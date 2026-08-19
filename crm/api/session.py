import frappe
from frappe import _
from frappe.permissions import ALL_USER_ROLE, AUTOMATIC_ROLES, GUEST_ROLE, SYSTEM_USER_ROLE

CRM_ALLOWED_ROLES = ["System Manager", "Sales Manager", "Sales User"]


def get_session_role_flags():
	roles = set(frappe.get_roles())

	if not roles.intersection(set(CRM_ALLOWED_ROLES)):
		frappe.throw(_("You are not permitted to access CRM resources."), frappe.PermissionError)

	return {
		"is_system_manager": "System Manager" in roles,
		"is_sales_manager": "Sales Manager" in roles and "System Manager" not in roles,
		"is_sales_user": "Sales User" in roles
		and "Sales Manager" not in roles
		and "System Manager" not in roles,
	}


@frappe.whitelist()
def get_users():
	session_roles = get_session_role_flags()

	users = frappe.qb.get_query(
		"User",
		fields=[
			"name",
			"email",
			"enabled",
			"user_image",
			"first_name",
			"last_name",
			"full_name",
			"user_type",
			"language",
		],
		order_by="full_name asc",
		distinct=True,
		filters={"enabled": 1},
	).run(as_dict=1)

	# One query each for the whole roster. Both lookups below are per-user by construction, and this
	# endpoint runs them once per enabled user on every page load.
	roles_by_user = _roles_by_user(users)
	telephony_agents = _telephony_agents()

	crm_users = []
	system_language = frappe.db.get_single_value("System Settings", "language")

	for user in users:
		if frappe.session.user == user.name:
			user.session_user = True

		user.roles = roles_by_user[user.name]

		user.role = ""

		if "System Manager" in user.roles:
			user.role = "System Manager"
		elif "Sales Manager" in user.roles:
			user.role = "Sales Manager"
		elif "Sales User" in user.roles:
			user.role = "Sales User"
		elif "Guest" in user.roles:
			user.role = "Guest"

		if frappe.session.user == user.name:
			user.session_user = True

		user.is_telephony_agent = telephony_agents.get(user.name)
		user.language = user.language or system_language

		if user.role in ("System Manager", "Sales Manager", "Sales User"):
			crm_users.append(user)

	if not session_roles["is_system_manager"]:
		users = crm_users

	return users, crm_users


def _roles_by_user(users):
	"""`frappe.get_roles` for a whole roster, in one query.

	Same answer, same rules: this mirrors `frappe.permissions.get_roles` (permissions.py:541-561) — the
	same `Has Role` filter, the same two automatic roles appended, `Desk User` for a System User, every
	Role for Administrator, and `Guest` alone for Guest.

	It is mirrored rather than called because that function resolves one user at a time, and answers
	`is_system_user` through `get_cached_doc`, which loads the entire User document and all eleven of its
	child tables. Over an enabled roster that was 4,421 queries on a cold cache. `user_type` is already
	on the row this endpoint selected, so the same question is answered without reading anything."""
	table = frappe.qb.DocType("Has Role")
	granted = {}
	for row in (
		frappe.qb.from_(table)
		.select(table.parent, table.role)
		.where(
			(table.parenttype == "User")
			& (table.parent.isin([u.name for u in users]))
			& (table.role.notin(AUTOMATIC_ROLES))
		)
		.run(as_dict=True)
	):
		granted.setdefault(row.parent, []).append(row.role)

	roles_by_user = {}
	for user in users:
		if user.name == "Guest":
			roles_by_user[user.name] = [GUEST_ROLE]
		elif user.name == "Administrator":
			roles_by_user[user.name] = frappe.get_all("Role", pluck="name")
		else:
			roles = granted.get(user.name, []) + [ALL_USER_ROLE, GUEST_ROLE]
			if user.user_type == "System User":
				roles.append(SYSTEM_USER_ROLE)
			roles_by_user[user.name] = roles
	return roles_by_user


def _telephony_agents():
	"""`{user: agent name}` for every agent — the value `frappe.db.exists` returned, asked once."""
	agents = frappe.get_all("CRM Telephony Agent", fields=["name", "user"], limit_page_length=0)
	return {agent.user: agent.name for agent in agents}


@frappe.whitelist()
def get_organizations():
	get_session_role_flags()

	organizations = frappe.qb.get_query(
		"CRM Organization",
		fields=["*"],
		order_by="name asc",
		distinct=True,
	).run(as_dict=1)

	return organizations
