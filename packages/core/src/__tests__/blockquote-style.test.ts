import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '../editor/Editor';
import { destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

function initEditor(config: Partial<Parameters<typeof Editor.init>[0]> = {}): Editor {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return Editor.init({ target, initialContent: '<blockquote>quoted</blockquote>', ...config });
}

describe('blockquoteStyle config', () => {
  it('applies the rly-blockquote-styled hook by default', () => {
    ed = initEditor();
    expect(ed.getBody().classList.contains('rly-blockquote-styled')).toBe(true);
  });

  it('applies the hook when blockquoteStyle is explicitly true', () => {
    ed = initEditor({ blockquoteStyle: true });
    expect(ed.getBody().classList.contains('rly-blockquote-styled')).toBe(true);
  });

  it('omits the hook when blockquoteStyle is false, leaving markup untouched', () => {
    ed = initEditor({ blockquoteStyle: false });
    expect(ed.getBody().classList.contains('rly-blockquote-styled')).toBe(false);
    expect(ed.getContent()).toBe('<blockquote>quoted</blockquote>');
  });

  it('never leaks the presentation hook into serialized content either way', () => {
    ed = initEditor({ blockquoteStyle: true });
    expect(ed.getContent()).not.toContain('rly-blockquote-styled');
    expect(ed.getContent()).not.toContain('rly-content');
    expect(ed.getContent()).toBe('<blockquote>quoted</blockquote>');
  });
});
