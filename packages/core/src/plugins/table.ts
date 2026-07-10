import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import { closestTag, closestBlock } from '../dom/DomUtils';

const GRID_ROWS = 6;
const GRID_COLS = 8;

function currentCell(editor: Editor): HTMLTableCellElement | null {
  const range = editor.selection.getRange();
  if (!range) return null;
  return (closestTag(range.startContainer, 'td', editor.getBody()) ??
    closestTag(range.startContainer, 'th', editor.getBody())) as HTMLTableCellElement | null;
}

function currentRow(editor: Editor): HTMLTableRowElement | null {
  return (currentCell(editor)?.closest('tr') as HTMLTableRowElement | null) ?? null;
}

function currentTable(editor: Editor): HTMLTableElement | null {
  return (currentCell(editor)?.closest('table') as HTMLTableElement | null) ?? null;
}

function placeCaretIn(editor: Editor, el: HTMLElement): void {
  editor.selection.selectNodeContents(el);
  editor.selection.collapseToEnd();
}

function makeCell(doc: Document, tag: 'td' | 'th' = 'td'): HTMLTableCellElement {
  const cell = doc.createElement(tag);
  cell.appendChild(doc.createElement('br')); // keeps empty cells clickable
  return cell;
}

function insertTable(editor: Editor, rows: number, cols: number): void {
  const body = editor.getBody();
  const doc = body.ownerDocument;
  const range = editor.selection.getRange();

  const table = doc.createElement('table');
  const tbody = doc.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    const tr = doc.createElement('tr');
    for (let c = 0; c < cols; c++) tr.appendChild(makeCell(doc));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  const block = range ? closestBlock(range.startContainer, body) : null;
  if (block && block.tagName !== 'LI') {
    // Empty paragraph gets replaced; otherwise insert after the block.
    if ((block.textContent ?? '').trim() === '') block.replaceWith(table);
    else block.after(table);
  } else {
    body.appendChild(table);
  }
  // Always leave an escape hatch after the table.
  if (!(table.nextElementSibling instanceof HTMLElement)) {
    const p = doc.createElement('p');
    p.appendChild(doc.createElement('br'));
    table.after(p);
  }
  placeCaretIn(editor, table.querySelector('td')!);
  editor.events.emit('change', editor.getContent());
}

function insertRow(editor: Editor, where: 'before' | 'after'): void {
  const row = currentRow(editor);
  if (!row) return;
  const doc = row.ownerDocument;
  const clone = doc.createElement('tr');
  for (let i = 0; i < row.cells.length; i++) clone.appendChild(makeCell(doc));
  where === 'before' ? row.before(clone) : row.after(clone);
  placeCaretIn(editor, clone.cells[0]!);
  editor.events.emit('change', editor.getContent());
}

function insertCol(editor: Editor, where: 'before' | 'after'): void {
  const cell = currentCell(editor);
  const table = currentTable(editor);
  if (!cell || !table) return;
  const idx = cell.cellIndex + (where === 'after' ? 1 : 0);
  const doc = table.ownerDocument;
  let caret: HTMLElement | null = null;
  for (const row of Array.from(table.rows)) {
    const fresh = makeCell(doc);
    const ref = row.cells[idx] ?? null;
    row.insertBefore(fresh, ref);
    if (row === cell.parentElement) caret = fresh;
  }
  if (caret) placeCaretIn(editor, caret);
  editor.events.emit('change', editor.getContent());
}

function deleteRow(editor: Editor): void {
  const row = currentRow(editor);
  const table = currentTable(editor);
  if (!row || !table) return;
  const next = (row.nextElementSibling ?? row.previousElementSibling) as HTMLTableRowElement | null;
  row.remove();
  if (!table.rows.length) table.remove();
  else if (next?.cells[0]) placeCaretIn(editor, next.cells[0]);
  editor.events.emit('change', editor.getContent());
}

function deleteCol(editor: Editor): void {
  const cell = currentCell(editor);
  const table = currentTable(editor);
  if (!cell || !table) return;
  const idx = cell.cellIndex;
  for (const row of Array.from(table.rows)) row.cells[idx]?.remove();
  if (!table.rows[0]?.cells.length) table.remove();
  else {
    const target = table.rows[0]!.cells[Math.max(0, idx - 1)];
    if (target) placeCaretIn(editor, target);
  }
  editor.events.emit('change', editor.getContent());
}

function buildGridPanel(editor: Editor, close: () => void): HTMLElement {
  const doc = editor.getBody().ownerDocument;
  const wrap = doc.createElement('div');
  const grid = doc.createElement('div');
  grid.className = 'sbe-grid';
  grid.style.gridTemplateColumns = `repeat(${GRID_COLS}, 18px)`;
  const label = doc.createElement('div');
  label.className = 'sbe-grid-label';
  label.textContent = '1 × 1';

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = doc.createElement('i');
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.dataset.testid = `grid-cell-${r}-${c}`;
      grid.appendChild(cell);
    }
  }
  grid.addEventListener('mouseover', (e) => {
    const t = e.target as HTMLElement;
    if (t.tagName !== 'I') return;
    const R = Number(t.dataset.r);
    const C = Number(t.dataset.c);
    grid.querySelectorAll<HTMLElement>('i').forEach((i) => {
      i.classList.toggle('sbe-on', Number(i.dataset.r) <= R && Number(i.dataset.c) <= C);
    });
    label.textContent = `${C + 1} × ${R + 1}`;
  });
  grid.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.tagName !== 'I') return;
    close();
    editor.execCommand('InsertTable', { rows: Number(t.dataset.r) + 1, cols: Number(t.dataset.c) + 1 });
  });

  wrap.append(grid, label);
  return wrap;
}

export const tablePlugin: Plugin = {
  name: 'table',
  init(editor) {
    editor.commands.register('InsertTable', {
      execute: (ed, args) => {
        const { rows = 3, cols = 3 } = (args as { rows?: number; cols?: number }) ?? {};
        insertTable(ed, rows, cols);
      },
      queryState: (ed) => !!currentTable(ed)
    });
    editor.commands.register('TableInsertRowBefore', { execute: (ed) => insertRow(ed, 'before') });
    editor.commands.register('TableInsertRowAfter', { execute: (ed) => insertRow(ed, 'after') });
    editor.commands.register('TableInsertColBefore', { execute: (ed) => insertCol(ed, 'before') });
    editor.commands.register('TableInsertColAfter', { execute: (ed) => insertCol(ed, 'after') });
    editor.commands.register('TableDeleteRow', { execute: (ed) => deleteRow(ed) });
    editor.commands.register('TableDeleteCol', { execute: (ed) => deleteCol(ed) });
    editor.commands.register('TableDelete', {
      execute: (ed) => {
        currentTable(ed)?.remove();
        ed.events.emit('change', ed.getContent());
      }
    });

    editor.ui.addButton('table', { icon: 'table', tooltip: 'Insert table', panel: buildGridPanel });

    editor.ui.addMenuItem('inserttable', { menu: 'table', text: 'Insert table (3×3)', command: 'InsertTable' });
    editor.ui.addMenuItem('rowabove', { menu: 'table', text: 'Insert row above', command: 'TableInsertRowBefore' });
    editor.ui.addMenuItem('rowbelow', { menu: 'table', text: 'Insert row below', command: 'TableInsertRowAfter' });
    editor.ui.addMenuItem('colleft', { menu: 'table', text: 'Insert column left', command: 'TableInsertColBefore' });
    editor.ui.addMenuItem('colright', { menu: 'table', text: 'Insert column right', command: 'TableInsertColAfter' });
    editor.ui.addMenuItem('delrow', { menu: 'table', text: 'Delete row', command: 'TableDeleteRow' });
    editor.ui.addMenuItem('delcol', { menu: 'table', text: 'Delete column', command: 'TableDeleteCol' });
    editor.ui.addMenuItem('deltable', { menu: 'table', text: 'Delete table', command: 'TableDelete' });

    // Tab / Shift+Tab cell navigation; Tab on the last cell appends a row.
    editor.on('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const cell = currentCell(editor);
      if (!cell) return;
      e.preventDefault();
      const table = cell.closest('table')!;
      const cells = Array.from(table.querySelectorAll<HTMLTableCellElement>('td,th'));
      const idx = cells.indexOf(cell);
      const nextIdx = idx + (e.shiftKey ? -1 : 1);
      if (nextIdx < 0) return;
      if (nextIdx >= cells.length) {
        editor.execCommand('TableInsertRowAfter');
        return;
      }
      placeCaretIn(editor, cells[nextIdx]!);
    });
  }
};
