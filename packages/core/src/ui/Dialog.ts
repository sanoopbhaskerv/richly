import type { Editor } from '../editor/Editor';

export interface DialogField {
  name: string;
  label: string;
  type?: 'text' | 'url' | 'textarea';
  placeholder?: string;
  value?: string;
}

export interface DialogSpec {
  name: string;
  title: string;
  fields: DialogField[];
  submitText?: string;
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

    const titleEl = doc.createElement('div');
    titleEl.className = 'sbe-dialog-title';
    titleEl.textContent = spec.title;
    dialog.appendChild(titleEl);

    const inputs = new Map<string, HTMLInputElement | HTMLTextAreaElement>();
    for (const field of spec.fields) {
      const row = doc.createElement('label');
      row.className = 'sbe-dialog-row';
      const labelEl = doc.createElement('span');
      labelEl.textContent = field.label;
      let input: HTMLInputElement | HTMLTextAreaElement;
      if (field.type === 'textarea') {
        input = doc.createElement('textarea');
        input.rows = 12;
        dialog.classList.add('sbe-dialog-wide');
      } else {
        input = doc.createElement('input');
        input.type = field.type ?? 'text';
      }
      input.dataset.testid = `dialog-field-${field.name}`;
      input.placeholder = field.placeholder ?? '';
      input.value = field.value ?? '';
      row.append(labelEl, input);
      dialog.appendChild(row);
      inputs.set(field.name, input);
    }

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
      inputs.forEach((input, name) => (values[name] = input.value));
      close(values);
    };

    cancelBtn.addEventListener('click', () => close(null));
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
    const first = inputs.values().next().value as HTMLInputElement | undefined;
    first?.focus();
    first?.select();
  });
}
