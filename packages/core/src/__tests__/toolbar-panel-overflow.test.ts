import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '../editor/Editor';
import { OverflowToolbar } from '../ui/toolbar/OverflowToolbar';
import { renderToolbarPanelControl } from '../ui/toolbar/ToolbarPanelControl';
let frames: Map<number, FrameRequestCallback>, next: number;
const destroys: Array<() => void> = [];
beforeEach(() => {
  frames = new Map();
  next = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.set(++next, cb);
    return next;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  vi.stubGlobal('innerWidth', 500);
  vi.stubGlobal('innerHeight', 400);
});
afterEach(() => {
  destroys.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function tick() {
  const current = [...frames.values()];
  frames.clear();
  current.forEach((cb) => cb(0));
}
function editor() {
  return { events: { on: (_: string, cb: () => void) => destroys.push(cb) } } as unknown as Editor;
}
function rect(el: HTMLElement, x: number, y: number, w: number, h: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    x,
    y,
    left: x,
    top: y,
    right: x + w,
    bottom: y + h,
    width: w,
    height: h,
    toJSON: () => ({})
  });
}
function overflow() {
  const host = document.createElement('div'),
    container = document.createElement('div');
  host.append(container);
  document.body.append(host);
  const sections = ['A', 'B', 'C'].map((text) => {
    const el = document.createElement('button');
    el.textContent = text;
    container.append(el);
    return [el];
  });
  let width = 90;
  const control = new OverflowToolbar(editor(), container, sections, {
    availableWidth: () => width,
    widthBoundaries: () => [container],
    occupiedWidth: (el) =>
      [...el.children].reduce(
        (total, child) =>
          total +
          (child.classList.contains('rly-toolbar-overflow')
            ? (child as HTMLElement).hidden
              ? 0
              : 20
            : 40),
        0
      )
  });
  const wrap = container.querySelector<HTMLElement>('.rly-toolbar-overflow')!;
  const panel = container.querySelector<HTMLElement>('.rly-toolbar-overflow-panel')!;
  return {
    container,
    control,
    wrap,
    panel,
    setWidth: (value: number) => {
      width = value;
      window.dispatchEvent(new Event('resize'));
    }
  };
}
describe('overflow toolbar responsive lifecycle', () => {
  it('moves trailing sections in order and restores them when space returns', () => {
    const { container, wrap, panel, setWidth } = overflow();
    tick();
    expect(panel.textContent).toBe('BC');
    expect(wrap.hidden).toBe(false);
    setWidth(10);
    expect(panel.textContent).toBe('ABC');
    setWidth(200);
    expect(panel.childElementCount).toBe(0);
    expect(wrap.hidden).toBe(true);
    expect([...container.children].slice(0, 3).map((el) => el.textContent)).toEqual([
      'A',
      'B',
      'C'
    ]);
    setWidth(0);
    expect(wrap.hidden).toBe(true);
    container.remove();
    setWidth(10);
    expect(wrap.hidden).toBe(true);
  });
  it('positions above or below and closes nested panels with Escape or outside click', () => {
    const { control, wrap, panel } = overflow();
    tick();
    rect(wrap, 100, 300, 20, 30);
    rect(panel, -20, 334, 200, 150);
    control.toggleButton.click();
    expect(panel.style.left).toBe('-92px');
    expect(panel.style.bottom).toBe('100%');
    expect(panel.style.maxHeight).toBe('288px');
    for (const el of [control.toggleButton, panel]) {
      const event = new MouseEvent('mousedown', { cancelable: true });
      el.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    const nested = document.createElement('div');
    nested.className = 'rly-tb-dd rly-open';
    panel.append(nested);
    const ignored = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    document.dispatchEvent(ignored);
    expect(ignored.defaultPrevented).toBe(false);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    document.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(control.toggleButton);
    expect(nested.classList.contains('rly-open')).toBe(false);
    const closedEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    document.dispatchEvent(closedEscape);
    expect(closedEscape.defaultPrevented).toBe(false);
    rect(wrap, 100, 20, 20, 30);
    rect(panel, 30, 54, 200, 30);
    control.toggleButton.click();
    tick();
    expect(panel.style.top).toBe('100%');
    expect(panel.style.maxHeight).toBe('338px');
    control.toggleButton.click();
    expect(panel.classList.contains('rly-open')).toBe(false);
    control.toggleButton.click();
    document.body.click();
    expect(control.toggleButton.getAttribute('aria-expanded')).toBe('false');
    window.dispatchEvent(new Event('scroll'));
  });
  it('observes containing boundaries and disconnects with a queued refresh', () => {
    let refresh!: () => void;
    const observe = vi.fn(),
      disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          refresh = cb;
        }
        observe = observe;
        disconnect = disconnect;
      }
    );
    const { wrap } = overflow();
    expect(observe).toHaveBeenCalledTimes(3);
    refresh();
    expect(wrap.hidden).toBe(false);
    destroys.splice(0).forEach((fn) => fn());
    expect(disconnect).toHaveBeenCalledOnce();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    wrap.hidden = true;
    refresh();
    expect(wrap.hidden).toBe(true);
  });
});
function panelControl(overflowHost = false, color = false) {
  const container = document.createElement('div');
  if (overflowHost) container.className = 'rly-toolbar-overflow-panel';
  document.body.append(container);
  const button = document.createElement('button'),
    content = document.createElement('div');
  if (color) {
    content.className = 'rly-color-picker';
    content.dataset.view = 'custom';
  }
  let close!: () => void;
  const result = renderToolbarPanelControl(
    editor(),
    container,
    'test',
    {
      type: 'panel',
      icon: 'x',
      tooltip: 'Test',
      valueCommand: color ? 'color' : undefined,
      panel: (_, fn) => {
        close = fn;
        return content;
      }
    },
    button,
    'Test'
  );
  container.append(result.element);
  const dropdown = result.element.querySelector<HTMLElement>('.rly-tb-dd')!;
  rect(result.element, 100, 100, 30, 30);
  rect(dropdown, 100, 134, 100, 50);
  return { button, content, dropdown, wrap: result.element, result, close: () => close() };
}
describe('toolbar panel positioning and lifecycle', () => {
  it.each([
    [false, 100, 50, '', ''],
    [false, 320, 100, 'auto', '100%'],
    [false, 100, 500, '-92px', ''],
    [true, 100, 50, '134px', 'auto'],
    [true, 320, 100, '216px', 'auto'],
    [true, 100, 500, '8px', 'auto']
  ] as const)('positions overflow=%s y=%s height=%s', (inside, y, height, top, bottom) => {
    const { button, dropdown, wrap, close } = panelControl(inside);
    rect(wrap, 100, y, 30, 30);
    rect(dropdown, 100, 0, 100, height);
    button.click();
    expect(dropdown.style.top).toBe(top);
    expect(dropdown.style.bottom).toBe(bottom);
    expect(dropdown.style.position).toBe(inside ? 'fixed' : '');
    dropdown.dispatchEvent(new Event('rly-panel-resize'));
    window.dispatchEvent(new Event('resize'));
    tick();
    close();
    expect(dropdown.classList.contains('rly-open')).toBe(false);
    expect(dropdown.style.left).toBe('');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    tick();
  });
  it('keeps custom color inputs interactive and simple panels selection-safe', () => {
    const color = panelControl(false, true),
      simple = panelControl();
    expect(color.result.valueIndicator).toEqual({ el: color.button, command: 'color' });
    expect(simple.result.valueIndicator).toBeUndefined();
    expect(color.dropdown.classList.contains('rly-tb-dd-color')).toBe(true);
    for (const [content, prevented] of [
      [color.content, false],
      [simple.content, true]
    ] as const) {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      content.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(prevented);
    }
    const opened = vi.fn();
    color.content.addEventListener('rly-panel-open', opened);
    color.button.click();
    expect(opened).toHaveBeenCalledOnce();
    color.content.click();
    expect(color.button.getAttribute('aria-expanded')).toBe('true');
    simple.button.click();
    expect(color.button.getAttribute('aria-expanded')).toBe('false');
    simple.button.click();
    expect(simple.button.getAttribute('aria-expanded')).toBe('false');
    tick();
    color.button.click();
    document.body.click();
    expect(color.dropdown.classList.contains('rly-open')).toBe(false);
  });
  it('corrects painted bounds during animation and cancels monitoring on destroy', () => {
    const { button, dropdown } = panelControl();
    rect(dropdown, -10, 0, 100, 50);
    button.click();
    expect(dropdown.style.left).toBe('-52px');
    dropdown.style.left = '';
    tick();
    expect(Number.parseFloat(dropdown.style.left)).toBeGreaterThan(-70);
    destroys.splice(0).forEach((fn) => fn());
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    document.body.click();
    expect(dropdown.classList.contains('rly-open')).toBe(true);
  });
});
