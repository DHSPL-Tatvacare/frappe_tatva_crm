# Copyright (c) 2024, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt
"""The tray's read, clear and write paths.

Each case here is one a rep felt: a clear that cost one document save per row, a badge that would start
under-reporting the moment the read was paged, and a de-dupe that never once fired.
"""

import frappe
from frappe.tests.utils import FrappeTestCase

from crm.api.notifications import get_notifications, mark_as_read, unread_count
from crm.fcrm.doctype.crm_notification.crm_notification import notify_user

TO_USER = "tray-reader@example.com"
FROM_USER = "tray-writer@example.com"


def _user(email):
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{"doctype": "User", "email": email, "first_name": email.split("@")[0], "send_welcome_email": 0}
		).insert(ignore_permissions=True)
	return email


def _rows(count, read=0):
	for i in range(count):
		frappe.get_doc(
			{
				"doctype": "CRM Notification",
				"from_user": FROM_USER,
				"to_user": TO_USER,
				"type": "Assignment",
				"read": read,
				"notification_text": f"row {i}",
			}
		).insert(ignore_permissions=True)


class TestCRMNotification(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		_user(TO_USER)
		_user(FROM_USER)

	def setUp(self):
		frappe.db.delete("CRM Notification", {"to_user": TO_USER})

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.delete("CRM Notification", {"to_user": TO_USER})

	def test_mark_as_read_clears_the_whole_tray(self):
		_rows(25)
		mark_as_read(user=TO_USER)
		self.assertEqual(unread_count(TO_USER), 0)

	def test_mark_as_read_is_a_receipt_and_does_not_edit_the_row(self):
		# CHANGED 2026-08-30: was get_doc + save per row, which bumped `modified` and fired one realtime event each — clearing 200 cost 200 saves and 200 pushes.
		_rows(3)
		before = frappe.get_all("CRM Notification", filters={"to_user": TO_USER}, fields=["name", "modified"])
		mark_as_read(user=TO_USER)
		for row in before:
			self.assertEqual(
				frappe.db.get_value("CRM Notification", row.name, "modified"),
				row.modified,
				"a read receipt must not rewrite the row's modified stamp",
			)

	def test_mark_as_read_for_one_document_leaves_the_rest_unread(self):
		_rows(2)
		target = frappe.get_all("CRM Notification", filters={"to_user": TO_USER}, pluck="name")[0]
		frappe.db.set_value("CRM Notification", target, "notification_type_doc", "CRM-LEAD-X", update_modified=False)
		mark_as_read(user=TO_USER, doc="CRM-LEAD-X")
		self.assertEqual(unread_count(TO_USER), 1)

	def test_the_page_is_bounded_and_says_so(self):
		_rows(12)
		frappe.set_user(TO_USER)
		result = get_notifications(limit=5)
		self.assertEqual(len(result["items"]), 5)
		self.assertTrue(result["has_more"])

	def test_the_unread_total_counts_the_tray_not_the_page(self):
		# The badge derived its number from the fetched list; a page of 5 would have reported 5 unread out of 12.
		_rows(12)
		frappe.set_user(TO_USER)
		self.assertEqual(get_notifications(limit=5)["unread"], 12)

	def test_a_row_carries_its_own_name(self):
		# The tray keys its list on this; `comment` is null on every non-Mention row, so they all collided on one key.
		_rows(1)
		frappe.set_user(TO_USER)
		self.assertTrue(get_notifications()["items"][0]["name"])

	def test_notify_user_writes_one_row_for_one_event(self):
		# CHANGED 2026-08-30: was two. The de-dupe passed `doctype` as a FILTER, so exists() queried a column that does not exist and answered None through get_value's ignore=True.
		payload = {
			"owner": FROM_USER,
			"assigned_to": TO_USER,
			"notification_type": "Assignment",
			"message": "same event",
			"notification_text": "same event",
			# A real link on both dynamic pairs — the row is link-validated on insert, and inventing a docname fails before the de-dupe is ever reached.
			"reference_doctype": "User",
			"reference_docname": TO_USER,
			"redirect_to_doctype": "User",
			"redirect_to_docname": TO_USER,
		}
		notify_user(payload)
		notify_user(payload)
		self.assertEqual(frappe.db.count("CRM Notification", {"to_user": TO_USER}), 1)
