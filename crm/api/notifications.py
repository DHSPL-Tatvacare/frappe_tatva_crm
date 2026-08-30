import frappe
from frappe.query_builder import Order
from frappe.utils import cint

DOCTYPE = "CRM Notification"
EVENT = "crm_notification"


def unread_count(user: str | None = None) -> int:
	"""The unread total, as its own COUNT — never the length of a fetched page."""
	return frappe.db.count(DOCTYPE, {"to_user": user or frappe.session.user, "read": 0})


def publish_unread(user: str) -> None:
	"""Tell a user's open tabs their new unread total; carrying it means no listener has to refetch to update a badge."""
	frappe.publish_realtime(EVENT, {"unread": unread_count(user)}, user=user)


def _full_names(rows) -> dict:
	"""Sender display names for a whole page in one query — this was one `get_value` per row."""
	senders = {r.from_user for r in rows if r.from_user}
	if not senders:
		return {}
	return {
		u.name: u.full_name
		for u in frappe.get_all("User", filters={"name": ["in", list(senders)]}, fields=["name", "full_name"])
	}


@frappe.whitelist()
def get_notifications(limit: int = 50, start: int = 0):
	limit, start = cint(limit) or 50, cint(start)
	Notification = frappe.qb.DocType(DOCTYPE)
	query = (
		frappe.qb.from_(Notification)
		.select("*")
		.where(Notification.to_user == frappe.session.user)
		.orderby("creation", order=Order.desc)
		# One row past the page is how "is there more" is known without a second COUNT.
		.limit(limit + 1)
		.offset(start)
	)
	rows = query.run(as_dict=True)
	has_more = len(rows) > limit
	rows = rows[:limit]
	full_names = _full_names(rows)

	_notifications = []
	for notification in rows:
		_notifications.append(
			{
				"name": notification.name,
				"creation": notification.creation,
				"from_user": {
					"name": notification.from_user,
					"full_name": full_names.get(notification.from_user),
				},
				"type": notification.type,
				"to_user": notification.to_user,
				"read": notification.read,
				"hash": get_hash(notification),
				"notification_text": notification.notification_text,
				"notification_type_doctype": notification.notification_type_doctype,
				"notification_type_doc": notification.notification_type_doc,
				"reference_doctype": ("deal" if notification.reference_doctype == "CRM Deal" else "lead"),
				"reference_name": notification.reference_name,
				"route_name": ("Deal" if notification.reference_doctype == "CRM Deal" else "Lead"),
			}
		)

	return {"items": _notifications, "unread": unread_count(), "has_more": has_more}


@frappe.whitelist()
def mark_as_read(user: str | None = None, doc: str | None = None):
	"""Flip the whole set in ONE statement. It was a get_doc + save per row, so clearing a tray of 200 cost 200 saves and 200 realtime events."""
	user = user or frappe.session.user
	Notification = frappe.qb.DocType(DOCTYPE)
	query = (
		frappe.qb.update(Notification)
		.set(Notification.read, 1)
		.where(Notification.to_user == user)
		.where(Notification.read == 0)
	)
	if doc:
		# A row names its document as either the comment or the subject — the same OR the loop's or_filters expressed once.
		query = query.where((Notification.comment == doc) | (Notification.notification_type_doc == doc))
	query.run()
	frappe.db.commit()  # nosemgrep: the read receipt is the whole request; the event below must not describe an uncommitted state
	publish_unread(user)


def get_hash(notification):
	_hash = ""
	if notification.type == "Mention" and notification.notification_type_doc:
		_hash = "#" + notification.notification_type_doc

	if notification.type == "WhatsApp":
		_hash = "#whatsapp"

	if notification.type == "Assignment" and notification.notification_type_doctype == "CRM Task":
		_hash = "#tasks"
		if "has been removed by" in notification.message:
			_hash = ""
	return _hash
