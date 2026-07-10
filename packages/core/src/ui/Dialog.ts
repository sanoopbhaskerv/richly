import type { Editor } from '../editor/Editor';

export interface DialogField {
  name: string;
  label: string;
  type?: 'text' | 'url' | 'number' | 'textarea' | 'select' | 'checkbox';
  placeholder?: string;
  hint?: string;
  /** For checkbox: 'true' | 'false'. */
  value?: string;
  /** For type 'select'. */
  options?: { value: string; label: string }[];
}

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
export function openDialog(editor: Editor, spec: DialogSpec): Promise<Record<string, string> | null> {
  const doc = editor.getRoot().ownerDocument;
  const bookmark = editor.selection.getBookmark();

  return new Promise((resolve) => {
    const overlay = doc.createElement('div');
    overlay.className = 'sbe-dialog-overlay';

    const dialog = doc.createElement('div');
    dialog.className = 'sbe-dialog';
    dialog.dataset.testid = `dialog-${spec.name}`;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', spec.title);

    const header = doc.createElement('div');
    header.className = 'sbe-dialog-header';
    const heading = doc.createElement('div');
    const titleEl = doc.createElement('div');
    titleEl.className = 'sbe-dialog-title';
    titleEl.textContent = spec.title;
    heading.appendChild(titleEl);
    if (spec.description) {
      const description = doc.createElement('div');
      description.className = 'sbe-dialog-description';
      description.textContent = spec.description;
      heading.appendChild(description);
    }
    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sbe-dialog-close';
    closeBtn.dataset.testid = 'dialog-close';
    closeBtn.setAttribute('aria-label', 'Close dialog');
    closeBtn.textContent = '×';
    header.append(heading, closeBtn);
    dialog.appendChild(header);

    const fields = doc.createElement('div');
    fields.className = spec.layout === 'grid' ? 'sbe-dialog-fields sbe-dialog-fields-grid' : 'sbe-dialog-fields';

    type FieldEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const inputs = new Map<string, FieldEl>();
    for (const field of spec.fields) {
      const row = doc.createElement('label');
      row.className = 'sbe-dialog-row';
      const labelEl = doc.createElement('span');
      labelEl.textContent = field.label;
      let input: FieldEl;
      if (field.type === 'textarea') {
        input = doc.createElement('textarea');
        input.rows = 12;
        input.placeholder = field.placeholder ?? '';
        input.value = field.value ?? '';
        dialog.classList.add('sbe-dialog-wide');
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
        row.classList.add('sbe-dialog-row-inline');
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
        hint.className = 'sbe-dialog-hint';
        hint.textContent = field.hint;
        row.appendChild(hint);
      }
      if (field.type === 'textarea') row.classList.add('sbe-dialog-row-span');
      fields.appendChild(row);
      inputs.set(field.name, input);
    }
    dialog.appendChild(fields);

    const footer = doc.createElement('div');
    footer.className = 'sbe-dialog-footer';
    const cancelBtn = doc.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'sbe-dialog-btn';
    cancelBtn.dataset.testid = 'dialog-cancel';
    cancelBtn.textContent = 'Cancel';
    const submitBtn = doc.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'sbe-dialog-btn sbe-dialog-btn-primary';
    submitBtn.dataset.testid = 'dialog-submit';
    submitBtn.textContent = spec.submitText ?? 'Save';
    footer.append(cancelBtn, submitBtn);
    dialog.appendChild(footer);

    overlay.appendChild(dialog);

    const close = (result: Record<string, string> | null): void => {
      doc.removeEventListener('keydown', keyHandler, true);
      overlay.remove();
      editor.selection.moveToBookmark(bookmark);
      editor.focus();
      resolve(result);
    };
    const submit = (): void => {
      const values: Record<string, string> = {};
      inputs.forEach((input, name) => {
        values[name] =
          input instanceof HTMLInputElement && input.type === 'checkbox' ? String(input.checked) : input.value;
      });
      close(values);
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
      } else if (e.key === 'Enter' && doc.activeElement?.tagName === 'INPUT' && dialog.contains(doc.activeElement)) {
        // Enter submits from single-line inputs only (textarea needs newlines).
        e.preventDefault();
        submit();
      } else if (e.key === 'Tab' && dialog.contains(doc.activeElement)) {
        // Focus trap.
        const focusables = [...inputs.values(), cancelBtn, submitBtn];
        const idx = focusables.indexOf(doc.activeElement as HTMLInputElement);
        if (idx !== -1) {
          e.preventDefault();
          const next = (idx + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
          focusables[next]?.focus();
        }
      }
    };
    doc.addEventListener('keydown', keyHandler, true);

    doc.body.appendChild(overlay);
    const first = inputs.values().next().value as FieldEl | undefined;
    first?.focus();
    if (first && 'select' in first && typeof first.select === 'function') first.select();
  });
}
