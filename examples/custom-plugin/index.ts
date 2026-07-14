import type { Plugin } from '@richly/core';

/**
 * Demo plugin that inserts an atomic, human-readable timestamp badge.
 *
 * The badge stores its visual identity in a durable class so host applications
 * can theme it without expanding Richly's sanitizer style allowlist. The live
 * node is non-editable, while the following non-breaking space gives the user
 * an immediate caret position for continuing to type.
 */
export const customPlugin: Plugin = {
  name: 'custom-demo',
  init(editor) {
    editor.commands.register('insertCustomTimestamp', {
      execute(ed) {
        const range = ed.selection.getRange();
        if (!range) return;

        const date = new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short'
        });
        const doc = ed.getBody().ownerDocument;
        const badge = doc.createElement('span');
        badge.className = 'custom-timestamp-badge';
        badge.textContent = `⏱️ ${date}`;
        badge.contentEditable = 'false';

        range.deleteContents();
        range.insertNode(badge);

        // Keep the atomic badge selectable while placing a usable caret after
        // it, rather than trapping subsequent typing inside the plugin node.
        const space = doc.createTextNode('\u00a0');
        badge.after(space);
        range.setStartAfter(space);
        range.collapse(true);
        ed.selection.setRange(range);
        ed.events.emit('change', ed.getContent());
      }
    });

    editor.ui.addButton('customTimestamp', {
      icon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
      tooltip: 'Insert timestamp (custom plugin)',
      command: 'insertCustomTimestamp'
    });

    editor.ui.addMenuItem('customTimestampMenu', {
      menu: 'insert',
      text: 'Custom timestamp',
      command: 'insertCustomTimestamp'
    });
  }
};
