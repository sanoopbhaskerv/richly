import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '../editor/Editor';
import { createTestEditor, placeCursor, selectText } from './test-utils';
let ed: Editor;
const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
function clipboard(value: object): void {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value });
}
function native(type: string, data?: object): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  ed.getBody().dispatchEvent(event);
  return event;
}
beforeEach(() => {
  ed = createTestEditor('<p><strong>alpha</strong> beta</p>');
  clipboard({});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  ed.destroy();
  document.body.innerHTML = '';
  if (original) Object.defineProperty(navigator, 'clipboard', original);
  else Reflect.deleteProperty(navigator, 'clipboard');
});
describe('clipboard browser APIs and native edge cases', () => {
  it('writes rich ClipboardItems', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    class Item {
      constructor(readonly data: Record<string, Blob>) {}
    }
    vi.stubGlobal('ClipboardItem', Item);
    clipboard({ write });
    selectText(ed, 'alpha');
    ed.execCommand('Copy');
    await tick();
    const item = write.mock.calls[0][0][0] as Item;
    expect(item.data['text/html'].type).toBe('text/html');
    expect(item.data['text/plain'].size).toBe(5);
  });
  it.each([false, true])('preserves internal copy when text writes denied: %s', async (denied) => {
    const writeText = denied
      ? vi.fn().mockRejectedValue(new Error('denied'))
      : vi.fn().mockResolvedValue(undefined);
    clipboard({ writeText });
    selectText(ed, 'alpha');
    ed.execCommand('Copy');
    await tick();
    expect(writeText).toHaveBeenCalledWith('alpha');
    placeCursor(ed, 'beta', 4);
    ed.execCommand('Paste');
    await tick();
    expect(ed.getContent()).toContain('beta<strong>alpha</strong>');
  });
  it.each([
    { html: '<em>rich</em>', text: 'rich', expected: '<em>rich</em>' },
    { html: '<em>html only</em>', text: '', expected: '<em>html only</em>' },
    { html: '', text: 'first\n<second>', expected: 'first<br>&lt;second&gt;' }
  ])('reads supported item types: $expected', async ({ html, text, expected }) => {
    const values: Record<string, string> = {};
    if (html) values['text/html'] = html;
    if (text) values['text/plain'] = text;
    clipboard({
      read: async () => [
        { types: ['image/png'] },
        {
          types: Object.keys(values),
          getType: async (type: string) => ({ text: async () => values[type] })
        }
      ]
    });
    placeCursor(ed, 'beta', 4);
    ed.execCommand('Paste');
    await tick();
    expect(ed.getContent()).toContain(`beta${expected}`);
  });
  it('falls back from empty rich items to readText', async () => {
    clipboard({
      read: async () => [
        { types: ['text/plain'], getType: async () => ({ text: async () => '' }) }
      ],
      readText: async () => 'plain'
    });
    placeCursor(ed, 'beta', 4);
    ed.execCommand('Paste');
    await tick();
    expect(ed.getContent()).toContain('betaplain');
  });
  it.each(['empty', 'denied'])('uses memory fallback for %s reads', async (mode) => {
    selectText(ed, 'alpha');
    ed.execCommand('Copy');
    clipboard({
      readText:
        mode === 'empty'
          ? async () => ''
          : async () => {
              throw new Error('denied');
            }
    });
    placeCursor(ed, 'beta', 4);
    ed.execCommand('Paste');
    await tick();
    expect(ed.getContent()).toContain('beta<strong>alpha</strong>');
  });
  it('does not insert without a selection', async () => {
    clipboard({ readText: async () => 'do not insert' });
    vi.spyOn(ed.selection, 'getRange').mockReturnValue(null);
    ed.execCommand('Paste');
    await tick();
    expect(ed.getContent()).not.toContain('do not insert');
  });
  it('handles rich HTML stripped to an empty fragment', async () => {
    clipboard({
      read: async () => [
        {
          types: ['text/html'],
          getType: async () => ({ text: async () => '<script>alert(1)</script>' })
        }
      ]
    });
    selectText(ed, 'alpha');
    ed.execCommand('Paste');
    await tick();
    expect(ed.getContent()).not.toMatch(/script|alert|alpha/);
  });
  it.each(['Copy', 'Cut'])('ignores %s without expanded selection', (cmd) => {
    placeCursor(ed, 'beta');
    const before = ed.getContent();
    ed.execCommand(cmd);
    vi.spyOn(ed.selection, 'getRange').mockReturnValue(null);
    ed.execCommand(cmd);
    expect(ed.getContent()).toBe(before);
  });
  it('ignores selections outside editor', () => {
    const outside = document.createElement('p');
    outside.textContent = 'outside';
    document.body.append(outside);
    const range = document.createRange();
    range.selectNodeContents(outside);
    vi.spyOn(ed.selection, 'getRange').mockReturnValue(range);
    ed.execCommand('Cut');
    expect(outside.textContent).toBe('outside');
  });
  it('copies element ranges using native clipboard formats', () => {
    const range = document.createRange();
    range.selectNodeContents(ed.getBody().querySelector('strong')!);
    ed.selection.setRange(range);
    const setData = vi.fn();
    expect(native('copy', { setData }).defaultPrevented).toBe(true);
    expect(setData).toHaveBeenCalledWith('text/plain', 'alpha');
    expect(setData).toHaveBeenCalledWith('text/html', '<strong>alpha</strong>');
  });
  it.each(['missing', 'throws'])('does not cut when native clipboard %s', (mode) => {
    selectText(ed, 'alpha');
    const event = native(
      'cut',
      mode === 'missing'
        ? undefined
        : {
            setData: () => {
              throw new Error('denied');
            }
          }
    );
    expect(event.defaultPrevented).toBe(false);
    expect(ed.getContent()).toContain('alpha');
  });
  it('deletes native cut only after writing and emits input', () => {
    selectText(ed, 'alpha');
    const input = vi.fn();
    ed.events.on('input', input);
    expect(native('cut', { setData: vi.fn() }).defaultPrevented).toBe(true);
    expect(ed.getContent()).not.toContain('alpha');
    expect(input).toHaveBeenCalled();
  });
  it('ignores collapsed native copy and cut', () => {
    placeCursor(ed, 'beta');
    const setData = vi.fn();
    native('copy', { setData });
    native('cut', { setData });
    expect(setData).not.toHaveBeenCalled();
  });
  it('leaves file paste untouched without an upload handler', () => {
    const before = ed.getContent();
    expect(native('paste').defaultPrevented).toBe(false);
    expect(
      native('paste', {
        getData: () => '',
        files: [new File(['x'], 'photo.png', { type: 'image/png' })]
      }).defaultPrevented
    ).toBe(false);
    expect(ed.getContent()).toBe(before);
  });
});
