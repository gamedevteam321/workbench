// Expose App and Editor globally
window.WorkbenchApp = null;
window.WorkbenchEditor = null;

(function(){
  const api = {
    async list(search=""){
      const r = await fetch(`/api/method/workbench.api.list_pages?search=${encodeURIComponent(search)}`);
      const j = await r.json();
      if(j.exc) throw j.exc; return j.message || [];
    },
    async get(name){
      const r = await fetch(`/api/method/workbench.api.get_page?name=${encodeURIComponent(name)}`);
      const j = await r.json(); if(j.exc) throw j.exc; return j.message;
    },
    async create(title="Untitled"){
      const r = await fetch(`/api/method/workbench.api.create_page`,{
        method:'POST', headers:{'Content-Type':'application/json','X-Frappe-CSRF-Token': frappe.csrf_token},
        body: JSON.stringify({title})
      });
      const j = await r.json(); if(j.exc) throw j.exc; return j.message;
    },
    async update(name, payload){
      const r = await fetch(`/api/method/workbench.api.update_page`,{
        method:'POST', headers:{'Content-Type':'application/json','X-Frappe-CSRF-Token': frappe.csrf_token},
        body: JSON.stringify(Object.assign({name}, payload))
      });
      const j = await r.json(); if(j.exc) throw j.exc; return j.message;
    },
    async del(name){
      const r = await fetch(`/api/method/workbench.api.delete_page`,{
        method:'POST', headers:{'Content-Type':'application/json','X-Frappe-CSRF-Token': frappe.csrf_token},
        body: JSON.stringify({name})
      });
      const j = await r.json(); if(j.exc) throw j.exc; return j.message;
    }
  };

  // --- Tiny Notion-like block editor ---
  const Editor = {
    init(root){
      this.root = root;
      this.saveCb = null;
      this.slashMenu = null;
      this.isSlashMenuOpen = false;
      root.addEventListener('keydown', this.onKeyDown.bind(this));
      root.addEventListener('paste', this.onPaste.bind(this));
      
      // Add global keydown handler to catch typing when no element is focused
      document.addEventListener('keydown', (e) => {
        // If no element is focused and user starts typing, focus the first block
        if(!document.activeElement || document.activeElement === document.body){
          const firstBlock = root.querySelector('.wb-block');
          if(firstBlock && e.key.length === 1){ // Only for printable characters
            this.focusBlock(firstBlock);
            // Let the key event propagate to the focused element
            setTimeout(() => {
              const editable = firstBlock.querySelector('[contenteditable]');
              if(editable){
                editable.focus();
                // Insert the character that was typed
                document.execCommand('insertText', false, e.key);
              }
            }, 10);
          }
        }
      });
      root.addEventListener('click', (e)=>{
        console.log('Click event on:', e.target); // Debug log
        
        const b = e.target.closest('.wb-block');
        if(!b) {
          console.log('No block found, creating new one'); // Debug log
          // If no block found, create a new one
          const newBlock = this.createParagraph('');
          root.appendChild(newBlock);
          this.focusBlock(newBlock);
          return;
        }
        
        const plus = e.target.closest('.wb-plus');
        if(plus){ 
          console.log('Plus button clicked'); // Debug log
          this.insertAfter(b, Editor.createParagraph("")); 
          this.focusBlock(b.nextElementSibling); 
          this.queueSave(); 
          return; 
        }
        
        // If clicking anywhere on the block, focus it
        const editable = b.querySelector('[contenteditable]');
        if(editable){
          e.preventDefault();
          console.log('Clicking on block, focusing...'); // Debug log
          this.focusBlock(b);
        }
      });
      
      // Add double-click handler for text selection
      root.addEventListener('dblclick', (e)=>{
        const b = e.target.closest('.wb-block');
        if(!b) return;
        const editable = b.querySelector('[contenteditable]');
        if(editable){
          this.focusBlock(b);
        }
      });
      
      // Add global click handler for the editor area
      root.addEventListener('click', (e)=>{
        // If clicking in empty space, focus the last block or create a new one
        if(e.target === root || e.target.classList.contains('wb-editor')){
          const lastBlock = root.querySelector('.wb-block:last-child');
          if(lastBlock){
            this.focusBlock(lastBlock);
          } else {
            const newBlock = this.createParagraph('');
            root.appendChild(newBlock);
            this.focusBlock(newBlock);
          }
        }
      });
      
      this.createSlashMenu();
      
      // Add a test button to manually focus
      const testButton = document.createElement('button');
      testButton.textContent = 'Test Focus';
      testButton.style.position = 'fixed';
      testButton.style.top = '10px';
      testButton.style.right = '10px';
      testButton.style.zIndex = '9999';
      testButton.onclick = () => {
        const firstBlock = root.querySelector('.wb-block');
        if(firstBlock){
          console.log('Manual focus test');
          this.focusBlock(firstBlock);
        } else {
          console.log('No blocks found, creating one');
          const newBlock = this.createParagraph('Test block');
          root.appendChild(newBlock);
          this.focusBlock(newBlock);
        }
      };
      document.body.appendChild(testButton);
      
      // Add a test button to create a new block
      const createButton = document.createElement('button');
      createButton.textContent = 'Create Block';
      createButton.style.position = 'fixed';
      createButton.style.top = '50px';
      createButton.style.right = '10px';
      createButton.style.zIndex = '9999';
      createButton.onclick = () => {
        console.log('Creating new block');
        const newBlock = this.createParagraph('New block created');
        root.appendChild(newBlock);
        this.focusBlock(newBlock);
      };
      document.body.appendChild(createButton);
    },
    createParagraph(text=""){ return Editor._block({type:'paragraph', level:1, text}); },
    createHeading(level=1, text=""){ return Editor._block({type:'heading', level, text}); },
    createBullet(text=""){ return Editor._block({type:'bulleted', level:1, text}); },
    createNumbered(text=""){ return Editor._block({type:'numbered', level:1, text}); },
    createChecklist(text="", checked=false){ return Editor._block({type:'checklist', level:1, text, checked}); },
    createCode(text=""){ return Editor._block({type:'code', level:1, text}); },
    createQuote(text=""){ return Editor._block({type:'quote', level:1, text}); },
    createDivider(){ return Editor._block({type:'divider', level:1, text:''}); },
    createImage(url=""){ return Editor._block({type:'image', level:1, text:url}); },
    createEmbed(url=""){ return Editor._block({type:'embed', level:1, text:url}); },

    _uuid(){ return 'b-'+(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)); },

    _block({type, level=1, text="", checked=false}){
      const el = document.createElement('div');
      el.className = 'wb-block';
      el.dataset.id = Editor._uuid();
      el.dataset.type = type; el.dataset.level = String(level);
      el.innerHTML = `
        <div class="wb-gutter">
          <div class="wb-handle">⋮</div>
          <div class="wb-plus">+</div>
        </div>
        <div class="wb-content">${Editor._blockInner(type, level, text, checked)}</div>`;
      Editor._bindBlock(el);
      console.log('Created block:', el); // Debug log
      return el;
    },

    _blockInner(type, level, text, checked){
      text = Editor._escape(text);
      if(type==='heading' && (level===1||level===2||level===3)) return `<div class="wb-h${level}" contenteditable="true" tabindex="0">${text}</div>`;
      if(type==='bulleted') return `<ul class="wb-ul"><li contenteditable="true" tabindex="0">${text}</li></ul>`;
      if(type==='numbered') return `<ol class="wb-ol"><li contenteditable="true" tabindex="0">${text}</li></ol>`;
      if(type==='checklist') return `<div class="wb-check"><input class="wb-checkbox" type="checkbox" ${checked?"checked":""}/><span contenteditable="true" tabindex="0">${text}</span></div>`;
      if(type==='code') return `<pre class="wb-code"><code contenteditable="true" tabindex="0">${text}</code></pre>`;
      if(type==='quote') return `<blockquote class="wb-quote" contenteditable="true" tabindex="0">${text}</blockquote>`;
      if(type==='divider') return `<div class="wb-divider"></div>`;
      if(type==='image') return `<div class="wb-image"><img src="${text}" alt="Image" style="max-width:100%; height:auto;"><div class="wb-image-url" contenteditable="true" tabindex="0">${text}</div></div>`;
      if(type==='embed') return `<div class="wb-embed"><iframe src="${text}" frameborder="0" style="width:100%; height:200px;"></iframe><div class="wb-embed-url" contenteditable="true" tabindex="0">${text}</div></div>`;
      return `<p contenteditable="true" tabindex="0">${text}</p>`; // paragraph default
    },

    _bindBlock(el){
      el.addEventListener('change', (e)=>{
        if(e.target.matches('.wb-checkbox')){ this.queueSave(); }
      });
      el.addEventListener('input', ()=> this.queueSave());
      
      // Drag & drop functionality
      const handle = el.querySelector('.wb-handle');
      if(handle){
        handle.draggable = true;
        handle.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', '');
          e.dataTransfer.effectAllowed = 'move';
          el.classList.add('wb-dragging');
          this.draggedBlock = el;
        });
        
        handle.addEventListener('dragend', (e) => {
          el.classList.remove('wb-dragging');
          this.draggedBlock = null;
          this.removeDropIndicators();
        });
      }
      
      el.addEventListener('dragover', (e) => {
        if(this.draggedBlock && this.draggedBlock !== el){
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          this.showDropIndicator(el, e);
        }
      });
      
      el.addEventListener('drop', (e) => {
        if(this.draggedBlock && this.draggedBlock !== el){
          e.preventDefault();
          this.moveBlock(this.draggedBlock, el, e);
          this.removeDropIndicators();
        }
      });
    },

    render(blocks){
      if(!blocks || !Array.isArray(blocks.blocks)){
        blocks = {blocks:[{id:this._uuid(), type:'paragraph', level:1, text:''}]};
      }
      this.root.innerHTML = '';
      blocks.blocks.forEach(b=>{
        const el = Editor._block(b);
        el.dataset.level = String(b.level || 1);
        this.root.appendChild(el);
      });
      if(!this.root.children.length){ this.root.appendChild(Editor.createParagraph("")); }
      
      // Auto-focus the first block after rendering
      setTimeout(() => {
        const firstBlock = this.root.querySelector('.wb-block');
        if(firstBlock){
          this.focusBlock(firstBlock);
        }
      }, 50);
    },

    serialize(){
      const out = [];
      for(const el of this.root.querySelectorAll('.wb-block')){
        const type = el.dataset.type; const level = parseInt(el.dataset.level||'1',10);
        let text = '' , checked = false;
        if(type==='heading') text = el.querySelector('[contenteditable]')?.innerHTML || '';
        else if(type==='bulleted' || type==='numbered') text = el.querySelector('li[contenteditable]')?.innerHTML || '';
        else if(type==='checklist') { text = el.querySelector('span[contenteditable]')?.innerHTML || ''; checked = el.querySelector('.wb-checkbox')?.checked || false; }
        else if(type==='code') text = el.querySelector('code[contenteditable]')?.innerHTML || '';
        else if(type==='quote') text = el.querySelector('blockquote[contenteditable]')?.innerHTML || '';
        else if(type==='divider') text = '';
        else if(type==='image') text = el.querySelector('.wb-image-url[contenteditable]')?.innerHTML || '';
        else if(type==='embed') text = el.querySelector('.wb-embed-url[contenteditable]')?.innerHTML || '';
        else text = el.querySelector('p[contenteditable]')?.innerHTML || '';
        out.push({ id: el.dataset.id, type, level, text, checked });
      }
      return { blocks: out };
    },

    insertAfter(blockEl, newEl){ blockEl.insertAdjacentElement('afterend', newEl); },

    focusBlock(blockEl){
      const ed = blockEl.querySelector('[contenteditable]'); 
      if(ed){ 
        console.log('Focusing block:', ed); // Debug log
        
        // Make sure the element is focusable
        ed.setAttribute('tabindex', '0');
        ed.style.cursor = 'text';
        
        // Force focus immediately
        ed.focus();
        
        // Create a selection to force cursor appearance
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(ed);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Ensure cursor is at the end and visible
        setTimeout(() => {
          Editor._placeCaretEnd(ed);
          ed.focus();
          console.log('Active element after focus:', document.activeElement); // Debug log
        }, 10);
        
        // Also try after a longer delay to ensure it works
        setTimeout(() => {
          if(document.activeElement !== ed){
            ed.focus();
            Editor._placeCaretEnd(ed);
          }
        }, 100);
        
        // Final attempt after even longer delay
        setTimeout(() => {
          if(document.activeElement !== ed){
            ed.focus();
            Editor._placeCaretEnd(ed);
          }
        }, 500);
      }
    },

    onKeyDown(e){
      const ed = e.target.closest('[contenteditable]'); if(!ed) return;
      const block = e.target.closest('.wb-block'); if(!block) return;
      const type = block.dataset.type; const level = parseInt(block.dataset.level||'1',10);
      
      // Handle slash commands
      if(e.key==='/' && !this.isSlashMenuOpen){
        const content = Editor._getText(ed);
        // Check if we're at the start of the block or after a space
        const selection = window.getSelection();
        if(selection.rangeCount > 0){
          const range = selection.getRangeAt(0);
          const textBeforeCursor = range.startContainer.textContent.substring(0, range.startOffset);
          if(textBeforeCursor.trim() === '' || textBeforeCursor.endsWith(' ')){
            e.preventDefault();
            this.showSlashMenu(block, ed);
            return;
          }
        }
      }

      // Handle rich text formatting shortcuts
      if(e.ctrlKey || e.metaKey){
        if(e.key==='b'){
          e.preventDefault();
          document.execCommand('bold');
          this.queueSave();
          return;
        }
        if(e.key==='i'){
          e.preventDefault();
          document.execCommand('italic');
          this.queueSave();
          return;
        }
        if(e.key==='u'){
          e.preventDefault();
          document.execCommand('underline');
          this.queueSave();
          return;
        }
      }
      
      if(e.key==='Enter'){
        if(e.shiftKey) return; // soft break
        e.preventDefault();
        const content = Editor._getText(ed);
        const empty = content.trim()==='';
        if(type==='bulleted' || type==='numbered' || type==='checklist'){
          if(empty){
            if(level>1){ block.dataset.level = String(level-1); return; }
            block.dataset.type = 'paragraph';
            block.querySelector('.wb-content').innerHTML = Editor._blockInner('paragraph',1,'');
            this.focusBlock(block); this.queueSave(); return;
          }
        }
        const afterText = Editor._splitAtCaret(ed);
        const next = (type==='heading') ? this.createParagraph(afterText) :
                     (type==='bulleted') ? this.createBullet(afterText) :
                     (type==='numbered') ? this.createNumbered(afterText) :
                     (type==='checklist') ? this.createChecklist(afterText,false) :
                     this.createParagraph(afterText);
        next.dataset.level = String(level);
        this.insertAfter(block, next); this.focusBlock(next); this.queueSave(); return;
      }

      if(e.key==='Backspace'){
        const atStart = Editor._caretAtStart(ed);
        if(atStart){
          e.preventDefault();
          const prev = block.previousElementSibling;
          if(!prev) return;
          const txt = Editor._getHTML(ed);
          const prevEd = prev.querySelector('[contenteditable]');
          Editor._placeCaretEnd(prevEd);
          document.execCommand('insertHTML', false, txt);
          block.remove(); this.queueSave(); return;
        }
      }

      if(e.key==='Tab'){
        e.preventDefault();
        if(e.shiftKey){ if(level>1) block.dataset.level = String(level-1); }
        else{ block.dataset.level = String(level+1); }
        this.queueSave(); return;
      }

      if(e.key==='Escape' && this.isSlashMenuOpen){
        e.preventDefault();
        this.hideSlashMenu();
        return;
      }
    },

    onPaste(e){
      const ed = e.target.closest('[contenteditable]'); if(!ed) return;
      const block = e.target.closest('.wb-block'); const type = block.dataset.type; const level = parseInt(block.dataset.level||'1',10);
      e.preventDefault();
      const text = (e.clipboardData||window.clipboardData).getData('text');
      const lines = text.replace(/\r\n/g,'\n').split('\n');
      if(lines.length===1){ document.execCommand('insertText', false, Editor._escape(lines[0])); this.queueSave(); return; }
      document.execCommand('insertText', false, Editor._escape(lines[0]));
      let ref = block;
      for(let i=1;i<lines.length;i++){
        const val = Editor._escape(lines[i]);
        const next = (type==='bulleted') ? this.createBullet(val) :
                     (type==='numbered') ? this.createNumbered(val) :
                     (type==='checklist') ? this.createChecklist(val,false) :
                     this.createParagraph(val);
        next.dataset.level = String(level);
        ref.insertAdjacentElement('afterend', next); ref = next;
      }
      this.focusBlock(ref); this.queueSave();
    },

    queueSave(){ clearTimeout(this._t); this._t = setTimeout(()=> this.saveCb && this.saveCb(this.serialize()), 250); },

    // Slash menu functions
    createSlashMenu(){
      this.slashMenu = document.createElement('div');
      this.slashMenu.className = 'wb-slash-menu';
      this.slashMenu.style.display = 'none';
      this.slashMenu.innerHTML = `
        <div class="wb-slash-item" data-type="paragraph">
          <div class="wb-slash-icon">📝</div>
          <div class="wb-slash-text">
            <div class="wb-slash-title">Text</div>
            <div class="wb-slash-desc">Just start typing with plain text</div>
          </div>
        </div>
        <div class="wb-slash-item" data-type="heading">
          <div class="wb-slash-icon">📋</div>
          <div class="wb-slash-text">
            <div class="wb-slash-title">Heading 1</div>
            <div class="wb-slash-desc">Big section heading</div>
          </div>
        </div>
        <div class="wb-slash-item" data-type="bulleted">
          <div class="wb-slash-icon">•</div>
          <div class="wb-slash-text">
            <div class="wb-slash-title">Bulleted list</div>
            <div class="wb-slash-desc">Create a simple bulleted list</div>
          </div>
        </div>
        <div class="wb-slash-item" data-type="numbered">
          <div class="wb-slash-icon">1.</div>
          <div class="wb-slash-text">
            <div class="wb-slash-title">Numbered list</div>
            <div class="wb-slash-desc">Create a list with numbering</div>
          </div>
        </div>
        <div class="wb-slash-item" data-type="checklist">
          <div class="wb-slash-icon">☐</div>
          <div class="wb-slash-text">
            <div class="wb-slash-title">To-do list</div>
            <div class="wb-slash-desc">Track tasks with a to-do list</div>
          </div>
        </div>
        <div class="wb-slash-item" data-type="code">
          <div class="wb-slash-icon">💻</div>
          <div class="wb-slash-text">
            <div class="wb-slash-title">Code</div>
            <div class="wb-slash-desc">Capture a code snippet</div>
          </div>
        </div>
        <div class="wb-slash-item" data-type="quote">
          <div class="wb-slash-icon">💬</div>
          <div class="wb-slash-text">
            <div class="wb-slash-title">Quote</div>
            <div class="wb-slash-desc">Capture a quote</div>
          </div>
        </div>
        <div class="wb-slash-item" data-type="divider">
          <div class="wb-slash-icon">➖</div>
          <div class="wb-slash-text">
            <div class="wb-slash-title">Divider</div>
            <div class="wb-slash-desc">Visually divide blocks</div>
          </div>
        </div>
        <div class="wb-slash-item" data-type="image">
          <div class="wb-slash-icon">🖼️</div>
          <div class="wb-slash-text">
            <div class="wb-slash-title">Image</div>
            <div class="wb-slash-desc">Upload or embed an image</div>
          </div>
        </div>
        <div class="wb-slash-item" data-type="embed">
          <div class="wb-slash-icon">🔗</div>
          <div class="wb-slash-text">
            <div class="wb-slash-title">Embed</div>
            <div class="wb-slash-desc">Embed a website or content</div>
          </div>
        </div>
      `;
      document.body.appendChild(this.slashMenu);
      
      // Add click handlers
      this.slashMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.wb-slash-item');
        if(item){
          const type = item.dataset.type;
          this.selectSlashCommand(type);
        }
      });
      
      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if(this.isSlashMenuOpen && !this.slashMenu.contains(e.target) && !e.target.closest('.wb-block')){
          this.hideSlashMenu();
        }
      });
    },

    showSlashMenu(block, ed){
      this.isSlashMenuOpen = true;
      this.currentBlock = block;
      this.currentEditable = ed;
      
      const rect = ed.getBoundingClientRect();
      this.slashMenu.style.display = 'block';
      this.slashMenu.style.left = rect.left + 'px';
      this.slashMenu.style.top = (rect.bottom + 5) + 'px';
      
      // Don't clear content, just show the menu
      this.focusBlock(block);
    },

    hideSlashMenu(){
      this.isSlashMenuOpen = false;
      this.slashMenu.style.display = 'none';
      this.currentBlock = null;
      this.currentEditable = null;
    },

    selectSlashCommand(type){
      if(!this.currentBlock || !this.currentEditable) return;
      
      this.hideSlashMenu();
      
      // Get current content and remove the slash
      const currentContent = this.currentEditable.innerHTML;
      const contentWithoutSlash = currentContent.replace(/\/$/, '');
      
      // Transform current block to selected type
      const level = parseInt(this.currentBlock.dataset.level || '1', 10);
      let newBlock;
      
      switch(type){
        case 'paragraph': newBlock = this.createParagraph(contentWithoutSlash); break;
        case 'heading': newBlock = this.createHeading(1, contentWithoutSlash); break;
        case 'bulleted': newBlock = this.createBullet(contentWithoutSlash); break;
        case 'numbered': newBlock = this.createNumbered(contentWithoutSlash); break;
        case 'checklist': newBlock = this.createChecklist(contentWithoutSlash, false); break;
        case 'code': newBlock = this.createCode(contentWithoutSlash); break;
        case 'quote': newBlock = this.createQuote(contentWithoutSlash); break;
        case 'divider': newBlock = this.createDivider(); break;
        case 'image': newBlock = this.createImage(contentWithoutSlash); break;
        case 'embed': newBlock = this.createEmbed(contentWithoutSlash); break;
        default: newBlock = this.createParagraph(contentWithoutSlash); break;
      }
      
      newBlock.dataset.level = String(level);
      this.currentBlock.replaceWith(newBlock);
      this.focusBlock(newBlock);
      this.queueSave();
    },

    // Drag & drop helpers
    showDropIndicator(targetBlock, e){
      this.removeDropIndicators();
      const rect = targetBlock.getBoundingClientRect();
      const indicator = document.createElement('div');
      indicator.className = 'wb-drop-indicator';
      indicator.style.position = 'absolute';
      indicator.style.left = '0';
      indicator.style.right = '0';
      indicator.style.height = '2px';
      indicator.style.background = 'var(--accent)';
      indicator.style.borderRadius = '1px';
      indicator.style.pointerEvents = 'none';
      indicator.style.zIndex = '1000';
      
      if(e.clientY < rect.top + rect.height / 2){
        // Drop above
        indicator.style.top = (rect.top - 1) + 'px';
        targetBlock.dataset.dropPosition = 'above';
      } else {
        // Drop below
        indicator.style.top = (rect.bottom - 1) + 'px';
        targetBlock.dataset.dropPosition = 'below';
      }
      
      document.body.appendChild(indicator);
    },
    
    removeDropIndicators(){
      const indicators = document.querySelectorAll('.wb-drop-indicator');
      indicators.forEach(ind => ind.remove());
      const blocks = this.root.querySelectorAll('.wb-block');
      blocks.forEach(block => delete block.dataset.dropPosition);
    },
    
    moveBlock(draggedBlock, targetBlock, e){
      const dropPosition = targetBlock.dataset.dropPosition;
      if(dropPosition === 'above'){
        targetBlock.parentNode.insertBefore(draggedBlock, targetBlock);
      } else if(dropPosition === 'below'){
        targetBlock.parentNode.insertBefore(draggedBlock, targetBlock.nextSibling);
      }
      this.queueSave();
    },

    // utils
    _escape(s){ return s.replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); },
    _getText(ed){ return ed.textContent || ''; },
    _getHTML(ed){ return ed.innerHTML || ''; },
    _placeCaretEnd(el){ 
      try {
        const r=document.createRange(); 
        const s=window.getSelection(); 
        r.selectNodeContents(el); 
        r.collapse(false); 
        s.removeAllRanges(); 
        s.addRange(r); 
        // Ensure the element is visible
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Force focus
        el.focus();
      } catch (e) {
        // Fallback: just focus the element
        el.focus();
      }
    },
    _caretAtStart(ed){ const s=window.getSelection(); if(!s.rangeCount) return false; const r=s.getRangeAt(0); return r.startOffset===0; },
    _splitAtCaret(ed){ const s=window.getSelection(); const r=s.getRangeAt(0); const full = ed.innerHTML; const pre = full.slice(0, r.startOffset); const post = full.slice(r.startOffset); ed.innerHTML = pre; return post; }
  };

  // --- App wiring ---
  const App = {
    state: { current: null },

    async boot(){
      console.log('App.boot() starting...');
      
      this.$pages = document.getElementById('wb-pages');
      this.$title = document.getElementById('wb-title');
      this.$crumb = document.getElementById('wb-crumb-title');
      this.$editor = document.getElementById('wb-editor');
      this.$new = document.getElementById('wb-new-page');
      this.$del = document.getElementById('wb-delete');
      this.$search = document.getElementById('wb-search');
      this.$theme = document.getElementById('wb-theme');
      
      console.log('Found elements:', {
        pages: !!this.$pages,
        title: !!this.$title,
        editor: !!this.$editor,
        new: !!this.$new
      });

      // Theme: restore + toggle
      const savedTheme = localStorage.getItem('wb-theme');
      if(savedTheme === 'dark') document.documentElement.classList.add('theme-dark');
      this.$theme.onclick = ()=>{
        document.documentElement.classList.toggle('theme-dark');
        localStorage.setItem('wb-theme', document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light');
      };

      console.log('Initializing editor with element:', this.$editor);
      Editor.init(this.$editor);
      console.log('Editor initialized');
      
      Editor.saveCb = (data)=>{
        const name = this.state.current; if(!name) return;
        api.update(name, { content_json: JSON.stringify(data) }).catch(console.error);
      };

      this.$new.onclick = async ()=>{
        const {name} = await api.create('Untitled');
        await this.refreshSidebar();
        this.open(name);
      };
      this.$del.onclick = async ()=>{
        if(!this.state.current) return; if(!confirm('Delete this page?')) return;
        await api.del(this.state.current); this.state.current = null; await this.refreshSidebar();
        if(this._first) this.open(this._first.name); else this.blank();
      };
      this.$title.addEventListener('input', (e)=>{
        if(!this.state.current) return;
        clearTimeout(this._ts); this._ts = setTimeout(()=>{
          const title = this.$title.value.trim() || 'Untitled';
          api.update(this.state.current, { title: title }).then(()=> this.refreshSidebar());
          this.$crumb.textContent = title;
        }, 250);
      });
      this.$search.addEventListener('input', ()=> this.refreshSidebar(this.$search.value));

      await this.refreshSidebar();
      if(this._first) this.open(this._first.name); else await this.createWelcome();
      
      // Fallback: ensure there's always a block to work with
      setTimeout(() => {
        const blocks = this.$editor.querySelectorAll('.wb-block');
        if(blocks.length === 0){
          console.log('No blocks found, creating fallback block');
          const fallbackBlock = Editor.createParagraph('Click here to start typing...');
          this.$editor.appendChild(fallbackBlock);
          Editor.focusBlock(fallbackBlock);
        }
      }, 1000);
    },

    async createWelcome(){
      try {
        const {name} = await api.create('Welcome to Workbench');
        await this.refreshSidebar();
        await this.open(name);
        const welcome = { blocks:[
          {id:Editor._uuid(), type:'heading', level:1, text:'Welcome to Workbench!'},
          {id:Editor._uuid(), type:'paragraph', level:1, text:"This is a Notion-style editor. Try these features:"},
          {id:Editor._uuid(), type:'bulleted', level:1, text:"Press '/' to open the slash menu"},
          {id:Editor._uuid(), type:'bulleted', level:1, text:"Use Ctrl+B for bold, Ctrl+I for italic, Ctrl+U for underline"},
          {id:Editor._uuid(), type:'bulleted', level:1, text:"Press Enter to create new blocks"},
          {id:Editor._uuid(), type:'bulleted', level:1, text:"Use Tab to indent blocks"},
          {id:Editor._uuid(), type:'checklist', level:1, text:'Try different block types from the slash menu', checked:false},
          {id:Editor._uuid(), type:'code', level:1, text:'// Code blocks for snippets'},
          {id:Editor._uuid(), type:'quote', level:1, text:'Quote blocks for important text'},
          {id:Editor._uuid(), type:'divider', level:1, text:''}
        ]};
        await api.update(name, { content_json: JSON.stringify(welcome) });
        this.open(name);
      } catch (error) {
        console.error('Error creating welcome page:', error);
        // If welcome page creation fails, just create a regular new page
        const {name} = await api.create('New Page');
        await this.refreshSidebar();
        this.open(name);
      }
    },

    async refreshSidebar(search=""){
      const items = await api.list(search);
      this.$pages.innerHTML = '';
      items.forEach((p,i)=>{
        if(i===0) this._first = p;
        const el = document.createElement('div');
        el.className = 'wb-page-item' + (p.name===this.state.current?' active':'');
        el.textContent = p.title || p.name;
        el.onclick = ()=> this.open(p.name);
        this.$pages.appendChild(el);
      });
    },

    async open(name){
      const data = await api.get(name);
      this.state.current = data.name;
      this.$title.value = data.title || '';
      this.$crumb.textContent = this.$title.value || 'Untitled';
      let blocks = null;
      try{ blocks = data.content_json ? JSON.parse(data.content_json) : null; }catch(_){ blocks = null; }
      Editor.render(blocks);
      
      // Ensure focus after opening a page
      setTimeout(() => {
        const firstBlock = Editor.root.querySelector('.wb-block');
        if(firstBlock){
          Editor.focusBlock(firstBlock);
        }
      }, 100);
    },

    blank(){
      this.$title.value = '';
      this.$crumb.textContent = 'Untitled';
      Editor.render({blocks:[{id:Editor._uuid(), type:'paragraph', level:1, text:''}]});
    }
  };

  // Expose App globally for external access
  window.WorkbenchApp = App;
  window.WorkbenchEditor = Editor;
  
  window.addEventListener('DOMContentLoaded', ()=> {
    console.log('DOM loaded, starting app...');
    App.boot().catch(console.error);
  });
})();
