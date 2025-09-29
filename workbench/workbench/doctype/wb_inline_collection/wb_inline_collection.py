# Copyright (c) 2024, Workbench and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class WBInlineCollection(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		block_id: DF.Data
		config_json: DF.LongText | None
		filters_json: DF.LongText | None
		modified: DF.Datetime | None
		modified_by: DF.Link | None
		owner: DF.Link | None
		page: DF.Link
		schema_json: DF.LongText | None
		sorts_json: DF.LongText | None
	# end: auto-generated types

	def validate(self):
		# Ensure block_id is unique per page
		if self.block_id:
			existing = frappe.get_all(
				"WB Inline Collection",
				filters={
					"page": self.page,
					"block_id": self.block_id,
					"name": ("!=", self.name)
				}
			)
			if existing:
				frappe.throw(f"Block ID '{self.block_id}' already exists for this page")

	def before_save(self):
		# Set default values for JSON fields if empty
		if not self.schema_json:
			self.schema_json = "{}"
		if not self.config_json:
			self.config_json = "{}"
		if not self.filters_json:
			self.filters_json = "[]"
		if not self.sorts_json:
			self.sorts_json = "[]"
