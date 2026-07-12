import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '../editor/Editor';
import { Editor as CoreEditor } from '../editor/Editor';
import { destroyAll, placeCursor } from './test-utils';
import { openDialog } from '../ui/Dialog';
import { constrainSize, uploadAndInsert } from '../plugins/image';

let ed: Editor;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  destroyAll(ed);
});

function createEditorWithImages(
  upload?: (file: File) => Promise<{ src: string; alt?: string }>,
  config: { accept?: string; maxBytes?: number } = {},
  initialContent = '<p>x</p>'
): Editor {
  const target = document.createElement('div');
  document.body.appendChild(target);
  return CoreEditor.init({
    target,
    initialContent,
    statusbar: true,
    images: {
      upload,
      accept: config.accept,
      maxBytes: config.maxBytes
    }
  });
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('image upload pipeline', () => {
  it('inserts a placeholder, resolves upload, snapshots once, and supports undo', async () => {
    const createUrl = vi.fn(() => 'blob:one');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: createUrl, revokeObjectURL: revokeUrl });

    ed = createEditorWithImages(async () => ({
      src: 'https://cdn.example/p.png',
      alt: 'Uploaded'
    }));
    placeCursor(ed, 'x', 1);

    const starts: string[] = [];
    const ends: string[] = [];
    ed.on('imageuploadstart', ({ file }) => starts.push(file.name));
    ed.on('imageuploadend', ({ src }) => ends.push(src));

    const before = ed.getContent();
    await uploadAndInsert(ed, new File(['ok'], 'pic.png', { type: 'image/png' }));

    expect(starts).toEqual(['pic.png']);
    expect(ends).toEqual(['https://cdn.example/p.png']);
    expect(revokeUrl).toHaveBeenCalledWith('blob:one');
    expect(ed.getContent()).toContain('<img src="https://cdn.example/p.png" alt="Uploaded"');

    ed.execCommand('Undo');
    expect(ed.getContent()).toBe(before);
  });

  it('removes placeholder and emits error when upload rejects', async () => {
    const createUrl = vi.fn(() => 'blob:two');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: createUrl, revokeObjectURL: revokeUrl });

    ed = createEditorWithImages(async () => {
      throw new Error('fail');
    });

    const errors: unknown[] = [];
    ed.on('imageuploaderror', ({ error }) => errors.push(error));

    await uploadAndInsert(ed, new File(['x'], 'bad.png', { type: 'image/png' }));

    expect(errors).toHaveLength(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:two');
    expect(ed.getBody().querySelector('img[data-rly-uploading]')).toBeNull();
    expect(ed.getContent()).toBe('<p>x</p>');
  });

  it('rejects files by accept/maxBytes before upload', async () => {
    const upload = vi.fn(async () => ({ src: 'https://cdn.example/never.png' }));
    ed = createEditorWithImages(upload, { accept: 'image/png', maxBytes: 2 });

    const errors: unknown[] = [];
    ed.on('imageuploaderror', ({ error }) => errors.push(error));

    await uploadAndInsert(ed, new File(['toolarge'], 'large.jpg', { type: 'image/jpeg' }));

    expect(upload).not.toHaveBeenCalled();
    expect(errors).toHaveLength(1);
    expect(ed.getContent()).toBe('<p>x</p>');
  });

  it('excludes in-flight placeholders from getContent()', async () => {
    const createUrl = vi.fn(() => 'blob:pending');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: createUrl, revokeObjectURL: revokeUrl });

    const pending = deferred<{ src: string; alt?: string }>();
    ed = createEditorWithImages(() => pending.promise);
    placeCursor(ed, 'x', 1);

    const run = uploadAndInsert(ed, new File(['ok'], 'later.png', { type: 'image/png' }));
    await tick();

    expect(ed.getBody().querySelector('img[data-rly-uploading]')).toBeTruthy();
    expect(ed.getContent()).toBe('<p>x</p>');

    pending.resolve({ src: 'https://cdn.example/later.png' });
    await run;
    expect(revokeUrl).toHaveBeenCalledWith('blob:pending');
  });

  it('handles orphaned placeholders safely when upload resolves', async () => {
    const createUrl = vi.fn(() => 'blob:orphan');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: createUrl, revokeObjectURL: revokeUrl });

    const pending = deferred<{ src: string; alt?: string }>();
    ed = createEditorWithImages(() => pending.promise);

    const run = uploadAndInsert(ed, new File(['ok'], 'gone.png', { type: 'image/png' }));
    await tick();

    ed.getBody().querySelector('img[data-rly-uploading]')?.remove();
    pending.resolve({ src: 'https://cdn.example/gone.png' });
    await run;

    expect(revokeUrl).toHaveBeenCalledWith('blob:orphan');
    expect(ed.getContent()).toBe('<p>x</p>');
  });

  it('dialog file field returns files side-channel and warns on reserved files field', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ed = createEditorWithImages(async () => ({ src: 'https://cdn.example/file.png' }));

    const promise = openDialog(ed, {
      name: 'filespec',
      title: 'File dialog',
      fields: [
        { name: 'files', label: 'Forbidden name' },
        { name: 'file', label: 'Upload', type: 'file', accept: 'image/*' }
      ]
    });

    const input = document.querySelector<HTMLInputElement>('[data-testid="dialog-field-file"]')!;
    const file = new File(['x'], 'dialog.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    document.querySelector<HTMLButtonElement>('[data-testid="dialog-submit"]')!.click();

    const result = await promise;
    expect(warn).toHaveBeenCalledWith('[richly] "files" is a reserved dialog field name');
    expect(result?.file).toBe('');
    expect(result?.files?.file).toBe(file);
  });
});

describe('image selection frame resize', () => {
  it('exports predictable constrainSize math', () => {
    expect(constrainSize({ w: 100, h: 50 }, { dx: 20, dy: 0 }, 'x', false, 24)).toEqual({
      w: 120,
      h: 50
    });
    expect(constrainSize({ w: 100, h: 50 }, { dx: -200, dy: 0 }, 'x', false, 24)).toEqual({
      w: 24,
      h: 50
    });
    expect(constrainSize({ w: 120, h: 60 }, { dx: 30, dy: 10 }, 'xy', true, 24)).toEqual({
      w: 150,
      h: 75
    });
  });

  it('resizes selected images with drag and frame keyboard only', () => {
    ed = createEditorWithImages(
      undefined,
      {},
      '<p>aa<img src="https://example.com/x.png" width="100" height="50" alt="x">bb</p>'
    );

    const img = ed.getBody().querySelector('img')!;
    img.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));

    const frame = ed.getRoot().querySelector<HTMLElement>('[data-testid="image-selection"]')!;
    expect(frame.classList.contains('rly-show')).toBe(true);

    const handle = ed.getRoot().querySelector<HTMLElement>('[data-testid="image-resize-xy"]')!;
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 20 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(img.getAttribute('width')).toBe('120');
    expect(img.getAttribute('height')).toBe('60');

    const widthBeforeBodyArrow = img.getAttribute('width');
    ed.getBody().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(img.getAttribute('width')).toBe(widthBeforeBodyArrow);

    frame.focus();
    frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(img.getAttribute('width')).toBe('121');

    frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(frame.classList.contains('rly-show')).toBe(false);
  });

  it('does not show the frame for uploading placeholders', () => {
    ed = createEditorWithImages(undefined, {}, '<p>x</p>');
    ed.getBody().innerHTML = '<p><img src="blob:upload" data-rly-uploading="true" alt=""></p>';

    const img = ed.getBody().querySelector('img')!;
    img.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));

    const frame = ed.getRoot().querySelector<HTMLElement>('[data-testid="image-selection"]')!;
    expect(frame.classList.contains('rly-show')).toBe(false);
  });
});
