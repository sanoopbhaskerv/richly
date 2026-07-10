import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, destroyAll, placeCursor } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

describe('editing edge cases', () => {
  it('commits an IME composition as one change and one undo step', () => {
    ed = createTestEditor('<p>start</p>');
    const body = ed.getBody();
    const changes = vi.fn();
    ed.on('change', changes);

    body.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    body.querySelector('p')!.textContent = '日本語';
    body.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    expect(changes).not.toHaveBeenCalled();

    body.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '日本語' }));
    expect(changes).toHaveBeenCalledTimes(1);
    ed.execCommand('Undo');
    expect(ed.getContent()).toBe('<p>start</p>');
  });

  it('does not coalesce a composition into the preceding typing burst', () => {
    ed = createTestEditor('<p>start</p>');
    const body = ed.getBody();
    body.querySelector('p')!.textContent = 'before';
    body.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    body.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    body.querySelector('p')!.textContent = '日本語';
    body.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    body.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '日本語' }));

    ed.execCommand('Undo');
    expect(ed.getContent()).toBe('<p>before</p>');
  });

  it('pastes plain text literally and preserves newlines', () => {
    ed = createTestEditor('<p>end</p>');
    placeCursor(ed, 'end', 0);
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: (type: string) =>
          type === 'text/plain' ? '<img src=x onerror=alert(1)>\nnext' : ''
      }
    });

    ed.getBody().dispatchEvent(event);

    expect(ed.getContent()).toContain('&lt;img src=x onerror=alert(1)&gt;<br>next');
    expect(ed.getBody().querySelector('img')).toBeNull();
  });

  it('rejects selections that cross the editable boundary', () => {
    ed = createTestEditor('<p>inside</p>');
    const outside = document.createTextNode('outside');
    document.body.appendChild(outside);
    const inside = ed.getBody().querySelector('p')!.firstChild!;
    const range = document.createRange();
    range.setStart(inside, 0);
    range.setEnd(outside, outside.textContent!.length);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(ed.selection.getRange()).toBeNull();
    expect(ed.selection.getBookmark()).toBeNull();
  });
});
