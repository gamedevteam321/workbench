# Copyright (c) 2024, Workbench and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import json


@frappe.whitelist()
def inline_col_upsert(page, block_id, schema=None, config=None, filters=None, sorts=None):
	"""Create or update an inline collection block"""
	
	# Debug logging
	frappe.log_error(f"inline_col_upsert called with page={page}, block_id={block_id}")
	
	# Check if page is provided
	if not page:
		frappe.throw("Page parameter is required")
	
	# Check if user has access to the page
	if not frappe.has_permission("Notion Page", "write", page):
		frappe.throw("You don't have permission to edit this page")
	
	# Try to get existing collection
	existing = frappe.get_all(
		"WB Inline Collection",
		filters={"page": page, "block_id": block_id},
		limit=1
	)
	
	# Use direct SQL operations to bypass validation entirely
	schema_json = json.dumps(schema) if isinstance(schema, dict) else (schema or "{}")
	config_json = json.dumps(config) if isinstance(config, dict) else (config or "{}")
	filters_json = json.dumps(filters) if isinstance(filters, list) else (filters or "[]")
	sorts_json = json.dumps(sorts) if isinstance(sorts, list) else (sorts or "[]")
	
	if existing:
		# Update existing collection
		collection_name = existing[0].name
		frappe.db.sql("""
			UPDATE `tabWB Inline Collection` 
			SET schema_json = %s, config_json = %s, filters_json = %s, sorts_json = %s, modified = NOW(), modified_by = %s
			WHERE name = %s
		""", (schema_json, config_json, filters_json, sorts_json, frappe.session.user, collection_name))
	else:
		# Create new collection
		collection_name = frappe.generate_hash(length=10)
		frappe.db.sql("""
			INSERT INTO `tabWB Inline Collection` 
			(name, page, block_id, schema_json, config_json, filters_json, sorts_json, creation, modified, owner, modified_by)
			VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW(), %s, %s)
		""", (collection_name, page, block_id, schema_json, config_json, filters_json, sorts_json, frappe.session.user, frappe.session.user))
	
	frappe.db.commit()
	
	return {
		"success": True,
		"collection": collection_name,
		"schema": json.loads(schema_json),
		"config": json.loads(config_json),
		"filters": json.loads(filters_json),
		"sorts": json.loads(sorts_json)
	}


@frappe.whitelist()
def inline_items_query(page, block_id, limit=100, offset=0):
	"""Query items for an inline collection"""
	
	# Skip permission check for temporary pages
	if not page.startswith('temp-page-'):
		# Check if user has access to the page
		if not frappe.has_permission("Notion Page", "read", page):
			frappe.throw("You don't have permission to read this page")
	
	# Get collection
	collection = frappe.get_all(
		"WB Inline Collection",
		filters={"page": page, "block_id": block_id},
		limit=1
	)
	
	if not collection:
		return {"success": True, "items": []}
	
	# Get items
	items = frappe.get_all(
		"WB Inline Item",
		filters={
			"collection": collection[0].name,
			"is_archived": 0
		},
		fields=["name", "props_json", "content_json", "position", "creation", "modified"],
		order_by="position asc, creation asc",
		limit=limit,
		start=offset
	)
	
	# Parse JSON fields
	for item in items:
		item["props"] = json.loads(item["props_json"] or "{}")
		item["content"] = json.loads(item["content_json"] or "{}")
		del item["props_json"]
		del item["content_json"]
	
	return {
		"success": True,
		"items": items
	}


@frappe.whitelist()
def inline_item_upsert(page, block_id, item):
	"""Create or update an inline item"""
	
	# Skip permission check for temporary pages
	if not page.startswith('temp-page-'):
		# Check if user has access to the page
		if not frappe.has_permission("Notion Page", "write", page):
			frappe.throw("You don't have permission to edit this page")
	
	# Parse item data
	if isinstance(item, str):
		item = json.loads(item)
	
	# Get collection
	collection = frappe.get_all(
		"WB Inline Collection",
		filters={"page": page, "block_id": block_id},
		limit=1
	)
	
	if not collection:
		frappe.throw("Collection not found")
	
	item_id = item.get("id")
	props = item.get("props", {})
	content = item.get("content", {})
	position = item.get("position", 0)
	
	# Use direct SQL operations to bypass validation entirely
	if item_id:
		# Update existing item
		frappe.db.sql("""
			UPDATE `tabWB Inline Item` 
			SET props_json = %s, content_json = %s, position = %s, is_archived = %s
			WHERE name = %s
		""", (json.dumps(props), json.dumps(content), position, 0, item_id))
		doc_name = item_id
	else:
		# Create new item with auto-generated ID
		doc_name = frappe.generate_hash(length=10)
		frappe.db.sql("""
			INSERT INTO `tabWB Inline Item` 
			(name, collection, props_json, content_json, position, is_archived, creation, modified, owner, modified_by)
			VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW(), %s, %s)
		""", (doc_name, collection[0].name, json.dumps(props), json.dumps(content), position, 0, frappe.session.user, frappe.session.user))
	
	# Commit the transaction
	frappe.db.commit()
	
	return {
		"success": True,
		"item": {
			"id": doc_name,
			"props": props,
			"content": content,
			"position": position
		}
	}


@frappe.whitelist()
def inline_item_delete(page, block_id, item_id):
	"""Delete an inline item"""
	
	# Skip permission check for temporary pages
	if not page.startswith('temp-page-'):
		# Check if user has access to the page
		if not frappe.has_permission("Notion Page", "write", page):
			frappe.throw("You don't have permission to edit this page")
	
	# Get collection
	collection = frappe.get_all(
		"WB Inline Collection",
		filters={"page": page, "block_id": block_id},
		limit=1
	)
	
	if not collection:
		frappe.throw("Collection not found")
	
	# Get item
	item = frappe.get_all(
		"WB Inline Item",
		filters={"collection": collection[0].name, "name": item_id},
		limit=1
	)
	
	if not item:
		frappe.throw("Item not found")
	
	# Delete item
	frappe.delete_doc("WB Inline Item", item[0].name)
	
	return {"success": True}


@frappe.whitelist()
def inline_item_get(page, block_id, item_id):
	"""Get a specific inline item with full data"""
	
	# Skip permission check for temporary pages
	if not page.startswith('temp-page-'):
		# Check if user has access to the page
		if not frappe.has_permission("Notion Page", "read", page):
			frappe.throw("You don't have permission to read this page")
	
	# Get collection
	collection = frappe.get_all(
		"WB Inline Collection",
		filters={"page": page, "block_id": block_id},
		limit=1
	)
	
	if not collection:
		frappe.throw("Collection not found")
	
	# Get item
	item = frappe.get_all(
		"WB Inline Item",
		filters={"collection": collection[0].name, "name": item_id},
		fields=["name", "props_json", "content_json", "position", "creation", "modified"],
		limit=1
	)
	
	if not item:
		frappe.throw("Item not found")
	
	item = item[0]
	item["props"] = json.loads(item["props_json"] or "{}")
	item["content"] = json.loads(item["content_json"] or "{}")
	del item["props_json"]
	del item["content_json"]
	
	return {
		"success": True,
		"item": item
	}


@frappe.whitelist()
def inline_item_save_body(page, block_id, item_id, content_json):
	"""Save the body content of an inline item"""
	
	# Skip permission check for temporary pages
	if not page.startswith('temp-page-'):
		# Check if user has access to the page
		if not frappe.has_permission("Notion Page", "write", page):
			frappe.throw("You don't have permission to edit this page")
	
	# Get collection
	collection = frappe.get_all(
		"WB Inline Collection",
		filters={"page": page, "block_id": block_id},
		limit=1
	)
	
	if not collection:
		frappe.throw("Collection not found")
	
	# Get item
	item = frappe.get_all(
		"WB Inline Item",
		filters={"collection": collection[0].name, "name": item_id},
		limit=1
	)
	
	if not item:
		frappe.throw("Item not found")
	
	# Update content using direct SQL to bypass validation
	content_json_str = content_json if isinstance(content_json, str) else json.dumps(content_json)
	frappe.db.sql("""
		UPDATE `tabWB Inline Item` 
		SET content_json = %s, modified = NOW(), modified_by = %s
		WHERE name = %s
	""", (content_json_str, frappe.session.user, item_id))
	frappe.db.commit()
	
	return {"success": True}


@frappe.whitelist()
def promote_collection(page, block_id):
	"""Promote an inline collection to a global database (future feature)"""
	
	# Check if user has access to the page
	if not frappe.has_permission("Notion Page", "write", page):
		frappe.throw("You don't have permission to edit this page")
	
	# This is a placeholder for future functionality
	# For now, just return success
	return {
		"success": True,
		"message": "Promotion to global database not yet implemented"
	}


@frappe.whitelist()
def delete_page_collections(page):
	"""Delete all collections and items for a specific page"""
	try:
		# Get all collections for this page
		collections = frappe.get_all(
			"WB Inline Collection",
			filters={"page": page}
		)
		
		frappe.log_error(f"Found {len(collections)} collections for page {page}: {[c.name for c in collections]}")
		
		deleted_collections = 0
		deleted_items = 0
		
		for collection in collections:
			# Delete all items in this collection using direct SQL
			items = frappe.get_all(
				"WB Inline Item",
				filters={"collection": collection.name}
			)
			
			frappe.log_error(f"Found {len(items)} items in collection {collection.name}")
			
			# Delete items using direct SQL to bypass validation
			if items:
				item_names = [item.name for item in items]
				frappe.db.sql("DELETE FROM `tabWB Inline Item` WHERE name IN %s", (item_names,))
				deleted_items += len(items)
				frappe.log_error(f"Deleted {len(items)} items using direct SQL")
			
			# Delete the collection using direct SQL
			try:
				frappe.db.sql("DELETE FROM `tabWB Inline Collection` WHERE name = %s", (collection.name,))
				deleted_collections += 1
				frappe.log_error(f"Deleted collection {collection.name} using direct SQL")
			except Exception as collection_error:
				frappe.log_error(f"Error deleting collection {collection.name}: {str(collection_error)}")
		
		frappe.db.commit()
		
		return {
			"success": True,
			"message": f"Deleted {deleted_collections} collections and {deleted_items} items for page {page}",
			"deleted_collections": deleted_collections,
			"deleted_items": deleted_items
		}
	except Exception as e:
		frappe.log_error(f"Error deleting page collections: {str(e)}")
		return {
			"success": False,
			"error": str(e)
		}

def cleanup_collection_items(doc, method):
	"""Clean up items when a collection is deleted"""
	
	# Delete all items in this collection
	items = frappe.get_all(
		"WB Inline Item",
		filters={"collection": doc.name}
	)
	
	for item in items:
		frappe.delete_doc("WB Inline Item", item.name)
