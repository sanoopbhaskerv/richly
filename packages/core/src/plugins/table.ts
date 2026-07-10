import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import { closestTag, closestBlock } from '../dom/DomUtils';
import { openDialog } from '../ui/Dialog';

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
  const colgroup = table.querySelector(':scope > colgroup');
  if (colgroup) {
    const col = doc.createElement('col');
    const neighbor = (colgroup.children[Math.min(idx, colgroup.children.length - 1)] as HTMLElement | undefined);
    const width = parseFloat(neighbor?.style.width ?? '') || 80;
    col.style.width = `${Math.round(width)}px`;
    colgroup.insertBefore(col, colgroup.children[idx] ?? null);
    const tableWidth = table.getBoundingClientRect().width || parseFloat(table.style.width);
    if (tableWidth) table.style.width = `${Math.round(tableWidth + width)}px`;
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
  colgroup?.children[idx]?.remove();
  if (colgroup && !colgroup.children.length) colgroup.remove();
  if (oldWidth && table.style.width) {
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
    table.classList.toggle('sbe-striped', args.striped === true || args.striped === 'true');
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
  const align = table.style.marginLeft === 'auto' ? (table.style.marginRight === 'auto' ? 'center' : 'right') : 'none';
  const result = await openDialog(editor, {
    name: 'tableprops',
    title: 'Table properties',
    description: 'Tune the table layout and visual hierarchy without touching its content.',
    layout: 'grid',
    fields: [
      { name: 'width', label: 'Width', value: table.style.width, placeholder: '100% or 640px', hint: 'Use px or %' },
      { name: 'height', label: 'Height', value: table.style.height, placeholder: 'Auto or 240px', hint: 'Leave blank for automatic height' },
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
      { name: 'cellPadding', label: 'Cell padding', value: firstCell?.style.padding.replace('px', '') ?? '', placeholder: '10', hint: 'Pixels' },
      { name: 'borderWidth', label: 'Border width', value: firstCell?.style.borderWidth.replace('px', '') ?? '', placeholder: '1', hint: 'Pixels' },
      { name: 'borderColor', label: 'Border color', value: firstCell?.style.borderColor ?? '', placeholder: '#d7dce3' },
      { name: 'striped', label: 'Striped rows', type: 'checkbox', value: String(table.classList.contains('sbe-striped')) },
      { name: 'headerRow', label: 'Header row', type: 'checkbox', value: String(!!table.tHead || table.rows[0]?.cells[0]?.tagName === 'TH') },
      { name: 'caption', label: 'Show caption', type: 'checkbox', value: String(!!table.querySelector('caption')) }
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
      { name: 'width', label: 'Width', value: cell.style.width, placeholder: '25% or 160px', hint: 'Use px or %' },
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
      { name: 'bg', label: 'Background color', value: cell.style.backgroundColor, placeholder: '#fef3c7' }
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
        ? table.tHead ?? table.createTHead()
        : args.section === 'foot'
          ? table.tFoot ?? table.createTFoot()
          : table.tBodies[0] ?? table.createTBody();
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
      { name: 'height', label: 'Height', value: row.style.height, placeholder: '44', hint: 'Pixels, or a CSS size' },
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
      { name: 'bg', label: 'Background color', value: row.style.backgroundColor, placeholder: '#f8fafc' }
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
    table.style.width = `${Math.round(table.getBoundingClientRect().width)}px`;
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
      caption ? caption.after(colgroup) : table.prepend(colgroup);
    }
    const colIdx = cell.cellIndex;
    const target = colgroup.children[colIdx] as HTMLElement | undefined;
    if (!target) return;
    const startX = e.clientX;
    const startW = parseFloat(target.style.width) || target.getBoundingClientRect().width;
    // Inner border: transfer width to the neighbor (table width constant).
    // Last column: grow/shrink the table itself.
    const next = (colgroup.children[colIdx + 1] as HTMLElement | undefined) ?? null;
    const startNextW = next ? parseFloat(next.style.width) || next.getBoundingClientRect().width : 0;
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
  frame.className = 'sbe-table-selection';
  frame.dataset.testid = 'table-selection';
  frame.setAttribute('aria-hidden', 'true');
  let selected: HTMLTableElement | null = null;

  const position = (): void => {
    if (!selected?.isConnected || !body.contains(selected)) {
      selected = null;
      frame.classList.remove('sbe-show');
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const rect = selected.getBoundingClientRect();
    frame.style.left = `${rect.left - rootRect.left}px`;
    frame.style.top = `${rect.top - rootRect.top}px`;
    frame.style.width = `${rect.width}px`;
    frame.style.height = `${rect.height}px`;
    frame.classList.add('sbe-show');
  };

  const select = (table: HTMLTableElement | null): void => {
    selected = table;
    position();
  };

  for (const axis of ['x', 'y', 'xy'] as const) {
    const handle = doc.createElement('button');
    handle.type = 'button';
    handle.tabIndex = -1;
    handle.className = `sbe-table-handle sbe-table-handle-${axis}`;
    handle.dataset.axis = axis;
    handle.dataset.testid = `table-resize-${axis}`;
    handle.setAttribute('aria-label', axis === 'x' ? 'Resize table width' : axis === 'y' ? 'Resize table height' : 'Resize table');
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
        if (axis !== 'y') table.style.width = `${Math.round(Math.max(120, startRect.width + ev.clientX - startX))}px`;
        if (axis !== 'x') table.style.height = `${Math.round(Math.max(44, startRect.height + ev.clientY - startY))}px`;
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
  wrap.className = 'sbe-table-grid-picker';
  const title = doc.createElement('div');
  title.className = 'sbe-table-panel-title';
  title.textContent = 'Insert table';
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

  wrap.append(title, grid, label);
  return wrap;
}

function buildTablePanel(editor: Editor, close: () => void): HTMLElement {
  const doc = editor.getBody().ownerDocument;
  const panel = doc.createElement('div');
  panel.className = 'sbe-table-panel';
  panel.appendChild(buildGridPanel(editor, close));

  const context = doc.createElement('div');
  context.className = 'sbe-table-context';
  const header = doc.createElement('div');
  header.className = 'sbe-table-context-header';
  const heading = doc.createElement('span');
  heading.className = 'sbe-table-panel-title';
  heading.textContent = 'Edit current table';
  const badge = doc.createElement('span');
  badge.className = 'sbe-table-context-badge';
  header.append(heading, badge);

  const quick = doc.createElement('div');
  quick.className = 'sbe-table-quick-grid';
  const propertyGrid = doc.createElement('div');
  propertyGrid.className = 'sbe-table-property-grid';
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
    btn.className = `sbe-table-action sbe-table-action-${kind}`;
    btn.dataset.testid = `table-action-${id}`;
    const icon = doc.createElement('span');
    icon.className = 'sbe-table-action-icon';
    icon.textContent = glyph;
    const label = doc.createElement('span');
    label.textContent = text;
    btn.append(icon, label);
    btn.addEventListener('click', () => {
      close();
      editor.execCommand(command);
      if (!doc.querySelector('.sbe-dialog-overlay')) editor.focus();
    });
    actions.push(btn);
    return btn;
  };

  quick.append(
    action('row-before', 'Row above', '↑', 'TableInsertRowBefore'),
    action('row-after', 'Row below', '↓', 'TableInsertRowAfter'),
    action('col-before', 'Column left', '←', 'TableInsertColBefore'),
    action('col-after', 'Column right', '→', 'TableInsertColAfter')
  );
  propertyGrid.append(
    action('table-props', 'Table', '▦', 'TableProps', 'property'),
    action('cell-props', 'Cell', '□', 'CellProps', 'property'),
    action('row-props', 'Row', '═', 'RowProps', 'property')
  );
  const danger = doc.createElement('div');
  danger.className = 'sbe-table-danger-row';
  danger.append(
    action('delete-table', 'Delete table', '×', 'TableDelete', 'danger'),
    action('delete-col', 'Delete column', '−', 'TableDeleteCol', 'danger'),
    action('delete-row', 'Delete row', '−', 'TableDeleteRow', 'danger'),
  );
  context.append(header, quick, propertyGrid, danger);
  panel.appendChild(context);

  const refresh = (): void => {
    const table = currentTable(editor);
    context.classList.toggle('sbe-disabled', !table);
    actions.forEach((btn) => (btn.disabled = !table));
    badge.textContent = table ? `${table.rows.length} × ${table.rows[0]?.cells.length ?? 0}` : 'Select a table';
  };
  editor.events.on('selectionchange', refresh);
  editor.events.on('change', refresh);
  panel.addEventListener('sbe-panel-open', refresh);
  refresh();
  return panel;
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

    editor.ui.addButton('table', { icon: 'table', tooltip: 'Insert or edit table', panel: buildTablePanel });

    editor.ui.addMenuItem('inserttable', { menu: 'table', text: 'Insert table (3×3)', command: 'InsertTable' });
    editor.ui.addMenuItem('rowabove', { menu: 'table', text: 'Insert row above', command: 'TableInsertRowBefore' });
    editor.ui.addMenuItem('rowbelow', { menu: 'table', text: 'Insert row below', command: 'TableInsertRowAfter' });
    editor.ui.addMenuItem('colleft', { menu: 'table', text: 'Insert column left', command: 'TableInsertColBefore' });
    editor.ui.addMenuItem('colright', { menu: 'table', text: 'Insert column right', command: 'TableInsertColAfter' });
    editor.ui.addMenuItem('deltable', { menu: 'table', text: 'Delete table', command: 'TableDelete' });
    editor.ui.addMenuItem('delcol', { menu: 'table', text: 'Delete column', command: 'TableDeleteCol' });
    editor.ui.addMenuItem('delrow', { menu: 'table', text: 'Delete row', command: 'TableDeleteRow' });
    
    
    editor.ui.addMenuItem('tableprops', { menu: 'table', text: 'Table properties…', command: 'TableProps' });
    editor.ui.addMenuItem('cellprops', { menu: 'table', text: 'Cell properties…', command: 'CellProps' });
    editor.ui.addMenuItem('rowprops', { menu: 'table', text: 'Row properties…', command: 'RowProps' });

    installColumnResize(editor);
    installTableSelection(editor);

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
