import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '../editor/Editor';
import type { EditorConfig } from '../editor/Editor';
import { destroyAll, placeCursor } from './test-utils';

let editor: Editor;

function createEditor(initialContent: string, config: Partial<EditorConfig> = {}): Editor {
  const target = document.createElement('div');
  document.body.appendChild(target);
  editor = Editor.init({ target, initialContent, statusbar: false, ...config });
  return editor;
}

function selectAcross(selector: string, first: number, last: number): void {
  const nodes = editor.getBody().querySelectorAll<HTMLElement>(selector);
  const range = document.createRange();
  range.setStart(nodes[first]!.firstChild!, 0);
  range.setEnd(nodes[last]!.firstChild!, nodes[last]!.firstChild!.textContent!.length);
  editor.selection.setRange(range);
}

afterEach(() => destroyAll(editor));

describe('scalable toolbar commands', () => {
  it('applies and removes unitless line height across selected blocks', () => {
    createEditor('<p>alpha</p><p>beta</p>');
    selectAcross('p', 0, 1);
    editor.execCommand('LineHeight', '1.5');

    expect(editor.getContent()).toBe(
      '<p style="line-height: 1.5;">alpha</p><p style="line-height: 1.5;">beta</p>'
    );
    expect(editor.queryCommandValue('LineHeight')).toBe('1.5');

    editor.execCommand('LineHeight', '');
    expect(editor.getContent()).toBe('<p>alpha</p><p>beta</p>');
  });

  it('formats every selected ordinary block without replacing structural list items', () => {
    createEditor('<p>alpha</p><p>beta</p><ul><li>item</li></ul>');
    selectAcross('p', 0, 1);
    editor.execCommand('FormatBlock', 'h6');
    expect(editor.getContent()).toContain('<h6>alpha</h6><h6>beta</h6>');

    placeCursor(editor, 'item', 1);
    editor.execCommand('FormatBlock', 'h2');
    expect(editor.getContent()).toContain('<ul><li>item</li></ul>');
  });

  it('applies a marker to the owning list without wrappers or duplicate items', () => {
    createEditor('<ul><li>one</li><li>two</li><li>three</li></ul>');
    selectAcross('li', 0, 1);
    editor.execCommand('ApplyList', { kind: 'ul', style: 'square' });

    const html = editor.getContent();
    expect(html).toBe(
      '<ul style="list-style-type: square;"><li>one</li><li>two</li><li>three</li></ul>'
    );
    expect(html).not.toContain('<span');
    expect(editor.getBody().querySelectorAll('li')).toHaveLength(3);
    expect(editor.queryCommandValue('BulletListStyle')).toBe('square');
  });

  it('changes kind and numbering style while preserving nested list structure', () => {
    createEditor('<ul><li>parent<ul><li>child</li></ul></li><li>peer</li></ul>');
    placeCursor(editor, 'parent', 1);
    editor.execCommand('ApplyList', { kind: 'ol', style: 'upper-roman' });

    expect(editor.getContent()).toBe(
      '<ol style="list-style-type: upper-roman;"><li>parent<ul><li>child</li></ul></li><li>peer</li></ol>'
    );
  });
});

describe('grouped toolbar UI', () => {
  it('renders the standard preset with complete progressive-disclosure groups', () => {
    createEditor('<p>hello</p>', { toolbarPreset: 'standard' });
    const root = editor.getRoot();

    expect(root.querySelector('[data-testid="tb-blockstyle"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tb-lineheight"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tb-bulliststyles-menu"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tb-numliststyles-menu"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tb-alignment"]')).not.toBeNull();
    expect(
      root.querySelector('[data-testid="menuitem-bulliststyles-disc"]')?.textContent
    ).toContain('●');
    expect(
      root.querySelector('[data-testid="menuitem-bulliststyles-circle"]')?.textContent
    ).toContain('○');
    expect(
      root.querySelector('[data-testid="menuitem-bulliststyles-square"]')?.textContent
    ).toContain('■');
    expect(
      root.querySelector('[data-testid="menuitem-numliststyles-lower-roman"]')?.textContent
    ).toContain('i.');
    for (const command of ['selectall', 'copy', 'cut', 'paste']) {
      expect(root.querySelector(`[data-testid="tb-${command}"]`)).not.toBeNull();
    }
    for (const command of ['findreplace', 'preview', 'visualblocks', 'code', 'fullscreen']) {
      expect(root.querySelector(`[data-testid="tb-${command}"]`)).not.toBeNull();
    }
    expect(root.querySelector('[data-testid="tb-superscript"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tb-subscript"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tb-removeformat"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tb-insertmenu"]')).toBeNull();
    expect(root.querySelector('[data-testid="tb-moretools"]')).toBeNull();
    expect(root.querySelectorAll('.rly-tb-row-break')).toHaveLength(1);
  });

  it('opens menus with the keyboard and restores focus on Escape', () => {
    createEditor('<p>hello</p>', { toolbar: 'blockstyle' });
    const trigger = editor
      .getRoot()
      .querySelector<HTMLButtonElement>('[data-testid="tb-blockstyle"]')!;
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    const menu = editor.getRoot().querySelector<HTMLElement>('[data-testid="dd-blockstyle"]')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(menu.classList.contains('rly-open')).toBe(true);
    expect(document.activeElement?.getAttribute('role')).toBe('menuitemradio');

    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes a pointer-opened choice menu on document Escape', () => {
    createEditor('<p>hello</p>', { toolbar: 'alignment' });
    const trigger = editor
      .getRoot()
      .querySelector<HTMLButtonElement>('[data-testid="tb-alignment"]')!;
    const menu = editor.getRoot().querySelector<HTMLElement>('[data-testid="dd-alignment"]')!;

    trigger.click();
    editor.getBody().focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(menu.classList.contains('rly-open')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps action-menu items distinct from radio-style value choices', () => {
    createEditor('<p>hello</p>', { toolbar: 'moretools blockstyle' });
    const root = editor.getRoot();

    expect(
      root.querySelector('[data-testid="menuitem-moretools-preview"]')?.getAttribute('role')
    ).toBe('menuitem');
    expect(
      root.querySelector('[data-testid="menuitem-moretools-preview"]')?.hasAttribute('aria-checked')
    ).toBe(false);
    expect(root.querySelector('[data-testid="menuitem-blockstyle-p"]')?.getAttribute('role')).toBe(
      'menuitemradio'
    );
  });

  it('filters configured list choices to supported portable values', () => {
    createEditor('<p>hello</p>', {
      toolbar: 'numliststyles',
      listStyles: {
        numbers: [
          { label: 'Letters', value: 'lower-alpha' },
          { label: 'Unsafe custom counter', value: 'symbols("x")' }
        ]
      }
    });
    const root = editor.getRoot();
    expect(root.querySelector('[data-testid="menuitem-numliststyles-lower-alpha"]')).not.toBeNull();
    expect(root.textContent).not.toContain('Unsafe custom counter');
  });
});
