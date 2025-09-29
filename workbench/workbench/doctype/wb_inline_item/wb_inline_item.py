# Copyright (c) 2024, Workbench and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class WBInlineItem(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		collection: DF.Link
		content_json: DF.LongText | None
		is_archived: DF.Check
		modified: DF.Datetime | None
		modified_by: DF.Link | None
		owner: DF.Link | None
		position: DF.Float
		props_json: DF.LongText | None
	# end: auto-generated types

	def validate(self):
		# Skip validation entirely for temporary pages
		if self.collection:
			try:
				collection = frappe.get_doc("WB Inline Collection", self.collection)
				# Skip all validation for temporary pages
				if collection.page.startswith('temp-page-'):
					return
			except frappe.DoesNotExistError:
				# Collection doesn't exist, skip validation
				return
		
		# Only validate for real pages
		if self.collection:
			try:
				collection = frappe.get_doc("WB Inline Collection", self.collection)
				# Check if user has access to the page
				try:
					page = frappe.get_doc("Notion Page", collection.page)
					if not frappe.has_permission("Notion Page", "read", page.name):
						frappe.throw("You don't have permission to access this collection")
				except frappe.DoesNotExistError:
					# Page doesn't exist, skip validation
					pass
			except frappe.DoesNotExistError:
				# Collection doesn't exist, skip validation
				pass

	def before_save(self):
		# Set default values for JSON fields if empty
		if not self.props_json:
			self.props_json = "{}"
		if not self.content_json:
			self.content_json = "{}"
		if self.position is None:
			self.position = 0
