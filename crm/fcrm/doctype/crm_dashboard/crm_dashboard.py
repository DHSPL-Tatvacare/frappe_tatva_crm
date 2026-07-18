# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import json

import frappe
from frappe.model.document import Document


class CRMDashboard(Document):
	pass


def default_manager_dashboard_layout():
	"""
	Returns the default layout for the CRM Manager Dashboard.

	# TATVA: reshaped for the ops motion — LEADS on top (grain-scoped stage/sub-stage funnel), a
	# full-width trend divider, DEALS at the end. Generic global-SaaS cards (territory, forecast,
	# blended avg deal value, deal-close time) dropped. Grain charts live in
	# tatva_connect.dashboard.grain_charts (dispatched via the get_leads_by_* shims in crm.api.dashboard).
	"""

	def item(name, type, x, y, w, h, tooltip=None):
		it = {"name": name, "type": type, "layout": {"x": x, "y": y, "w": w, "h": h, "i": name}}
		if tooltip:
			it["tooltip"] = tooltip
		return it

	# Every row spans the full 20 cols with no trailing gap, so the grid's vertical compaction can't
	# float a right-column card up beside a half-empty row above it.
	layout = [
		# KPIs — leads + tasks (LeadSquared "Sales Productivity" style)
		item("total_leads", "number_chart", 0, 0, 4, 3, "Total number of leads"),
		item("total_tasks", "number_chart", 4, 0, 4, 3, "All tasks"),
		item("pending_tasks", "number_chart", 8, 0, 4, 3, "Tasks not yet completed"),
		item("overdue_tasks", "number_chart", 12, 0, 4, 3, "Pending tasks past their due date"),
		item("completed_tasks", "number_chart", 16, 0, 4, 3, "Tasks marked done"),
		item("tasks_due_today", "number_chart", 0, 3, 10, 3, "Pending tasks due today"),
		item("average_time_to_close_a_lead", "number_chart", 10, 3, 10, 3, "Average time taken to close a lead"),
		# LEADS — distribution (Source + Owner), then Product Line + Tasks by Owner
		item("leads_by_source", "donut_chart", 0, 6, 10, 9),
		item("leads_by_owner", "donut_chart", 10, 6, 10, 9),
		item("leads_by_vertical", "donut_chart", 0, 15, 10, 9),
		item("tasks_by_owner", "axis_chart", 10, 15, 10, 9),
		# PIPELINE — grain-scoped stage / sub-stage funnel
		item("leads_by_stage", "axis_chart", 0, 24, 10, 9),
		item("leads_by_substage", "axis_chart", 10, 24, 10, 9),
		# TREND
		item("sales_trend", "axis_chart", 0, 33, 20, 9),
		# DEALS
		item("ongoing_deals", "number_chart", 0, 42, 7, 3, "Total number of ongoing deals"),
		item("won_deals", "number_chart", 7, 42, 7, 3, "Total number of won deals"),
		item("average_won_deal_value", "number_chart", 14, 42, 6, 3, "Average value of won deals"),
		item("deals_by_stage_donut", "donut_chart", 0, 45, 10, 9),
		item("deals_by_source", "donut_chart", 10, 45, 10, 9),
		item("deals_by_salesperson", "axis_chart", 0, 54, 10, 9),
		item("lost_deal_reasons", "axis_chart", 10, 54, 10, 9),
	]
	return json.dumps(layout)


def create_default_manager_dashboard(force=False):
	"""
	Creates the default CRM Manager Dashboard if it does not exist.
	"""
	if not frappe.db.exists("CRM Dashboard", "Manager Dashboard"):
		doc = frappe.new_doc("CRM Dashboard")
		doc.title = "Manager Dashboard"
		doc.layout = default_manager_dashboard_layout()
		doc.insert(ignore_permissions=True)
	else:
		doc = frappe.get_doc("CRM Dashboard", "Manager Dashboard")
		if force:
			doc.layout = default_manager_dashboard_layout()
			doc.save(ignore_permissions=True)
	return doc.layout
