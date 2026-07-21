import { Editor } from '@richly/core';
import type {
  CommandResult,
  ImageOperation,
  ImageSession,
  ImageSourceInput
} from '@richly/image-core';
import { imageInlineToolbarPlugin, type ImageInlineToolbarOptions } from '../index';

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Deterministic in-memory session so quick-edit tests run without canvas.
 * Only the members the toolbar touches are meaningful; the rest are stubs.
 */
class FakeSession {
  operations: ImageOperation[] = [];
  transient: ImageOperation | null = null;
  destroyed = false;
  exportCalls = 0;
  exportError: Error | null = null;
  private nextId = 0;

  constructor(readonly source: ImageSourceInput) {}

  getState() {
    return {
      status: this.destroyed ? ('destroyed' as const) : ('ready' as const),
      source: { width: 120, height: 80 },
      operations: this.operations,
      transient: this.transient,
      outputWidth: 120,
      outputHeight: 80,
      history: { entries: [], index: 0, canUndo: false, canRedo: false },
      dirty: this.operations.length > 0,
      revision: 0
    };
  }

  execute(command: string, params: unknown): CommandResult {
    this.operations = [
      ...this.operations,
      { id: `op-${this.nextId++}`, type: command, version: 1, params: params as never }
    ];
    return { ok: true };
  }

  preview(command: string, params: unknown) {
    this.transient = { id: 'transient', type: command, version: 1, params: params as never };
    return { ok: true as const };
  }

  cancelPreview(): void {
    this.transient = null;
  }

  commitPreview(): CommandResult {
    if (this.transient) {
      this.operations = [...this.operations, { ...this.transient, id: `op-${this.nextId++}` }];
      this.transient = null;
    }
    return { ok: true };
  }

  removeOperation(id: string): CommandResult {
    this.operations = this.operations.filter((operation) => operation.id !== id);
    return { ok: true };
  }

  async export() {
    this.exportCalls += 1;
    if (this.exportError) throw this.exportError;
    return {
      blob: new Blob(['pixels'], { type: 'image/png' }),
      width: 80,
      height: 120,
      mimeType: 'image/png'
    };
  }

  toDocument() {
    return {
      schemaVersion: 1 as const,
      source: { width: 120, height: 80 },
      operations: this.operations
    };
  }

  destroy(): void {
    this.destroyed = true;
  }
}

interface Harness {
  editor: Editor;
  image: HTMLImageElement;
  sessions: FakeSession[];
  persist: ReturnType<typeof vi.fn>;
  onError: ReturnType<typeof vi.fn>;
  changes: () => number;
  bar: () => HTMLElement;
  button: (id: string) => HTMLButtonElement;
  maybeButton: (id: string) => HTMLButtonElement | null;
}

function createHarness(overrides: Partial<ImageInlineToolbarOptions> = {}): Harness {
  const sessions: FakeSession[] = [];
  const persist = vi.fn(async () => ({ src: 'persisted.png' }));
  const onError = vi.fn();
  const target = document.createElement('div');
  document.body.append(target);
  const editor = Editor.init({
    target,
    initialContent:
      '<p>Hello</p><p><img src="before.png" alt="Before" width="120" height="80"></p>',
    toolbar: 'undo redo',
    plugins: [
      imageInlineToolbarPlugin({
        persist,
        onError,
        openEditor: async () => null,
        createSession: async (source) => {
          const session = new FakeSession(source);
          sessions.push(session);
          return session as unknown as ImageSession;
        },
        // jsdom rects are 0x0; disable the compact breakpoint so tests see
        // the full desktop root toolbar.
        compactBreakpoint: 0,
        ...overrides
      })
    ]
  });
  let changeCount = 0;
  editor.events.on('change', () => {
    changeCount += 1;
  });
  const image = editor.getBody().querySelector('img') as HTMLImageElement;
  const bar = (): HTMLElement =>
    editor.getRoot().querySelector('[data-testid="image-inline-toolbar"]') as HTMLElement;
  const button = (id: string): HTMLButtonElement => {
    const found = bar().querySelector<HTMLButtonElement>(`[data-testid="image-toolbar-${id}"]`);
    if (!found) throw new Error(`Missing toolbar button ${id}`);
    return found;
  };
  return {
    editor,
    image,
    sessions,
    persist,
    onError,
    changes: () => changeCount,
    bar,
    button,
    maybeButton: (id) =>
      bar().querySelector<HTMLButtonElement>(`[data-testid="image-toolbar-${id}"]`)
  };
}

function selectImage(harness: Harness): void {
  const range = document.createRange();
  range.selectNode(harness.image);
  harness.editor.selection.setRange(range);
  harness.editor.events.emit('selectionchange', undefined);
}

function selectText(harness: Harness): void {
  const paragraph = harness.editor.getBody().querySelector('p') as HTMLElement;
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  harness.editor.selection.setRange(range);
  harness.editor.events.emit('selectionchange', undefined);
}

const popover = (): HTMLElement | null =>
  document.querySelector('[data-testid="image-toolbar-adjust-popover"]');
const cropPopover = (): HTMLElement | null =>
  document.querySelector('[data-testid="image-toolbar-crop-popover"]');

describe('imageInlineToolbarPlugin', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('shows the root toolbar for a selected image and hides for text', () => {
    const harness = createHarness();
    selectImage(harness);

    const bar = harness.bar();
    expect(bar.classList.contains('rly-open')).toBe(true);
    expect(bar.getAttribute('role')).toBe('toolbar');
    expect(bar.getAttribute('aria-label')).toBe('Image actions');
    for (const id of ['align', 'crop', 'transform', 'adjust', 'studio', 'alt', 'replace', 'more']) {
      expect(harness.maybeButton(id), id).not.toBeNull();
    }
    expect(harness.button('studio').getAttribute('aria-label')).toBe('Open Image Studio');
    expect(harness.button('crop').dataset.tooltip).toBe('Crop image');
    expect(harness.button('studio').dataset.tooltip).toBe('Open Image Studio');

    selectText(harness);
    expect(bar.classList.contains('rly-open')).toBe(false);
    harness.editor.destroy();
  });

  it('opens crop inline and applies only after Apply crop', async () => {
    const harness = createHarness();
    selectImage(harness);

    harness.button('crop').click();
    expect(cropPopover()).not.toBeNull();
    expect(harness.image.getAttribute('src')).toBe('before.png');
    expect(harness.persist).not.toHaveBeenCalled();
    expect(harness.changes()).toBe(0);

    cropPopover()!
      .querySelector<HTMLButtonElement>('[data-testid="image-toolbar-crop-square"]')!
      .click();
    cropPopover()!
      .querySelector<HTMLButtonElement>('[data-testid="image-toolbar-crop-apply"]')!
      .click();
    await flushAsync();

    expect(harness.sessions[0]!.operations).toEqual([
      expect.objectContaining({
        type: 'crop',
        params: { rect: { x: 20, y: 0, width: 80, height: 80 } }
      })
    ]);
    expect(harness.persist).toHaveBeenCalledTimes(1);
    expect(harness.image.getAttribute('src')).toBe('persisted.png');
    expect(harness.image.getAttribute('width')).toBe('80');
    expect(harness.image.getAttribute('height')).toBe('120');
    expect(harness.changes()).toBe(1);
    harness.editor.destroy();
  });

  it('morphs into the Transform sub-toolbar and back', () => {
    const harness = createHarness();
    selectImage(harness);

    harness.button('transform').click();
    expect(harness.bar().getAttribute('aria-label')).toBe('Transform image');
    expect(harness.bar().textContent).toContain('Transform:');
    for (const id of [
      'back',
      'rotate-left',
      'rotate-right',
      'flip-vertical',
      'flip-horizontal',
      'resize'
    ]) {
      expect(harness.maybeButton(id), id).not.toBeNull();
    }
    expect(harness.button('back').getAttribute('aria-label')).toBe('Back to image actions');

    harness.button('back').click();
    expect(harness.bar().getAttribute('aria-label')).toBe('Image actions');
    harness.editor.destroy();
  });

  it('runs repeatable rotate quick edits: one persist, one undo step, one change each', async () => {
    const harness = createHarness();
    selectImage(harness);
    harness.button('transform').click();

    harness.button('rotate-right').click();
    await flushAsync();

    expect(harness.sessions).toHaveLength(1);
    expect(harness.sessions[0]!.operations).toEqual([
      expect.objectContaining({ type: 'rotate', params: { angle: 90 } })
    ]);
    expect(harness.sessions[0]!.exportCalls).toBe(1);
    expect(harness.sessions[0]!.destroyed).toBe(true);
    expect(harness.persist).toHaveBeenCalledTimes(1);
    expect(harness.image.getAttribute('src')).toBe('persisted.png');
    // Explicit display dimensions swap with the rotated pixels.
    expect(harness.image.getAttribute('width')).toBe('80');
    expect(harness.image.getAttribute('height')).toBe('120');
    expect(harness.changes()).toBe(1);

    // Rotate stays enabled and repeatable after completion.
    harness.persist.mockResolvedValueOnce({ src: 'persisted-2.png' });
    harness.button('rotate-right').click();
    await flushAsync();
    expect(harness.sessions).toHaveLength(2);
    expect(harness.image.getAttribute('src')).toBe('persisted-2.png');
    expect(harness.changes()).toBe(2);

    harness.editor.execCommand('Undo');
    expect(harness.editor.getContent()).toContain('src="persisted.png"');
    harness.editor.execCommand('Undo');
    expect(harness.editor.getContent()).toContain('src="before.png"');
    harness.editor.destroy();
  });

  it('flip failures leave the image, history, and change stream untouched', async () => {
    const harness = createHarness();
    harness.persist.mockRejectedValueOnce(new Error('persist down'));
    selectImage(harness);
    harness.button('transform').click();

    harness.button('flip-horizontal').click();
    await flushAsync();

    expect(harness.image.getAttribute('src')).toBe('before.png');
    expect(harness.changes()).toBe(0);
    expect(harness.onError).toHaveBeenCalledTimes(1);
    expect(harness.bar().querySelector('[data-testid="image-toolbar-error"]')).not.toBeNull();

    // Retry works after the failure.
    harness
      .bar()
      .querySelector<HTMLButtonElement>('[data-testid="image-toolbar-error-retry"]')!
      .click();
    await flushAsync();
    expect(harness.image.getAttribute('src')).toBe('persisted.png');
    expect(harness.changes()).toBe(1);
    harness.editor.destroy();
  });

  it('refuses to mutate a stale target after persistence', async () => {
    const harness = createHarness();
    let releasePersist: (() => void) | null = null;
    harness.persist.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releasePersist = () => resolve({ src: 'late.png' });
        })
    );
    selectImage(harness);
    harness.button('transform').click();
    harness.button('rotate-left').click();
    await flushAsync();

    // The image is replaced while the host persists.
    harness.image.setAttribute('src', 'replaced.png');
    releasePersist!();
    await flushAsync();

    expect(harness.image.getAttribute('src')).toBe('replaced.png');
    expect(harness.changes()).toBe(0);
    expect(harness.onError).toHaveBeenCalledTimes(1);
    harness.editor.destroy();
  });

  it('previews adjustments transiently and applies once', async () => {
    const harness = createHarness();
    selectImage(harness);
    harness.button('adjust').click();
    expect(harness.bar().getAttribute('aria-label')).toBe('Adjust image');

    harness.button('brightness').click();
    await flushAsync();
    expect(popover()).not.toBeNull();
    const session = harness.sessions[0]!;

    const slider = popover()!.querySelector<HTMLInputElement>(
      '[data-testid="image-toolbar-adjust-slider"]'
    )!;
    slider.value = '40';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(session.transient).toEqual(
      expect.objectContaining({ type: 'adjust', params: { channel: 'brightness', value: 0.4 } })
    );
    expect(harness.image.hasAttribute('data-rly-adjust-preview')).toBe(true);
    expect(harness.changes()).toBe(0);
    expect(harness.persist).not.toHaveBeenCalled();

    popover()!
      .querySelector<HTMLButtonElement>('[data-testid="image-toolbar-adjust-apply"]')!
      .click();
    await flushAsync();

    expect(session.exportCalls).toBe(1);
    expect(harness.persist).toHaveBeenCalledTimes(1);
    expect(harness.image.getAttribute('src')).toBe('persisted.png');
    expect(harness.image.hasAttribute('data-rly-adjust-preview')).toBe(false);
    expect(session.destroyed).toBe(true);
    expect(harness.changes()).toBe(1);

    harness.editor.execCommand('Undo');
    expect(harness.editor.getContent()).toContain('src="before.png"');
    harness.editor.destroy();
  });

  it('cancelling an adjustment restores the original with no history or change', async () => {
    const harness = createHarness();
    selectImage(harness);
    harness.button('adjust').click();
    harness.button('saturation').click();
    await flushAsync();

    const slider = popover()!.querySelector<HTMLInputElement>(
      '[data-testid="image-toolbar-adjust-slider"]'
    )!;
    slider.value = '-60';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    popover()!
      .querySelector<HTMLButtonElement>('[data-testid="image-toolbar-adjust-cancel"]')!
      .click();
    expect(harness.sessions[0]!.transient).toBeNull();

    // Leaving Adjust disposes the draft entirely.
    harness.button('back').click();
    expect(harness.sessions[0]!.destroyed).toBe(true);
    expect(harness.image.hasAttribute('data-rly-adjust-preview')).toBe(false);
    expect(harness.image.getAttribute('src')).toBe('before.png');
    expect(harness.changes()).toBe(0);
    expect(harness.persist).not.toHaveBeenCalled();
    harness.editor.destroy();
  });

  it('walks the escape chain: popover, sub-toolbar, then toolbar dismissal', async () => {
    const harness = createHarness();
    selectImage(harness);
    harness.button('adjust').click();
    harness.button('contrast').click();
    await flushAsync();
    expect(popover()).not.toBeNull();

    popover()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(popover()).toBeNull();
    expect(harness.bar().getAttribute('aria-label')).toBe('Adjust image');

    harness.bar().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(harness.bar().getAttribute('aria-label')).toBe('Image actions');

    harness.bar().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(harness.bar().classList.contains('rly-open')).toBe(false);
    harness.editor.destroy();
  });

  it('saves alt text as one undoable change', () => {
    const harness = createHarness();
    selectImage(harness);
    harness.button('alt').click();

    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="image-toolbar-alt-input"]'
    )!;
    expect(input.value).toBe('Before');
    input.value = 'A mountain vista';
    document.querySelector<HTMLButtonElement>('[data-testid="image-toolbar-alt-save"]')!.click();

    expect(harness.image.getAttribute('alt')).toBe('A mountain vista');
    expect(harness.changes()).toBe(1);
    harness.editor.execCommand('Undo');
    expect(harness.editor.getContent()).toContain('alt="Before"');
    harness.editor.destroy();
  });

  it('deletes the image from the More menu with one change', () => {
    const harness = createHarness();
    selectImage(harness);
    harness.button('more').click();

    document.querySelector<HTMLButtonElement>('[data-testid="image-toolbar-menu-delete"]')!.click();

    expect(harness.editor.getBody().querySelector('img')).toBeNull();
    expect(harness.changes()).toBe(1);
    expect(harness.bar().classList.contains('rly-open')).toBe(false);
    harness.editor.execCommand('Undo');
    expect(harness.editor.getBody().querySelector('img')).not.toBeNull();
    harness.editor.destroy();
  });

  it('resets to root mode when a different image is selected', () => {
    const harness = createHarness();
    const second = document.createElement('img');
    second.setAttribute('src', 'second.png');
    harness.image.parentElement!.appendChild(second);
    selectImage(harness);
    harness.button('transform').click();
    expect(harness.bar().getAttribute('aria-label')).toBe('Transform image');

    const range = document.createRange();
    range.selectNode(second);
    harness.editor.selection.setRange(range);
    harness.editor.events.emit('selectionchange', undefined);

    expect(harness.bar().getAttribute('aria-label')).toBe('Image actions');
    harness.editor.destroy();
  });

  it('hides the root studio button when enableStudioAction is false', () => {
    const harness = createHarness({ enableStudioAction: false });
    selectImage(harness);
    // studio action must not appear even though openEditor is provided
    expect(harness.maybeButton('studio')).toBeNull();
    // other root actions are unaffected
    for (const id of ['align', 'crop', 'transform', 'adjust', 'alt', 'replace', 'more']) {
      expect(harness.maybeButton(id), id).not.toBeNull();
    }
    harness.editor.destroy();
  });

  it('shows the root studio button by default when openEditor is provided', () => {
    const harness = createHarness(); // enableStudioAction not set — defaults to showing
    selectImage(harness);
    expect(harness.maybeButton('studio')).not.toBeNull();
    harness.editor.destroy();
  });

  it('hides "More adjustments in Image Studio" button in Adjust mode when enableAdjustStudio is false', () => {
    const harness = createHarness({ enableAdjustStudio: false });
    selectImage(harness);
    harness.button('adjust').click();
    expect(harness.bar().getAttribute('aria-label')).toBe('Adjust image');
    // Inline adjustment sliders must still be present
    for (const id of ['brightness', 'contrast', 'saturation', 'grayscale']) {
      expect(harness.maybeButton(id), id).not.toBeNull();
    }
    // The studio shortcut inside Adjust must be absent
    expect(harness.maybeButton('adjust-studio')).toBeNull();
    harness.editor.destroy();
  });

  it('shows "More adjustments in Image Studio" button in Adjust mode by default', () => {
    const harness = createHarness(); // enableAdjustStudio not set — defaults to showing
    selectImage(harness);
    harness.button('adjust').click();
    expect(harness.maybeButton('adjust-studio')).not.toBeNull();
    harness.editor.destroy();
  });
});
