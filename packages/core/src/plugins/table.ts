import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import { closestTag, closestBlock } from '../dom/DomUtils';
import { openDialog } from '../ui/Dialog';

const GRID_ROWS = 6;
const GRID_COLS = 8;
const cellSelections = new WeakMap<Editor, HTMLTableCellElement[]>();

function selectedCells(editor: Editor): HTMLTableCellElement[] {
  return (cellSelections.get(editor) ?? []).filter((cell) => cell.isConnected);
}

function clearCellSelection(editor: Editor): void {
  selectedCells(editor).forEach((cell) => cell.classList.remove('rly-cell-selected'));
  cellSelections.delete(editor);
}

function setSelectedCells(editor: Editor, cells: HTMLTableCellElement[]): void {
  clearCellSelection(editor);
  cells.forEach((cell) => cell.classList.add('rly-cell-selected'));
  cellSelections.set(editor, cells);
  editor.events.emit('selectionchange', undefined);
}

function currentCell(editor: Editor): HTMLTableCellElement | null {
  const selected = selectedCells(editor);
  if (selected.length) return selected[0] ?? null;
  const range = editor.selection.getRange();
  if (!range) return null;
  return (closestTag(range.startContainer, 'td', editor.getBody()) ??
    closestTag(range.startContainer, 'th', editor.getBody())) as HTMLTableCellElement | null;
}

function currentRow(editor: Editor): HTMLTableRowElement | null {
  return (currentCell(editor)?.closest('tr') as HTMLTableRowElement | null) ?? null;
}

function currentTable(editor: Editor): HTMLTableElement | null {
  const selected = selectedCells(editor);
  if (selected.length) return selected[0]?.closest('table') ?? null;
  const range = editor.selection.getRange();
  if (!range) return null;
  // Resolve from anywhere inside the table — including the <caption>.
  return closestTag(range.startContainer, 'table', editor.getBody()) as HTMLTableElement | null;
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
  // Percentage columns keep the empty grid equal without forcing fixed layout:
  // normal text wraps at spaces, while an unbroken word can expand its column.
  const colgroup = doc.createElement('colgroup');
  for (let c = 0; c < cols; c++) {
    const col = doc.createElement('col');
    col.style.width = `${100 / cols}%`;
    colgroup.appendChild(col);
  }
  const tbody = doc.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    const tr = doc.createElement('tr');
    for (let c = 0; c < cols; c++) tr.appendChild(makeCell(doc));
    tbody.appendChild(tr);
  }
  table.append(colgroup, tbody);

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
  if (where === 'before') row.before(clone);
  else row.after(clone);
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
  const colgroup = table.querySelector(':scope > colgroup');
  if (colgroup) {
    const col = doc.createElement('col');
    const neighbor = colgroup.children[Math.min(idx, colgroup.children.length - 1)] as
      HTMLElement | undefined;
    const percentageColumns = neighbor?.style.width.trim().endsWith('%') ?? false;
    const width = parseFloat(neighbor?.style.width ?? '') || 80;
    col.style.width = percentageColumns
      ? `${100 / (colgroup.children.length + 1)}%`
      : `${Math.round(width)}px`;
    colgroup.insertBefore(col, colgroup.children[idx] ?? null);
    if (percentageColumns) {
      const equalWidth = `${100 / colgroup.children.length}%`;
      Array.from(colgroup.children).forEach((item) => {
        (item as HTMLElement).style.width = equalWidth;
      });
    } else {
      const tableWidth = table.getBoundingClientRect().width || parseFloat(table.style.width);
      if (tableWidth) table.style.width = `${Math.round(tableWidth + width)}px`;
    }
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
  const colgroup = table.querySelector(':scope > colgroup');
  const oldWidth = (colgroup?.children[idx] as HTMLElement | undefined)?.style.width;
  const percentageColumns = oldWidth?.trim().endsWith('%') ?? false;
  colgroup?.children[idx]?.remove();
  if (colgroup && !colgroup.children.length) colgroup.remove();
  else if (colgroup && percentageColumns) {
    const equalWidth = `${100 / colgroup.children.length}%`;
    Array.from(colgroup.children).forEach((item) => {
      (item as HTMLElement).style.width = equalWidth;
    });
  } else if (oldWidth && table.style.width) {
    table.style.width = `${Math.max(60, Math.round(parseFloat(table.style.width) - parseFloat(oldWidth)))}px`;
  }
  if (!table.rows[0]?.cells.length) table.remove();
  else {
    const target = table.rows[0]!.cells[Math.max(0, idx - 1)];
    if (target) placeCaretIn(editor, target);
  }
  editor.events.emit('change', editor.getContent());
}

function deleteTable(editor: Editor): void {
  const table = currentTable(editor);
  if (!table) return;
  const doc = table.ownerDocument;
  let target = (table.nextElementSibling ?? table.previousElementSibling) as HTMLElement | null;
  table.remove();
  if (!target) {
    target = doc.createElement('p');
    target.appendChild(doc.createElement('br'));
    editor.getBody().appendChild(target);
  }
  placeCaretIn(editor, target);
  editor.events.emit('change', editor.getContent());
}

function rectangularCells(
  table: HTMLTableElement,
  start: HTMLTableCellElement,
  end: HTMLTableCellElement
): HTMLTableCellElement[] {
  const rows = Array.from(table.rows);
  const startRow = rows.indexOf(start.parentElement as HTMLTableRowElement);
  const endRow = rows.indexOf(end.parentElement as HTMLTableRowElement);
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(start.cellIndex, end.cellIndex);
  const maxCol = Math.max(start.cellIndex, end.cellIndex);
  const cells: HTMLTableCellElement[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cell = rows[row]?.cells[col];
      if (cell) cells.push(cell);
    }
  }
  return cells;
}

function mergeSelectedCells(editor: Editor): void {
  const cells = selectedCells(editor);
  if (cells.length < 2 || cells.some((cell) => cell.rowSpan !== 1 || cell.colSpan !== 1)) return;
  const table = cells[0]?.closest('table');
  if (!table || cells.some((cell) => cell.closest('table') !== table)) return;
  const rows = Array.from(table.rows);
  const rowIndexes = [
    ...new Set(cells.map((cell) => rows.indexOf(cell.parentElement as HTMLTableRowElement)))
  ].sort((a, b) => a - b);
  const colIndexes = [...new Set(cells.map((cell) => cell.cellIndex))].sort((a, b) => a - b);
  if (cells.length !== rowIndexes.length * colIndexes.length) return;
  const master = rows[rowIndexes[0]!]?.cells[colIndexes[0]!];
  if (!master) return;

  for (const cell of cells) {
    if (cell === master) continue;
    const hasContent = (cell.textContent ?? '').trim() || cell.querySelector('img,table');
    if (hasContent) {
      if ((master.textContent ?? '').trim() || master.querySelector('img,table'))
        master.appendChild(master.ownerDocument.createElement('br'));
      while (cell.firstChild) master.appendChild(cell.firstChild);
    }
    cell.remove();
  }
  master.rowSpan = rowIndexes.length;
  master.colSpan = colIndexes.length;
  setSelectedCells(editor, [master]);
  placeCaretIn(editor, master);
  editor.events.emit('change', editor.getContent());
}

function splitCurrentCell(editor: Editor): void {
  const cell = currentCell(editor);
  const table = cell?.closest('table');
  if (!cell || !table || (cell.rowSpan === 1 && cell.colSpan === 1)) return;
  const rows = Array.from(table.rows);
  const rowIndex = rows.indexOf(cell.parentElement as HTMLTableRowElement);
  const colIndex = cell.cellIndex;
  const rowSpan = cell.rowSpan;
  const colSpan = cell.colSpan;
  const tag = cell.tagName.toLowerCase() as 'td' | 'th';
  cell.removeAttribute('rowspan');
  cell.removeAttribute('colspan');

  for (let rowOffset = 0; rowOffset < rowSpan; rowOffset++) {
    const row = rows[rowIndex + rowOffset];
    if (!row) continue;
    const count = rowOffset === 0 ? colSpan - 1 : colSpan;
    const insertionIndex = rowOffset === 0 ? colIndex + 1 : colIndex;
    for (let colOffset = 0; colOffset < count; colOffset++) {
      row.insertBefore(
        makeCell(cell.ownerDocument, tag),
        row.cells[insertionIndex + colOffset] ?? null
      );
    }
  }
  setSelectedCells(editor, [cell]);
  placeCaretIn(editor, cell);
  editor.events.emit('change', editor.getContent());
}

function installMultiCellSelection(editor: Editor): void {
  const body = editor.getBody();
  const doc = body.ownerDocument;
  let anchor: HTMLTableCellElement | null = null;
  let dragging = false;

  const onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const cell = (event.target as HTMLElement).closest?.('td,th') as HTMLTableCellElement | null;
    if (!cell || !body.contains(cell)) {
      anchor = null;
      clearCellSelection(editor);
      return;
    }
    if (!event.shiftKey || !anchor || anchor.closest('table') !== cell.closest('table'))
      anchor = cell;
    dragging = true;
    if (event.shiftKey && anchor !== cell) {
      event.preventDefault();
      setSelectedCells(editor, rectangularCells(cell.closest('table')!, anchor, cell));
    } else {
      clearCellSelection(editor);
    }
  };
  const onMouseOver = (event: MouseEvent): void => {
    if (!dragging || !anchor || event.buttons !== 1) return;
    const cell = (event.target as HTMLElement).closest?.('td,th') as HTMLTableCellElement | null;
    const table = anchor.closest('table');
    if (!cell || !table || cell.closest('table') !== table || cell === anchor) return;
    setSelectedCells(editor, rectangularCells(table, anchor, cell));
  };
  const onMouseUp = (): void => {
    dragging = false;
    const cells = selectedCells(editor);
    if (cells.length > 1 && anchor) placeCaretIn(editor, anchor);
  };
  body.addEventListener('mousedown', onMouseDown);
  body.addEventListener('mouseover', onMouseOver);
  doc.addEventListener('mouseup', onMouseUp);
  editor.events.on('destroy', () => {
    body.removeEventListener('mousedown', onMouseDown);
    body.removeEventListener('mouseover', onMouseOver);
    doc.removeEventListener('mouseup', onMouseUp);
    clearCellSelection(editor);
  });
}

// ---------- table / cell properties ----------

export interface TablePropsArgs {
  width?: string;
  height?: string;
  align?: 'none' | 'center' | 'right';
  striped?: string | boolean;
  caption?: string | boolean;
  headerRow?: string | boolean;
  borderWidth?: string;
  borderColor?: string;
  cellPadding?: string;
}

function cssSize(value: string, fallbackUnit = ''): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^(auto|\d+(?:\.\d+)?(?:px|%|em|rem|vh|vw))$/i.test(trimmed)) return trimmed;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return `${trimmed}${fallbackUnit}`;
  return '';
}

function replaceCellTag(cell: HTMLTableCellElement, tag: 'td' | 'th'): HTMLTableCellElement {
  if (cell.tagName.toLowerCase() === tag) return cell;
  const fresh = cell.ownerDocument.createElement(tag) as HTMLTableCellElement;
  for (const attr of Array.from(cell.attributes)) fresh.setAttribute(attr.name, attr.value);
  while (cell.firstChild) fresh.appendChild(cell.firstChild);
  cell.replaceWith(fresh);
  return fresh;
}

function setHeaderRow(table: HTMLTableElement, enabled: boolean): void {
  const first = table.rows[0];
  if (!first) return;
  Array.from(first.cells).forEach((cell) => {
    const fresh = replaceCellTag(cell, enabled ? 'th' : 'td');
    if (enabled) fresh.scope = 'col';
    else fresh.removeAttribute('scope');
  });
  if (enabled) {
    const head = table.tHead ?? table.createTHead();
    head.appendChild(first);
  } else if (table.tHead?.contains(first)) {
    const body = table.tBodies[0] ?? table.createTBody();
    body.prepend(first);
    if (!table.tHead.rows.length) table.tHead.remove();
  }
}

function applyTableProps(editor: Editor, args: TablePropsArgs): void {
  const table = currentTable(editor);
  if (!table) return;
  const doc = table.ownerDocument;

  if (args.width !== undefined) table.style.width = cssSize(args.width);
  if (args.height !== undefined) table.style.height = cssSize(args.height, 'px');
  if (args.align !== undefined) {
    table.style.marginLeft = args.align === 'center' || args.align === 'right' ? 'auto' : '';
    table.style.marginRight = args.align === 'center' ? 'auto' : '';
  }
  if (args.striped !== undefined) {
    table.classList.toggle('rly-striped', args.striped === true || args.striped === 'true');
    if (!table.classList.length) table.removeAttribute('class');
  }
  if (args.borderWidth !== undefined || args.cellPadding !== undefined) {
    for (const cell of Array.from(table.querySelectorAll<HTMLElement>('td,th'))) {
      if (args.borderWidth !== undefined) cell.style.borderWidth = cssSize(args.borderWidth, 'px');
      if (args.cellPadding !== undefined) cell.style.padding = cssSize(args.cellPadding, 'px');
      if (!cell.getAttribute('style')) cell.removeAttribute('style');
    }
  }
  if (args.borderColor !== undefined) {
    for (const cell of Array.from(table.querySelectorAll<HTMLElement>('td,th'))) {
      cell.style.borderColor = args.borderColor.trim();
    }
  }
  if (args.caption !== undefined) {
    const wants = args.caption === true || args.caption === 'true';
    const existing = table.querySelector('caption');
    if (wants && !existing) {
      const cap = doc.createElement('caption');
      cap.textContent = 'Table caption';
      table.prepend(cap);
    } else if (!wants && existing) {
      existing.remove();
    }
  }
  if (args.headerRow !== undefined) {
    setHeaderRow(table, args.headerRow === true || args.headerRow === 'true');
  }
  if (!table.getAttribute('style')) table.removeAttribute('style');
  editor.events.emit('change', editor.getContent());
}

async function openTablePropsDialog(editor: Editor): Promise<void> {
  const table = currentTable(editor);
  if (!table) return;
  const firstCell = table.querySelector<HTMLElement>('td,th');
  const align =
    table.style.marginLeft === 'auto'
      ? table.style.marginRight === 'auto'
        ? 'center'
        : 'right'
      : 'none';
  const result = await openDialog(editor, {
    name: 'tableprops',
    title: 'Table properties',
    description: 'Tune the table layout and visual hierarchy without touching its content.',
    layout: 'grid',
    fields: [
      {
        name: 'width',
        label: 'Width',
        value: table.style.width,
        placeholder: '100% or 640px',
        hint: 'Use px or %'
      },
      {
        name: 'height',
        label: 'Height',
        value: table.style.height,
        placeholder: 'Auto or 240px',
        hint: 'Leave blank for automatic height'
      },
      {
        name: 'align',
        label: 'Alignment',
        type: 'select',
        value: align,
        options: [
          { value: 'none', label: 'None' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' }
        ]
      },
      {
        name: 'cellPadding',
        label: 'Cell padding',
        value: firstCell?.style.padding.replace('px', '') ?? '',
        placeholder: '10',
        hint: 'Pixels'
      },
      {
        name: 'borderWidth',
        label: 'Border width',
        value: firstCell?.style.borderWidth.replace('px', '') ?? '',
        placeholder: '1',
        hint: 'Pixels'
      },
      {
        name: 'borderColor',
        label: 'Border color',
        value: firstCell?.style.borderColor ?? '',
        placeholder: '#d7dce3'
      },
      {
        name: 'striped',
        label: 'Striped rows',
        type: 'checkbox',
        value: String(table.classList.contains('rly-striped'))
      },
      {
        name: 'headerRow',
        label: 'Header row',
        type: 'checkbox',
        value: String(!!table.tHead || table.rows[0]?.cells[0]?.tagName === 'TH')
      },
      {
        name: 'caption',
        label: 'Show caption',
        type: 'checkbox',
        value: String(!!table.querySelector('caption'))
      }
    ]
  });
  if (result) editor.execCommand('TableProps', result);
}

export interface CellPropsArgs {
  width?: string;
  type?: 'td' | 'th';
  scope?: '' | 'row' | 'col';
  halign?: '' | 'left' | 'center' | 'right';
  valign?: '' | 'top' | 'middle' | 'bottom';
  bg?: string;
}

function applyCellProps(editor: Editor, args: CellPropsArgs): void {
  let cell = currentCell(editor);
  if (!cell) return;
  if (args.type && cell.tagName.toLowerCase() !== args.type) {
    cell = replaceCellTag(cell, args.type);
  }
  if (args.scope !== undefined) {
    if (args.scope && cell.tagName === 'TH') cell.scope = args.scope;
    else cell.removeAttribute('scope');
  }
  if (args.width !== undefined) cell.style.width = cssSize(args.width);
  if (args.halign !== undefined) cell.style.textAlign = args.halign;
  if (args.valign !== undefined) cell.style.verticalAlign = args.valign;
  if (args.bg !== undefined) cell.style.backgroundColor = args.bg;
  if (!cell.getAttribute('style')) cell.removeAttribute('style');

  placeCaretIn(editor, cell);
  editor.events.emit('change', editor.getContent());
}

async function openCellPropsDialog(editor: Editor): Promise<void> {
  const cell = currentCell(editor);
  if (!cell) return;
  const result = await openDialog(editor, {
    name: 'cellprops',
    title: 'Cell properties',
    description: 'Control the selected cell’s semantics, size, and alignment.',
    layout: 'grid',
    fields: [
      {
        name: 'width',
        label: 'Width',
        value: cell.style.width,
        placeholder: '25% or 160px',
        hint: 'Use px or %'
      },
      {
        name: 'type',
        label: 'Cell type',
        type: 'select',
        value: cell.tagName.toLowerCase(),
        options: [
          { value: 'td', label: 'Cell' },
          { value: 'th', label: 'Header cell' }
        ]
      },
      {
        name: 'scope',
        label: 'Header scope',
        type: 'select',
        value: cell.getAttribute('scope') ?? '',
        options: [
          { value: '', label: 'None' },
          { value: 'col', label: 'Column' },
          { value: 'row', label: 'Row' }
        ]
      },
      {
        name: 'halign',
        label: 'Horizontal align',
        type: 'select',
        value: cell.style.textAlign,
        options: [
          { value: '', label: 'Default' },
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' }
        ]
      },
      {
        name: 'valign',
        label: 'Vertical align',
        type: 'select',
        value: cell.style.verticalAlign,
        options: [
          { value: '', label: 'Default' },
          { value: 'top', label: 'Top' },
          { value: 'middle', label: 'Middle' },
          { value: 'bottom', label: 'Bottom' }
        ]
      },
      {
        name: 'bg',
        label: 'Background color',
        value: cell.style.backgroundColor,
        placeholder: '#fef3c7'
      }
    ]
  });
  if (result) editor.execCommand('CellProps', result);
}

export interface RowPropsArgs {
  section?: 'head' | 'body' | 'foot';
  height?: string;
  align?: '' | 'left' | 'center' | 'right';
  valign?: '' | 'top' | 'middle' | 'bottom';
  bg?: string;
}

function rowSection(row: HTMLTableRowElement): 'head' | 'body' | 'foot' {
  const tag = row.parentElement?.tagName;
  return tag === 'THEAD' ? 'head' : tag === 'TFOOT' ? 'foot' : 'body';
}

function applyRowProps(editor: Editor, args: RowPropsArgs): void {
  const row = currentRow(editor);
  const table = currentTable(editor);
  if (!row || !table) return;

  if (args.section && rowSection(row) !== args.section) {
    const section =
      args.section === 'head'
        ? (table.tHead ?? table.createTHead())
        : args.section === 'foot'
          ? (table.tFoot ?? table.createTFoot())
          : (table.tBodies[0] ?? table.createTBody());
    section.appendChild(row);
    Array.from(row.cells).forEach((cell) => {
      const fresh = replaceCellTag(cell, args.section === 'head' ? 'th' : 'td');
      if (args.section === 'head') fresh.scope = 'col';
      else fresh.removeAttribute('scope');
    });
  }
  if (args.height !== undefined) row.style.height = cssSize(args.height, 'px');
  if (args.align !== undefined) row.style.textAlign = args.align;
  if (args.valign !== undefined) row.style.verticalAlign = args.valign;
  if (args.bg !== undefined) row.style.backgroundColor = args.bg.trim();
  if (!row.getAttribute('style')) row.removeAttribute('style');

  const target = row.cells[0];
  if (target) placeCaretIn(editor, target);
  editor.events.emit('change', editor.getContent());
}

async function openRowPropsDialog(editor: Editor): Promise<void> {
  const row = currentRow(editor);
  if (!row) return;
  const result = await openDialog(editor, {
    name: 'rowprops',
    title: 'Row properties',
    description: 'Set the role, dimensions, and alignment for this row.',
    layout: 'grid',
    fields: [
      {
        name: 'section',
        label: 'Row type',
        type: 'select',
        value: rowSection(row),
        options: [
          { value: 'head', label: 'Header' },
          { value: 'body', label: 'Body' },
          { value: 'foot', label: 'Footer' }
        ]
      },
      {
        name: 'height',
        label: 'Height',
        value: row.style.height,
        placeholder: '44',
        hint: 'Pixels, or a CSS size'
      },
      {
        name: 'align',
        label: 'Horizontal align',
        type: 'select',
        value: row.style.textAlign,
        options: [
          { value: '', label: 'Default' },
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' }
        ]
      },
      {
        name: 'valign',
        label: 'Vertical align',
        type: 'select',
        value: row.style.verticalAlign,
        options: [
          { value: '', label: 'Default' },
          { value: 'top', label: 'Top' },
          { value: 'middle', label: 'Middle' },
          { value: 'bottom', label: 'Bottom' }
        ]
      },
      {
        name: 'bg',
        label: 'Background color',
        value: row.style.backgroundColor,
        placeholder: '#f8fafc'
      }
    ]
  });
  if (result) editor.execCommand('RowProps', result);
}

// ---------- column drag-resize ----------

const EDGE_PX = 5;

function installColumnResize(editor: Editor): void {
  const body = editor.getBody();
  const doc = body.ownerDocument;

  const cellEdge = (e: MouseEvent): HTMLTableCellElement | null => {
    const target = (e.target as HTMLElement).closest?.('td,th') as HTMLTableCellElement | null;
    if (!target || !body.contains(target)) return null;
    const rect = target.getBoundingClientRect();
    return rect.right - e.clientX < EDGE_PX ? target : null;
  };

  body.addEventListener('mousemove', (e) => {
    body.style.cursor = cellEdge(e) ? 'col-resize' : '';
  });

  body.addEventListener('mousedown', (e) => {
    const cell = cellEdge(e);
    if (!cell) return;
    e.preventDefault();
    const table = cell.closest('table') as HTMLTableElement;
    editor.undoManager.snapshot();

    // Freeze measured columns into a colgroup. Widths on td/th are redistributed
    // differently by browser table algorithms; colgroup gives deterministic drag math.
    const measuredTableWidth = table.getBoundingClientRect().width;
    const measuredColumnWidths = Array.from(table.rows[0]?.cells ?? []).map(
      (item) => item.getBoundingClientRect().width
    );
    table.style.width = `${Math.round(measuredTableWidth)}px`;
    table.style.tableLayout = 'fixed';
    let colgroup = table.querySelector(':scope > colgroup');
    if (!colgroup) {
      colgroup = doc.createElement('colgroup');
      const firstRow = table.rows[0];
      for (const c of Array.from(firstRow?.cells ?? [])) {
        const col = doc.createElement('col');
        col.style.width = `${Math.round(c.getBoundingClientRect().width)}px`;
        colgroup.appendChild(col);
      }
      const caption = table.querySelector(':scope > caption');
      if (caption) caption.after(colgroup);
      else table.prepend(colgroup);
    }
    // Convert percentage columns to rendered pixel widths before drag math.
    Array.from(colgroup.children).forEach((item, index) => {
      const width = measuredColumnWidths[index];
      if (width) (item as HTMLElement).style.width = `${Math.round(width)}px`;
    });
    const colIdx = cell.cellIndex;
    const target = colgroup.children[colIdx] as HTMLElement | undefined;
    if (!target) return;
    const startX = e.clientX;
    const startW = parseFloat(target.style.width) || target.getBoundingClientRect().width;
    // Inner border: transfer width to the neighbor (table width constant).
    // Last column: grow/shrink the table itself.
    const next = (colgroup.children[colIdx + 1] as HTMLElement | undefined) ?? null;
    const startNextW = next
      ? parseFloat(next.style.width) || next.getBoundingClientRect().width
      : 0;
    const startTableW = table.getBoundingClientRect().width;

    const onMove = (ev: MouseEvent): void => {
      const rawDx = ev.clientX - startX;
      const dx = next
        ? Math.max(30 - startW, Math.min(startNextW - 30, rawDx))
        : Math.max(60 - startW, rawDx);
      target.style.width = `${Math.round(Math.max(30, startW + dx))}px`;
      if (next) next.style.width = `${Math.round(startNextW - dx)}px`;
      else table.style.width = `${Math.round(Math.max(60, startTableW + dx))}px`;
    };
    const onUp = (): void => {
      doc.removeEventListener('mousemove', onMove);
      doc.removeEventListener('mouseup', onUp);
      editor.events.emit('change', editor.getContent());
    };
    doc.addEventListener('mousemove', onMove);
    doc.addEventListener('mouseup', onUp);
  });
}

// ---------- table selection frame + whole-table resize ----------

function installTableSelection(editor: Editor): void {
  const root = editor.getRoot();
  const body = editor.getBody();
  const doc = body.ownerDocument;
  const frame = doc.createElement('div');
  frame.className = 'rly-table-selection';
  frame.dataset.testid = 'table-selection';
  frame.setAttribute('aria-hidden', 'true');
  let selected: HTMLTableElement | null = null;

  const position = (): void => {
    if (!selected?.isConnected || !body.contains(selected)) {
      selected = null;
      frame.classList.remove('rly-show');
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const rect = selected.getBoundingClientRect();
    frame.style.left = `${rect.left - rootRect.left}px`;
    frame.style.top = `${rect.top - rootRect.top}px`;
    frame.style.width = `${rect.width}px`;
    frame.style.height = `${rect.height}px`;
    frame.classList.add('rly-show');
  };

  const select = (table: HTMLTableElement | null): void => {
    selected = table;
    position();
  };

  for (const axis of ['x', 'y', 'xy'] as const) {
    const handle = doc.createElement('button');
    handle.type = 'button';
    handle.tabIndex = -1;
    handle.className = `rly-table-handle rly-table-handle-${axis}`;
    handle.dataset.axis = axis;
    handle.dataset.testid = `table-resize-${axis}`;
    handle.setAttribute(
      'aria-label',
      axis === 'x' ? 'Resize table width' : axis === 'y' ? 'Resize table height' : 'Resize table'
    );
    handle.addEventListener('mousedown', (e) => {
      if (!selected) return;
      e.preventDefault();
      e.stopPropagation();
      editor.undoManager.snapshot();
      const table = selected;
      const startRect = table.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      table.style.width = `${Math.round(startRect.width)}px`;
      if (axis !== 'x') table.style.height = `${Math.round(startRect.height)}px`;

      const onMove = (ev: MouseEvent): void => {
        if (axis !== 'y')
          table.style.width = `${Math.round(Math.max(120, startRect.width + ev.clientX - startX))}px`;
        if (axis !== 'x')
          table.style.height = `${Math.round(Math.max(44, startRect.height + ev.clientY - startY))}px`;
        position();
      };
      const onUp = (): void => {
        doc.removeEventListener('mousemove', onMove);
        doc.removeEventListener('mouseup', onUp);
        editor.events.emit('change', editor.getContent());
        position();
      };
      doc.addEventListener('mousemove', onMove);
      doc.addEventListener('mouseup', onUp);
    });
    frame.appendChild(handle);
  }
  root.appendChild(frame);

  const onBodyMouseDown = (e: MouseEvent): void => {
    const table = (e.target as HTMLElement).closest?.('table') as HTMLTableElement | null;
    select(table && body.contains(table) ? table : null);
  };
  const onScroll = (): void => position();
  body.addEventListener('mousedown', onBodyMouseDown);
  body.addEventListener('scroll', onScroll);
  doc.defaultView?.addEventListener('resize', onScroll);
  editor.events.on('selectionchange', () => {
    const table = currentTable(editor);
    if (table) select(table);
  });
  editor.events.on('change', position);
  editor.events.on('destroy', () => {
    body.removeEventListener('mousedown', onBodyMouseDown);
    body.removeEventListener('scroll', onScroll);
    doc.defaultView?.removeEventListener('resize', onScroll);
    frame.remove();
  });
}

function buildGridPanel(editor: Editor, close: () => void): HTMLElement {
  const doc = editor.getBody().ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = 'rly-table-grid-picker';
  const title = doc.createElement('div');
  title.className = 'rly-table-panel-title';
  title.textContent = 'Insert table';
  const grid = doc.createElement('div');
  grid.className = 'rly-grid';
  grid.style.gridTemplateColumns = `repeat(${GRID_COLS}, 18px)`;
  const label = doc.createElement('div');
  label.className = 'rly-grid-label';
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
      i.classList.toggle('rly-on', Number(i.dataset.r) <= R && Number(i.dataset.c) <= C);
    });
    label.textContent = `${C + 1} × ${R + 1}`;
  });
  grid.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.tagName !== 'I') return;
    close();
    editor.execCommand('InsertTable', {
      rows: Number(t.dataset.r) + 1,
      cols: Number(t.dataset.c) + 1
    });
  });

  wrap.append(title, grid, label);
  return wrap;
}

function buildTableContext(
  editor: Editor,
  close: () => void,
  options: { testIdPrefix?: string; popup?: boolean; restoreSelection?: () => void } = {}
): HTMLElement {
  const doc = editor.getBody().ownerDocument;
  const context = doc.createElement('div');
  context.className = 'rly-table-context';
  if (options.popup) context.classList.add('rly-table-context-popup');
  const header = doc.createElement('div');
  header.className = 'rly-table-context-header';
  const heading = doc.createElement('span');
  heading.className = 'rly-table-panel-title';
  heading.textContent = 'Edit current table';
  const badge = doc.createElement('span');
  badge.className = 'rly-table-context-badge';
  header.append(heading, badge);

  const quick = doc.createElement('div');
  quick.className = 'rly-table-quick-grid';
  const propertyGrid = doc.createElement('div');
  propertyGrid.className = 'rly-table-property-grid';
  const actions: HTMLButtonElement[] = [];

  const action = (
    id: string,
    text: string,
    glyph: string,
    command: string,
    kind: 'quick' | 'property' | 'danger' = 'quick'
  ): HTMLButtonElement => {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = `rly-table-action rly-table-action-${kind}`;
    btn.dataset.testid = `${options.testIdPrefix ?? ''}table-action-${id}`;
    if (options.popup) btn.setAttribute('role', 'menuitem');
    const icon = doc.createElement('span');
    icon.className = 'rly-table-action-icon';
    icon.textContent = glyph;
    const label = doc.createElement('span');
    label.textContent = text;
    btn.append(icon, label);
    btn.addEventListener('click', () => {
      close();
      // A popup menu lives outside the editable body, so the live selection can
      // be lost before the command runs (notably in Firefox, where an unfocused
      // contenteditable drops its range). Re-anchor to the opening cell first.
      options.restoreSelection?.();
      editor.execCommand(command);
      if (!doc.querySelector('.rly-dialog-overlay')) editor.focus();
    });
    actions.push(btn);
    return btn;
  };

  const mergeButton = action('merge-cells', 'Merge cells', '⊞', 'TableMergeCells');
  const splitButton = action('split-cell', 'Split cell', '⊟', 'TableSplitCell');
  quick.append(
    action('row-before', 'Row above', '↑', 'TableInsertRowBefore'),
    action('row-after', 'Row below', '↓', 'TableInsertRowAfter'),
    action('col-before', 'Column left', '←', 'TableInsertColBefore'),
    action('col-after', 'Column right', '→', 'TableInsertColAfter'),
    mergeButton,
    splitButton
  );
  propertyGrid.append(
    action('table-props', 'Table', '▦', 'TableProps', 'property'),
    action('cell-props', 'Cell', '□', 'CellProps', 'property'),
    action('row-props', 'Row', '═', 'RowProps', 'property')
  );
  const danger = doc.createElement('div');
  danger.className = 'rly-table-danger-row';
  danger.append(
    action('delete-table', 'Delete table', '×', 'TableDelete', 'danger'),
    action('delete-col', 'Delete column', '−', 'TableDeleteCol', 'danger'),
    action('delete-row', 'Delete row', '−', 'TableDeleteRow', 'danger')
  );
  context.append(header, quick, propertyGrid, danger);

  const refresh = (): void => {
    const table = currentTable(editor);
    context.classList.toggle('rly-disabled', !table);
    actions.forEach((btn) => (btn.disabled = !table));
    const selection = selectedCells(editor);
    mergeButton.disabled =
      selection.length < 2 || selection.some((cell) => cell.rowSpan !== 1 || cell.colSpan !== 1);
    const cell = currentCell(editor);
    splitButton.disabled = !cell || (cell.rowSpan === 1 && cell.colSpan === 1);
    badge.textContent =
      selection.length > 1
        ? `${selection.length} cells`
        : table
          ? `${table.rows.length} × ${table.rows[0]?.cells.length ?? 0}`
          : 'Select a table';
  };
  editor.events.on('selectionchange', refresh);
  editor.events.on('change', refresh);
  context.addEventListener('rly-panel-open', refresh);
  refresh();
  return context;
}

function buildTablePanel(editor: Editor, close: () => void): HTMLElement {
  const doc = editor.getBody().ownerDocument;
  const panel = doc.createElement('div');
  panel.className = 'rly-table-panel';
  panel.append(buildGridPanel(editor, close), buildTableContext(editor, close));
  panel.addEventListener('rly-panel-open', () => editor.events.emit('selectionchange', undefined));
  return panel;
}

// ---------- inline table options toolbar ----------

/**
 * Icon-only actions shown in the inline toolbar, in display order.
 * `null` entries render as group separators. Each action maps 1:1 to an
 * already-registered table command, so the toolbar carries no logic of its own.
 */
const INLINE_ACTIONS: ({ id: string; command: string; label: string; icon: string } | null)[] = [
  { id: 'table-props', command: 'TableProps', label: 'Table properties', icon: 'inlineTableProps' },
  { id: 'delete-table', command: 'TableDelete', label: 'Delete table', icon: 'inlineDeleteTable' },
  null,
  {
    id: 'row-before',
    command: 'TableInsertRowBefore',
    label: 'Insert row above',
    icon: 'inlineRowBefore'
  },
  {
    id: 'row-after',
    command: 'TableInsertRowAfter',
    label: 'Insert row below',
    icon: 'inlineRowAfter'
  },
  { id: 'delete-row', command: 'TableDeleteRow', label: 'Delete row', icon: 'inlineDeleteRow' },
  null,
  {
    id: 'col-before',
    command: 'TableInsertColBefore',
    label: 'Insert column left',
    icon: 'inlineColBefore'
  },
  {
    id: 'col-after',
    command: 'TableInsertColAfter',
    label: 'Insert column right',
    icon: 'inlineColAfter'
  },
  { id: 'delete-col', command: 'TableDeleteCol', label: 'Delete column', icon: 'inlineDeleteCol' }
];

/** Stroke-based 24px glyphs for the inline toolbar (kept local — table-specific). */
const INLINE_ICONS: Record<string, string> = {
  inlineTableProps:
    '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M4 14.5h16M10 5v14M15 5v14" stroke-width="1.4"/>',
  inlineDeleteTable:
    '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="m9.5 9.5 5 5M14.5 9.5l-5 5"/>',
  inlineRowBefore:
    '<rect x="4" y="12.5" width="16" height="7" rx="1.5"/><path d="M12 3.5v5.5M9.3 6.2h5.4"/>',
  inlineRowAfter:
    '<rect x="4" y="4.5" width="16" height="7" rx="1.5"/><path d="M12 15v5.5M9.3 17.8h5.4"/>',
  inlineDeleteRow:
    '<rect x="4" y="9" width="16" height="6" rx="1.5"/><path d="m9.8 4 2.2 2.2L14.2 4M9.8 20l2.2-2.2L14.2 20" stroke-width="1.4"/>',
  inlineColBefore:
    '<rect x="12.5" y="4" width="7" height="16" rx="1.5"/><path d="M3.5 12H9M6.2 9.3v5.4"/>',
  inlineColAfter:
    '<rect x="4.5" y="4" width="7" height="16" rx="1.5"/><path d="M15 12h5.5M17.8 9.3v5.4"/>',
  inlineDeleteCol:
    '<rect x="9" y="4" width="6" height="16" rx="1.5"/><path d="m4 9.8 2.2 2.2L4 14.2M20 9.8l-2.2 2.2 2.2 2.2" stroke-width="1.4"/>'
};

/** Wraps an INLINE_ICONS glyph into a standalone stroke SVG. */
function inlineIconSvg(name: string): string {
  return (
    `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ` +
    `stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `${INLINE_ICONS[name] ?? ''}</svg>`
  );
}

/**
 * Installs the floating "table options" toolbar that appears whenever a table
 * is selected (caret inside it, or the selection frame is active).
 *
 * UX notes:
 * - Positioned centered *below* the table with a notch pointing at it, and
 *   flips *above* the table when there is no room in the viewport
 *   (`rly-flip` class moves the notch to the bottom edge).
 * - Buttons are icon-only with tooltips; they never steal the content
 *   selection (mousedown is prevented — same rule as the main toolbar).
 * - The bar stays open after an action so row/column edits can be chained,
 *   and hides when the caret leaves the table or focus moves elsewhere.
 *
 * data-testids: `table-inline-toolbar` (bar), `inline-table-action-<id>`.
 */
function installInlineTableToolbar(editor: Editor): void {
  const root = editor.getRoot();
  const body = editor.getBody();
  const doc = body.ownerDocument;

  const bar = doc.createElement('div');
  bar.className = 'rly-table-inline-toolbar';
  bar.dataset.testid = 'table-inline-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Table options');
  // Keep the cell selection while interacting with the bar (HANDOFF.md rule).
  bar.addEventListener('mousedown', (e) => e.preventDefault());
  const buttons: HTMLButtonElement[] = [];

  const focusButton = (index: number): void => {
    const enabled = buttons.filter((button) => !button.disabled);
    if (!enabled.length) return;
    const target = (index + enabled.length) % enabled.length;
    enabled.forEach((button, buttonIndex) => (button.tabIndex = buttonIndex === target ? 0 : -1));
    enabled[target]?.focus();
  };

  for (const entry of INLINE_ACTIONS) {
    if (entry === null) {
      const sep = doc.createElement('div');
      sep.className = 'rly-table-inline-sep';
      bar.appendChild(sep);
      continue;
    }
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.tabIndex = -1; // the content keeps focus; actions are pointer-driven
    btn.className = 'rly-table-inline-btn';
    btn.dataset.testid = `inline-table-action-${entry.id}`;
    btn.title = entry.label;
    btn.setAttribute('aria-label', entry.label);
    btn.innerHTML = inlineIconSvg(entry.icon);
    btn.addEventListener('click', () => {
      editor.execCommand(entry.command);
      // Deleting the table (or its last row/col) removes the anchor element;
      // `position()` below will hide the bar in that case on the change event.
      if (!doc.querySelector('.rly-dialog-overlay')) editor.focus();
    });
    buttons.push(btn);
    bar.appendChild(btn);
  }
  root.appendChild(bar);

  const onToolbarKeyDown = (event: KeyboardEvent): void => {
    const enabled = buttons.filter((button) => !button.disabled);
    const current = enabled.indexOf(doc.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      focusButton(current + (event.key === 'ArrowRight' ? 1 : -1));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusButton(event.key === 'Home' ? 0 : enabled.length - 1);
    } else if (event.key === 'Escape' || (event.altKey && event.key === 'F10')) {
      event.preventDefault();
      buttons.forEach((button) => (button.tabIndex = -1));
      editor.focus();
    }
  };
  const onEditorKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey && event.key === 'F10' && bar.classList.contains('rly-open')) {
      event.preventDefault();
      focusButton(0);
    }
  };
  bar.addEventListener('keydown', onToolbarKeyDown);
  body.addEventListener('keydown', onEditorKeyDown);

  /** Table the bar is currently anchored to (null = hidden). */
  let anchor: HTMLTableElement | null = null;

  /** Re-anchor and re-position the bar; hides it when the table is gone. */
  const position = (): void => {
    if (!anchor?.isConnected || !body.contains(anchor)) {
      anchor = null;
      bar.classList.remove('rly-open');
      buttons.forEach((button) => (button.tabIndex = -1));
      return;
    }
    bar.classList.add('rly-open'); // must be visible to measure
    const rootRect = root.getBoundingClientRect();
    const tableRect = anchor.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const view = doc.defaultView;

    // Horizontal: centered under the table, clamped inside the editor root.
    const left = Math.max(
      8,
      Math.min(
        rootRect.width - barRect.width - 8,
        tableRect.left - rootRect.left + tableRect.width / 2 - barRect.width / 2
      )
    );

    // Vertical: below the table by default; flip above when clipped.
    const GAP = 10;
    const fitsBelow = !view || tableRect.bottom + GAP + barRect.height + 8 <= view.innerHeight;
    bar.classList.toggle('rly-flip', !fitsBelow);
    const top = fitsBelow
      ? tableRect.bottom - rootRect.top + GAP
      : tableRect.top - rootRect.top - barRect.height - GAP;

    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
  };

  const show = (table: HTMLTableElement | null): void => {
    anchor = table;
    position();
  };

  // Same visibility triggers as the selection frame: pointer + caret both count.
  const onBodyMouseDown = (e: MouseEvent): void => {
    const table = (e.target as HTMLElement).closest?.('table') as HTMLTableElement | null;
    show(table && body.contains(table) ? table : null);
  };
  const onScroll = (): void => position();
  body.addEventListener('mousedown', onBodyMouseDown);
  body.addEventListener('scroll', onScroll);
  doc.defaultView?.addEventListener('resize', onScroll);
  editor.events.on('selectionchange', () => show(currentTable(editor)));
  editor.events.on('change', position); // rows/cols added, table resized or deleted
  editor.events.on('blur', () => {
    // Let button clicks land first; hide only if focus truly left the editor.
    setTimeout(() => {
      if (!root.contains(doc.activeElement)) show(null);
    }, 0);
  });
  editor.events.on('destroy', () => {
    body.removeEventListener('mousedown', onBodyMouseDown);
    body.removeEventListener('scroll', onScroll);
    body.removeEventListener('keydown', onEditorKeyDown);
    bar.removeEventListener('keydown', onToolbarKeyDown);
    doc.defaultView?.removeEventListener('resize', onScroll);
    bar.remove();
  });
}

function installTableContextMenu(editor: Editor): void {
  const root = editor.getRoot();
  const body = editor.getBody();
  const doc = body.ownerDocument;
  const menu = doc.createElement('div');
  menu.className = 'rly-table-context-menu';
  menu.dataset.testid = 'table-context-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Table actions');
  menu.tabIndex = -1;

  // The cell the menu was opened over, so commands can re-anchor the selection
  // even if the editable body has since lost its DOM range.
  let anchorCell: HTMLTableCellElement | null = null;
  const close = (restoreFocus = false): void => {
    menu.classList.remove('rly-open');
    menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]').forEach((item) => {
      item.tabIndex = -1;
    });
    if (restoreFocus) editor.focus();
  };
  const restoreSelection = (): void => {
    if (anchorCell && body.contains(anchorCell)) placeCaretIn(editor, anchorCell);
  };
  menu.appendChild(
    buildTableContext(editor, close, { testIdPrefix: 'context-', popup: true, restoreSelection })
  );
  menu
    .querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    .forEach((item) => (item.tabIndex = -1));
  // Preserve the cell selection while clicking commands in the floating menu.
  menu.addEventListener('mousedown', (e) => e.preventDefault());
  root.appendChild(menu);

  const openAt = (
    table: HTMLTableElement,
    cell: HTMLTableCellElement | null,
    clientX: number,
    clientY: number,
    focusFirst = false
  ): void => {
    const target = cell && table.contains(cell) ? cell : (table.rows[0]?.cells[0] ?? null);
    anchorCell = target;
    placeCaretIn(editor, target ?? table);
    editor.events.emit('selectionchange', undefined);

    // The toolbar dropdown and context menu are alternate views of the same actions.
    root
      .querySelectorAll('.rly-tb-dd.rly-open')
      .forEach((panel) => panel.classList.remove('rly-open'));
    const rootRect = root.getBoundingClientRect();
    menu.style.left = `${clientX - rootRect.left}px`;
    menu.style.top = `${clientY - rootRect.top}px`;
    menu.classList.add('rly-open');

    const rect = menu.getBoundingClientRect();
    const view = doc.defaultView;
    if (!view) return;
    const minLeft = 8 - rootRect.left;
    const minTop = 8 - rootRect.top;
    const maxLeft = view.innerWidth - rootRect.left - rect.width - 8;
    const maxTop = view.innerHeight - rootRect.top - rect.height - 8;
    menu.style.left = `${Math.max(minLeft, Math.min(maxLeft, clientX - rootRect.left))}px`;
    menu.style.top = `${Math.max(minTop, Math.min(maxTop, clientY - rootRect.top))}px`;
    if (focusFirst) {
      const first = menu.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
      if (first) {
        first.tabIndex = 0;
        first.focus();
      }
    }
  };
  const onContextMenu = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    const table = target.closest?.('table') as HTMLTableElement | null;
    if (!table || !body.contains(table)) {
      close();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const cell = target.closest?.('td,th') as HTMLTableCellElement | null;
    openAt(table, cell, e.clientX, e.clientY);
  };
  const onDocumentMouseDown = (e: MouseEvent): void => {
    if (!menu.contains(e.target as Node)) close();
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (
      (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) &&
      body.contains(e.target as Node)
    ) {
      const table = currentTable(editor);
      const cell = currentCell(editor);
      if (!table) return;
      e.preventDefault();
      e.stopPropagation();
      const anchor = (cell ?? table).getBoundingClientRect();
      openAt(table, cell, anchor.left + 8, anchor.top + 8, true);
      return;
    }
    if (!menu.classList.contains('rly-open')) return;
    const items = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
    );
    const index = items.indexOf(doc.activeElement as HTMLButtonElement);
    const focusItem = (target: number): void => {
      const next = (target + items.length) % items.length;
      items.forEach((item, itemIndex) => (item.tabIndex = itemIndex === next ? 0 : -1));
      items[next]?.focus();
    };
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem(index + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      focusItem(e.key === 'Home' ? 0 : items.length - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    }
  };
  const onScroll = (): void => close();
  body.addEventListener('contextmenu', onContextMenu);
  body.addEventListener('scroll', onScroll);
  doc.addEventListener('mousedown', onDocumentMouseDown);
  doc.addEventListener('keydown', onKeyDown);
  editor.events.on('destroy', () => {
    body.removeEventListener('contextmenu', onContextMenu);
    body.removeEventListener('scroll', onScroll);
    doc.removeEventListener('mousedown', onDocumentMouseDown);
    doc.removeEventListener('keydown', onKeyDown);
    menu.remove();
  });
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
      execute: (ed) => deleteTable(ed)
    });
    editor.commands.register('TableMergeCells', {
      execute: mergeSelectedCells,
      queryState: (ed) => selectedCells(ed).length > 1
    });
    editor.commands.register('TableSplitCell', {
      execute: splitCurrentCell,
      queryState: (ed) => {
        const cell = currentCell(ed);
        return !!cell && (cell.rowSpan > 1 || cell.colSpan > 1);
      }
    });
    editor.commands.register('TableProps', {
      execute: (ed, args) => {
        if (args) applyTableProps(ed, args as TablePropsArgs);
        else void openTablePropsDialog(ed);
      }
    });
    editor.commands.register('CellProps', {
      execute: (ed, args) => {
        if (args) applyCellProps(ed, args as CellPropsArgs);
        else void openCellPropsDialog(ed);
      }
    });
    editor.commands.register('RowProps', {
      execute: (ed, args) => {
        if (args) applyRowProps(ed, args as RowPropsArgs);
        else void openRowPropsDialog(ed);
      }
    });

    editor.ui.addButton('table', {
      icon: 'table',
      tooltip: 'Insert or edit table',
      panel: buildTablePanel
    });

    editor.ui.addMenuItem('inserttable', {
      menu: 'table',
      text: 'Insert table (3×3)',
      command: 'InsertTable'
    });
    editor.ui.addMenuItem('rowabove', {
      menu: 'table',
      text: 'Insert row above',
      command: 'TableInsertRowBefore'
    });
    editor.ui.addMenuItem('rowbelow', {
      menu: 'table',
      text: 'Insert row below',
      command: 'TableInsertRowAfter'
    });
    editor.ui.addMenuItem('colleft', {
      menu: 'table',
      text: 'Insert column left',
      command: 'TableInsertColBefore'
    });
    editor.ui.addMenuItem('colright', {
      menu: 'table',
      text: 'Insert column right',
      command: 'TableInsertColAfter'
    });
    editor.ui.addMenuItem('deltable', {
      menu: 'table',
      text: 'Delete table',
      command: 'TableDelete'
    });
    editor.ui.addMenuItem('delcol', {
      menu: 'table',
      text: 'Delete column',
      command: 'TableDeleteCol'
    });
    editor.ui.addMenuItem('delrow', {
      menu: 'table',
      text: 'Delete row',
      command: 'TableDeleteRow'
    });
    editor.ui.addMenuItem('mergecells', {
      menu: 'table',
      text: 'Merge selected cells',
      command: 'TableMergeCells'
    });
    editor.ui.addMenuItem('splitcell', {
      menu: 'table',
      text: 'Split cell',
      command: 'TableSplitCell'
    });

    editor.ui.addMenuItem('tableprops', {
      menu: 'table',
      text: 'Table properties…',
      command: 'TableProps'
    });
    editor.ui.addMenuItem('cellprops', {
      menu: 'table',
      text: 'Cell properties…',
      command: 'CellProps'
    });
    editor.ui.addMenuItem('rowprops', {
      menu: 'table',
      text: 'Row properties…',
      command: 'RowProps'
    });

    installColumnResize(editor);
    installTableSelection(editor);
    installInlineTableToolbar(editor);
    installMultiCellSelection(editor);
    installTableContextMenu(editor);

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
