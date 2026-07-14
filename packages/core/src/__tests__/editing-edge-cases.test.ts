import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, destroyAll, placeCursor, selectText } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

describe('editing edge cases', () => {
  it('moves Home/End within a block and Mod+End to the document boundary', () => {
    ed = createTestEditor('<p>alpha</p><p>omega</p>');
    placeCursor(ed, 'alpha', 2);

    ed.getBody().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })
    );
    const first = ed.getBody().querySelector('p')!;
    expect(ed.selection.getRange()?.startContainer).toBe(first);
    expect(ed.selection.getRange()?.startOffset).toBe(first.childNodes.length);

    ed.getBody().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })
    );
    expect(ed.selection.getRange()?.startContainer).toBe(first);
    expect(ed.selection.getRange()?.startOffset).toBe(0);

    ed.getBody().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true, cancelable: true })
    );
    const last = ed.getBody().querySelectorAll('p')[1]!;
    expect(ed.selection.getRange()?.startContainer).toBe(last);
    expect(ed.selection.getRange()?.startOffset).toBe(last.childNodes.length);
  });

  it('normalizes an entirely deleted document without retaining an empty list', () => {
    ed = createTestEditor('<h1>Heading</h1><ul><li>item</li></ul>');
    ed.getBody().innerHTML = '<h1><br></h1><ul> </ul>';
    ed.getBody().dispatchEvent(new InputEvent('input', { bubbles: true }));

    expect(ed.getContent()).toBe('<p><br></p>');
    expect(ed.getBody().querySelector('ul')).toBeNull();
  });

  it('preserves intentional empty paragraphs created in an otherwise blank document', () => {
    ed = createTestEditor('<p><br></p><p><br></p>');
    ed.getBody().dispatchEvent(new InputEvent('input', { bubbles: true }));

    expect(ed.getBody().querySelectorAll(':scope > p')).toHaveLength(2);
  });

  it('normalizes an empty list even when the browser retains an empty item', () => {
    ed = createTestEditor('<ul><li><br></li></ul>');
    ed.getBody().dispatchEvent(new InputEvent('input', { bubbles: true }));

    expect(ed.getContent()).toBe('<p><br></p>');
  });

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

  it('preserves styled spans when bold interleaves with colored text', () => {
    ed = createTestEditor('<p><span style="color: red">abc</span></p>');
    selectText(ed, 'b');

    ed.execCommand('Bold');

    const content = ed.getContent();
    expect(content).toContain('color: red');
    expect(content).toContain('<strong>b</strong>');
    expect(content).not.toMatch(/style=""|<span[^>]*><span/i);
  });

  it('does not leak empty styled spans into getContent after a browser-like split', () => {
    ed = createTestEditor('<p><span style="color: red">ab</span></p>');
    ed.getBody().innerHTML =
      '<p><span style="color: red">a</span><span style="color: red"></span><span style="color: red">b</span></p>';

    expect(ed.getContent()).toBe(
      '<p><span style="color: red">a</span><span style="color: red">b</span></p>'
    );
  });

  it('RemoveFormat clears mixed tag and style runs across one selection', () => {
    ed = createTestEditor(
      '<p><strong>aa</strong><span style="color: red; font-size: 18px">bb</span><em>cc</em></p>'
    );

    const paragraph = ed.getBody().querySelector('p')!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    ed.selection.setRange(range);

    ed.execCommand('RemoveFormat');

    expect(ed.getContent()).toBe('<p>aabbcc</p>');
  });

  it('RemoveFormat peels a font-size ancestor around an exact text selection', () => {
    ed = createTestEditor('<p><span style="font-size: 16.5px"><em>formatted</em></span></p>');
    selectText(ed, 'formatted');

    ed.execCommand('RemoveFormat');

    expect(ed.getContent()).toBe('<p>formatted</p>');
  });
});
