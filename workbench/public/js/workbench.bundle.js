(() => {
  // ../workbench/workbench/public/js/workbench.bundle.js
  (() => {
    (() => {
      (() => {
        (() => {
          (() => {
            (() => {
              (() => {
                (() => {
                  (() => {
                    (() => {
                      (() => {
                        (function() {
                          const api = {
                            async list(search = "") {
                              const r = await fetch(`/api/method/workbench.api.list_pages?search=${encodeURIComponent(search)}`);
                              const j = await r.json();
                              if (j.exc)
                                throw j.exc;
                              return j.message || [];
                            },
                            async get(name) {
                              const r = await fetch(`/api/method/workbench.api.get_page?name=${encodeURIComponent(name)}`);
                              const j = await r.json();
                              if (j.exc)
                                throw j.exc;
                              return j.message;
                            },
                            async create(title = "Untitled") {
                              const r = await fetch(`/api/method/workbench.api.create_page`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": frappe.csrf_token },
                                body: JSON.stringify({ title })
                              });
                              const j = await r.json();
                              if (j.exc)
                                throw j.exc;
                              return j.message;
                            },
                            async update(name, payload) {
                              const r = await fetch(`/api/method/workbench.api.update_page`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": frappe.csrf_token },
                                body: JSON.stringify(Object.assign({ name }, payload))
                              });
                              const j = await r.json();
                              if (j.exc)
                                throw j.exc;
                              return j.message;
                            },
                            async del(name) {
                              const r = await fetch(`/api/method/workbench.api.delete_page`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": frappe.csrf_token },
                                body: JSON.stringify({ name })
                              });
                              const j = await r.json();
                              if (j.exc)
                                throw j.exc;
                              return j.message;
                            }
                          };
                          const Editor = {
                            init(root) {
                              this.root = root;
                              this.saveCb = null;
                              root.addEventListener("keydown", this.onKeyDown.bind(this));
                              root.addEventListener("paste", this.onPaste.bind(this));
                              root.addEventListener("click", (e) => {
                                const b = e.target.closest(".wb-block");
                                if (!b)
                                  return;
                                const plus = e.target.closest(".wb-plus");
                                if (plus) {
                                  this.insertAfter(b, Editor.createParagraph(""));
                                  this.focusBlock(b.nextElementSibling);
                                  this.queueSave();
                                }
                              });
                            },
                            createParagraph(text = "") {
                              return Editor._block({ type: "paragraph", level: 1, text });
                            },
                            createHeading(level = 1, text = "") {
                              return Editor._block({ type: "heading", level, text });
                            },
                            createBullet(text = "") {
                              return Editor._block({ type: "bulleted", level: 1, text });
                            },
                            createNumbered(text = "") {
                              return Editor._block({ type: "numbered", level: 1, text });
                            },
                            createChecklist(text = "", checked = false) {
                              return Editor._block({ type: "checklist", level: 1, text, checked });
                            },
                            _uuid() {
                              return "b-" + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
                            },
                            _block({ type, level = 1, text = "", checked = false }) {
                              const el = document.createElement("div");
                              el.className = "wb-block";
                              el.dataset.id = Editor._uuid();
                              el.dataset.type = type;
                              el.dataset.level = String(level);
                              el.innerHTML = `
        <div class="wb-gutter">
          <div class="wb-handle">\u22EE</div>
          <div class="wb-plus">+</div>
        </div>
        <div class="wb-content">${Editor._blockInner(type, level, text, checked)}</div>`;
                              Editor._bindBlock(el);
                              return el;
                            },
                            _blockInner(type, level, text, checked) {
                              text = Editor._escape(text);
                              if (type === "heading" && (level === 1 || level === 2 || level === 3))
                                return `<div class="wb-h${level}" contenteditable="true">${text}</div>`;
                              if (type === "bulleted")
                                return `<ul class="wb-ul"><li contenteditable="true">${text}</li></ul>`;
                              if (type === "numbered")
                                return `<ol class="wb-ol"><li contenteditable="true">${text}</li></ol>`;
                              if (type === "checklist")
                                return `<div class="wb-check"><input class="wb-checkbox" type="checkbox" ${checked ? "checked" : ""}/><span contenteditable="true">${text}</span></div>`;
                              return `<p contenteditable="true">${text}</p>`;
                            },
                            _bindBlock(el) {
                              el.addEventListener("change", (e) => {
                                if (e.target.matches(".wb-checkbox")) {
                                  this.queueSave();
                                }
                              });
                              el.addEventListener("input", () => this.queueSave());
                            },
                            render(blocks) {
                              if (!blocks || !Array.isArray(blocks.blocks)) {
                                blocks = { blocks: [{ id: this._uuid(), type: "paragraph", level: 1, text: "" }] };
                              }
                              this.root.innerHTML = "";
                              blocks.blocks.forEach((b) => {
                                const el = Editor._block(b);
                                el.dataset.level = String(b.level || 1);
                                this.root.appendChild(el);
                              });
                              if (!this.root.children.length) {
                                this.root.appendChild(Editor.createParagraph(""));
                              }
                            },
                            serialize() {
                              var _a, _b, _c, _d, _e;
                              const out = [];
                              for (const el of this.root.querySelectorAll(".wb-block")) {
                                const type = el.dataset.type;
                                const level = parseInt(el.dataset.level || "1", 10);
                                let text = "", checked = false;
                                if (type === "heading")
                                  text = ((_a = el.querySelector("[contenteditable]")) == null ? void 0 : _a.innerHTML) || "";
                                else if (type === "bulleted" || type === "numbered")
                                  text = ((_b = el.querySelector("li[contenteditable]")) == null ? void 0 : _b.innerHTML) || "";
                                else if (type === "checklist") {
                                  text = ((_c = el.querySelector("span[contenteditable]")) == null ? void 0 : _c.innerHTML) || "";
                                  checked = ((_d = el.querySelector(".wb-checkbox")) == null ? void 0 : _d.checked) || false;
                                } else
                                  text = ((_e = el.querySelector("p[contenteditable]")) == null ? void 0 : _e.innerHTML) || "";
                                out.push({ id: el.dataset.id, type, level, text, checked });
                              }
                              return { blocks: out };
                            },
                            insertAfter(blockEl, newEl) {
                              blockEl.insertAdjacentElement("afterend", newEl);
                            },
                            focusBlock(blockEl) {
                              const ed = blockEl.querySelector("[contenteditable]");
                              if (ed) {
                                ed.focus();
                                Editor._placeCaretEnd(ed);
                              }
                            },
                            onKeyDown(e) {
                              const ed = e.target.closest("[contenteditable]");
                              if (!ed)
                                return;
                              const block = e.target.closest(".wb-block");
                              if (!block)
                                return;
                              const type = block.dataset.type;
                              const level = parseInt(block.dataset.level || "1", 10);
                              if (e.key === "Enter") {
                                if (e.shiftKey)
                                  return;
                                e.preventDefault();
                                const content = Editor._getText(ed);
                                const empty = content.trim() === "";
                                if (type === "bulleted" || type === "numbered" || type === "checklist") {
                                  if (empty) {
                                    if (level > 1) {
                                      block.dataset.level = String(level - 1);
                                      return;
                                    }
                                    block.dataset.type = "paragraph";
                                    block.querySelector(".wb-content").innerHTML = Editor._blockInner("paragraph", 1, "");
                                    this.focusBlock(block);
                                    this.queueSave();
                                    return;
                                  }
                                }
                                const afterText = Editor._splitAtCaret(ed);
                                const next = type === "heading" ? this.createParagraph(afterText) : type === "bulleted" ? this.createBullet(afterText) : type === "numbered" ? this.createNumbered(afterText) : type === "checklist" ? this.createChecklist(afterText, false) : this.createParagraph(afterText);
                                next.dataset.level = String(level);
                                this.insertAfter(block, next);
                                this.focusBlock(next);
                                this.queueSave();
                                return;
                              }
                              if (e.key === "Backspace") {
                                const atStart = Editor._caretAtStart(ed);
                                if (atStart) {
                                  e.preventDefault();
                                  const prev = block.previousElementSibling;
                                  if (!prev)
                                    return;
                                  const txt = Editor._getHTML(ed);
                                  const prevEd = prev.querySelector("[contenteditable]");
                                  Editor._placeCaretEnd(prevEd);
                                  document.execCommand("insertHTML", false, txt);
                                  block.remove();
                                  this.queueSave();
                                  return;
                                }
                              }
                              if (e.key === "Tab") {
                                e.preventDefault();
                                if (e.shiftKey) {
                                  if (level > 1)
                                    block.dataset.level = String(level - 1);
                                } else {
                                  block.dataset.level = String(level + 1);
                                }
                                this.queueSave();
                                return;
                              }
                            },
                            onPaste(e) {
                              const ed = e.target.closest("[contenteditable]");
                              if (!ed)
                                return;
                              const block = e.target.closest(".wb-block");
                              const type = block.dataset.type;
                              const level = parseInt(block.dataset.level || "1", 10);
                              e.preventDefault();
                              const text = (e.clipboardData || window.clipboardData).getData("text");
                              const lines = text.replace(/\r\n/g, "\n").split("\n");
                              if (lines.length === 1) {
                                document.execCommand("insertText", false, Editor._escape(lines[0]));
                                this.queueSave();
                                return;
                              }
                              document.execCommand("insertText", false, Editor._escape(lines[0]));
                              let ref = block;
                              for (let i = 1; i < lines.length; i++) {
                                const val = Editor._escape(lines[i]);
                                const next = type === "bulleted" ? this.createBullet(val) : type === "numbered" ? this.createNumbered(val) : type === "checklist" ? this.createChecklist(val, false) : this.createParagraph(val);
                                next.dataset.level = String(level);
                                ref.insertAdjacentElement("afterend", next);
                                ref = next;
                              }
                              this.focusBlock(ref);
                              this.queueSave();
                            },
                            queueSave() {
                              clearTimeout(this._t);
                              this._t = setTimeout(() => this.saveCb && this.saveCb(this.serialize()), 250);
                            },
                            _escape(s) {
                              return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
                            },
                            _getText(ed) {
                              return ed.textContent || "";
                            },
                            _getHTML(ed) {
                              return ed.innerHTML || "";
                            },
                            _placeCaretEnd(el) {
                              const r = document.createRange();
                              const s = window.getSelection();
                              r.selectNodeContents(el);
                              r.collapse(false);
                              s.removeAllRanges();
                              s.addRange(r);
                            },
                            _caretAtStart(ed) {
                              const s = window.getSelection();
                              if (!s.rangeCount)
                                return false;
                              const r = s.getRangeAt(0);
                              return r.startOffset === 0;
                            },
                            _splitAtCaret(ed) {
                              const s = window.getSelection();
                              const r = s.getRangeAt(0);
                              const full = ed.innerHTML;
                              const pre = full.slice(0, r.startOffset);
                              const post = full.slice(r.startOffset);
                              ed.innerHTML = pre;
                              return post;
                            }
                          };
                          const App = {
                            state: { current: null },
                            async boot() {
                              this.$pages = document.getElementById("wb-pages");
                              this.$title = document.getElementById("wb-title");
                              this.$crumb = document.getElementById("wb-crumb-title");
                              this.$editor = document.getElementById("wb-editor");
                              this.$new = document.getElementById("wb-new-page");
                              this.$del = document.getElementById("wb-delete");
                              this.$search = document.getElementById("wb-search");
                              this.$theme = document.getElementById("wb-theme");
                              const savedTheme = localStorage.getItem("wb-theme");
                              if (savedTheme === "dark")
                                document.documentElement.classList.add("theme-dark");
                              this.$theme.onclick = () => {
                                document.documentElement.classList.toggle("theme-dark");
                                localStorage.setItem("wb-theme", document.documentElement.classList.contains("theme-dark") ? "dark" : "light");
                              };
                              Editor.init(this.$editor);
                              Editor.saveCb = (data) => {
                                const name = this.state.current;
                                if (!name)
                                  return;
                                api.update(name, { content_json: JSON.stringify(data) }).catch(console.error);
                              };
                              this.$new.onclick = async () => {
                                const { name } = await api.create("Untitled");
                                await this.refreshSidebar();
                                this.open(name);
                              };
                              this.$del.onclick = async () => {
                                if (!this.state.current)
                                  return;
                                if (!confirm("Delete this page?"))
                                  return;
                                await api.del(this.state.current);
                                this.state.current = null;
                                await this.refreshSidebar();
                                if (this._first)
                                  this.open(this._first.name);
                                else
                                  this.blank();
                              };
                              this.$title.addEventListener("input", (e) => {
                                if (!this.state.current)
                                  return;
                                clearTimeout(this._ts);
                                this._ts = setTimeout(() => {
                                  api.update(this.state.current, { title: this.$title.value }).then(() => this.refreshSidebar());
                                  this.$crumb.textContent = this.$title.value || "Untitled";
                                }, 250);
                              });
                              this.$search.addEventListener("input", () => this.refreshSidebar(this.$search.value));
                              await this.refreshSidebar();
                              if (this._first)
                                this.open(this._first.name);
                              else
                                await this.createWelcome();
                            },
                            async createWelcome() {
                              const { name } = await api.create("New page");
                              await this.refreshSidebar();
                              await this.open(name);
                              const welcome = { blocks: [
                                { id: Editor._uuid(), type: "heading", level: 1, text: "New page" },
                                { id: Editor._uuid(), type: "paragraph", level: 1, text: "Write, press '/' for commands\u2026" },
                                { id: Editor._uuid(), type: "bulleted", level: 1, text: "Bulleted item" },
                                { id: Editor._uuid(), type: "numbered", level: 1, text: "Numbered item" },
                                { id: Editor._uuid(), type: "checklist", level: 1, text: "Checklist item", checked: false }
                              ] };
                              await api.update(name, { content_json: JSON.stringify(welcome) });
                              this.open(name);
                            },
                            async refreshSidebar(search = "") {
                              const items = await api.list(search);
                              this.$pages.innerHTML = "";
                              items.forEach((p, i) => {
                                if (i === 0)
                                  this._first = p;
                                const el = document.createElement("div");
                                el.className = "wb-page-item" + (p.name === this.state.current ? " active" : "");
                                el.textContent = p.title || p.name;
                                el.onclick = () => this.open(p.name);
                                this.$pages.appendChild(el);
                              });
                            },
                            async open(name) {
                              const data = await api.get(name);
                              this.state.current = data.name;
                              this.$title.value = data.title || "";
                              this.$crumb.textContent = this.$title.value || "Untitled";
                              let blocks = null;
                              try {
                                blocks = data.content_json ? JSON.parse(data.content_json) : null;
                              } catch (_) {
                                blocks = null;
                              }
                              Editor.render(blocks);
                            },
                            blank() {
                              this.$title.value = "";
                              this.$crumb.textContent = "Untitled";
                              Editor.render({ blocks: [{ id: Editor._uuid(), type: "paragraph", level: 1, text: "" }] });
                            }
                          };
                          window.addEventListener("DOMContentLoaded", () => App.boot().catch(console.error));
                        })();
                      })();
                    })();
                  })();
                })();
              })();
            })();
          })();
        })();
      })();
    })();
  })();
})();
//# sourceMappingURL=workbench.bundle.XQLYLLO7.js.map
