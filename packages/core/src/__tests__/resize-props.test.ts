import { describe, it, expect, afterEach } from 'vitest';
import { Editor as CoreEditor, type Editor } from '../editor/Editor';
import { createTestEditor, placeCursor, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('editor resize grip', () => {
  it('renders in the statusbar and resizes the content on drag', () => {
    ed = createTestEditor('<p>x</p>');
    const grip = ed.getRoot().querySelector<HTMLElement>('[data-testid="status-resize"]')!;
    expect(grip).toBeTruthy();

    grip.dispatchEvent(new MouseEvent('mousedown', { clientY: 10, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 310 }));
    document.dispatchEvent(new MouseEvent('mouseup', {}));
    expect(ed.getBody().style.height).toBe('300px'); // 0 (jsdom offsetHeight) + 300, min 120

    // Further drags after mouseup must not resize.
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 500 }));
    expect(ed.getBody().style.height).toBe('300px');
  });

  it('can be disabled via config', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const ed2 = CoreEditor.init({ target, initialContent: '<p>x</p>', resize: false });
    expect(ed2.getRoot().querySelector('[data-testid="status-resize"]')).toBeNull();
    ed2.destroy();
  });
});

describe('TableProps command', () => {
  const TABLE = '<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>';

  it('applies width, alignment, border and padding', () => {
    ed = createTestEditor(TABLE);
    placeCursor(ed, 'a', 0);
    ed.execCommand('TableProps', { width: '50%', align: 'center', borderWidth: '2', cellPadding: '12' });
    const table = ed.getBody().querySelector('table')!;
    expect(table.style.width).toBe('50%');
    expect(table.style.marginLeft).toBe('auto');
    expect(table.style.marginRight).toBe('auto');
    const cell = table.querySelector('td')!;
    expect(cell.style.borderWidth).toBe('2px');
    expect(cell.style.padding).toBe('12px');
  });

  it('toggles striped rows and caption', () => {
    ed = createTestEditor(TABLE);
    placeCursor(ed, 'a', 0);
    ed.execCommand('TableProps', { striped: 'true', caption: 'true' });
    const table = ed.getBody().querySelector('table')!;
    expect(table.classList.contains('sbe-striped')).toBe(true);
    expect(table.querySelector('caption')).toBeTruthy();

    placeCursor(ed, 'a', 0);
    ed.execCommand('TableProps', { striped: 'false', caption: 'false' });
    expect(table.classList.contains('sbe-striped')).toBe(false);
    expect(table.querySelector('caption')).toBeNull();
  });

  it('toggles an accessible header row and applies table height', () => {
    ed = createTestEditor(TABLE);
    placeCursor(ed, 'a', 0);
    ed.execCommand('TableProps', { headerRow: 'true', height: '220' });
    const table = ed.getBody().querySelector('table')!;
    expect(table.style.height).toBe('220px');
    expect(table.tHead?.rows).toHaveLength(1);
    expect(table.tHead?.querySelectorAll('th[scope="col"]')).toHaveLength(2);

    placeCursor(ed, 'a', 0);
    ed.execCommand('TableProps', { headerRow: 'false' });
    expect(table.tHead).toBeNull();
    expect(table.rows[0]?.querySelectorAll('td')).toHaveLength(2);
  });

  it('ignores invalid CSS dimensions', () => {
    ed = createTestEditor(TABLE);
    placeCursor(ed, 'a', 0);
    ed.execCommand('TableProps', { width: 'expression(bad)', height: 'nope' });
    const table = ed.getBody().querySelector('table')!;
    expect(table.style.width).toBe('');
    expect(table.style.height).toBe('');
  });

  it('opens a prefilled dialog without args', async () => {
    ed = createTestEditor(TABLE);
    placeCursor(ed, 'a', 0);
    ed.execCommand('TableProps', { width: '80%' });
    placeCursor(ed, 'a', 0);
    ed.execCommand('TableProps');
    const dialog = document.querySelector<HTMLElement>('[data-testid="dialog-tableprops"]')!;
    expect(dialog).toBeTruthy();
    expect(dialog.querySelector<HTMLInputElement>('[data-testid="dialog-field-width"]')!.value).toBe('80%');
    dialog.querySelector<HTMLButtonElement>('[data-testid="dialog-cancel"]')!.click();
    await tick();
  });
});

describe('CellProps command', () => {
  it('sets width, alignment and background', () => {
    ed = createTestEditor('<table><tbody><tr><td>cell</td></tr></tbody></table>');
    placeCursor(ed, 'cell', 0);
    ed.execCommand('CellProps', { width: '120px', halign: 'center', valign: 'top', bg: '#fef3c7' });
    const cell = ed.getBody().querySelector('td')!;
    expect(cell.style.width).toBe('120px');
    expect(cell.style.textAlign).toBe('center');
    expect(cell.style.verticalAlign).toBe('top');
    expect(cell.style.backgroundColor).toBe('rgb(254, 243, 199)');
  });

  it('converts td to th preserving content', () => {
    ed = createTestEditor('<table><tbody><tr><td>head</td><td>x</td></tr></tbody></table>');
    placeCursor(ed, 'head', 0);
    ed.execCommand('CellProps', { type: 'th' });
    expect(ed.getContent()).toContain('<th>head</th>');
    expect(ed.getContent()).toContain('<td>x</td>');
    // command targets the converted cell, state still "in table"
    expect(ed.queryCommandState('InsertTable')).toBe(true);
  });

  it('survives the sanitizer round-trip (styles whitelisted)', () => {
    ed = createTestEditor('<table><tbody><tr><td>x</td></tr></tbody></table>');
    placeCursor(ed, 'x', 0);
    ed.execCommand('CellProps', { width: '25%', valign: 'middle' });
    const html = ed.getContent();
    ed.setContent(html);
    expect(ed.getContent()).toContain('width: 25%');
    expect(ed.getContent()).toContain('vertical-align: middle');
  });
});

describe('RowProps command', () => {
  it('moves a row into the header and preserves semantic cells', () => {
    ed = createTestEditor('<table><tbody><tr><td>head</td><td>value</td></tr><tr><td>a</td><td>b</td></tr></tbody></table>');
    placeCursor(ed, 'head', 0);
    ed.execCommand('RowProps', { section: 'head', height: '48', align: 'center', valign: 'middle' });
    const row = ed.getBody().querySelector('thead tr')! as HTMLTableRowElement;
    expect(row.style.height).toBe('48px');
    expect(row.style.textAlign).toBe('center');
    expect(row.style.verticalAlign).toBe('middle');
    expect(row.querySelectorAll('th[scope="col"]')).toHaveLength(2);
  });

  it('opens the row properties dialog from the contextual table panel', () => {
    ed = createTestEditor('<table><tbody><tr><td>cell</td></tr></tbody></table>');
    placeCursor(ed, 'cell', 0);
    ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="tb-table"]')!.click();
    const button = ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="table-action-row-props"]')!;
    expect(button.disabled).toBe(false);
    button.click();
    expect(document.querySelector('[data-testid="dialog-rowprops"]')).toBeTruthy();
    document.querySelector<HTMLButtonElement>('[data-testid="dialog-cancel"]')!.click();
  });
});

describe('table selection frame', () => {
  it('selects a clicked table without adding editor-only handles to the HTML', () => {
    ed = createTestEditor('<table><tbody><tr><td>x</td></tr></tbody></table>');
    const cell = ed.getBody().querySelector('td')!;
    cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(ed.getRoot().querySelector('[data-testid="table-selection"]')?.classList.contains('sbe-show')).toBe(true);
    expect(ed.getContent()).not.toContain('table-selection');
    expect(ed.getContent()).not.toContain('table-resize');
  });
});
