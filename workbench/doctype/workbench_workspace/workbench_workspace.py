import frappe
from frappe.model.document import Document

class WorkbenchWorkspace(Document):
    def before_save(self):
        if not self.owner:
            self.owner = frappe.session.user
