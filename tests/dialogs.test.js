import test from 'node:test';
import assert from 'node:assert/strict';
import { createDialogManager } from '../js/dialogs.js';

// A small DOM model exercises keyboard/focus behavior without a browser runtime.
test('nested dialogs isolate the background, trap Tab, close only the top and restore focus after replacement', () => {
  const handlers = new Map();
  const document = { activeElement: null, addEventListener: (name, handler) => handlers.set(name, handler), removeEventListener: name => handlers.delete(name) };
  class Element {
    constructor(tag, attrs = {}) {
      this.tagName = tag.toUpperCase(); this.attrs = attrs; this.children = []; this.inert = false;
      this.hidden = false; this.disabled = false; this.isConnected = true; this.scrollTop = 0;
      this.dataset = { uiDialog: attrs['data-ui-dialog'] };
    }
    get attributes() { return Object.entries(this.attrs).map(([name, value]) => ({ name, value })); }
    append(node) { node.parent = this; this.children.push(node); }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    closest(selector) { const key = selector.slice(1, -1); for (let node = this; node; node = node.parent) if (node[key]) return node; return null; }
    getClientRects() { return this.hidden ? [] : [{}]; }
    focus() { document.activeElement = this; }
    click() { this.onclick?.(); }
    matches(selector) {
      if (selector.startsWith('input')) return this.tagName === 'INPUT';
      if (selector === '[data-dialog-close]') return 'data-dialog-close' in this.attrs;
      const attrs = [...selector.matchAll(/\[([^=]+)="([^"]*)"\]/g)];
      return attrs.length && attrs.every(([, name, value]) => this.attrs[name] === value);
    }
    querySelectorAll() { return this.children.flatMap(child => ['BUTTON','INPUT','SELECT'].includes(child.tagName) ? [child] : child.querySelectorAll()); }
    querySelector(selector) { return this.querySelectorAll().find(child => child.matches(selector)); }
    disconnect() { this.isConnected = false; for (const node of this.children) node.disconnect(); }
  }
  const body = new Element('body'), app = new Element('main'), opener = new Element('button', { 'data-open': 'roster' });
  body.append(app); app.append(opener); document.body = body;
  document.querySelectorAll = () => body.children.filter(node => node.dataset.uiDialog);
  document.querySelector = selector => body.querySelector(selector);
  const panel = key => {
    const node = new Element('section', { 'data-ui-dialog': key });
    const close = new Element('button', { 'data-dialog-close': '', 'data-close': key });
    const input = new Element('input', { 'data-edit': key });
    node.append(close); node.append(input); body.append(node);
    return { node, close, input };
  };
  globalThis.document = document; globalThis.CSS = { escape: value => value };
  const manager = createDialogManager();
  try {
    opener.focus(); manager.beforeRender();
    let roster = panel('roster'); manager.sync();
    assert.equal(document.activeElement, roster.input);
    assert.equal(app.inert, true);
    let prevented = 0;
    const key = (key, shiftKey = false) => handlers.get('keydown')({ key, shiftKey, preventDefault: () => prevented++, stopImmediatePropagation() {} });
    roster.close.focus(); key('Tab', true);
    assert.equal(document.activeElement, roster.input);
    key('Tab'); assert.equal(document.activeElement, roster.close);
    roster.input.focus(); roster.node.scrollTop = 120;
    manager.beforeRender();
    const old = roster;
    body.children = body.children.filter(node => node !== old.node); old.node.disconnect();
    roster = panel('roster'); manager.sync();
    assert.equal(document.activeElement, roster.input, 'replacement restores the same control');
    assert.equal(roster.node.scrollTop, 120);
    roster.close.focus(); manager.beforeRender();
    const rename = panel('rename'); manager.sync();
    assert.equal(roster.node.inert, true);
    let rosterClosed = 0, renameClosed = 0;
    roster.close.onclick = () => {
      rosterClosed++; manager.beforeRender();
      body.children = body.children.filter(node => node !== roster.node); roster.node.disconnect(); manager.sync();
    };
    rename.close.onclick = () => {
      renameClosed++; manager.beforeRender();
      body.children = body.children.filter(node => node !== rename.node); rename.node.disconnect(); manager.sync();
    };
    key('Escape');
    assert.equal(renameClosed, 1); assert.equal(rosterClosed, 0);
    assert.equal(document.activeElement, roster.close);
    assert.equal(roster.node.inert, false); assert.equal(app.inert, true);
    key('Escape');
    assert.equal(rosterClosed, 1); assert.equal(app.inert, false);
    assert.equal(document.activeElement, opener);
    assert.equal(prevented, 4);
  } finally {
    manager.dispose(); delete globalThis.document; delete globalThis.CSS;
  }
});
