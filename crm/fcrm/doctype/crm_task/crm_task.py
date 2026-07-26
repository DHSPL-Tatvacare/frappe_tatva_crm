# Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from frappe.desk.form.assign_to import add as assign
from frappe.desk.form.assign_to import remove as unassign
from frappe.model.document import Document


class CRMTask(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		assigned_to: DF.Link | None
		description: DF.TextEditor | None
		due_date: DF.Datetime | None
		name: DF.Int | None
		priority: DF.Literal["Low", "Medium", "High"]
		reference_docname: DF.DynamicLink | None
		reference_doctype: DF.Link | None
		start_date: DF.Date | None
		status: DF.Literal["Backlog", "Todo", "In Progress", "Done", "Canceled"]
		title: DF.Data
	# end: auto-generated types

	def after_insert(self):
		self.assign_to()

	def validate(self):
		if self.is_new() or not self.assigned_to:
			return

		if self.get_doc_before_save().assigned_to != self.assigned_to:
			self.unassign_from_previous_user(self.get_doc_before_save().assigned_to)
			self.assign_to()

	def unassign_from_previous_user(self, user: str | None):
		if user:
			unassign(self.doctype, self.name, user)

	def assign_to(self):
		if self.assigned_to:
			assign(
				{
					"assign_to": [self.assigned_to],
					"doctype": self.doctype,
					"name": self.name,
					"description": self.title or self.description,
				}
			)

	@staticmethod
	def default_list_data():
		columns = [
			{"label": "Task ID", "type": "Data", "key": "name", "width": "10rem"},
			{"label": "Lead ID", "type": "Dynamic Link", "key": "reference_docname", "options": "reference_doctype", "width": "11rem"},
			{"label": "Title", "type": "Data", "key": "title", "width": "16rem"},
			{"label": "Task Type", "type": "Link", "key": "custom_task_type", "options": "CRM Task Type", "width": "10rem"},
			{"label": "Status", "type": "Select", "key": "status", "width": "8rem"},
			{"label": "Priority", "type": "Select", "key": "priority", "width": "8rem"},
			{"label": "Due Date", "type": "Datetime", "key": "due_date", "width": "9rem"},
			{"label": "Assigned To", "type": "Link", "key": "assigned_to", "options": "User", "width": "10rem"},
			{"label": "Completed On", "type": "Date", "key": "custom_completed_on", "width": "9rem"},
			{"label": "Created On", "type": "Datetime", "key": "creation", "width": "9rem"},
			{"label": "Modified On", "type": "Datetime", "key": "modified", "width": "9rem"},
		]

		# TATVA: the ONE declaration of the rep-facing field set — filter, group-by, sort and the column picker all resolve through it (tatva_connect/api/task_lenses.py).
		rows = [
			"name", "reference_doctype", "reference_docname", "title", "custom_task_type",
			"status", "priority", "due_date", "start_date", "assigned_to", "custom_completed_on",
			"custom_outcome", "custom_followup_at", "custom_scheduled_at",
			"creation", "modified", "description",
		]
		return {"columns": columns, "rows": rows}

	@staticmethod
	def default_kanban_settings():
		return {
			"column_field": "status",
			"title_field": "title",
			"kanban_fields": '["description", "priority", "creation"]',
		}
