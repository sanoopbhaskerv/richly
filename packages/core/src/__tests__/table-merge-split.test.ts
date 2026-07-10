import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

function selectRectangle(
  editor: Editor,
  from: HTMLTableCellElement,
  to: HTMLTableCellElement
): void {
  from.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  to.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }));
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

describe('table multi-cell operations', () => {
  it('selects a rectangle and merges its content', () => {
    ed = createTestEditor(
      '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>'
    );
    const cells = ed.getBody().querySelectorAll<HTMLTableCellElement>('td');
    selectRectangle(ed, cells[0]!, cells[3]!);

    expect(ed.queryCommandState('TableMergeCells')).toBe(true);
    ed.execCommand('TableMergeCells');

    const merged = ed.getBody().querySelector('td')!;
    expect(merged.rowSpan).toBe(2);
    expect(merged.colSpan).toBe(2);
    expect(merged.textContent).toBe('ABCD');
    expect(ed.getBody().querySelectorAll('td')).toHaveLength(1);
    expect(ed.getContent()).not.toContain('rly-cell-selected');
  });

  it('splits a merged cell back into its grid slots', () => {
    ed = createTestEditor(
      '<table><tbody><tr><td rowspan="2" colspan="2">A</td></tr><tr></tr></tbody></table>'
    );
    const cell = ed.getBody().querySelector<HTMLTableCellElement>('td')!;
    cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    const range = document.createRange();
    range.selectNodeContents(cell);
    ed.selection.setRange(range);

    expect(ed.queryCommandState('TableSplitCell')).toBe(true);
    ed.execCommand('TableSplitCell');

    expect(ed.getBody().querySelectorAll('td')).toHaveLength(4);
    expect(cell.rowSpan).toBe(1);
    expect(cell.colSpan).toBe(1);
  });
});
