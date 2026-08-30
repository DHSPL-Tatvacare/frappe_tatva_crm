# Copyright (c) 2024, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CRMNotification(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		comment: DF.Link | None
		from_user: DF.Link | None
		message: DF.HTMLEditor | None
		notification_text: DF.Text | None
		notification_type_doc: DF.DynamicLink | None
		notification_type_doctype: DF.Link | None
		read: DF.Check
		reference_doctype: DF.Link | None
		reference_name: DF.DynamicLink | None
		to_user: DF.Link
		type: DF.Literal["Mention", "Task", "Assignment", "WhatsApp"]
	# end: auto-generated types

	def on_update(self):
		if self.to_user:
			from crm.api.notifications import publish_unread

			# One event shape everywhere: it carries the new unread total, so a listener updates its badge without refetching.
			publish_unread(self.to_user)


def on_doctype_update():
	# Every tray read filters on exactly this pair; without it each one is a full table scan.
	# `read` is a MariaDB reserved word and add_index joins fields unquoted, so it is quoted here and the index named explicitly (the derived name would carry the backticks).
	frappe.db.add_index("CRM Notification", ["to_user", "`read`"], index_name="to_user_read_index")


def notify_user(notification):
	"""
	Notify the assigned user
	"""
	notification = frappe._dict(notification)
	if notification.owner == notification.assigned_to:
		return

	values = frappe._dict(
		doctype="CRM Notification",
		from_user=notification.owner,
		to_user=notification.assigned_to,
		type=notification.notification_type,
		message=notification.message,
		notification_text=notification.notification_text,
		notification_type_doctype=notification.reference_doctype,
		notification_type_doc=notification.reference_docname,
		reference_doctype=notification.redirect_to_doctype,
		reference_name=notification.redirect_to_docname,
	)

	# `values` carries `doctype` for get_doc; passing it as a FILTER made exists() query a column that does not exist, and exists() swallows that error (get_value ignore=True) and answers None — so the de-dupe never once fired.
	if frappe.db.exists("CRM Notification", {k: v for k, v in values.items() if k != "doctype"}):
		return
	frappe.get_doc(values).insert(ignore_permissions=True)
