import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor, getEditorConfig } from '../editor/Editor';
import { createTestEditor, placeCursor, selectText } from './test-utils';
let ed: Editor | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  ed?.destroy();
  ed = undefined;
  document.body.innerHTML = '';
});
function init(html = '<p>alpha</p>'): Editor {
  return (ed = createTestEditor(html));
}
function key(editor: Editor, key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  editor.getBody().dispatchEvent(event);
  return event;
}
describe('Editor initialization and event boundaries', () => {
  it('requires an existing target or selector', () => {
    expect(() => Editor.init({})).toThrow('config.target or config.selector');
    expect(() => Editor.init({ selector: '#missing' })).toThrow('config.target or config.selector');
  });
  it('mounts by selector and cleans configuration on destruction', () => {
    document.body.innerHTML = '<div id="mount"></div>';
    ed = Editor.init({
      selector: '#mount',
      menubar: false,
      statusbar: false,
      toolbar: '',
      testIdPrefix: 'custom',
      blockquoteStyle: false
    });
    expect(ed.getRoot().dataset.testid).toBe('custom-root');
    expect(ed.getBody().classList.contains('rly-blockquote-styled')).toBe(false);
    expect(ed.getRoot().querySelector('.rly-menubar')).toBeNull();
    expect(ed.getRoot().querySelector('.rly-statusbar')).toBeNull();
    expect(ed.getContent()).toBe('<p><br></p>');
    const old = ed;
    ed.destroy();
    ed = undefined;
    expect(() => getEditorConfig(old)).toThrow('configuration is unavailable');
  });
  it.each([
    ['b', false, 'Bold'],
    ['i', false, 'Italic'],
    ['u', false, 'Underline'],
    ['z', false, 'Undo'],
    ['z', true, 'Redo'],
    ['y', false, 'Redo'],
    ['f', false, 'FindReplace']
  ] as const)('routes modified %s shortcut', (pressed, shiftKey, command) => {
    const editor = init();
    const run = vi.spyOn(editor, 'execCommand').mockReturnValue(true);
    expect(key(editor, pressed, { ctrlKey: true, shiftKey }).defaultPrevented).toBe(true);
    expect(run).toHaveBeenCalledWith(command);
  });
  it('preserves unrecognized modified and IME keys', () => {
    const editor = init();
    const run = vi.spyOn(editor, 'execCommand');
    expect(key(editor, 'q', { metaKey: true }).defaultPrevented).toBe(false);
    expect(key(editor, 'b', { ctrlKey: true, isComposing: true }).defaultPrevented).toBe(false);
    expect(key(editor, 'b', { ctrlKey: true, keyCode: 229 }).defaultPrevented).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
  it.each(['Enter', 'ArrowDown', 'Home'])('ignores %s with no selection', (pressed) => {
    const editor = init();
    vi.spyOn(editor.selection, 'getRange').mockReturnValue(null);
    expect(key(editor, pressed).defaultPrevented).toBe(false);
  });
  it.each(['Enter', 'ArrowDown'])(
    'does not hijack %s for expanded or ordinary selections',
    (pressed) => {
      const editor = init();
      selectText(editor, 'alpha');
      expect(key(editor, pressed).defaultPrevented).toBe(false);
      placeCursor(editor, 'alpha', 2);
      expect(key(editor, pressed).defaultPrevented).toBe(false);
    }
  );
  it.each(['Enter', 'ArrowDown'])('keeps %s within unfinished blockquote text', (pressed) => {
    const editor = init('<blockquote><p>alpha</p></blockquote>');
    placeCursor(editor, 'alpha', 2);
    expect(key(editor, pressed).defaultPrevented).toBe(false);
    expect(editor.getBody().children.length).toBe(1);
  });
  it.each([false, true])('ArrowDown exits a quote, existing following block: %s', (hasNext) => {
    const editor = init(`<blockquote><p>alpha</p></blockquote>${hasNext ? '<p>next</p>' : ''}`);
    const range = document.createRange();
    range.selectNodeContents(editor.getBody().firstElementChild!);
    range.collapse(false);
    editor.selection.setRange(range);
    expect(key(editor, 'ArrowDown').defaultPrevented).toBe(true);
    expect(editor.getBody().children.length).toBe(2);
    expect(editor.selection.getRange()?.startContainer).toBe(editor.getBody().lastElementChild);
  });
  it('Enter at the quote boundary creates a following paragraph', () => {
    const editor = init('<blockquote><p>alpha</p></blockquote>');
    const range = document.createRange();
    range.selectNodeContents(editor.getBody().firstElementChild!);
    range.collapse(false);
    editor.selection.setRange(range);
    expect(key(editor, 'Enter').defaultPrevented).toBe(true);
    expect(editor.getContent()).toBe('<blockquote><p>alpha</p></blockquote><p><br></p>');
  });
  it('Enter removes an empty quote line while preserving nonempty quote siblings', () => {
    const editor = init('<blockquote><p>alpha</p><p><br></p></blockquote>');
    const range = document.createRange();
    range.setStart(editor.getBody().querySelectorAll('p')[1], 0);
    range.collapse(true);
    editor.selection.setRange(range);
    expect(key(editor, 'Enter').defaultPrevented).toBe(true);
    expect(editor.getContent()).toBe('<blockquote><p>alpha</p></blockquote><p><br></p>');
  });
  it('only appends a paragraph for a click below the trailing quote', () => {
    const editor = init('<blockquote>alpha</blockquote>');
    vi.spyOn(editor.getBody().firstElementChild!, 'getBoundingClientRect').mockReturnValue({
      bottom: 10
    } as DOMRect);
    editor.getBody().dispatchEvent(new MouseEvent('mousedown', { clientY: 5 }));
    expect(editor.getBody().children.length).toBe(1);
    editor.getBody().dispatchEvent(new MouseEvent('mousedown', { clientY: 20 }));
    expect(editor.getBody().children.length).toBe(2);
  });
  it('uses the body as Home/End boundary when there are no blocks', () => {
    const editor = init('plain');
    placeCursor(editor, 'plain', 2);
    expect(key(editor, 'End', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(editor.selection.getRange()?.startContainer).toBe(editor.getBody());
    expect(key(editor, 'Home').defaultPrevented).toBe(true);
    expect(editor.selection.getRange()?.startOffset).toBe(0);
  });
  it('returns false and emits no success event for unknown commands', () => {
    const editor = init();
    const listener = vi.fn();
    editor.on('execcommand', listener);
    expect(editor.execCommand('Unknown')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    editor.off('execcommand', listener);
  });
});
