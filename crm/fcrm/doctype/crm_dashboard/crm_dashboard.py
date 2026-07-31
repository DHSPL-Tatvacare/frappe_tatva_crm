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

	# TATVA: nothing reads this after the role-driven dashboard shipped — the SPA calls
	# tatva_connect.dashboard.api.get_dashboard, which resolves a layout from the caller's own roles.
	# The lead/task cards that were dispatched from crm.api.dashboard are gone with their shims; what
	# remains are the fork's own deal charts, kept only so this inert default still parses.
	"""

	def item(name, type, x, y, w, h, tooltip=None):
		it = {"name": name, "type": type, "layout": {"x": x, "y": y, "w": w, "h": h, "i": name}}
		if tooltip:
			it["tooltip"] = tooltip
		return it

	# Every row spans the full 20 cols with no trailing gap, so the grid's vertical compaction can't
	# float a right-column card up beside a half-empty row above it.
	layout = [
		item("total_leads", "number_chart", 0, 0, 10, 3, "Total number of leads"),
		item("average_time_to_close_a_lead", "number_chart", 10, 0, 10, 3, "Average time taken to close a lead"),
		item("leads_by_source", "donut_chart", 0, 3, 20, 9),
		# TREND
		item("sales_trend", "axis_chart", 0, 12, 20, 9),
		# DEALS
		item("ongoing_deals", "number_chart", 0, 21, 7, 3, "Total number of ongoing deals"),
		item("won_deals", "number_chart", 7, 21, 7, 3, "Total number of won deals"),
		item("average_won_deal_value", "number_chart", 14, 21, 6, 3, "Average value of won deals"),
		item("deals_by_stage_donut", "donut_chart", 0, 24, 10, 9),
		item("deals_by_source", "donut_chart", 10, 24, 10, 9),
		item("deals_by_salesperson", "axis_chart", 0, 33, 10, 9),
		item("lost_deal_reasons", "axis_chart", 10, 33, 10, 9),
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
