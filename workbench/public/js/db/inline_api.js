/**
 * Inline Collection API Wrapper
 * Provides a clean interface for working with inline collections
 */

class InlineCollectionAPI {
  constructor() {
    this.csrfToken = this.getCSRFToken();
  }

  getCSRFToken() {
    return window.csrf_token || 
           (window.frappe && window.frappe.csrf_token) ||
           document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  }

  async request(method, endpoint, data = null) {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': this.csrfToken
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`/api/method/workbench.workbench.inline_api.inline_collection.${endpoint}`, options);
      const result = await response.json();
      
      if (result.exc_type) {
        console.error('API Error details:', result);
        throw new Error(result.exc || 'API Error');
      }
      
      return result;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Collection management
  async upsertCollection(page, blockId, schema = null, config = null, filters = null, sorts = null) {
    console.log('upsertCollection called with:', { page, blockId, schema, config, filters, sorts });
    return await this.request('POST', 'inline_col_upsert', {
      page,
      block_id: blockId,
      schema,
      config,
      filters,
      sorts
    });
  }

  async queryItems(page, blockId, limit = 100, offset = 0) {
    return await this.request('GET', 'inline_items_query', {
      page,
      block_id: blockId,
      limit,
      offset
    });
  }

  // Item management
  async upsertItem(page, blockId, item) {
    return await this.request('POST', 'inline_item_upsert', {
      page,
      block_id: blockId,
      item
    });
  }

  async deleteItem(page, blockId, itemId) {
    return await this.request('POST', 'inline_item_delete', {
      page,
      block_id: blockId,
      item_id: itemId
    });
  }

  async getItem(page, blockId, itemId) {
    return await this.request('GET', 'inline_item_get', {
      page,
      block_id: blockId,
      item_id: itemId
    });
  }

  async saveItemBody(page, blockId, itemId, content) {
    return await this.request('POST', 'inline_item_save_body', {
      page,
      block_id: blockId,
      item_id: itemId,
      content_json: typeof content === 'string' ? content : JSON.stringify(content)
    });
  }

  // Utility methods
  async promoteCollection(page, blockId) {
    return await this.request('POST', 'promote_collection', {
      page,
      block_id: blockId
    });
  }

  // Default schemas for different view types
  getDefaultSchema(viewType) {
    const baseSchema = {
      "Title": { "type": "title" },
      "Status": { 
        "type": "select", 
        "options": ["Not started", "In progress", "Done"] 
      },
      "StartDate": { "type": "date" },
      "EndDate": { "type": "date" },
      "AssignedTo": { 
        "type": "select", 
        "options": ["John Doe", "Jane Smith", "Mike Johnson", "Sarah Wilson", "Alex Brown"] 
      },
      "Priority": { 
        "type": "select", 
        "options": ["Low", "Medium", "High", "Urgent"] 
      },
      "Tags": { 
        "type": "multi_select", 
        "options": ["UI", "Backend", "Bug", "Feature", "Design", "Testing"] 
      }
    };

    switch (viewType) {
      case 'timeline':
        return {
          ...baseSchema,
          "Start": { "type": "date" },
          "End": { "type": "date" }
        };
      
      case 'calendar':
        return {
          ...baseSchema,
          "Date": { "type": "date" }
        };
      
      case 'gallery':
        return {
          ...baseSchema,
          "Cover": { "type": "file" }
        };
      
      case 'board':
        return {
          ...baseSchema,
          "Status": { 
            "type": "select", 
            "options": ["Not started", "In progress", "Done"] 
          }
        };
      
      default:
        return baseSchema;
    }
  }

  getDefaultConfig(viewType) {
    switch (viewType) {
      case 'timeline':
        return {
          "startProp": "Start",
          "endProp": "End",
          "groupBy": null,
          "zoom": "month"
        };
      
      case 'calendar':
        return {
          "dateProp": "Date"
        };
      
      case 'gallery':
        return {
          "coverProp": "Cover",
          "cardFields": ["Title", "Status"],
          "size": "medium"
        };
      
      case 'board':
        return {
          "groupProp": "Status"
        };
      
      case 'table':
        return {
          "visibleCols": ["Title", "Status", "Date"]
        };
      
      case 'list':
        return {
          "visibleCols": ["Title", "Status"]
        };
      
      default:
        return {};
    }
  }
}

// Export for use in other modules
window.InlineCollectionAPI = InlineCollectionAPI;
