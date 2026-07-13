import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '../editor/Editor';
import { Toolbar } from '../ui/Toolbar';
import { createTestEditor, destroyAll } from './test-utils';

let ed: Editor | undefined;
afterEach(() => {
  if (ed) destroyAll(ed);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockToolbarLayout(
  initialWidth: number,
  initialGroupWidth = 70
): { setWidth: (width: number) => void; setGroupWidth: (width: number) => void } {
  let width = initialWidth;
  let groupWidth = initialGroupWidth;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const element = this as HTMLElement;
    const elementWidth = element.classList.contains('rly-tb-group')
      ? groupWidth
      : element.classList.contains('rly-tb-sep')
        ? 10
        : element.classList.contains('rly-toolbar-sliding-toggle')
          ? 32
          : 0;
    return {
      x: 0,
      y: 0,
      top: 0,
      right: elementWidth,
      bottom: 30,
      left: 0,
      width: elementWidth,
      height: 30,
      toJSON: () => ({})
    } as DOMRect;
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  return {
    setWidth(nextWidth: number): void {
      width = nextWidth;
      window.dispatchEvent(new Event('resize'));
    },
    setGroupWidth(nextWidth: number): void {
      groupWidth = nextWidth;
    }
  };
}

function createSlidingEditor(): Editor {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return Editor.init({
    target,
    initialContent: '<p>content</p>',
    toolbar: 'bold italic | underline strikethrough | h1 h2',
    toolbarMode: 'sliding'
  });
}

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

  it('renders sliding mode as an inline disclosure rather than a popup menu', () => {
    mockToolbarLayout(155);
    ed = createSlidingEditor();
    const toolbar = ed.getRoot().querySelector<HTMLElement>('.rly-toolbar')!;
    const button = toolbar.querySelector<HTMLButtonElement>('[data-testid="tb-more"]')!;
    const drawer = toolbar.querySelector<HTMLElement>('[data-testid="toolbar-sliding-drawer"]')!;

    expect(toolbar.classList.contains('rly-toolbar-sliding-enabled')).toBe(true);
    expect(toolbar.querySelector('.rly-toolbar-overflow-panel')).toBeNull();
    expect(button.parentElement?.hidden).toBe(false);
    expect(button.getAttribute('aria-haspopup')).toBeNull();
    expect(button.getAttribute('aria-controls')).toBe(drawer.id);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(drawer.getAttribute('role')).toBe('group');
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    expect(
      Array.from(drawer.querySelectorAll<HTMLElement>('[data-testid^="tb-"]')).map(
        (element) => element.dataset.testid
      )
    ).toEqual(['tb-underline', 'tb-strikethrough', 'tb-h1', 'tb-h2']);
  });

  it('toggles sliding disclosure state and its accessible name', () => {
    mockToolbarLayout(155);
    ed = createSlidingEditor();
    const button = ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="tb-more"]')!;
    const drawer = ed
      .getRoot()
      .querySelector<HTMLElement>('[data-testid="toolbar-sliding-drawer"]')!;

    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Hide more tools');
    expect(drawer.getAttribute('aria-hidden')).toBe('false');
    expect(drawer.classList.contains('rly-open')).toBe(true);

    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Show more tools');
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    expect(drawer.classList.contains('rly-open')).toBe(false);
  });

  it('keeps the leading tool group visible at extremely narrow measured widths', () => {
    mockToolbarLayout(80);
    ed = createSlidingEditor();
    const primary = ed.getRoot().querySelector<HTMLElement>('[data-testid="toolbar-primary"]')!;
    const drawer = ed
      .getRoot()
      .querySelector<HTMLElement>('[data-testid="toolbar-sliding-drawer"]')!;

    expect(primary.querySelector('[data-testid="tb-bold"]')).not.toBeNull();
    expect(primary.querySelector('[data-testid="tb-italic"]')).not.toBeNull();
    expect(drawer.querySelector('[data-testid="tb-bold"]')).toBeNull();
    expect(primary.querySelector('[data-testid="tb-more"]')).not.toBeNull();
  });

  it('prioritizes core formatting ahead of clipboard tools in the default sliding toolbar', () => {
    mockToolbarLayout(190);
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = Editor.init({ target, initialContent: '<p>content</p>', toolbarMode: 'sliding' });
    const primary = ed.getRoot().querySelector<HTMLElement>('[data-testid="toolbar-primary"]')!;
    const drawer = ed
      .getRoot()
      .querySelector<HTMLElement>('[data-testid="toolbar-sliding-drawer"]')!;

    expect(primary.querySelector('[data-testid="tb-undo"]')).not.toBeNull();
    expect(primary.querySelector('[data-testid="tb-bold"]')).not.toBeNull();
    expect(primary.querySelector('[data-testid="tb-italic"]')).not.toBeNull();
    expect(drawer.querySelector('[data-testid="tb-selectall"]')).not.toBeNull();
  });

  it('does not count the sliding toggle auto margin as required content width', () => {
    mockToolbarLayout(190);
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const styles = getComputedStyle(element, pseudoElement);
      if (!(element as HTMLElement).classList.contains('rly-toolbar-sliding-toggle')) {
        return styles;
      }
      return new Proxy(styles, {
        get(target, property, receiver) {
          if (property === 'marginLeft') return '2.281px';
          return Reflect.get(target, property, receiver) as unknown;
        }
      });
    });

    ed = createSlidingEditor();
    const primary = ed.getRoot().querySelector<HTMLElement>('[data-testid="toolbar-primary"]')!;

    expect(primary.querySelector('[data-testid="tb-bold"]')).not.toBeNull();
    expect(primary.querySelector('[data-testid="tb-underline"]')).not.toBeNull();
    expect(primary.querySelector('[data-testid="tb-h1"]')).toBeNull();
  });

  it('coalesces repeated resize observations into the final animation frame', () => {
    let notifyResize = (): void => undefined;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver);
      }
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const layout = mockToolbarLayout(155);
    const frames: FrameRequestCallback[] = [];
    vi.mocked(window.requestAnimationFrame).mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    ed = createSlidingEditor();
    const primary = ed.getRoot().querySelector<HTMLElement>('[data-testid="toolbar-primary"]')!;
    const more = primary.querySelector<HTMLButtonElement>('[data-testid="tb-more"]')!;

    expect(primary.querySelector('[data-testid="tb-underline"]')).toBeNull();
    expect(frames).toHaveLength(1);
    frames.shift()!(0);

    layout.setWidth(300);
    notifyResize();
    notifyResize();
    notifyResize();
    expect(frames).toHaveLength(1);
    frames.shift()!(16);

    expect(primary.querySelector('[data-testid="tb-underline"]')).not.toBeNull();
    expect(primary.querySelector('[data-testid="tb-h2"]')).not.toBeNull();
    expect(more.parentElement?.hidden).toBe(true);
  });

  it('uses the pre-mutation width for the complete redistribution pass', () => {
    mockToolbarLayout(300);
    const frames: FrameRequestCallback[] = [];
    vi.mocked(window.requestAnimationFrame).mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const availableWidth = vi
      .spyOn(
        Toolbar.prototype as unknown as { availableToolbarWidth(): number },
        'availableToolbarWidth'
      )
      .mockReturnValueOnce(300)
      .mockReturnValue(80);

    ed = createSlidingEditor();
    const primary = ed.getRoot().querySelector<HTMLElement>('[data-testid="toolbar-primary"]')!;

    expect(availableWidth).toHaveBeenCalledTimes(1);
    expect(primary.querySelector('[data-testid="tb-h2"]')).not.toBeNull();
    expect(frames).toHaveLength(1);
  });

  it('cancels the queued initial measurement when the editor is destroyed', () => {
    mockToolbarLayout(155);
    const frames: FrameRequestCallback[] = [];
    const cancelledFrames: number[] = [];
    vi.mocked(window.requestAnimationFrame).mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frame) => {
      cancelledFrames.push(frame);
    });
    const availableWidth = vi
      .spyOn(
        Toolbar.prototype as unknown as { availableToolbarWidth(): number },
        'availableToolbarWidth'
      )
      .mockReturnValue(155);

    ed = createSlidingEditor();
    expect(availableWidth).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);

    ed.destroy();
    frames[0]!(16);

    expect(cancelledFrames).toEqual([1]);
    expect(availableWidth).toHaveBeenCalledTimes(1);
    ed = undefined;
  });

  it('waits for a containing grid to resolve through React host wrappers', () => {
    let settled = false;
    let notifyResize = (): void => undefined;
    const observed = new Set<Element>();
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver);
      }
      observe(target: Element): void {
        observed.add(target);
      }
      disconnect(): void {}
      unobserve(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      const element = this as HTMLElement;
      if (!settled && element.dataset.gridBoundary === 'true') return 0;
      return settled ? 300 : 120;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const element = this as HTMLElement;
      const width = element.classList.contains('rly-tb-group')
        ? 70
        : element.classList.contains('rly-tb-sep')
          ? 10
          : element.classList.contains('rly-toolbar-sliding-toggle')
            ? 32
            : 0;
      return {
        x: 0,
        y: 0,
        top: 0,
        right: width,
        bottom: 30,
        left: 0,
        width,
        height: 30,
        toJSON: () => ({})
      } as DOMRect;
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    const grid = document.createElement('div');
    grid.dataset.gridBoundary = 'true';
    const configuredHost = document.createElement('div');
    const reactHost = document.createElement('div');
    configuredHost.appendChild(reactHost);
    grid.appendChild(configuredHost);
    document.body.appendChild(grid);
    ed = Editor.init({
      target: reactHost,
      initialContent: '<p>content</p>',
      toolbar: 'bold italic | underline strikethrough | h1 h2',
      toolbarMode: 'sliding'
    });
    const primary = ed.getRoot().querySelector<HTMLElement>('[data-testid="toolbar-primary"]')!;
    const more = primary.querySelector<HTMLButtonElement>('[data-testid="tb-more"]')!;

    expect(observed.has(grid)).toBe(true);
    expect(primary.querySelector('[data-testid="tb-h2"]')).not.toBeNull();
    expect(more.parentElement?.hidden).toBe(true);

    settled = true;
    notifyResize();

    expect(primary.querySelector('[data-testid="tb-h2"]')).not.toBeNull();
    expect(more.parentElement?.hidden).toBe(true);
  });

  it('collapses sliding mode with Escape and restores focus to its disclosure', () => {
    mockToolbarLayout(155);
    ed = createSlidingEditor();
    const button = ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="tb-more"]')!;
    const overflowButton = ed
      .getRoot()
      .querySelector<HTMLButtonElement>('[data-testid="tb-underline"]')!;

    button.click();
    overflowButton.focus();
    overflowButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('preserves an open drawer while overflow remains and removes it when all groups fit', () => {
    const layout = mockToolbarLayout(155);
    ed = createSlidingEditor();
    const button = ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="tb-more"]')!;
    const drawer = ed
      .getRoot()
      .querySelector<HTMLElement>('[data-testid="toolbar-sliding-drawer"]')!;

    button.click();
    layout.setWidth(190);
    expect(button.parentElement?.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(drawer.querySelector('[data-testid="tb-underline"]')).toBeNull();
    expect(drawer.querySelector('[data-testid="tb-h1"]')).not.toBeNull();

    layout.setWidth(300);
    expect(button.parentElement?.hidden).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    expect(drawer.children[0]?.childElementCount).toBe(0);
    expect(ed.getRoot().querySelector('.rly-toolbar-primary [data-testid="tb-h2"]')).not.toBeNull();
  });

  it('uses DOM order for arrow navigation and excludes a closed drawer', () => {
    mockToolbarLayout(155);
    ed = createSlidingEditor();
    const button = ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="tb-more"]')!;
    const bold = ed.getRoot().querySelector<HTMLButtonElement>('[data-testid="tb-bold"]')!;
    const underline = ed
      .getRoot()
      .querySelector<HTMLButtonElement>('[data-testid="tb-underline"]')!;

    button.focus();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(bold);

    button.click();
    button.focus();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(underline);
    underline.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(button);
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

  it('lets explicit sliding mode take precedence over the deprecated alias', () => {
    mockToolbarLayout(155);
    const target = document.createElement('div');
    document.body.appendChild(target);
    ed = Editor.init({
      target,
      initialContent: '<p>content</p>',
      toolbar: 'bold italic | underline strikethrough | h1 h2',
      toolbarMode: 'sliding',
      toolbarOverflow: false
    });

    expect(ed.getRoot().querySelector('[data-testid="toolbar-sliding-drawer"]')).not.toBeNull();
    expect(ed.getRoot().querySelector('[data-testid="toolbar-more-panel"]')).toBeNull();
  });

  it('does not intercept arrow keys from the font-size input in another document realm', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const frameDocument = iframe.contentDocument!;
    const target = frameDocument.createElement('div');
    frameDocument.body.appendChild(target);
    ed = Editor.init({ target, initialContent: '<p>content</p>' });
    const input = ed.getRoot().querySelector<HTMLInputElement>('[data-testid="font-size-input"]')!;
    input.focus();

    const frameWindow = iframe.contentWindow as Window & typeof globalThis;
    const event = new frameWindow.KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true
    });
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(frameDocument.activeElement).toBe(input);
  });
});
