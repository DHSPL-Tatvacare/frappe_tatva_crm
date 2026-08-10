import frappe
from frappe.model.delete_doc import get_dynamic_linked_docs
from frappe.tests.utils import FrappeTestCase

from crm.api.doc import get_linked_docs_of_document, remove_doc_link


class TestLinkedDocDelete(FrappeTestCase):
	"""TATVA: what the modal lists must be what `delete_doc` refuses, or the user is shown a dead end."""

	def setUp(self):
		self.lead = frappe.get_doc({"doctype": "CRM Lead", "first_name": "Linked Doc Delete"}).insert(
			ignore_permissions=True
		)
		self.call = frappe.get_doc(
			{
				"doctype": "CRM Call Log",
				"id": frappe.generate_hash(length=12),
				"telephony_medium": "Manual",
				"type": "Outgoing",
				"status": "Completed",
				"from": "unknown",
				"to": "unknown",
				"reference_doctype": "CRM Lead",
				"reference_docname": self.lead.name,
			}
		).insert(ignore_permissions=True)

	def _orphan(self):
		"""Leave a link row whose parent is gone — what a raw delete of the parent produces."""
		frappe.get_doc(
			{
				"doctype": "Dynamic Link",
				"parent": self.call.name,
				"parenttype": "CRM Call Log",
				"parentfield": "links",
				"link_doctype": "CRM Lead",
				"link_name": self.lead.name,
			}
		).insert(ignore_permissions=True)
		frappe.db.delete("CRM Call Log", {"name": self.call.name})

	def test_pre_check_reports_every_row_the_delete_gate_blocks_on(self):
		self._orphan()
		blocked = get_dynamic_linked_docs(self.lead)
		listed = {d["reference_docname"] for d in get_linked_docs_of_document("CRM Lead", self.lead.name)}
		self.assertTrue(blocked, "the gate must see the orphan, else this test proves nothing")
		for link in blocked:
			self.assertIn(
				link["reference_docname"],
				listed,
				"a row delete_doc refuses was hidden from the user",
			)

	def test_an_orphan_is_flagged_so_the_ui_can_offer_unlink(self):
		self._orphan()
		listed = get_linked_docs_of_document("CRM Lead", self.lead.name)
		self.assertTrue(any(d.get("orphaned") for d in listed))

	def test_unlinking_an_orphan_clears_it_and_frees_the_delete(self):
		self._orphan()
		remove_doc_link("CRM Call Log", self.call.name)
		self.assertEqual(get_dynamic_linked_docs(self.lead), [])
		self.assertEqual(get_linked_docs_of_document("CRM Lead", self.lead.name), [])

	def test_a_live_link_is_still_listed_and_still_blocks(self):
		listed = get_linked_docs_of_document("CRM Lead", self.lead.name)
		self.assertIn(self.call.name, {d["reference_docname"] for d in listed})
		self.assertFalse(any(d.get("orphaned") for d in listed))
