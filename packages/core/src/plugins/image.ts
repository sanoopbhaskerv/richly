import type { Plugin } from './types';
import type { Editor } from '../editor/Editor';
import { openDialog } from '../ui/Dialog';
import { getEditorConfig } from '../editor/Editor';

interface ImageArgs {
  src: string;
  alt?: string;
  width?: string | number;
  height?: string | number;
}

type ResizeAxis = 'x' | 'y' | 'xy';

/** Normalize edited/resized dimensions to portable integer attributes. */
function setImageDimension(
  image: HTMLImageElement,
  dimension: 'width' | 'height',
  value: string | number
): void {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
  // Inline width/height overrides HTML attributes in CSS. Remove it even when
  // clearing a dimension so a stale pasted style cannot defeat future resizes.
  image.style.removeProperty(dimension);
  if (!image.getAttribute('style')) image.removeAttribute('style');
  if (Number.isFinite(numeric) && numeric > 0) {
    image.setAttribute(dimension, String(Math.round(numeric)));
  } else {
    image.removeAttribute(dimension);
  }
}

/** Apply both frame dimensions through one canonical serialization path. */
function setImageSize(image: HTMLImageElement, size: { w: number; h: number }): void {
  setImageDimension(image, 'width', size.w);
  setImageDimension(image, 'height', size.h);
}

function currentImage(editor: Editor): HTMLImageElement | null {
  const range = editor.selection.getRange();
  if (!range) return null;
  const node = range.startContainer;
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = (node as HTMLElement).childNodes[range.startOffset];
    if (el instanceof HTMLImageElement) return el;
  }
  return node.parentElement?.closest('img') as HTMLImageElement | null;
}

function getImageSettings(
  editor: Editor
): NonNullable<ReturnType<typeof getEditorConfig>['images']> {
  return getEditorConfig(editor).images ?? {};
}

function insertImageNode(editor: Editor, args: ImageArgs, at?: Range): HTMLImageElement | null {
  const doc = editor.getBody().ownerDocument;
  const range = at?.cloneRange() ?? editor.selection.getRange();
  if (!range) return null;

  const existing = at ? null : currentImage(editor);
  if (existing) {
    existing.setAttribute('src', args.src);
    if (args.alt !== undefined) existing.setAttribute('alt', args.alt);
    if (args.width !== undefined) setImageDimension(existing, 'width', args.width);
    if (args.height !== undefined) setImageDimension(existing, 'height', args.height);
    return existing;
  }

  range.deleteContents();
  const img = doc.createElement('img');
  img.setAttribute('src', args.src);
  img.setAttribute('alt', args.alt ?? '');
  if (args.width !== undefined) setImageDimension(img, 'width', args.width);
  if (args.height !== undefined) setImageDimension(img, 'height', args.height);
  range.insertNode(img);
  const after = doc.createRange();
  after.setStartAfter(img);
  after.collapse(true);
  editor.selection.setRange(after);
  return img;
}

function insertPlaceholder(editor: Editor, objectUrl: string, at?: Range): HTMLImageElement {
  const img = insertImageNode(editor, { src: objectUrl, alt: '' }, at);
  if (!img) throw new Error('Cannot insert upload placeholder without a valid range');
  img.setAttribute('data-rly-uploading', 'true');
  img.setAttribute('draggable', 'false');
  return img;
}

export function matchesAccept(file: File, accept: string): boolean {
  const normalized = accept.trim();
  if (!normalized) return true;

  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const tokens = normalized
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (!tokens.length) return true;
  return tokens.some((token) => {
    if (token === '*/*') return true;
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) {
      const family = token.slice(0, token.indexOf('/'));
      return type.startsWith(`${family}/`);
    }
    return type === token;
  });
}

function rangeFromPoint(doc: Document, x: number, y: number): Range | null {
  const withCaretRange = doc as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const withCaretPosition = doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };

  const byRange = withCaretRange.caretRangeFromPoint?.(x, y);
  if (byRange) return byRange;

  const byPosition = withCaretPosition.caretPositionFromPoint?.(x, y);
  if (byPosition?.offsetNode) {
    const range = doc.createRange();
    range.setStart(byPosition.offsetNode, byPosition.offset);
    range.collapse(true);
    return range;
  }
  return null;
}

/** Shared by dialog picker, paste, and drop. Exported for unit tests. */
export async function uploadAndInsert(editor: Editor, file: File, at?: Range): Promise<void> {
  const { upload, accept = 'image/*', maxBytes } = getImageSettings(editor);
  if (!upload) return;
  if (!matchesAccept(file, accept) || (maxBytes && file.size > maxBytes)) {
    editor.events.emit('imageuploaderror', {
      file,
      error: new RangeError('rejected by accept/maxBytes')
    });
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = insertPlaceholder(editor, objectUrl, at);
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    editor.events.emit('imageuploaderror', { file, error });
    return;
  }

  editor.events.emit('imageuploadstart', { file });
  try {
    const { src, alt } = await upload(file);
    URL.revokeObjectURL(objectUrl);
    if (!img.isConnected) {
      editor.events.emit('imageuploadend', { file, src });
      return;
    }
    img.setAttribute('src', src);
    if (alt !== undefined) img.setAttribute('alt', alt);
    img.removeAttribute('data-rly-uploading');
    editor.undoManager.snapshot();
    editor.events.emit('imageuploadend', { file, src });
    editor.events.emit('change', editor.getContent());
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    if (img.isConnected) img.remove();
    editor.events.emit('imageuploaderror', { file, error });
    editor.events.emit('change', editor.getContent());
  }
}

async function openImageDialog(editor: Editor): Promise<void> {
  const existing = currentImage(editor);
  const { upload, accept = 'image/*' } = getImageSettings(editor);
  const result = await openDialog(editor, {
    name: 'image',
    title: existing ? 'Edit image' : 'Insert image',
    fields: [
      ...(upload
        ? [
            {
              name: 'file',
              label: 'Upload from device',
              type: 'file' as const,
              accept
            }
          ]
        : []),
      {
        name: 'src',
        label: 'Image URL',
        type: 'url',
        placeholder: 'https://…',
        value: existing?.getAttribute('src') ?? ''
      },
      { name: 'alt', label: 'Alternative description', value: existing?.getAttribute('alt') ?? '' },
      {
        name: 'width',
        label: 'Width (px)',
        type: 'number',
        placeholder: 'Automatic',
        value: existing?.getAttribute('width') ?? ''
      },
      {
        name: 'height',
        label: 'Height (px)',
        type: 'number',
        placeholder: 'Automatic',
        value: existing?.getAttribute('height') ?? ''
      }
    ],
    layout: 'grid',
    submitText: existing ? 'Update' : 'Insert'
  });

  const file = result?.files?.file;
  if (file instanceof File) {
    await uploadAndInsert(editor, file);
    return;
  }

  const src = typeof result?.src === 'string' ? result.src.trim() : '';
  const alt = typeof result?.alt === 'string' ? result.alt : undefined;
  if (src) {
    editor.execCommand('InsertImage', {
      src,
      alt,
      width: result?.width ?? '',
      height: result?.height ?? ''
    });
  }
}

export function constrainSize(
  start: { w: number; h: number },
  delta: { dx: number; dy: number },
  axis: ResizeAxis,
  lockRatio: boolean,
  min = 24
): { w: number; h: number } {
  const startW = Math.max(1, start.w);
  const startH = Math.max(1, start.h);
  const ratio = Math.max(0.01, startW / startH);

  let w = startW;
  let h = startH;
  if (axis !== 'y') w = startW + delta.dx;
  if (axis !== 'x') h = startH + delta.dy;

  if (axis === 'xy' && lockRatio) {
    if (Math.abs(delta.dx) >= Math.abs(delta.dy)) h = w / ratio;
    else w = h * ratio;
  }

  // Clamp only dimensions controlled by this handle. A width-only drag must
  // not silently change a short image's height (and vice versa).
  if (axis !== 'y') w = Math.max(min, w);
  if (axis !== 'x') h = Math.max(min, h);

  if (axis === 'xy' && lockRatio) {
    if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
  }

  return { w: Math.round(w), h: Math.round(h) };
}

function installImageDrop(editor: Editor): void {
  const body = editor.getBody();
  const doc = body.ownerDocument;

  const acceptedFiles = (list: FileList | null): File[] => {
    const { upload, accept = 'image/*' } = getImageSettings(editor);
    if (!upload || !list?.length) return [];
    return Array.from(list).filter((file) => matchesAccept(file, accept));
  };

  const onDragOver = (event: DragEvent): void => {
    if (acceptedFiles(event.dataTransfer?.files ?? null).length > 0) {
      event.preventDefault();
    }
  };

  const onDrop = (event: DragEvent): void => {
    const files = acceptedFiles(event.dataTransfer?.files ?? null);
    if (!files.length) return;

    event.preventDefault();
    event.stopPropagation();

    const at =
      rangeFromPoint(doc, event.clientX, event.clientY) ??
      editor.selection.getRange()?.cloneRange();
    void (async () => {
      let first = true;
      for (const file of files) {
        await uploadAndInsert(editor, file, first ? at : undefined);
        first = false;
      }
    })();
  };

  body.addEventListener('dragover', onDragOver);
  body.addEventListener('drop', onDrop);
  editor.events.on('destroy', () => {
    body.removeEventListener('dragover', onDragOver);
    body.removeEventListener('drop', onDrop);
  });
}

function installImageSelection(editor: Editor): void {
  const root = editor.getRoot();
  const body = editor.getBody();
  const doc = body.ownerDocument;
  const frame = doc.createElement('div');
  frame.className = 'rly-table-selection rly-image-selection';
  frame.dataset.testid = 'image-selection';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = 0;
  frame.setAttribute('aria-label', 'Resize image');

  let selected: HTMLImageElement | null = null;
  let restoreBookmark = editor.selection.getBookmark();

  const hide = (restoreSelection = false): void => {
    frame.classList.remove('rly-show');
    if (restoreSelection) {
      editor.selection.moveToBookmark(restoreBookmark);
      editor.focus();
    }
    selected = null;
  };

  const position = (): void => {
    if (
      !selected?.isConnected ||
      !body.contains(selected) ||
      selected.hasAttribute('data-rly-uploading')
    ) {
      hide(false);
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const rect = selected.getBoundingClientRect();
    frame.style.left = `${rect.left - rootRect.left}px`;
    frame.style.top = `${rect.top - rootRect.top}px`;
    frame.style.width = `${rect.width}px`;
    frame.style.height = `${rect.height}px`;
    frame.classList.add('rly-show');
  };

  const currentSize = (img: HTMLImageElement): { w: number; h: number } => {
    const rect = img.getBoundingClientRect();
    const computed = doc.defaultView?.getComputedStyle(img);
    const attributeWidth = parseFloat(img.getAttribute('width') ?? '');
    const attributeHeight = parseFloat(img.getAttribute('height') ?? '');
    const inlinePixels = (value: string, computedValue: string | undefined, rendered: number) =>
      value.trim().endsWith('px') ? parseFloat(value) : parseFloat(computedValue ?? '') || rendered;
    // Inline CSS wins over attributes, so only that case must start from the
    // rendered box. Attribute-only images retain their explicit dimensions;
    // this also avoids intrinsic 1×1 placeholders collapsing a configured size.
    const width = img.style.width
      ? inlinePixels(img.style.width, computed?.width, rect.width)
      : attributeWidth || rect.width || img.naturalWidth || 1;
    const height = img.style.height
      ? inlinePixels(img.style.height, computed?.height, rect.height)
      : attributeHeight || rect.height || img.naturalHeight || 1;
    return { w: Math.max(1, width), h: Math.max(1, height) };
  };

  const select = (img: HTMLImageElement | null): void => {
    if (!img || img.hasAttribute('data-rly-uploading')) {
      hide(false);
      return;
    }
    restoreBookmark = editor.selection.getBookmark();
    const range = doc.createRange();
    range.selectNode(img);
    editor.selection.setRange(range);
    selected = img;
    position();
    frame.focus();
  };

  const addHandle = (axis: ResizeAxis): void => {
    const handle = doc.createElement('button');
    handle.type = 'button';
    handle.tabIndex = -1;
    handle.className = `rly-table-handle rly-image-handle rly-table-handle-${axis}`;
    handle.dataset.testid = `image-resize-${axis}`;
    handle.setAttribute(
      'aria-label',
      axis === 'x' ? 'Resize image width' : axis === 'y' ? 'Resize image height' : 'Resize image'
    );
    handle.addEventListener('mousedown', (event) => {
      if (!selected) return;
      event.preventDefault();
      event.stopPropagation();
      editor.undoManager.snapshot();

      const img = selected;
      const start = currentSize(img);
      const startX = event.clientX;
      const startY = event.clientY;

      const onMove = (move: MouseEvent): void => {
        const next = constrainSize(
          start,
          { dx: move.clientX - startX, dy: move.clientY - startY },
          axis,
          axis === 'xy' && !move.shiftKey,
          24
        );
        setImageSize(img, next);
        position();
      };

      const onUp = (): void => {
        doc.removeEventListener('mousemove', onMove);
        doc.removeEventListener('mouseup', onUp);
        editor.events.emit('change', editor.getContent());
        position();
      };

      doc.addEventListener('mousemove', onMove);
      doc.addEventListener('mouseup', onUp);
    });
    frame.appendChild(handle);
  };

  addHandle('x');
  addHandle('y');
  addHandle('xy');

  frame.addEventListener('keydown', (event) => {
    if (!selected) return;
    const step = event.shiftKey ? 10 : 1;

    if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      hide(true);
      return;
    }

    let axis: ResizeAxis | null = null;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowRight') {
      axis = 'x';
      dx = step;
    } else if (event.key === 'ArrowLeft') {
      axis = 'x';
      dx = -step;
    } else if (event.key === 'ArrowDown') {
      axis = 'y';
      dy = step;
    } else if (event.key === 'ArrowUp') {
      axis = 'y';
      dy = -step;
    }
    if (!axis) return;

    event.preventDefault();
    event.stopPropagation();
    editor.undoManager.snapshot(true);
    const next = constrainSize(currentSize(selected), { dx, dy }, axis, false, 24);
    setImageSize(selected, next);
    editor.events.emit('change', editor.getContent());
    position();
  });

  root.appendChild(frame);

  const onBodyMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const img = (event.target as HTMLElement).closest?.('img') as HTMLImageElement | null;
    if (img && body.contains(img)) {
      select(img);
      return;
    }
    if (frame.contains(event.target as Node)) return;
    hide(false);
  };
  const onDocMouseDown = (event: MouseEvent): void => {
    const target = event.target as Node;
    if (!root.contains(target)) hide(false);
  };
  const onScroll = (): void => hide(false);

  body.addEventListener('mousedown', onBodyMouseDown);
  doc.addEventListener('mousedown', onDocMouseDown);
  body.addEventListener('scroll', onScroll);
  editor.events.on('change', position);
  editor.events.on('selectionchange', () => {
    const img = currentImage(editor);
    if (img && body.contains(img) && !img.hasAttribute('data-rly-uploading')) {
      selected = img;
      position();
    }
  });
  editor.events.on('destroy', () => {
    body.removeEventListener('mousedown', onBodyMouseDown);
    doc.removeEventListener('mousedown', onDocMouseDown);
    body.removeEventListener('scroll', onScroll);
    frame.remove();
  });
}

export const imagePlugin: Plugin = {
  name: 'image',
  init(editor) {
    editor.commands.register('InsertImage', {
      execute: (ed, args) => {
        const opts = args as ImageArgs | undefined;
        if (!opts?.src) {
          void openImageDialog(ed);
          return;
        }
        if (!insertImageNode(ed, opts)) return;
        ed.events.emit('change', ed.getContent());
      }
    });

    editor.ui.addButton('image', {
      icon: 'image',
      tooltip: 'Insert image',
      command: 'InsertImage'
    });
    editor.ui.addMenuItem('image', { menu: 'insert', text: 'Image…', command: 'InsertImage' });

    installImageDrop(editor);
    installImageSelection(editor);
  }
};
