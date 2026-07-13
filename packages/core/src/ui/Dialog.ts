import type { Editor } from '../editor/Editor';

export interface DialogField {
  name: string;
  label: string;
  type?: 'text' | 'url' | 'number' | 'textarea' | 'select' | 'checkbox' | 'file';
  placeholder?: string;
  hint?: string;
  /** For checkbox: 'true' | 'false'. */
  value?: string;
  /** For type 'select'. */
  options?: { value: string; label: string }[];
  /** For type 'file'. */
  accept?: string;
}

export type DialogResult = Record<string, string> & { files?: Record<string, File> };

export interface DialogSpec {
  name: string;
  title: string;
  description?: string;
  fields: DialogField[];
  submitText?: string;
  /** A compact two-column form on wider screens, collapsing to one column. */
  layout?: 'single' | 'grid';
}

/**
 * Declarative modal dialog (DESIGN.md §2.5). Saves the selection bookmark on
 * open and restores it on close, so commands run against the original selection.
 * data-testids (TESTING.md §4): dialog-<name>, dialog-field-<name>, dialog-submit, dialog-cancel.
 * Resolves with the field values, or null on cancel.
 */
export function openDialog(editor: Editor, spec: DialogSpec): Promise<DialogResult | null> {
  const doc = editor.getRoot().ownerDocument;
  const bookmark = editor.selection.getBookmark();

  const globalObj = globalThis as { process?: { env?: Record<string, string | undefined> } };
  const isDevMode = globalObj.process?.env?.NODE_ENV !== 'production';
  if (isDevMode && spec.fields.some((field) => field.name === 'files')) {
    console.warn('[richly] "files" is a reserved dialog field name');
  }

  return new Promise((resolve) => {
    const overlay = doc.createElement('div');
    overlay.className = 'rly-dialog-overlay';

    const dialog = doc.createElement('div');
    dialog.className = 'rly-dialog';
    dialog.dataset.testid = `dialog-${spec.name}`;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', spec.title);

    const header = doc.createElement('div');
    header.className = 'rly-dialog-header';
    const heading = doc.createElement('div');
    const titleEl = doc.createElement('div');
    titleEl.className = 'rly-dialog-title';
    titleEl.textContent = spec.title;
    heading.appendChild(titleEl);
    if (spec.description) {
      const description = doc.createElement('div');
      description.className = 'rly-dialog-description';
      description.textContent = spec.description;
      heading.appendChild(description);
    }
    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'rly-dialog-close';
    closeBtn.dataset.testid = 'dialog-close';
    closeBtn.setAttribute('aria-label', 'Close dialog');
    closeBtn.textContent = '×';
    header.append(heading, closeBtn);
    dialog.appendChild(header);

    const fields = doc.createElement('div');
    fields.className =
      spec.layout === 'grid' ? 'rly-dialog-fields rly-dialog-fields-grid' : 'rly-dialog-fields';

    type FieldEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const inputs = new Map<string, FieldEl>();
    for (const field of spec.fields) {
      const row = doc.createElement('label');
      row.className = 'rly-dialog-row';
      const labelEl = doc.createElement('span');
      labelEl.textContent = field.label;
      let input: FieldEl;
      if (field.type === 'textarea') {
        input = doc.createElement('textarea');
        input.rows = 12;
        input.placeholder = field.placeholder ?? '';
        input.value = field.value ?? '';
        dialog.classList.add('rly-dialog-wide');
      } else if (field.type === 'select') {
        input = doc.createElement('select');
        for (const opt of field.options ?? []) {
          const o = doc.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          input.appendChild(o);
        }
        input.value = field.value ?? field.options?.[0]?.value ?? '';
      } else if (field.type === 'checkbox') {
        input = doc.createElement('input');
        input.type = 'checkbox';
        input.checked = field.value === 'true';
        row.classList.add('rly-dialog-row-inline');
      } else if (field.type === 'file') {
        input = doc.createElement('input');
        input.type = 'file';
        input.accept = field.accept ?? '';
      } else {
        input = doc.createElement('input');
        input.type = field.type ?? 'text';
        input.placeholder = field.placeholder ?? '';
        input.value = field.value ?? '';
      }
      input.dataset.testid = `dialog-field-${field.name}`;
      if (field.type === 'checkbox') row.append(input, labelEl);
      else row.append(labelEl, input);
      if (field.hint) {
        const hint = doc.createElement('small');
        hint.className = 'rly-dialog-hint';
        hint.textContent = field.hint;
        row.appendChild(hint);
      }
      if (field.type === 'textarea') row.classList.add('rly-dialog-row-span');
      fields.appendChild(row);
      inputs.set(field.name, input);
    }
    dialog.appendChild(fields);

    const footer = doc.createElement('div');
    footer.className = 'rly-dialog-footer';
    const cancelBtn = doc.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'rly-dialog-btn';
    cancelBtn.dataset.testid = 'dialog-cancel';
    cancelBtn.textContent = 'Cancel';
    const submitBtn = doc.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'rly-dialog-btn rly-dialog-btn-primary';
    submitBtn.dataset.testid = 'dialog-submit';
    submitBtn.textContent = spec.submitText ?? 'Save';
    footer.append(cancelBtn, submitBtn);
    dialog.appendChild(footer);

    overlay.appendChild(dialog);

    const close = (result: DialogResult | null): void => {
      doc.removeEventListener('keydown', keyHandler, true);
      overlay.remove();
      editor.selection.moveToBookmark(bookmark);
      editor.focus();
      resolve(result);
    };
    const submit = (): void => {
      const values: Record<string, string> = {};
      const files: Record<string, File> = {};
      inputs.forEach((input, name) => {
        if (input instanceof HTMLInputElement && input.type === 'checkbox') {
          values[name] = String(input.checked);
          return;
        }
        if (input instanceof HTMLInputElement && input.type === 'file') {
          values[name] = '';
          const file = input.files?.[0];
          if (file) files[name] = file;
          return;
        }
        values[name] = input.value;
      });
      const result = values as DialogResult;
      if (Object.keys(files).length) result.files = files;
      close(result);
    };

    cancelBtn.addEventListener('click', () => close(null));
    closeBtn.addEventListener('click', () => close(null));
    submitBtn.addEventListener('click', submit);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close(null);
    });
    // Document-level (capture): Escape must close the modal wherever focus sits.
    const keyHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(null);
      } else if (
        e.key === 'Enter' &&
        doc.activeElement?.tagName === 'INPUT' &&
        (doc.activeElement as HTMLInputElement).type !== 'file' &&
        dialog.contains(doc.activeElement)
      ) {
        // Enter submits from single-line inputs only (textarea needs newlines).
        e.preventDefault();
        submit();
      } else if (e.key === 'Tab' && dialog.contains(doc.activeElement)) {
        // Focus trap.
        const focusables = [closeBtn, ...inputs.values(), cancelBtn, submitBtn].filter(
          (element) => !element.disabled && !element.hidden
        );
        const idx = focusables.indexOf(doc.activeElement as HTMLInputElement);
        if (idx !== -1) {
          e.preventDefault();
          const next = (idx + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
          focusables[next]?.focus();
        }
      }
    };
    doc.addEventListener('keydown', keyHandler, true);

    // Keep the modal inside the editor theme scope so public --rly-* overrides
    // and dark-mode tokens are inherited by portal-like dialog chrome.
    editor.getRoot().appendChild(overlay);
    const first = inputs.values().next().value as FieldEl | undefined;
    first?.focus();
    if (first && 'select' in first && typeof first.select === 'function') first.select();
  });
}
