/**
 * Collection Block Renderer
 * Handles rendering and interaction with collection blocks
 */

class CollectionBlockRenderer {
  constructor() {
    this.api = new InlineCollectionAPI();
    this.currentPage = null;
    this.viewRenderers = new Map();
    this.setupViewRenderers();
  }

  setupViewRenderers() {
    // Register view renderers
    this.viewRenderers.set('calendar', this.createCalendarRenderer());
    this.viewRenderers.set('timeline', this.createTimelineRenderer());
    this.viewRenderers.set('gallery', this.createGalleryRenderer());
    this.viewRenderers.set('board', this.createBoardRenderer());
    this.viewRenderers.set('table', this.createTableViewRenderer());
    this.viewRenderers.set('list', this.createListRenderer());
  }

  async createCollectionBlock(viewType, pageName) {
    console.log('createCollectionBlock called with:', { viewType, pageName });
    this.currentPage = pageName;
    
    // Generate unique block ID
    const blockId = `collection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get default schema and config
    const schema = this.api.getDefaultSchema(viewType);
    const config = this.api.getDefaultConfig(viewType);
    
    console.log('Creating collection with:', { pageName, blockId, schema, config });
    
    // Create collection
    try {
      const result = await this.api.upsertCollection(pageName, blockId, schema, config, [], []);
      
      console.log('API response:', result);
      
      // Check if the response has the data in message property
      const responseData = result.message || result;
      
      if (responseData.success) {
        console.log('Collection created successfully, rendering block...');
        return this.renderCollectionBlock(blockId, viewType, responseData.schema, responseData.config, []);
      }
      
      console.error('Collection creation failed:', result);
      console.error('Error message details:', JSON.stringify(responseData, null, 2));
      throw new Error(`Failed to create collection: ${JSON.stringify(responseData) || 'Unknown error'}`);
    } catch (error) {
      console.error('Error in createCollectionBlock:', error);
      throw error;
    }
  }

  async loadCollectionBlock(blockId, viewType, pageName) {
    console.log('loadCollectionBlock called with:', { blockId, viewType, pageName });
    this.currentPage = pageName;
    
    try {
      // Load collection data
      const collectionResult = await this.api.upsertCollection(pageName, blockId, null, null, [], []);
      const collectionData = collectionResult.message || collectionResult;
      
      if (!collectionData.success) {
        throw new Error('Failed to load collection data');
      }
      
      // Load items
      const itemsResult = await this.api.queryItems(pageName, blockId);
      const itemsData = itemsResult.message || itemsResult;
      
      if (!itemsData.success) {
        throw new Error('Failed to load items data');
      }
      
      console.log('Loaded collection data:', collectionData);
      console.log('Loaded items data:', itemsData);
      
      // Render the block with loaded data
      return this.renderCollectionBlock(blockId, viewType, collectionData.schema, collectionData.config, itemsData.items || []);
    } catch (error) {
      console.error('Error loading collection block:', error);
      // Fallback to empty collection
      return this.renderCollectionBlock(blockId, viewType, this.api.getDefaultSchema(viewType), this.api.getDefaultConfig(viewType), []);
    }
  }

  renderCollectionBlock(blockId, viewType, schema, config, items = []) {
    console.log('renderCollectionBlock called with:', { blockId, viewType, schema, config, items });
    
    const block = document.createElement('div');
    block.className = 'wb-block wb-collection-block';
    block.dataset.type = 'collection';
    block.dataset.blockId = blockId;
    block.dataset.viewType = viewType;
    
    console.log('Created block element:', block);
    
    block.innerHTML = `
      <div class="wb-collection-header">
        <div class="wb-collection-toolbar">
          <div class="wb-collection-toolbar-left">
            <button class="wb-collection-filter-btn" title="Filter">
              <span class="wb-icon">🔍</span>
            </button>
            <button class="wb-collection-sort-btn" title="Sort">
              <span class="wb-icon">⇅</span>
            </button>
            <button class="wb-collection-search-btn" title="Search">
              <span class="wb-icon">🔎</span>
            </button>
          </div>
          <div class="wb-collection-toolbar-center">
            <div class="wb-collection-view-switcher">
              <button class="wb-collection-view-btn active" data-view="table">
                <span class="wb-icon">📊</span>
                <span class="wb-label">Table</span>
              </button>
              <button class="wb-collection-view-btn" data-view="board">
                <span class="wb-icon">📋</span>
                <span class="wb-label">Board</span>
              </button>
              <button class="wb-collection-view-btn" data-view="calendar">
                <span class="wb-icon">📅</span>
                <span class="wb-label">Calendar</span>
              </button>
              <button class="wb-collection-view-btn" data-view="gallery">
                <span class="wb-icon">🖼️</span>
                <span class="wb-label">Gallery</span>
              </button>
              <button class="wb-collection-view-btn" data-view="timeline">
                <span class="wb-icon">📈</span>
                <span class="wb-label">Timeline</span>
              </button>
              <button class="wb-collection-view-btn" data-view="list">
                <span class="wb-icon">📝</span>
                <span class="wb-label">List</span>
              </button>
            </div>
          </div>
          <div class="wb-collection-toolbar-right">
            <button class="wb-collection-new-btn">
              <span class="wb-icon">+</span>
              <span class="wb-label">New</span>
            </button>
            <button class="wb-collection-more-btn" title="More options">
              <span class="wb-icon">⋯</span>
            </button>
          </div>
        </div>
      </div>
      <div class="wb-collection-content">
        <div class="wb-collection-view-container">
          <!-- View content will be rendered here -->
        </div>
      </div>
    `;

    // Store data
    block.collectionData = {
      blockId,
      viewType,
      schema,
      config,
      items,
      filters: [],
      sorts: []
    };

    // Setup event listeners
    this.setupCollectionEventListeners(block);

    // Render initial view
    console.log('About to render initial view for block:', block);
    this.renderView(block, viewType);
    console.log('Block after rendering:', block.outerHTML);

    return block;
  }

  setupCollectionEventListeners(block) {
    const toolbar = block.querySelector('.wb-collection-toolbar');
    console.log('Setting up collection event listeners for toolbar:', toolbar);
    
    // View switcher
    const viewButtons = toolbar.querySelectorAll('.wb-collection-view-btn');
    console.log('Found view buttons:', viewButtons.length);
    viewButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('View button clicked:', btn.dataset.view);
        const newViewType = btn.dataset.view;
        this.switchView(block, newViewType);
      });
    });

    // New item button
    const newBtn = toolbar.querySelector('.wb-collection-new-btn');
    console.log('Found new button:', newBtn);
    if (newBtn) {
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('New button clicked');
        this.createNewItem(block);
      });
    }

    // Filter button
    const filterBtn = toolbar.querySelector('.wb-collection-filter-btn');
    console.log('Found filter button:', filterBtn);
    if (filterBtn) {
      filterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Filter button clicked');
        this.showFilterMenu(block);
      });
    }

    // Sort button
    const sortBtn = toolbar.querySelector('.wb-collection-sort-btn');
    console.log('Found sort button:', sortBtn);
    if (sortBtn) {
      sortBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Sort button clicked');
        this.showSortMenu(block);
      });
    }

    // Search button
    const searchBtn = toolbar.querySelector('.wb-collection-search-btn');
    console.log('Found search button:', searchBtn);
    if (searchBtn) {
      searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Search button clicked');
        this.toggleSearch(block);
      });
    }

    // More options button
    const moreBtn = toolbar.querySelector('.wb-collection-more-btn');
    console.log('Found more button:', moreBtn);
    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('More button clicked');
        this.showMoreMenu(block);
      });
    }
  }

  async switchView(block, newViewType) {
    console.log('Switching view from', block.collectionData.viewType, 'to', newViewType);
    const data = block.collectionData;
    
    // Update active button
    block.querySelectorAll('.wb-collection-view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === newViewType);
    });

    // Check if we need to remap config
    const needsConfigRemapping = this.needsConfigRemapping(data.viewType, newViewType, data.config);
    console.log('Needs config remapping:', needsConfigRemapping);
    
    if (needsConfigRemapping) {
      const newConfig = await this.remapConfig(block, data.viewType, newViewType, data.config, data.schema);
      if (newConfig) {
        data.config = newConfig;
        // Save updated config
        await this.api.upsertCollection(this.currentPage, data.blockId, data.schema, data.config, data.filters, data.sorts);
      }
    }

    // Update data
    data.viewType = newViewType;
    block.dataset.viewType = newViewType;

    // Render new view
    console.log('Rendering new view:', newViewType);
    this.renderView(block, newViewType);
  }

  needsConfigRemapping(fromView, toView, config) {
    // Check if required config properties exist for the new view
    const requiredConfigs = {
      'calendar': ['dateProp'],
      'timeline': ['startProp', 'endProp'],
      'gallery': ['coverProp'],
      'board': ['groupProp'],
      'table': ['visibleCols'],
      'list': ['visibleCols']
    };

    const required = requiredConfigs[toView] || [];
    return required.some(prop => !config[prop]);
  }

  async remapConfig(block, fromView, toView, currentConfig, schema) {
    // Show a simple picker for missing config properties
    const requiredConfigs = {
      'calendar': ['dateProp'],
      'timeline': ['startProp', 'endProp'],
      'gallery': ['coverProp'],
      'board': ['groupProp']
    };

    const required = requiredConfigs[toView] || [];
    const missing = required.filter(prop => !currentConfig[prop]);
    
    if (missing.length === 0) {
      return currentConfig;
    }

    // For now, use sensible defaults based on schema
    const newConfig = { ...currentConfig };
    
    for (const prop of missing) {
      if (prop === 'dateProp' || prop === 'startProp') {
        // Find first date property
        const dateProps = Object.keys(schema).filter(key => schema[key].type === 'date');
        if (dateProps.length > 0) {
          newConfig[prop] = dateProps[0];
        }
      } else if (prop === 'endProp') {
        // Find second date property or use same as start
        const dateProps = Object.keys(schema).filter(key => schema[key].type === 'date');
        if (dateProps.length > 1) {
          newConfig[prop] = dateProps[1];
        } else {
          newConfig[prop] = newConfig.startProp || dateProps[0];
        }
      } else if (prop === 'coverProp') {
        // Find first file property
        const fileProps = Object.keys(schema).filter(key => schema[key].type === 'file');
        if (fileProps.length > 0) {
          newConfig[prop] = fileProps[0];
        }
      } else if (prop === 'groupProp') {
        // Find first select property
        const selectProps = Object.keys(schema).filter(key => schema[key].type === 'select');
        if (selectProps.length > 0) {
          newConfig[prop] = selectProps[0];
        }
      }
    }

    return newConfig;
  }

  renderView(block, viewType) {
    const container = block.querySelector('.wb-collection-view-container');
    const data = block.collectionData;

    console.log('Rendering view:', viewType, 'with data:', data);
    console.log('Container found:', container);
    console.log('Block element:', block);

    if (!container) {
      console.error('Container not found! Block HTML:', block.outerHTML);
      return;
    }

    // Clear container
    container.innerHTML = '';

    // Get the appropriate view renderer
    const renderer = this.viewRenderers.get(viewType);
    
    if (renderer) {
      // Use specialized view renderer
      console.log('Using specialized renderer for:', viewType);
      renderer.render(container, data);
    } else {
      // Fallback to basic table view
      console.log('Using basic table view for:', viewType);
      this.renderBasicTableView(container, data);
    }
  }

  renderBasicTableView(container, data) {
    const { schema, items } = data;
    const visibleCols = data.config.visibleCols || Object.keys(schema).slice(0, 4);

    console.log('Rendering basic table view with:', { schema, items, visibleCols });

    let html = `
      <div class="wb-table-view">
        <table class="wb-table">
          <thead>
            <tr>
              ${visibleCols.map(col => `<th>${col}</th>`).join('')}
              <th class="wb-table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (items.length === 0) {
      html += `
        <tr class="wb-table-empty">
          <td colspan="${visibleCols.length + 1}">
            <div class="wb-empty-state">
              <div class="wb-empty-icon">📊</div>
              <div class="wb-empty-text">No items yet</div>
              <div class="wb-empty-subtext">Click "New" to create your first item</div>
            </div>
          </td>
        </tr>
      `;
    } else {
      items.forEach(item => {
        html += `
          <tr data-item-id="${item.id}">
            ${visibleCols.map(col => {
              const value = item.props[col] || '';
              return `<td>${this.formatPropertyValue(value, schema[col])}</td>`;
            }).join('')}
            <td class="wb-table-actions">
              <button class="wb-item-edit-btn" data-item-id="${item.id}">Edit</button>
              <button class="wb-item-delete-btn" data-item-id="${item.id}">Delete</button>
            </td>
          </tr>
        `;
      });
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
    console.log('Table HTML rendered:', html);
    console.log('Container after setting HTML:', container.outerHTML);
    
    // Force a style update to make sure it's visible
    container.style.display = 'block';
    container.style.visibility = 'visible';
    container.style.opacity = '1';

    // Setup table event listeners
    this.setupTableViewEventListeners(container, data);
  }

  setupTableViewEventListeners(container, data) {
    // Edit buttons
    container.querySelectorAll('.wb-item-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = btn.dataset.itemId;
        this.editItem(data, itemId);
      });
    });

    // Delete buttons
    container.querySelectorAll('.wb-item-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = btn.dataset.itemId;
        this.deleteItem(data, itemId);
      });
    });
  }

  formatPropertyValue(value, schema) {
    if (!value) return '';
    
    switch (schema?.type) {
      case 'select':
        return `<span class="wb-property-chip wb-property-select">${value}</span>`;
      case 'multi_select':
        const values = Array.isArray(value) ? value : value.split(',').map(v => v.trim());
        return values.map(v => `<span class="wb-property-chip wb-property-multi-select">${v}</span>`).join(' ');
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'file':
        return `<span class="wb-property-file">📎 ${value}</span>`;
      default:
        return value;
    }
  }

  async createNewItem(block) {
    const data = block.collectionData;
    
    // Create new item with default values
    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      props: this.getDefaultProps(data.schema),
      content: {},
      position: data.items.length
    };

    try {
      // Create item via API
      console.log('Creating item via API:', newItem);
      const result = await this.api.upsertItem(this.currentPage, data.blockId, newItem);
      console.log('Item created successfully:', result);
      
      // Add item locally
      data.items.push(newItem);
      this.renderView(block, data.viewType);
      
      // Open modal editor for the new item
      this.openItemModal(block, newItem);
      
    } catch (error) {
      console.error('Failed to create item:', error);
      // Fallback: add item locally even if API fails
      data.items.push(newItem);
      this.renderView(block, data.viewType);
      this.openItemModal(block, newItem);
    }
  }

  openItemModal(block, item) {
    console.log('Opening modal for item:', item);
    
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'wb-item-modal-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      justify-content: center;
      align-items: center;
    `;
    
    // Create modal content - full page editor
    const modalContent = document.createElement('div');
    modalContent.className = 'wb-item-modal-content';
    modalContent.style.cssText = `
      background: white;
      border-radius: 8px;
      width: 95%;
      height: 90%;
      max-width: 1200px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    
    modalContent.innerHTML = `
      <div class="wb-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #e1e5e9; background: #f8f9fa;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <h2 style="margin: 0; color: #333; font-size: 18px;">${item.props.Title || 'New Item'}</h2>
          <span style="background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">${item.props.Status || 'Not started'}</span>
        </div>
        <button class="wb-modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
      </div>
      
      <div class="wb-modal-body" style="flex: 1; padding: 24px; overflow-y: auto;">
        <div class="wb-page-editor" style="min-height: 100%;">
          <div class="wb-editor" style="outline: none; min-height: 400px;">
            ${this.renderItemContentAsBlocks(item)}
          </div>
        </div>
      </div>
      
      <div class="wb-modal-footer" style="padding: 16px 24px; border-top: 1px solid #e1e5e9; background: #f8f9fa; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 12px;">
          <button class="wb-modal-save" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">Save</button>
          <button class="wb-modal-cancel" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
        <div style="color: #666; font-size: 12px;">Press Ctrl+S to save</div>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Initialize the page editor with main workbench functionality
    this.initializeModalEditorWithMainWorkbench(modal, item, block);
    
    // Add event listeners
    modal.querySelector('.wb-modal-close').addEventListener('click', () => {
      this.closeModal(modal, block, item);
    });
    
    modal.querySelector('.wb-modal-cancel').addEventListener('click', () => {
      this.closeModal(modal, block, item);
    });
    
    modal.querySelector('.wb-modal-save').addEventListener('click', async () => {
      await this.saveModalContent(modal, block, item);
    });
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal(modal, block, item);
      }
    });
    
    // Keyboard shortcuts
    modal.addEventListener('keydown', async (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        await this.saveModalContent(modal, block, item);
      }
      if (e.key === 'Escape') {
        this.closeModal(modal, block, item);
      }
    });
  }

  renderItemContentAsBlocks(item) {
    // Use the same block system as the main workbench
    const content = item.content.body || '';
    
    if (content.trim() === '') {
      // Create an empty paragraph block with placeholder
      const block = this.createModalBlockElement('paragraph', 'Type something...');
      return block.outerHTML;
    }
    
    // Parse existing content and convert to blocks
    const lines = content.split('\n');
    const blocks = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.trim() === '') {
        const block = this.createModalBlockElement('paragraph', '');
        blocks.push(block.outerHTML);
        continue;
      }
      
      if (line.startsWith('# ')) {
        const block = this.createModalBlockElement('heading1', line.substring(2));
        blocks.push(block.outerHTML);
      } else if (line.startsWith('## ')) {
        const block = this.createModalBlockElement('heading2', line.substring(3));
        blocks.push(block.outerHTML);
      } else if (line.startsWith('### ')) {
        const block = this.createModalBlockElement('heading3', line.substring(4));
        blocks.push(block.outerHTML);
      } else if (line.startsWith('- ')) {
        const block = this.createModalBlockElement('bulleted', line.substring(2));
        blocks.push(block.outerHTML);
      } else if (line.startsWith('1. ')) {
        const block = this.createModalBlockElement('numbered', line.substring(3));
        blocks.push(block.outerHTML);
      } else {
        const block = this.createModalBlockElement('paragraph', line);
        blocks.push(block.outerHTML);
      }
    }
    
    return blocks.join('');
  }

  initializeModalBlocksAfterRender(modal, editor) {
    // After the HTML is inserted, we need to re-attach event listeners to all blocks
    const blocks = editor.querySelectorAll('.wb-block');
    blocks.forEach(block => {
      // Only setup events if not already attached
      if (block.dataset.eventsAttached !== 'true') {
        this.setupModalBlockEvents(block);
        
        // Re-attach gutter button events
        const plusBtn = block.querySelector('.wb-plus');
        const handleBtn = block.querySelector('.wb-handle');
        
        if (plusBtn) {
          plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showModalSlashMenu(modal, block.querySelector('[contenteditable]'), editor);
          });
        }
        
        if (handleBtn) {
          handleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Block menu clicked');
          });
        }
      }
    });
  }

  createModalBlockElement(type, content = '') {
    // Copy the exact createBlock function from main workbench
    const block = document.createElement('div');
    block.className = 'wb-block';
    block.dataset.type = type;
    
    const blockId = 'modal-block-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    block.dataset.id = blockId;
    
    let contentHTML = '';
    switch(type) {
      case 'heading1':
        contentHTML = `<h1 contenteditable="true" class="wb-h1" style="font-size: 2em; font-weight: 700; margin: 0.67em 0; outline: none;">${content}</h1>`;
        break;
      case 'heading2':
        contentHTML = `<h2 contenteditable="true" class="wb-h2" style="font-size: 1.5em; font-weight: 700; margin: 0.75em 0; outline: none;">${content}</h2>`;
        break;
      case 'heading3':
        contentHTML = `<h3 contenteditable="true" class="wb-h3" style="font-size: 1.17em; font-weight: 700; margin: 0.83em 0; outline: none;">${content}</h3>`;
        break;
      case 'bulleted':
        contentHTML = `<ul style="margin: 0; padding-left: 1.5em;"><li contenteditable="true" style="outline: none; list-style-type: disc;">${content}</li></ul>`;
        break;
      case 'numbered':
        // For now, use 1 as default - will be updated after insertion
        contentHTML = `<div style="display: flex; align-items: flex-start; gap: 8px; padding-left: 1.5em;"><span style="min-width: 20px; color: #666; user-select: none;">1.</span><div contenteditable="true" style="outline: none; flex: 1;">${content}</div></div>`;
        break;
      case 'checklist':
        contentHTML = `<div style="display: flex; align-items: center; gap: 8px;"><input type="checkbox" style="margin: 0;"><span contenteditable="true" style="outline: none; flex: 1;">${content}</span></div>`;
        break;
      case 'toggle':
        contentHTML = `<div class="wb-toggle" data-open="true">
          <div class="wb-toggle-caret">▼</div>
          <div class="wb-toggle-title" contenteditable="true" style="outline: none; flex: 1;">${content}</div>
        </div>`;
        break;
      case 'image':
        contentHTML = `<div class="wb-media wb-image-block" data-align="center" style="--w: 60%">
          <div class="wb-media-toolbar">
            <button class="wb-media-upload">Upload</button>
            <button class="wb-media-url">From URL</button>
          </div>
          <div class="wb-media-preview wb-media-empty">
            ${content.src ? `<img src="${content.src}" alt="${content.caption || ''}" style="width: 100%; border-radius: 8px;">` : 'Click Upload or From URL'}
          </div>
          <input class="wb-media-caption" placeholder="Add a caption..." value="${content.caption || ''}" style="outline: none; text-align: center; font-size: 14px; color: #666; margin-top: 8px;">
        </div>`;
        break;
      case 'file':
        contentHTML = `<div class="wb-media wb-file-block">
          <div class="wb-media-toolbar">
            <button class="wb-media-upload">Upload</button>
            <button class="wb-media-url">From URL</button>
          </div>
          <div class="wb-media-preview wb-media-empty">
            ${content.url ? `<div class="wb-media-card"><span class="wb-media-icon">📎</span><a href="${content.url}" target="_blank">${content.name || 'Untitled'}</a></div>` : 'No file yet'}
          </div>
        </div>`;
        break;
      case 'code':
        contentHTML = `<pre style="background: #f5f5f5; padding: 1em; border-radius: 4px; font-family: 'Courier New', monospace; margin: 0;"><code contenteditable="true" style="outline: none;">${content}</code></pre>`;
        break;
      case 'quote':
        contentHTML = `<blockquote contenteditable="true" style="border-left: 4px solid #ddd; padding-left: 1em; margin: 0; font-style: italic; color: #666; outline: none;">${content}</blockquote>`;
        break;
      case 'divider':
        contentHTML = `<hr style="border: none; border-top: 1px solid #ddd; margin: 1em 0;">`;
        break;
      default: // paragraph
        contentHTML = `<p contenteditable="true" style="margin: 0; outline: none;">${content}</p>`;
    }
    
    block.innerHTML = `
      <div class="wb-gutter" style="width: 32px; display: flex; gap: 6px; visibility: hidden; align-items: center;">
        <div class="wb-handle" style="width: 18px; height: 18px; border-radius: 6px; border: 1px solid #ddd; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: grab;" title="Drag to reorder">⋮</div>
        <div class="wb-plus" style="width: 18px; height: 18px; border-radius: 6px; border: 1px solid #ddd; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer;" title="Add block">+</div>
      </div>
      <div class="wb-content" style="flex: 1; min-height: 1.5em;">
        ${contentHTML}
      </div>
    `;
    
    // Show gutter on hover
    block.addEventListener('mouseenter', () => {
      block.querySelector('.wb-gutter').style.visibility = 'visible';
    });
    block.addEventListener('mouseleave', () => {
      block.querySelector('.wb-gutter').style.visibility = 'hidden';
    });
    
    // Add event listeners for gutter buttons
    const plusBtn = block.querySelector('.wb-plus');
    const handleBtn = block.querySelector('.wb-handle');
    
    if (plusBtn) {
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showModalSlashMenu(this.currentModal, block.querySelector('[contenteditable]'), this.currentEditor);
      });
    }
    
    if (handleBtn) {
      handleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Show block menu (3-dots menu)
        console.log('Block menu clicked');
      });
    }
    
    // Add block event listeners
    this.setupModalBlockEvents(block);
    
    return block;
  }

  getModalNumberedListPosition(currentBlock) {
    let position = 1;
    let current = currentBlock.previousElementSibling;
    
    // Count previous numbered items
    while (current) {
      if (current.dataset.type === 'numbered') {
        position++;
      } else if (current.dataset.type !== 'numbered') {
        // If we hit a non-numbered block, reset the sequence
        break;
      }
      current = current.previousElementSibling;
    }
    
    return position;
  }

  initializeModalEditorWithMainWorkbench(modal, item, block) {
    const editor = modal.querySelector('.wb-editor');
    
    // Store references for use in block creation
    this.currentModal = modal;
    this.currentEditor = editor;
    
    // Make the editor focusable
    editor.focus();
    
    // Initialize blocks after HTML is inserted
    this.initializeModalBlocksAfterRender(modal, editor);
    
    // Add the same event listeners as the main workbench
    this.setupModalEditorEventListeners(modal, editor, item, block);
  }

  setupModalBlockEvents(block) {
    const editable = block.querySelector('[contenteditable="true"]');
    if (!editable) return;

    // Check if events are already attached to prevent duplicates
    if (block.dataset.eventsAttached === 'true') {
      return;
    }

    // Handle slash commands
    editable.addEventListener('keydown', (e) => {
      if (e.key === '/') {
        e.preventDefault();
        console.log('Slash command detected in modal, showing menu');
        this.showModalSlashMenu(this.currentModal, editable, this.currentEditor);
      }
    });

    // Handle Enter key for new blocks
    editable.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        
        // Check if we're in a list and should continue it
        const listType = this.getModalListType(block);
        console.log('Enter pressed, block type:', block.dataset.type, 'listType:', listType, 'text:', block.textContent);
        
        if (listType) {
          // Continue the list
          console.log('Continuing list:', listType);
          this.continueModalList(block, listType);
        } else {
          // Create a new paragraph block
          console.log('Creating new paragraph block');
          this.createModalBlockAfter(block, this.currentEditor);
        }
      }
    });

    // Handle Backspace for empty blocks
    editable.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        const text = editable.textContent || '';
        if (text.trim() === '') {
          e.preventDefault();
          // Don't delete the last block
          const allBlocks = this.currentEditor.querySelectorAll('.wb-block');
          if (allBlocks.length > 1) {
            block.remove();
          }
        }
      }
    });

    // Mark events as attached
    block.dataset.eventsAttached = 'true';
  }

  setupModalEditorEventListeners(modal, editor, item, block) {
    // The event listeners are now handled by setupModalBlockEvents for each individual block
    // This function is kept for compatibility but the real work is done in setupModalBlockEvents
  }

  showModalSlashMenu(modal, editable, editor) {
    console.log('showModalSlashMenu called with:', { modal, editable, editor });
    
    // Use the same block types as the main workbench (excluding collection blocks)
    const blockTypes = {
      paragraph: { icon: '📝', name: 'Text', create: () => this.createModalBlockElement('paragraph') },
      heading1: { icon: '📋', name: 'Heading 1', create: () => this.createModalBlockElement('heading1') },
      heading2: { icon: '📋', name: 'Heading 2', create: () => this.createModalBlockElement('heading2') },
      heading3: { icon: '📋', name: 'Heading 3', create: () => this.createModalBlockElement('heading3') },
      bulleted: { icon: '•', name: 'Bulleted list', create: () => this.createModalBlockElement('bulleted') },
      numbered: { icon: '1.', name: 'Numbered list', create: () => this.createModalBlockElement('numbered') },
      checklist: { icon: '☐', name: 'To-do list', create: () => this.createModalBlockElement('checklist') },
      toggle: { icon: '🔽', name: 'Toggle', create: () => this.createModalBlockElement('toggle') },
      image: { icon: '🖼️', name: 'Image', create: () => this.createModalBlockElement('image') },
      file: { icon: '📎', name: 'File', create: () => this.createModalBlockElement('file') },
      code: { icon: '💻', name: 'Code', create: () => this.createModalBlockElement('code') },
      quote: { icon: '💬', name: 'Quote', create: () => this.createModalBlockElement('quote') },
      divider: { icon: '➖', name: 'Divider', create: () => this.createModalBlockElement('divider') }
    };
    
    const menu = document.createElement('div');
    menu.className = 'wb-slash-menu';
    menu.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      min-width: 280px;
      max-height: 300px;
      overflow-y: auto;
    `;
    
    Object.entries(blockTypes).forEach(([key, type]) => {
      const item = document.createElement('div');
      item.className = 'wb-slash-item';
      item.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f0f0f0;
      `;
      item.innerHTML = `
        <div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 16px;">${type.icon}</div>
        <div style="flex: 1;">
          <div style="font-weight: 500; color: #333;">${type.name}</div>
        </div>
      `;
      
      item.addEventListener('click', () => {
        const currentBlock = editable.closest('.wb-block');
        if (currentBlock) {
          const newBlock = type.create();
          
          // Initialize the new block
          this.setupModalBlockEvents(newBlock);
          
          // Re-attach gutter button events for the new block
          const plusBtn = newBlock.querySelector('.wb-plus');
          const handleBtn = newBlock.querySelector('.wb-handle');
          
          if (plusBtn) {
            plusBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.showModalSlashMenu(modal, newBlock.querySelector('[contenteditable]'), editor);
            });
          }
          
          if (handleBtn) {
            handleBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              console.log('Block menu clicked');
            });
          }
          
          // Replace current block with new block
          currentBlock.replaceWith(newBlock);
          
          // Focus the new block
          const newEditable = newBlock.querySelector('[contenteditable]');
          if (newEditable) {
            newEditable.focus();
          }
        }
        menu.remove();
      });
      
      menu.appendChild(item);
    });
    
    document.body.appendChild(menu);
    
    const rect = editable.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 5) + 'px';
    
    // Close menu when clicking outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
  }

  htmlToElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  getModalListType(block) {
    const text = block.textContent || '';
    
    // Check for bullet list
    if (block.dataset.type === 'bulleted' || 
        block.querySelector('ul') || 
        text.startsWith('•') ||
        text.includes('•')) {
      return 'bulleted';
    }
    
    // Check for checklist
    if (block.dataset.type === 'checklist' || 
        block.querySelector('input[type="checkbox"]')) {
      return 'checklist';
    }
    
    // Check for numbered list (only if it has the specific numbered list structure)
    if (block.dataset.type === 'numbered' || 
        (block.querySelector('.wb-content > div > span') && 
         !block.querySelector('input[type="checkbox"]') &&
         /^\d+\./.test(text.trim()))) {
      return 'numbered';
    }
    
    return null;
  }

  continueModalList(currentBlock, listType) {
    const newBlock = this.createModalBlockElement(listType, 'Type something...');
    
    // Insert after current block
    currentBlock.parentNode.insertBefore(newBlock, currentBlock.nextSibling);
    
    // Update numbered list positions if it's a numbered list
    if (listType === 'numbered') {
      this.updateModalNumberedListPositions();
    }
    
    // Initialize the new block
    this.setupModalBlockEvents(newBlock);
    
    // Re-attach gutter button events for the new block
    const plusBtn = newBlock.querySelector('.wb-plus');
    const handleBtn = newBlock.querySelector('.wb-handle');
    
    if (plusBtn) {
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showModalSlashMenu(this.currentModal, newBlock.querySelector('[contenteditable]'), this.currentEditor);
      });
    }
    
    if (handleBtn) {
      handleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Block menu clicked');
      });
    }
    
    // Focus the new block
    const newEditable = newBlock.querySelector('[contenteditable]');
    if (newEditable) {
      newEditable.focus();
    }
  }

  updateModalNumberedListPositions() {
    const allBlocks = this.currentEditor.querySelectorAll('.wb-block');
    let currentNumber = 1;
    
    allBlocks.forEach((block) => {
      if (block.dataset.type === 'numbered') {
        const numberSpan = block.querySelector('.wb-content > div > span');
        if (numberSpan) {
          numberSpan.textContent = currentNumber + '.';
          currentNumber++;
        }
      } else {
        // Reset numbering when we hit a non-numbered block
        currentNumber = 1;
      }
    });
    
    console.log('Updated numbered list positions, current number:', currentNumber);
  }

  createModalBlockAfter(currentBlock, editor) {
    const newBlock = this.createModalBlockElement('paragraph', 'Type something...');
    
    // Insert after current block
    currentBlock.parentNode.insertBefore(newBlock, currentBlock.nextSibling);
    
    // Initialize the new block (this will mark events as attached)
    this.setupModalBlockEvents(newBlock);
    
    // Re-attach gutter button events for the new block
    const plusBtn = newBlock.querySelector('.wb-plus');
    const handleBtn = newBlock.querySelector('.wb-handle');
    
    if (plusBtn) {
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showModalSlashMenu(this.currentModal, newBlock.querySelector('[contenteditable]'), this.currentEditor);
      });
    }
    
    if (handleBtn) {
      handleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Block menu clicked');
      });
    }
    
    // Focus the new block
    const newEditable = newBlock.querySelector('[contenteditable]');
    if (newEditable) {
      newEditable.focus();
    }
  }


  async saveModalContent(modal, block, item) {
    const editor = modal.querySelector('.wb-editor');
    const content = editor.innerHTML;
    
    // Update item content
    item.content.body = content;
    
    // Update title if it changed
    const titleElement = modal.querySelector('h2');
    if (titleElement) {
      item.props.Title = titleElement.textContent;
    }
    
    try {
      // Save to backend
      console.log('Saving item to backend:', item);
      const result = await this.api.upsertItem(this.currentPage, block.collectionData.blockId, item);
      console.log('Item saved successfully:', result);
      
      // Update the local data
      const data = block.collectionData;
      const itemIndex = data.items.findIndex(i => i.id === item.id);
      if (itemIndex !== -1) {
        data.items[itemIndex] = item;
      } else {
        data.items.push(item);
      }
      
      // Re-render the collection view
      this.renderView(block, data.viewType);
      
    } catch (error) {
      console.error('Failed to save item:', error);
      alert('Failed to save item. Please try again.');
      return; // Don't close modal if save failed
    }
    
    // Close modal
    document.body.removeChild(modal);
    
    console.log('Item saved locally and to backend:', item);
  }

  closeModal(modal, block, item) {
    document.body.removeChild(modal);
  }

  getDefaultProps(schema) {
    const props = {};
    Object.keys(schema).forEach(key => {
      const field = schema[key];
      switch (field.type) {
        case 'title':
          props[key] = 'New Item';
          break;
        case 'select':
          props[key] = field.options?.[0] || '';
          break;
        case 'multi_select':
          props[key] = [];
          break;
        case 'date':
          props[key] = new Date().toISOString().split('T')[0];
          break;
        default:
          props[key] = '';
      }
    });
    return props;
  }

  async editItem(data, itemId) {
    const item = data.items.find(i => i.id === itemId);
    if (!item) return;

    // Open modal editor for the item
    const block = document.querySelector(`[data-block-id="${data.blockId}"]`);
    this.openItemModal(block, item);
  }

  async deleteItem(data, itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      // Delete item via API
      console.log('Deleting item via API:', itemId);
      await this.api.deleteItem(this.currentPage, data.blockId, itemId);
      console.log('Item deleted successfully');
      
      // Delete item locally
      data.items = data.items.filter(i => i.id !== itemId);
      this.renderView(document.querySelector(`[data-block-id="${data.blockId}"]`), data.viewType);
      
    } catch (error) {
      console.error('Failed to delete item:', error);
      // Fallback: delete item locally even if API fails
      data.items = data.items.filter(i => i.id !== itemId);
      this.renderView(document.querySelector(`[data-block-id="${data.blockId}"]`), data.viewType);
    }
  }

  showFilterMenu(block) {
    console.log('Show filter menu');
    alert('Filter menu - Coming soon! This will allow you to filter items by properties.');
  }

  showSortMenu(block) {
    console.log('Show sort menu');
    alert('Sort menu - Coming soon! This will allow you to sort items by different columns.');
  }

  toggleSearch(block) {
    console.log('Toggle search');
    alert('Search - Coming soon! This will allow you to search through items.');
  }

  showMoreMenu(block) {
    console.log('Show more menu');
    const options = [
      'Export Data',
      'Import Data', 
      'Duplicate Collection',
      'Delete Collection',
      'Collection Settings'
    ];
    
    const choice = prompt(`More Options:\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\nEnter number (1-${options.length}):`);
    
    if (choice && choice >= 1 && choice <= options.length) {
      const selectedOption = options[choice - 1];
      alert(`Selected: ${selectedOption} - Coming soon!`);
    }
  }

  // View Renderer Factory Methods
  createTableViewRenderer() {
    return {
      render: (container, data) => {
        this.renderBasicTableView(container, data);
      }
    };
  }

  createBoardRenderer() {
    return {
      render: (container, data) => {
        this.renderBoardView(container, data);
      }
    };
  }

  createCalendarRenderer() {
    return {
      render: (container, data) => {
        this.renderCalendarView(container, data);
      }
    };
  }

  createGalleryRenderer() {
    return {
      render: (container, data) => {
        this.renderGalleryView(container, data);
      }
    };
  }

  createTimelineRenderer() {
    return {
      render: (container, data) => {
        this.renderTimelineView(container, data);
      }
    };
  }

  createListRenderer() {
    return {
      render: (container, data) => {
        this.renderListView(container, data);
      }
    };
  }

  // View Implementation Methods
  renderBoardView(container, data) {
    console.log('Rendering board view with data:', data);
    
    if (!data.items || data.items.length === 0) {
      container.innerHTML = `
        <div class="wb-board-view">
          <div class="wb-empty-state">
            <div class="wb-empty-icon">📋</div>
            <div class="wb-empty-text">No items yet</div>
            <div class="wb-empty-subtext">Click "New" to create your first item</div>
          </div>
        </div>
      `;
      return;
    }

    // Group items by status
    const groupedItems = {};
    data.items.forEach(item => {
      const status = item.props.Status || 'Not started';
      if (!groupedItems[status]) {
        groupedItems[status] = [];
      }
      groupedItems[status].push(item);
    });

    const columns = Object.keys(groupedItems);
    const columnsHTML = columns.map(status => `
      <div class="wb-board-column">
        <div class="wb-board-column-header">
          <h3>${status}</h3>
          <span class="wb-board-count">${groupedItems[status].length}</span>
        </div>
        <div class="wb-board-column-content">
          ${groupedItems[status].map(item => `
            <div class="wb-board-card" data-item-id="${item.id}">
              <div class="wb-board-card-title">${item.props.Title || 'Untitled'}</div>
              <div class="wb-board-card-meta">
                <span class="wb-board-card-date">${item.props.Date || ''}</span>
              </div>
              <div class="wb-board-card-actions">
                <button class="wb-item-edit-btn" data-item-id="${item.id}">Edit</button>
                <button class="wb-item-delete-btn" data-item-id="${item.id}">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="wb-board-view">
        <div class="wb-board-columns">
          ${columnsHTML}
        </div>
      </div>
    `;
  }

  renderCalendarView(container, data) {
    console.log('Rendering calendar view with data:', data);
    
    if (!data.items || data.items.length === 0) {
      container.innerHTML = `
        <div class="wb-calendar-view">
          <div class="wb-empty-state">
            <div class="wb-empty-icon">📅</div>
            <div class="wb-empty-text">No items yet</div>
            <div class="wb-empty-subtext">Click "New" to create your first item</div>
          </div>
        </div>
      `;
      return;
    }

    // Simple calendar grid for now
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    
    let calendarHTML = `
      <div class="wb-calendar-view">
        <div class="wb-calendar-header">
          <h3>${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
        </div>
        <div class="wb-calendar-grid">
          <div class="wb-calendar-weekdays">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          <div class="wb-calendar-days">
    `;
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      calendarHTML += '<div class="wb-calendar-day wb-calendar-day-empty"></div>';
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayItems = data.items.filter(item => {
        const startDate = new Date(item.props.StartDate || '');
        const endDate = new Date(item.props.EndDate || '');
        const currentDate = new Date(currentYear, currentMonth, day);
        
        // Check if item starts on this day, ends on this day, or spans this day
        return (startDate.getDate() === day && startDate.getMonth() === currentMonth) ||
               (endDate.getDate() === day && endDate.getMonth() === currentMonth) ||
               (startDate <= currentDate && endDate >= currentDate);
      });
      
      calendarHTML += `
        <div class="wb-calendar-day ${day === today.getDate() ? 'wb-calendar-day-today' : ''}">
          <div class="wb-calendar-day-number">${day}</div>
          <div class="wb-calendar-day-items">
            ${dayItems.map(item => {
              const startDate = new Date(item.props.StartDate || '');
              const endDate = new Date(item.props.EndDate || '');
              const currentDate = new Date(currentYear, currentMonth, day);
              const isStart = startDate.getDate() === day && startDate.getMonth() === currentMonth;
              const isEnd = endDate.getDate() === day && endDate.getMonth() === currentMonth;
              const isSpanning = startDate < currentDate && endDate > currentDate;
              
              let itemClass = 'wb-calendar-item';
              if (isStart) itemClass += ' wb-calendar-item-start';
              if (isEnd) itemClass += ' wb-calendar-item-end';
              if (isSpanning) itemClass += ' wb-calendar-item-spanning';
              
              const assignedTo = item.props.AssignedTo || '';
              const priority = item.props.Priority || '';
              const status = item.props.Status || '';
              
              return `
                <div class="${itemClass}" data-item-id="${item.id}" title="${item.props.Title || 'Untitled'} - ${assignedTo} - ${priority}">
                  <div class="wb-calendar-item-title">${item.props.Title || 'Untitled'}</div>
                  ${assignedTo ? `<div class="wb-calendar-item-assignee">👤 ${assignedTo}</div>` : ''}
                  ${priority ? `<div class="wb-calendar-item-priority priority-${priority.toLowerCase()}">${priority}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    
    calendarHTML += `
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = calendarHTML;
  }

  renderGalleryView(container, data) {
    console.log('Rendering gallery view with data:', data);
    
    if (!data.items || data.items.length === 0) {
      container.innerHTML = `
        <div class="wb-gallery-view">
          <div class="wb-empty-state">
            <div class="wb-empty-icon">🖼️</div>
            <div class="wb-empty-text">No items yet</div>
            <div class="wb-empty-subtext">Click "New" to create your first item</div>
          </div>
        </div>
      `;
      return;
    }

    const itemsHTML = data.items.map(item => `
      <div class="wb-gallery-item" data-item-id="${item.id}">
        <div class="wb-gallery-item-image">
          <div class="wb-gallery-placeholder">📄</div>
        </div>
        <div class="wb-gallery-item-content">
          <div class="wb-gallery-item-title">${item.props.Title || 'Untitled'}</div>
          <div class="wb-gallery-item-meta">
            <span class="wb-gallery-item-status">${item.props.Status || 'Not started'}</span>
            <span class="wb-gallery-item-date">${item.props.Date || ''}</span>
          </div>
          <div class="wb-gallery-item-actions">
            <button class="wb-item-edit-btn" data-item-id="${item.id}">Edit</button>
            <button class="wb-item-delete-btn" data-item-id="${item.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="wb-gallery-view">
        <div class="wb-gallery-grid">
          ${itemsHTML}
        </div>
      </div>
    `;
  }

  renderTimelineView(container, data) {
    console.log('Rendering timeline view with data:', data);
    
    if (!data.items || data.items.length === 0) {
      container.innerHTML = `
        <div class="wb-timeline-view">
          <div class="wb-empty-state">
            <div class="wb-empty-icon">📈</div>
            <div class="wb-empty-text">No items yet</div>
            <div class="wb-empty-subtext">Click "New" to create your first item</div>
          </div>
        </div>
      `;
      return;
    }

    // Sort items by start date
    const sortedItems = data.items.sort((a, b) => {
      const dateA = new Date(a.props.StartDate || a.props.Date || '');
      const dateB = new Date(b.props.StartDate || b.props.Date || '');
      return dateA - dateB;
    });

    const timelineHTML = sortedItems.map((item, index) => {
      const startDate = new Date(item.props.StartDate || item.props.Date || '');
      const endDate = new Date(item.props.EndDate || item.props.StartDate || item.props.Date || '');
      const hasDateRange = item.props.StartDate && item.props.EndDate && startDate.getTime() !== endDate.getTime();
      const assignedTo = item.props.AssignedTo || '';
      const priority = item.props.Priority || '';
      const status = item.props.Status || 'Not started';
      
      const duration = hasDateRange ? 
        Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1 : 1;
      
      return `
        <div class="wb-timeline-item ${hasDateRange ? 'wb-timeline-item-range' : ''}" data-item-id="${item.id}">
          <div class="wb-timeline-marker ${priority ? `priority-${priority.toLowerCase()}` : ''}"></div>
          <div class="wb-timeline-content">
            <div class="wb-timeline-item-header">
              <div class="wb-timeline-item-title">${item.props.Title || 'Untitled'}</div>
              ${priority ? `<span class="wb-timeline-priority priority-${priority.toLowerCase()}">${priority}</span>` : ''}
            </div>
            <div class="wb-timeline-item-meta">
              <span class="wb-timeline-item-status status-${status.toLowerCase().replace(' ', '-')}">${status}</span>
              <span class="wb-timeline-item-date">
                ${hasDateRange ? 
                  `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()} (${duration} days)` :
                  startDate.toLocaleDateString()
                }
              </span>
              ${assignedTo ? `<span class="wb-timeline-item-assignee">👤 ${assignedTo}</span>` : ''}
            </div>
            ${hasDateRange ? `<div class="wb-timeline-item-bar" style="width: ${Math.min(duration * 20, 200)}px;"></div>` : ''}
            <div class="wb-timeline-item-actions">
              <button class="wb-item-edit-btn" data-item-id="${item.id}">Edit</button>
              <button class="wb-item-delete-btn" data-item-id="${item.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="wb-timeline-view">
        <div class="wb-timeline-container">
          ${timelineHTML}
        </div>
      </div>
    `;
  }

  renderListView(container, data) {
    console.log('Rendering list view with data:', data);
    
    if (!data.items || data.items.length === 0) {
      container.innerHTML = `
        <div class="wb-list-view">
          <div class="wb-empty-state">
            <div class="wb-empty-icon">📝</div>
            <div class="wb-empty-text">No items yet</div>
            <div class="wb-empty-subtext">Click "New" to create your first item</div>
          </div>
        </div>
      `;
      return;
    }

    const itemsHTML = data.items.map(item => `
      <div class="wb-list-item" data-item-id="${item.id}">
        <div class="wb-list-item-content">
          <div class="wb-list-item-title">${item.props.Title || 'Untitled'}</div>
          <div class="wb-list-item-meta">
            <span class="wb-list-item-status">${item.props.Status || 'Not started'}</span>
            <span class="wb-list-item-date">${item.props.Date || ''}</span>
          </div>
        </div>
        <div class="wb-list-item-actions">
          <button class="wb-item-edit-btn" data-item-id="${item.id}">Edit</button>
          <button class="wb-item-delete-btn" data-item-id="${item.id}">Delete</button>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="wb-list-view">
        <div class="wb-list-container">
          ${itemsHTML}
        </div>
      </div>
    `;
  }
}

// Export for use in other modules
window.CollectionBlockRenderer = CollectionBlockRenderer;
