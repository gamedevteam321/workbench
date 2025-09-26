import uuid
import json
import time
import frappe
from frappe.utils import now

@frappe.whitelist()
def get_user_workspaces():
    """Get all workspaces accessible to the current user."""
    user = frappe.session.user
    
    # Get workspaces where user is owner
    owned_workspaces = frappe.get_all(
        "Workbench Workspace",
        filters={"owner_user": user},
        fields=["name", "title", "description", "visibility", "company", "creation", "modified"],
        order_by="modified desc",
    )
    
    # Get workspaces where user is collaborator
    collaborator_workspaces = frappe.get_all(
        "Workbench Workspace Collaborator",
        filters={"user": user},
        fields=["parent as name"],
    )
    
    if collaborator_workspaces:
        collab_names = [c.name for c in collaborator_workspaces]
        collab_workspaces = frappe.get_all(
            "Workbench Workspace",
            filters={"name": ["in", collab_names]},
            fields=["name", "title", "description", "visibility", "company", "creation", "modified"],
            order_by="modified desc",
        )
    else:
        collab_workspaces = []
    
    # Get company workspaces (if user has company)
    company_workspaces = []
    user_company = frappe.db.get_value("User", user, "company") or frappe.db.get_default("company")
    if user_company:
        company_workspaces = frappe.get_all(
            "Workbench Workspace",
            filters={"visibility": "Company", "company": user_company},
            fields=["name", "title", "description", "visibility", "company", "creation", "modified"],
            order_by="modified desc",
        )
    
    # Combine and deduplicate
    all_workspaces = owned_workspaces + collab_workspaces + company_workspaces
    seen = set()
    result = []
    
    for ws in all_workspaces:
        if ws.name not in seen:
            seen.add(ws.name)
            result.append(ws)
    
    return result

@frappe.whitelist()
def create_workspace(title: str = "New Workspace", description: str = "", visibility: str = "Private", company: str = None, collaborators=None):
    """Create a new workspace with visibility/collaborators for the current user."""
    if isinstance(collaborators, str):
        try:
            collaborators = frappe.parse_json(collaborators)
        except Exception:
            collaborators = None

    workspace = frappe.get_doc({
        "doctype": "Workbench Workspace",
        "title": title,
        "description": description,
        "owner_user": frappe.session.user,
        "visibility": visibility,
        "company": company,
    })
    
    if collaborators:
        for c in collaborators:
            user_id = c.get("user")
            # Validate that the user exists
            if not frappe.db.exists("User", user_id):
                frappe.throw(f"User {user_id} does not exist")
            workspace.append("collaborators", {
                "user": user_id,
                "access": c.get("access", "Viewer"),
            })
    
    workspace.insert()

    # Create a default "Getting Started" page
    create_page(workspace.name, "Getting Started", get_default_page_content())

    return workspace.name

def get_default_page_content():
    """Return default page content for new workspaces."""
    return {
        "blocks": [
            {
                "id": f"block-{int(time.time())}",
                "type": "heading1",
                "content": "Welcome to your new workspace!",
                "level": 1
            },
            {
                "id": f"block-{int(time.time()) + 1}",
                "type": "paragraph",
                "content": "This is your first page. You can start typing here or use the '/' command to add different types of content blocks.",
                "level": 1
            },
            {
                "id": f"block-{int(time.time()) + 2}",
                "type": "paragraph",
                "content": "Try typing '/' to see all available block types!",
                "level": 1
            }
        ]
    }

@frappe.whitelist()
def get_workspace_pages(workspace):
    """Get all pages for a workspace with proper visibility filtering."""
    user = frappe.session.user
    
    # Filter pages based on per-page visibility logic
    all_pages = frappe.get_all(
        "Notion Page",
        filters={"workspace": workspace, "is_archived": 0},
        fields=["name", "title", "page_order", "last_edited_date", "last_edited_by", "visibility", "company", "created_by"],
        order_by="page_order asc, creation asc",
    )
    
    pages = []
    ws = frappe.get_doc("Workbench Workspace", workspace)
    
    for p in all_pages:
        if p.visibility == "Use Workspace":
            if has_workspace_access(ws, user, write=False):
                pages.append({k: p.get(k) for k in ["name", "title", "page_order", "last_edited_date", "last_edited_by", "visibility"]})
        elif p.visibility == "Private":
            if p.created_by == user:
                pages.append({k: p.get(k) for k in ["name", "title", "page_order", "last_edited_date", "last_edited_by", "visibility"]})
        elif p.visibility == "Company":
            user_company = frappe.db.get_value("User", user, "company") or frappe.db.get_default("company")
            if user_company and user_company == (p.company or frappe.db.get_default("company")):
                pages.append({k: p.get(k) for k in ["name", "title", "page_order", "last_edited_date", "last_edited_by", "visibility"]})
        elif p.visibility == "Specific Users":
            is_collab = frappe.db.exists("Workbench Page Collaborator", {"parent": p.name, "user": user})
            if is_collab:
                pages.append({k: p.get(k) for k in ["name", "title", "page_order", "last_edited_date", "last_edited_by", "visibility"]})
    
    return pages

def has_workspace_access(workspace, user, write=False):
    """Check if user has access to workspace."""
    # Owner always has access
    if workspace.owner_user == user:
        return True
    
    # Check if user is collaborator
    if write:
        collab = frappe.db.exists("Workbench Workspace Collaborator", {"parent": workspace.name, "user": user, "access": "Editor"})
    else:
        collab = frappe.db.exists("Workbench Workspace Collaborator", {"parent": workspace.name, "user": user})
    
    if collab:
        return True
    
    # Check company access
    if workspace.visibility == "Company":
        user_company = frappe.db.get_value("User", user, "company") or frappe.db.get_default("company")
        if user_company and user_company == workspace.company:
            return True
    
    return False

@frappe.whitelist()
def get_page(name: str):
    doc = frappe.get_doc("Notion Page", name)
    frappe.only_for(["System Manager", "All"])  # simplistic demo
    return {
        "name": doc.name,
        "title": doc.title,
        "content_json": doc.content_json or "",
        "is_archived": doc.is_archived,
        "modified": doc.modified,
    }

@frappe.whitelist()
def create_page(workspace: str, title: str = "Untitled", content_json=None, visibility: str = "Use Workspace", company: str = None, collaborators=None):
    """Create a new page in a workspace."""
    # Check workspace access
    ws = frappe.get_doc("Workbench Workspace", workspace)
    if not has_workspace_access(ws, frappe.session.user, write=True):
        frappe.throw("You don't have permission to create pages in this workspace")
    
    if isinstance(collaborators, str):
        try:
            collaborators = frappe.parse_json(collaborators)
        except Exception:
            collaborators = None
    
    # Ensure unique title within workspace
    base_title = title or "Untitled"
    final_title = base_title
    counter = 1
    
    while frappe.db.exists("Notion Page", {"title": final_title, "workspace": workspace}):
        final_title = f"{base_title} {counter}"
        counter += 1
        if counter > 1000:
            final_title = f"{base_title} {int(time.time())}"
            break
    
    # Get next page order
    max_order = frappe.db.sql("SELECT MAX(page_order) FROM `tabNotion Page` WHERE workspace = %s", (workspace,))
    next_order = (max_order[0][0] or 0) + 1
    
    # Default content if not provided
    if not content_json:
        content_json = {
            "blocks": [
                {"id": str(uuid.uuid4()), "type": "paragraph", "content": ""}
            ]
        }
    
    # Create page
    doc = frappe.get_doc({
        "doctype": "Notion Page",
        "workspace": workspace,
        "title": final_title,
        "page_order": next_order,
        "visibility": visibility,
        "company": company,
        "content_json": json.dumps(content_json) if isinstance(content_json, dict) else content_json,
        "created_by": frappe.session.user,
        "last_edited_by": frappe.session.user,
    })
    
    if collaborators:
        for c in collaborators:
            user_id = c.get("user")
            if not frappe.db.exists("User", user_id):
                frappe.throw(f"User {user_id} does not exist")
            doc.append("collaborators", {
                "user": user_id,
                "access": c.get("access", "Viewer"),
            })
    
    doc.insert()
    frappe.db.commit()
    
    return {"name": doc.name, "title": doc.title, "workspace": workspace}

@frappe.whitelist()
def update_page(name: str, title: str = None, content_json: str = None):
    frappe.only_for(["System Manager", "All"])  # demo
    doc = frappe.get_doc("Notion Page", name)
    
    if title is not None:
        new_title = title or "Untitled"
        # Check if title is changing and if new title already exists
        if new_title != doc.title and frappe.db.exists("Notion Page", new_title):
            # Make title unique
            base_title = new_title
            counter = 1
            while frappe.db.exists("Notion Page", f"{base_title} {counter}"):
                counter += 1
            new_title = f"{base_title} {counter}"
        doc.title = new_title
    
    if content_json is not None:
        # basic sanity check
        try:
            parsed = json.loads(content_json)
            assert isinstance(parsed, dict)
        except Exception:
            frappe.throw("Invalid content_json")
        doc.content_json = content_json
    
    # Ensure title is never empty
    if not doc.title or doc.title.strip() == "":
        doc.title = "Untitled"
    
    doc.save()
    frappe.db.commit()
    return {"ok": True, "modified": now()}

@frappe.whitelist()
def delete_page(name: str, hard: int = 0):
    frappe.only_for(["System Manager", "All"])  # demo
    if int(hard):
        frappe.delete_doc("Notion Page", name)
    else:
        frappe.db.set_value("Notion Page", name, "is_archived", 1)
    frappe.db.commit()
    return {"ok": True}

@frappe.whitelist()
def get_backlinks(name: str):
    """Get pages that link to this page."""
    frappe.only_for(["System Manager", "All"])
    
    # Get all pages
    pages = frappe.get_all(
        "Notion Page",
        filters={"is_archived": 0},
        fields=["name", "title", "content_json"],
    )
    
    backlinks = []
    for page in pages:
        try:
            if page.content_json:
                content = json.loads(page.content_json)
                if isinstance(content, dict) and "blocks" in content:
                    for block in content["blocks"]:
                        text = block.get("text", "") or ""
                        # Simple backlink detection - look for page name in content
                        if name in text or page.name in text:
                            backlinks.append({
                                "name": page.name,
                                "title": page.title,
                                "modified": page.modified
                            })
                            break
        except:
            pass
    
    return backlinks

@frappe.whitelist()
def get_comments(page_name: str):
    """Get comments for a page."""
    frappe.only_for(["System Manager", "All"])
    
    comments = frappe.get_all(
        "Notion Comment",
        filters={"page_name": page_name, "is_resolved": 0},
        fields=["name", "block_id", "comment_text", "author", "creation", "modified"],
        order_by="creation asc"
    )
    
    return comments

@frappe.whitelist()
def add_comment(page_name: str, block_id: str = "", comment_text: str = ""):
    """Add a comment to a page or block."""
    frappe.only_for(["System Manager", "All"])
    
    doc = frappe.get_doc({
        "doctype": "Notion Comment",
        "page_name": page_name,
        "block_id": block_id,
        "comment_text": comment_text,
        "author": frappe.session.user
    }).insert()
    
    frappe.db.commit()
    return {"name": doc.name, "creation": doc.creation}

@frappe.whitelist()
def resolve_comment(comment_name: str):
    """Mark a comment as resolved."""
    frappe.only_for(["System Manager", "All"])
    
    frappe.db.set_value("Notion Comment", comment_name, "is_resolved", 1)
    frappe.db.commit()
    return {"ok": True}

@frappe.whitelist()
def delete_page(name: str, hard: int = 0):
    """Delete a page (soft delete by default)."""
    frappe.only_for(["System Manager", "All"])
    
    if int(hard):
        frappe.delete_doc("Notion Page", name)
    else:
        frappe.db.set_value("Notion Page", name, "is_archived", 1)
    frappe.db.commit()
    return {"ok": True}

@frappe.whitelist()
def move_page_to_workspace(page_name: str, workspace_name: str):
    """Move a page to a different workspace."""
    frappe.only_for(["System Manager", "All"])
    
    try:
        # Update the page's workspace field
        frappe.db.set_value("Notion Page", page_name, "workspace", workspace_name)
        frappe.db.commit()
        return {"ok": True, "message": f"Page moved to workspace {workspace_name}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@frappe.whitelist()
def delete_workspace(workspace_name: str):
    """Delete a workspace (only if empty)."""
    frappe.only_for(["System Manager", "All"])
    
    try:
        # Check if workspace has pages
        pages = frappe.get_all("Notion Page", filters={"workspace": workspace_name})
        if pages:
            return {"ok": False, "error": "Cannot delete workspace with pages. Move or delete pages first."}
        
        # Delete workspace
        frappe.delete_doc("Workbench Workspace", workspace_name)
        frappe.db.commit()
        return {"ok": True, "message": f"Workspace {workspace_name} deleted"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@frappe.whitelist()
def get_company_users():
    """Get users from the same company for assignees/collaborators."""
    user_company = frappe.db.get_value("User", frappe.session.user, "company") or frappe.db.get_default("company")
    
    if not user_company:
        return []
    
    users = frappe.get_all(
        "User",
        filters={"company": user_company, "enabled": 1},
        fields=["name", "full_name", "email", "user_image"],
        order_by="full_name asc"
    )
    
    return users

@frappe.whitelist()
def get_workspace_settings(workspace_name: str):
    """Get workspace settings."""
    ws = frappe.get_doc("Workbench Workspace", workspace_name)
    
    # Check access
    if not has_workspace_access(ws, frappe.session.user, write=False):
        frappe.throw("You don't have access to this workspace")
    
    return {
        "name": ws.name,
        "title": ws.title,
        "description": ws.description,
        "visibility": ws.visibility,
        "company": ws.company,
        "collaborators": [
            {
                "user": c.user,
                "access": c.access,
                "user_name": frappe.db.get_value("User", c.user, "full_name")
            }
            for c in ws.collaborators
        ]
    }

@frappe.whitelist()
def update_workspace_settings(workspace_name: str, title: str = None, description: str = None, visibility: str = None, company: str = None, collaborators=None):
    """Update workspace settings (owner only)."""
    ws = frappe.get_doc("Workbench Workspace", workspace_name)
    
    # Only owner can update settings
    if ws.owner_user != frappe.session.user:
        frappe.throw("Only the workspace owner can update settings")
    
    if title is not None:
        ws.title = title
    if description is not None:
        ws.description = description
    if visibility is not None:
        ws.visibility = visibility
    if company is not None:
        ws.company = company
    
    if collaborators is not None:
        if isinstance(collaborators, str):
            try:
                collaborators = frappe.parse_json(collaborators)
            except Exception:
                collaborators = None
        
        # Clear existing collaborators
        ws.collaborators = []
        
        if collaborators:
            for c in collaborators:
                user_id = c.get("user")
                if not frappe.db.exists("User", user_id):
                    frappe.throw(f"User {user_id} does not exist")
                ws.append("collaborators", {
                    "user": user_id,
                    "access": c.get("access", "Viewer"),
                })
    
    ws.save()
    frappe.db.commit()
    
    return {"ok": True}

    # helpers
    import uuid

    def _uuid():
        return "b-" + uuid.uuid4().hex
