/**
 * Injected stylesheet for the inline image toolbar. The plugin owns its CSS
 * (rather than the core theme file) so `@richly/core` stays image-agnostic;
 * all colors come from Richly theme tokens, keeping light/dark support.
 */

const STYLE_ID = 'rly-image-inline-toolbar-styles';

const css = `
.rly-image-inline-toolbar {
  position: absolute;
  z-index: 45;
  display: none;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--rly-surface);
  border: 1px solid var(--rly-border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(20, 30, 50, 0.16);
  white-space: nowrap;
}
.rly-image-inline-toolbar.rly-open { display: flex; }
.rly-image-inline-toolbar::before {
  content: '';
  position: absolute;
  top: auto;
  bottom: -5px;
  left: var(--rly-image-toolbar-pointer, 50%);
  width: 10px;
  height: 10px;
  transform: translateX(-50%) rotate(45deg);
  background: var(--rly-surface);
  border-right: 1px solid var(--rly-border);
  border-bottom: 1px solid var(--rly-border);
}
.rly-image-inline-toolbar.rly-flip::before {
  top: -5px;
  bottom: auto;
  border: none;
  border-left: 1px solid var(--rly-border);
  border-top: 1px solid var(--rly-border);
}
.rly-image-inline-btn {
  position: relative;
  width: 34px;
  height: 32px;
  display: grid;
  place-items: center;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: var(--rly-text);
}
.rly-image-inline-btn:hover { background: var(--rly-hover); color: var(--rly-accent); }
.rly-image-inline-btn:hover::after,
.rly-image-inline-btn:focus-visible::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 2;
  transform: translateX(-50%);
  max-width: 180px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--rly-text);
  color: var(--rly-surface);
  font: 500 12px/1.2 system-ui, sans-serif;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
}
.rly-image-inline-btn:disabled { opacity: 0.55; cursor: default; }
.rly-image-inline-btn:disabled:hover { background: none; color: var(--rly-text); }
.rly-image-inline-btn.rly-active { background: var(--rly-active); color: var(--rly-accent); }
.rly-image-inline-btn.rly-busy svg { animation: rly-image-spin 0.8s linear infinite; }
@keyframes rly-image-spin { to { transform: rotate(360deg); } }
.rly-image-inline-label {
  font: 500 13px/1 system-ui, sans-serif;
  color: var(--rly-text-dim);
  padding: 0 6px 0 2px;
}
.rly-image-inline-sep {
  width: 1px;
  height: 22px;
  background: var(--rly-border);
  margin: 0 6px;
}

/* Compact editors swap the floating bubble for a bottom contextual bar. */
.rly-image-inline-toolbar.rly-compact {
  left: 8px !important;
  right: 8px;
  top: auto !important;
  bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  justify-content: space-around;
  border-radius: 14px;
}
.rly-image-inline-toolbar.rly-compact::before { display: none; }
.rly-image-inline-toolbar.rly-compact .rly-image-inline-btn {
  min-width: 44px;
  min-height: 44px;
}
.rly-image-inline-toolbar.rly-compact .rly-image-inline-label { display: none; }

/* Popovers (adjust slider, alt text) and menus (align, more). */
.rly-image-inline-popover {
  position: absolute;
  z-index: 46;
  display: none;
  box-sizing: border-box;
  min-width: 216px;
  padding: 12px;
  background: var(--rly-surface);
  border: 1px solid var(--rly-border);
  border-radius: 12px;
  box-shadow: 0 14px 38px rgba(15, 23, 42, 0.2);
}
.rly-image-inline-popover.rly-open { display: block; }
.rly-image-inline-popover.rly-sheet {
  left: 8px !important;
  right: 8px;
  top: auto !important;
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
}
.rly-image-inline-popover-title {
  font: 600 13px/1.2 system-ui, sans-serif;
  color: var(--rly-text);
  margin: 0 0 8px;
}
.rly-image-inline-popover input[type='range'] { width: 100%; accent-color: var(--rly-accent); }
.rly-image-inline-popover-value {
  font: 500 12px/1 system-ui, sans-serif;
  color: var(--rly-text-dim);
  float: right;
}
.rly-image-inline-crop-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(42px, 1fr));
  gap: 8px;
}
.rly-image-inline-crop-grid button {
  min-height: 44px;
  padding: 7px 9px;
  border: 1px solid var(--rly-border);
  border-radius: 8px;
  background: var(--rly-surface);
  color: var(--rly-text);
  cursor: pointer;
  font: 600 13px/1 system-ui, sans-serif;
}
.rly-image-inline-crop-grid button:hover,
.rly-image-inline-crop-grid button.rly-active {
  background: var(--rly-active);
  color: var(--rly-accent);
}
.rly-image-inline-popover-actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
}
.rly-image-inline-popover-actions button,
.rly-image-inline-menu-item {
  font: 500 13px/1 system-ui, sans-serif;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--rly-border);
  background: var(--rly-surface);
  color: var(--rly-text);
  cursor: pointer;
}
.rly-image-inline-popover-actions button:hover { background: var(--rly-hover); }
.rly-image-inline-popover-actions button.rly-primary {
  background: var(--rly-accent);
  border-color: var(--rly-accent);
  color: var(--rly-surface);
}
.rly-image-inline-popover-actions button:disabled { opacity: 0.55; cursor: default; }
.rly-image-inline-popover input[type='text'] {
  box-sizing: border-box;
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--rly-border);
  border-radius: 8px;
  background: var(--rly-surface);
  color: var(--rly-text);
  font: 400 13px/1.3 system-ui, sans-serif;
}
.rly-image-inline-menu { min-width: 184px; padding: 6px; }
.rly-image-inline-menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  border: none;
  text-align: left;
  background: none;
}
.rly-image-inline-menu-item:hover { background: var(--rly-hover); }
.rly-image-inline-menu-item.rly-active { background: var(--rly-active); color: var(--rly-accent); }
.rly-image-inline-menu-item.rly-danger { color: #c22f3e; }
.rly-image-inline-menu-item.rly-danger:hover { background: rgba(194, 47, 62, 0.12); }

.rly-image-inline-error {
  display: flex;
  align-items: center;
  gap: 8px;
  font: 500 12px/1.3 system-ui, sans-serif;
  color: #c22f3e;
  padding: 0 4px;
  white-space: normal;
  max-width: 260px;
}

.rly-image-inline-live {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
`;

/** Installs the toolbar stylesheet once per document. */
export function ensureInlineToolbarStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  doc.head.appendChild(style);
}
