import { describe, it, expect, afterEach } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, placeCursor, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

/**
 * Simulate the user clicking into an element inside the editable body.
 * jsdom fires the event but (unlike a real browser) does not move the caret,
 * so callers that need a live selection must also call `placeCursor`.
 */
function mouseDownOn(el: Element): void {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
}

const bar = (): HTMLElement =>
  ed.getRoot().querySelector<HTMLElement>('[data-testid="table-inline-toolbar"]')!;

const TABLE = '<p>before</p><table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';

describe('inline table options toolbar', () => {
  it('is hidden until a table is selected, then shows', () => {
    ed = createTestEditor(TABLE);
    expect(bar().classList.contains('rly-open')).toBe(false);
    mouseDownOn(ed.getBody().querySelector('td')!);
    expect(bar().classList.contains('rly-open')).toBe(true);
  });

  it('renders all grouped actions with testids', () => {
    ed = createTestEditor(TABLE);
    const ids = [
      'table-props',
      'delete-table',
      'row-before',
      'row-after',
      'delete-row',
      'col-before',
      'col-after',
      'delete-col'
    ];
    for (const id of ids) {
      expect(bar().querySelector(`[data-testid="inline-table-action-${id}"]`)).toBeTruthy();
    }
    expect(bar().querySelectorAll('.rly-table-inline-sep').length).toBe(2);
  });

  it('executes commands and stays open for chained edits', () => {
    ed = createTestEditor(TABLE);
    mouseDownOn(ed.getBody().querySelector('td')!);
    placeCursor(ed, 'a', 0); // jsdom: caret must be placed explicitly
    bar()
      .querySelector<HTMLButtonElement>('[data-testid="inline-table-action-row-after"]')!
      .click();
    expect(ed.getBody().querySelectorAll('tr').length).toBe(2);
    expect(bar().classList.contains('rly-open')).toBe(true);

    bar()
      .querySelector<HTMLButtonElement>('[data-testid="inline-table-action-col-after"]')!
      .click();
    expect(ed.getBody().querySelectorAll('tr')[0]!.children.length).toBe(3);
  });

  it('hides when clicking outside the table', () => {
    ed = createTestEditor(TABLE);
    mouseDownOn(ed.getBody().querySelector('td')!);
    expect(bar().classList.contains('rly-open')).toBe(true);
    mouseDownOn(ed.getBody().querySelector('p')!);
    expect(bar().classList.contains('rly-open')).toBe(false);
  });

  it('hides after the table itself is deleted', () => {
    ed = createTestEditor(TABLE);
    mouseDownOn(ed.getBody().querySelector('td')!);
    placeCursor(ed, 'a', 0); // jsdom: caret must be placed explicitly
    bar()
      .querySelector<HTMLButtonElement>('[data-testid="inline-table-action-delete-table"]')!
      .click();
    expect(ed.getBody().querySelector('table')).toBeNull();
    expect(bar().classList.contains('rly-open')).toBe(false);
  });
});
