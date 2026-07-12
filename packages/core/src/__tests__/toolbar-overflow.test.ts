import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '../editor/Editor';
import { createTestEditor, destroyAll } from './test-utils';

let ed: Editor;
afterEach(() => destroyAll(ed));

describe('toolbar mode', () => {
  it('wraps by default without rendering a More button', () => {
    ed = createTestEditor('<p>content</p>');
    const toolbar = ed.getBody().parentElement?.querySelector('.rly-toolbar');

    expect(toolbar?.classList.contains('rly-toolbar-overflow-enabled')).toBe(false);
    expect(toolbar?.querySelector('[data-testid="tb-more"]')).toBeNull();
  });

  it('renders the More control in more mode', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = Editor.init({
      target,
      initialContent: '<p>content</p>',
      toolbarMode: 'more'
    });
    const toolbar = ed.getBody().parentElement?.querySelector('.rly-toolbar');

    expect(toolbar?.classList.contains('rly-toolbar-overflow-enabled')).toBe(true);
    expect(toolbar?.querySelector('[data-testid="tb-more"]')).not.toBeNull();
  });

  it('keeps toolbarOverflow as a backward-compatible alias', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = Editor.init({ target, initialContent: '<p>content</p>', toolbarOverflow: true });

    expect(ed.getRoot().querySelector('[data-testid="tb-more"]')).not.toBeNull();
  });

  it('gives toolbarMode precedence over the deprecated alias', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = Editor.init({
      target,
      initialContent: '<p>content</p>',
      toolbarMode: 'wrap',
      toolbarOverflow: true
    });

    expect(ed.getRoot().querySelector('[data-testid="tb-more"]')).toBeNull();
  });

  it('does not intercept arrow keys from a native select in another document realm', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const frameDocument = iframe.contentDocument!;
    const target = frameDocument.createElement('div');
    frameDocument.body.appendChild(target);
    ed = Editor.init({ target, initialContent: '<p>content</p>' });
    const select = ed
      .getRoot()
      .querySelector<HTMLSelectElement>('[data-testid="tb-select-fontsize"]')!;
    select.focus();

    const frameWindow = iframe.contentWindow as Window & typeof globalThis;
    const event = new frameWindow.KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true
    });
    select.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(frameDocument.activeElement).toBe(select);
  });
});
