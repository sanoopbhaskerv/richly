import type { Bookmark } from '../dom/SelectionManager';
import type { Editor } from '../editor/Editor';

export interface FontSizeCommandArgs {
  value: string | null;
}

export interface FontSizeControlOptions {
  editor: Editor;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  fallbackSize?: number;
  onApply?: (value: string | null) => void;
}

export interface FontSizeControl {
  element: HTMLElement;
  refresh(): void;
  focus(): void;
  destroy(): void;
}

const DEFAULT_MIN = 1;
const DEFAULT_MAX = 512;
const DEFAULT_STEP = 1;
const DEFAULT_LARGE_STEP = 5;
const DEFAULT_FALLBACK_SIZE = 16;
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
let errorId = 0;

export function parseFontSizeInput(
  input: string,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX
): number | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, '').replace(/px$/, '');
  if (!normalized || !/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export function formatFontSizeValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function isTextNode(node: Node | null): node is Text {
  return node?.nodeType === TEXT_NODE;
}

function isElement(node: Node | null): node is HTMLElement {
  return node?.nodeType === ELEMENT_NODE;
}

function isUsableText(node: Node): node is Text {
  if (!isTextNode(node) || !node.textContent?.trim()) return false;
  const parent = node.parentElement;
  return Boolean(
    parent &&
    !parent.closest(
      'script,style,noscript,template,[contenteditable="false"],[hidden],[aria-hidden="true"]'
    )
  );
}

function firstTextDescendant(root: Node): Text | null {
  if (isUsableText(root)) return root;
  const doc = root.ownerDocument;
  if (!doc) return null;
  const showText = doc.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
  const walker = doc.createTreeWalker(root, showText);
  let node = walker.nextNode();
  while (node) {
    if (isUsableText(node)) return node;
    node = walker.nextNode();
  }
  return null;
}

function firstTextNodeInRange(range: Range, body: HTMLElement): Text | null {
  if (range.collapsed) {
    if (isUsableText(range.startContainer)) return range.startContainer;
    const start = range.startContainer;
    const child =
      start.childNodes[range.startOffset] ??
      start.childNodes[Math.max(range.startOffset - 1, 0)] ??
      null;
    return (child && firstTextDescendant(child)) || firstTextDescendant(start);
  }

  const doc = body.ownerDocument;
  const showText = doc.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
  const rangeType = doc.defaultView?.Range ?? Range;
  const walker = doc.createTreeWalker(body, showText);
  let node = walker.nextNode();
  while (node) {
    if (isUsableText(node)) {
      const nodeRange = doc.createRange();
      nodeRange.selectNodeContents(node);
      const overlaps =
        range.compareBoundaryPoints(rangeType.START_TO_END, nodeRange) > 0 &&
        range.compareBoundaryPoints(rangeType.END_TO_START, nodeRange) < 0;
      if (overlaps) return node;
    }
    node = walker.nextNode();
  }
  return null;
}

function getComputedFontSize(node: Text | HTMLElement, fallback: number): number {
  const element = isElement(node) ? node : node.parentElement;
  if (!element) return fallback;
  const size = element.ownerDocument.defaultView?.getComputedStyle(element).fontSize;
  const value = Number.parseFloat(size ?? '');
  return Number.isFinite(value) ? value : fallback;
}

/** Returns the computed size at the normalized start of the current selection. */
export function getReferenceFontSize(editor: Editor, fallback = DEFAULT_FALLBACK_SIZE): number {
  const range = editor.selection.getRange();
  if (!range) {
    const firstText = firstTextDescendant(editor.getBody());
    return firstText
      ? getComputedFontSize(firstText, fallback)
      : getComputedFontSize(editor.getBody(), fallback);
  }

  const firstText = firstTextNodeInRange(range, editor.getBody());
  if (firstText) return getComputedFontSize(firstText, fallback);

  const startElement = isElement(range.startContainer)
    ? range.startContainer
    : range.startContainer.parentElement;
  return startElement
    ? getComputedFontSize(startElement, fallback)
    : getComputedFontSize(editor.getBody(), fallback);
}

export function createFontSizeControl(options: FontSizeControlOptions): FontSizeControl {
  const {
    editor,
    min = DEFAULT_MIN,
    max = DEFAULT_MAX,
    step = DEFAULT_STEP,
    largeStep = DEFAULT_LARGE_STEP,
    fallbackSize = DEFAULT_FALLBACK_SIZE
  } = options;
  if (!(min > 0 && max >= min && step > 0 && largeStep > 0)) {
    throw new Error('Invalid font-size control bounds');
  }

  const doc = editor.getBody().ownerDocument;
  const element = doc.createElement('div');
  element.className = 'rly-font-size-stepper';
  element.dataset.testid = 'font-size-control';
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'Font size');

  const decrease = doc.createElement('button');
  decrease.type = 'button';
  decrease.className = 'rly-font-size-button rly-font-size-decrease';
  decrease.dataset.testid = 'font-size-decrease';
  decrease.setAttribute('aria-label', 'Decrease font size');
  decrease.textContent = '−';

  const inputWrap = doc.createElement('div');
  inputWrap.className = 'rly-font-size-input-wrap';
  const input = doc.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.className = 'rly-font-size-input';
  input.dataset.testid = 'font-size-input';
  input.setAttribute('aria-label', 'Font size in pixels');
  input.setAttribute('aria-invalid', 'false');
  const unit = doc.createElement('span');
  unit.className = 'rly-font-size-unit';
  unit.setAttribute('aria-hidden', 'true');
  unit.textContent = 'px';
  inputWrap.append(input, unit);

  const increase = doc.createElement('button');
  increase.type = 'button';
  increase.className = 'rly-font-size-button rly-font-size-increase';
  increase.dataset.testid = 'font-size-increase';
  increase.setAttribute('aria-label', 'Increase font size');
  increase.textContent = '+';

  const error = doc.createElement('span');
  error.id = `rly-font-size-error-${++errorId}`;
  error.className = 'rly-font-size-error';
  error.setAttribute('role', 'alert');
  error.hidden = true;
  element.append(decrease, inputWrap, increase, error);

  const state: {
    committedValue: number;
    editing: boolean;
    applying: boolean;
    bookmark: Bookmark | null;
    destroyed: boolean;
  } = {
    committedValue: fallbackSize,
    editing: false,
    applying: false,
    bookmark: editor.selection.getBookmark(),
    destroyed: false
  };

  const clamp = (value: number): number => Math.min(max, Math.max(min, value));
  const updateButtons = (value: number): void => {
    decrease.disabled = value <= min;
    increase.disabled = value >= max;
  };
  const clearError = (): void => {
    delete element.dataset.error;
    input.setAttribute('aria-invalid', 'false');
    input.removeAttribute('aria-describedby');
    error.hidden = true;
    error.textContent = '';
  };
  const showError = (): void => {
    element.dataset.error = 'true';
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', error.id);
    error.textContent = `Enter a size from ${formatFontSizeValue(min)} to ${formatFontSizeValue(max)} px`;
    error.hidden = false;
  };
  const captureSelection = (): void => {
    const bookmark = editor.selection.getBookmark();
    if (bookmark) state.bookmark = bookmark;
  };
  const restoreSelection = (): void => {
    editor.selection.moveToBookmark(state.bookmark);
    if (editor.selection.getRange()) return;

    // The editor has not been focused yet. Match the displayed reference size
    // by applying at the first editable position rather than allowing focus()
    // to choose a browser-dependent caret after the command has already run.
    const body = editor.getBody();
    const firstText = firstTextDescendant(body);
    const target = firstText ?? body.firstElementChild ?? body;
    const range = doc.createRange();
    range.setStart(target, 0);
    range.collapse(true);
    editor.selection.setRange(range);
    state.bookmark = editor.selection.getBookmark();
  };

  const refresh = (): void => {
    if (state.destroyed || state.editing || state.applying) return;
    captureSelection();
    const value = getReferenceFontSize(editor, fallbackSize);
    state.committedValue = value;
    input.value = formatFontSizeValue(value);
    updateButtons(value);
    clearError();
  };

  const commitValue = (value: number | null): void => {
    state.applying = true;
    state.editing = false;
    try {
      restoreSelection();
      const formatted = value === null ? null : `${formatFontSizeValue(value)}px`;
      editor.execCommand('FontSize', { value: formatted } satisfies FontSizeCommandArgs);
      options.onApply?.(formatted);
      const resolved = value ?? getReferenceFontSize(editor, fallbackSize);
      state.committedValue = resolved;
      input.value = formatFontSizeValue(resolved);
      updateButtons(resolved);
      clearError();
      editor.focus();
      captureSelection();
    } finally {
      state.applying = false;
    }
  };

  const applyDraft = (): void => {
    const draft = input.value.trim();
    if (!draft) {
      commitValue(null);
      return;
    }
    const value = parseFontSizeInput(draft, min, max);
    if (value === null) {
      showError();
      return;
    }
    commitValue(value);
  };

  const changeBy = (delta: number): void => {
    const current = parseFontSizeInput(input.value, min, max) ?? state.committedValue;
    commitValue(clamp(current + delta));
  };

  element.addEventListener('pointerdown', captureSelection, true);
  input.addEventListener('focus', () => {
    captureSelection();
    state.editing = true;
  });
  input.addEventListener('input', () => {
    state.editing = true;
    clearError();
  });
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      applyDraft();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      state.editing = false;
      input.value = formatFontSizeValue(state.committedValue);
      clearError();
      editor.focus();
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? 1 : -1;
      changeBy(direction * (event.shiftKey ? largeStep : step));
    }
  });
  input.addEventListener('blur', (event) => {
    if (!state.editing || (event.relatedTarget && element.contains(event.relatedTarget as Node)))
      return;
    const draft = input.value.trim();
    if (!draft) {
      commitValue(null);
      return;
    }
    const value = parseFontSizeInput(draft, min, max);
    if (value === null) {
      state.editing = false;
      input.value = formatFontSizeValue(state.committedValue);
      updateButtons(state.committedValue);
      showError();
      return;
    }
    commitValue(value);
  });
  decrease.addEventListener('click', (event) => changeBy(event.shiftKey ? -largeStep : -step));
  increase.addEventListener('click', (event) => changeBy(event.shiftKey ? largeStep : step));

  const offSelection = editor.events.on('selectionchange', refresh);
  const offChange = editor.events.on('change', refresh);
  const offCommand = editor.events.on('execcommand', refresh);
  let offDestroy = (): void => {};
  const destroy = (): void => {
    if (state.destroyed) return;
    state.destroyed = true;
    offSelection();
    offChange();
    offCommand();
    offDestroy();
    element.remove();
  };
  offDestroy = editor.events.on('destroy', destroy);

  refresh();
  return {
    element,
    refresh,
    focus: () => input.focus(),
    destroy
  };
}
