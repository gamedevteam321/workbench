import frappe

def get_context(context):
    # require login to access
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/workbench"
        raise frappe.Redirect

    context.no_cache = 1
    context.title = "Workbench"
    return context
