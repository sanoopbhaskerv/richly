import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, destroyAll, selectText } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

const bar = (): HTMLElement =>
  ed.getRoot().querySelector<HTMLElement>('[data-testid="text-inline-toolbar"]')!;

function emitSelection(): void {
  ed.events.emit('selectionchange', undefined);
}

describe('inline text toolbar', () => {
  it('shows for non-collapsed text selections and hides otherwise', () => {
    ed = createTestEditor('<p>hello world</p>');
    expect(bar().classList.contains('rly-open')).toBe(false);

    selectText(ed, 'hello');
    emitSelection();
    expect(bar().classList.contains('rly-open')).toBe(true);

    const range = ed.selection.getRange()!;
    range.collapse(true);
    ed.selection.setRange(range);
    emitSelection();
    expect(bar().classList.contains('rly-open')).toBe(false);
  });

  it('renders all configured actions with separators', () => {
    ed = createTestEditor('<p>hello world</p>');
    const ids = ['bold', 'italic', 'link', 'h2', 'h3', 'blockquote'];
    for (const id of ids) {
      expect(bar().querySelector(`[data-testid="inline-text-action-${id}"]`)).toBeTruthy();
    }
    expect(bar().querySelectorAll('.rly-text-inline-sep').length).toBe(1);
  });

  it('executes formatting actions from the inline toolbar', () => {
    ed = createTestEditor('<p>hello world</p>');
    selectText(ed, 'hello');
    emitSelection();

    bar().querySelector<HTMLButtonElement>('[data-testid="inline-text-action-bold"]')!.click();
    expect(ed.getContent()).toContain('<strong>hello</strong>');

    selectText(ed, 'hello');
    emitSelection();
    bar().querySelector<HTMLButtonElement>('[data-testid="inline-text-action-h3"]')!.click();
    expect(ed.getContent()).toContain('<h3><strong>hello</strong> world</h3>');
  });

  it('highlights active styles from the current selection', () => {
    ed = createTestEditor('<p><strong>hello</strong> <em>world</em></p>');
    selectText(ed, 'hello');
    emitSelection();
    expect(
      bar()
        .querySelector('[data-testid="inline-text-action-bold"]')!
        .classList.contains('rly-active')
    ).toBe(true);

    selectText(ed, 'world');
    emitSelection();
    expect(
      bar()
        .querySelector('[data-testid="inline-text-action-italic"]')!
        .classList.contains('rly-active')
    ).toBe(true);
  });

  it('stays hidden for table selections', () => {
    ed = createTestEditor('<table><tbody><tr><td>cell text</td></tr></tbody></table>');
    selectText(ed, 'cell');
    emitSelection();
    expect(bar().classList.contains('rly-open')).toBe(false);
  });
});
