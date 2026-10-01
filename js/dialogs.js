const DIALOG = '[data-ui-dialog]';
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
const visible = node => !node.hidden && !node.closest('[hidden]') && node.getClientRects().length;

function focusSnapshot(node) {
  if (!node || node === document.body) return null;
  const attributes = [...node.attributes].filter(a => a.name === 'id' || a.name.startsWith('data-'));
  const selector = attributes.length ? node.tagName.toLowerCase() + attributes.map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') : null;
  return { node, selector, start: node.selectionStart, end: node.selectionEnd };
}
function restoreFocus(snapshot, scope = document) {
  const node = snapshot?.node?.isConnected ? snapshot.node : snapshot?.selector && scope.querySelector(snapshot.selector);
  if (!node || node.disabled || node.closest('[inert]') || !visible(node)) return false;
  node.focus({ preventScroll: true });
  if (snapshot.start != null && node.setSelectionRange) node.setSelectionRange(snapshot.start, snapshot.end);
  return true;
}

export function createDialogManager() {
  let stack = [], active = null;
  const inertNodes = new Map();
  function releaseInert() {
    for (const [node, inert] of inertNodes) node.inert = inert;
    inertNodes.clear();
  }
  function isolate(top, parent = document.body) {
    for (const node of parent.children) {
      if (node === top || /^(SCRIPT|STYLE)$/.test(node.tagName)) continue;
      if (node.contains(top)) isolate(top, node);
      else { inertNodes.set(node, node.inert); node.inert = true; }
    }
  }
  function beforeRender() {
    active = focusSnapshot(document.activeElement);
    for (const entry of stack) {
      entry.scroll = entry.panel.scrollTop;
      if (entry.panel.contains(document.activeElement)) entry.focus = active;
    }
    releaseInert();
  }
  function sync() {
    releaseInert();
    const panels = [...document.querySelectorAll(DIALOG)];
    const previous = stack.at(-1);
    const next = panels.map(panel => {
      const existing = stack.find(entry => entry.key === panel.dataset.uiDialog);
      if (existing) { panel.scrollTop = existing.scroll; return { ...existing, panel }; }
      return { key: panel.dataset.uiDialog, panel, opener: active || focusSnapshot(document.activeElement), scroll: 0 };
    });
    const top = next.at(-1);
    stack = next;
    if (!top) {
      if (previous) restoreFocus(previous.opener);
      active = null;
      return;
    }
    isolate(top.panel);
    if (top.panel.contains(document.activeElement)) return;
    const saved = previous?.key === top.key ? top.focus || active : previous?.opener;
    if (!restoreFocus(saved, top.panel) || !top.panel.contains(document.activeElement)) {
      const target = top.panel.querySelector('input:not([type="color"]):not(:disabled)') || [...top.panel.querySelectorAll(FOCUSABLE)].find(visible) || top.panel;
      if (target === top.panel) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
    active = null;
  }
  function keydown(event) {
    const panel = stack.at(-1)?.panel;
    if (!panel) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      panel.querySelector('[data-dialog-close]')?.click();
    }
    if (event.key === 'Tab') {
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter(visible);
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (!panel.contains(document.activeElement) || event.shiftKey && document.activeElement === first) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('keydown', keydown, true);
  return { beforeRender, sync, dispose() { releaseInert(); document.removeEventListener('keydown', keydown, true); stack = []; } };
}

export const dialogs = typeof document === 'undefined' ? null : createDialogManager();
