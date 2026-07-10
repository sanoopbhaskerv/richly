import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '../editor/Editor';
import { createTestEditor, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

describe('toolbar overflow option', () => {
  it('wraps by default without rendering a More button', () => {
    ed = createTestEditor('<p>content</p>');
    const toolbar = ed.getBody().parentElement?.querySelector('.rly-toolbar');

    expect(toolbar?.classList.contains('rly-toolbar-overflow-enabled')).toBe(false);
    expect(toolbar?.querySelector('[data-testid="tb-more"]')).toBeNull();
  });

  it('renders the More control when toolbarOverflow is enabled', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = Editor.init({
      target,
      initialContent: '<p>content</p>',
      toolbarOverflow: true
    });
    const toolbar = ed.getBody().parentElement?.querySelector('.rly-toolbar');

    expect(toolbar?.classList.contains('rly-toolbar-overflow-enabled')).toBe(true);
    expect(toolbar?.querySelector('[data-testid="tb-more"]')).not.toBeNull();
  });
});
