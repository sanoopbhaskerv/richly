import { Emitter } from '../events/Emitter';
import { CommandRegistry } from '../commands/Registry';
import { SelectionManager } from '../dom/SelectionManager';
import { UndoManager } from '../undo/UndoManager';
import { UiRegistry } from '../ui/UiRegistry';
import { Toolbar } from '../ui/Toolbar';
import { Menubar } from '../ui/Menubar';
import { Statusbar } from '../ui/Statusbar';
import { sanitize } from '../model/Sanitizer';
import { corePlugins, type Plugin } from '../plugins';

export interface EditorConfig {
  /** Element to mount into (or use selector). */
  target?: HTMLElement;
  selector?: string;
  initialContent?: string;
  /** Toolbar spec, e.g. "undo redo | bold italic underline strikethrough | h1 h2 paragraph blockquote | removeformat" */
  toolbar?: string;
  /** Named progressive-disclosure toolbar. An explicit `toolbar` string takes precedence. */
  toolbarPreset?: ToolbarPreset;
  /** Toolbar layout. `wrap` is the default; `more` floats overflow; `sliding` expands inline. */
  toolbarMode?: ToolbarMode;
  /** @deprecated Use `toolbarMode: 'more'` instead. */
  toolbarOverflow?: boolean;
  /** Set false to hide the menubar. */
  menubar?: boolean;
  statusbar?: boolean;
  /** Word-count display. True/default shows words; false hides it. */
  wordCount?: boolean | WordCountOptions;
  /** Set false to remove the statusbar resize grip. */
  resize?: boolean;
  plugins?: Plugin[];
  /** Prefix for chrome data-testids (default "editor"): editor-root, editor-toolbar, editor-content, editor-statusbar. */
  testIdPrefix?: string;
  /** Configure color swatches and Format-menu font size presets. */
  textStyles?: {
    /** Replace Richly's built-in palette for both text and highlight colors. */
    colors?: string[];
    /** Brand/theme colors placed before the configured or built-in palette. */
    themeColors?: string[];
    fontSizes?: string[];
    /** Replace the unitless line-height choices shown by the line-height menu. */
    lineHeights?: LineHeightOption[];
  };
  /** Image upload settings used by the image plugin and clipboard/drop routing. */
  images?: ImagesConfig;
  /** Restrict or relabel the standards-based list variants shown by split buttons. */
  listStyles?: {
    bullets?: ListStyleOption[];
    numbers?: ListStyleOption[];
  };
  /**
   * Set false to omit Richly's default blockquote styling (accent border,
   * tinted background, rounded corner). The `blockquote` element itself is
   * unaffected — only the `.rly-blockquote-styled` presentation hook is
   * withheld, so you can style `.rly-content blockquote` yourself without
   * fighting Richly's rule. Default true.
   */
  blockquoteStyle?: boolean;
}

/** A sanitized, unitless line-height choice exposed by the toolbar. */
export interface LineHeightOption {
  /** Localizable text shown in the menu, for example `Comfortable`. */
  label: string;
  /** Unitless CSS value. An empty value removes the declaration and restores normal spacing. */
  value: string;
}

/** A supported CSS list marker exposed by the bullet or numbered-list menu. */
export interface ListStyleOption {
  /** Localizable text shown in the variant menu. */
  label: string;
  /** Standards-based `list-style-type` value accepted by Richly. */
  value: string;
}

export interface ImagesConfig {
  /** Enables file upload in the image dialog and on paste/drop. */
  upload?: (file: File) => Promise<{ src: string; alt?: string }>;
  /** Accept filter for pickers and paste/drop validation. Default: image\/* */
  accept?: string;
  /** Files larger than this are rejected before upload is called. */
  maxBytes?: number;
}

const editorConfigs = new WeakMap<Editor, EditorConfig>();

/** Package-internal configuration access for bundled plugins. */
export function getEditorConfig(editor: Editor): Readonly<EditorConfig> {
  const config = editorConfigs.get(editor);
  if (!config) throw new Error('Editor configuration is unavailable');
  return config;
}

export type ToolbarMode = 'wrap' | 'more' | 'sliding';

/** Built-in toolbar compositions, from compact inline editing to full authoring. */
export type ToolbarPreset = 'essential' | 'standard' | 'complete';

export interface WordCountOptions {
  words?: boolean;
  characters?: boolean;
  /** Show counts for a non-collapsed selection instead of the whole document. */
  selection?: boolean;
}

export interface EditorEvents extends Record<string, unknown> {
  init: void;
  change: string;
  input: void;
  selectionchange: void;
  focus: void;
  blur: void;
  keydown: KeyboardEvent;
  execcommand: { name: string; args?: unknown };
  imageuploadstart: { file: File };
  imageuploadend: { file: File; src: string };
  imageuploaderror: { file: File; error: unknown };
  destroy: void;
}

/**
 * Stable, command-token compositions used by core and the demo. Applications
 * can still supply an arbitrary toolbar string for complete control.
 */
export const TOOLBAR_PRESETS: Readonly<Record<ToolbarPreset, string>> = {
  essential:
    'undo redo | selectall copy cut paste | bold italic underline | forecolor backcolor | link | removeformat',
  standard:
    'undo redo | selectall copy cut paste | blockstyle | bold italic underline strikethrough superscript subscript removeformat | findreplace preview visualblocks code fullscreen || forecolor backcolor fontsize lineheight | bulliststyles numliststyles | alignment outdent indent | link unlink image table',
  complete:
    'undo redo | selectall copy cut paste | blockstyle | bold italic underline strikethrough superscript subscript removeformat | findreplace preview visualblocks code fullscreen || forecolor backcolor fontsize lineheight | bulliststyles numliststyles | alignment outdent indent | link unlink image table hr'
};

// Preserve the pre-preset default for applications that omit both toolbar
// options. The redesigned demo opts into `standard`; existing integrations do
// not receive a surprise toolbar reordering during the release-candidate line.
const LEGACY_DEFAULT_TOOLBAR =
  'undo redo | bold italic | selectall copy cut paste | underline strikethrough superscript subscript | forecolor backcolor fontsize | h1 h2 paragraph blockquote | alignleft aligncenter alignright | bullist numlist outdent indent | link unlink table image | findreplace preview visualblocks | code fullscreen removeformat';

export class Editor {
  readonly events = new Emitter<EditorEvents>();
  readonly ui = new UiRegistry();
  readonly commands: CommandRegistry;
  readonly selection: SelectionManager;
  readonly undoManager: UndoManager;

  private root!: HTMLElement;
  private body!: HTMLElement;
  private cleanups: (() => void)[] = [];
  private composing = false;

  static init(config: EditorConfig): Editor {
    return new Editor(config);
  }

  constructor(private config: EditorConfig) {
    const target =
      config.target ??
      (config.selector ? (document.querySelector(config.selector) as HTMLElement | null) : null);
    if (!target) throw new Error('Editor.init: config.target or config.selector is required');

    editorConfigs.set(this, config);

    this.buildChrome(target);
    this.selection = new SelectionManager(this.body);
    this.commands = new CommandRegistry(this);
    this.undoManager = new UndoManager(this);

    for (const plugin of [...corePlugins, ...(config.plugins ?? [])]) plugin.init(this);

    if (config.menubar !== false) {
      new Menubar(this, this.root.querySelector<HTMLElement>('.rly-menubar')!);
    }
    const toolbarEl = this.root.querySelector<HTMLElement>('.rly-toolbar')!;
    const toolbarMode: ToolbarMode =
      config.toolbarMode ?? (config.toolbarOverflow ? 'more' : 'wrap');
    const toolbar =
      config.toolbar ??
      (config.toolbarPreset ? TOOLBAR_PRESETS[config.toolbarPreset] : LEGACY_DEFAULT_TOOLBAR);
    new Toolbar(this, toolbarEl, toolbar, toolbarMode);
    if (config.statusbar !== false) {
      new Statusbar(
        this,
        this.root.querySelector<HTMLElement>('.rly-statusbar')!,
        config.resize !== false,
        config.wordCount
      );
    }

    this.setContent(config.initialContent ?? '<p><br></p>', { addUndoLevel: false });
    this.bindEvents();
    this.undoManager.reset();
    this.events.emit('init', undefined);
  }

  private buildChrome(target: HTMLElement): void {
    const doc = target.ownerDocument;
    const p = this.config.testIdPrefix ?? 'editor';

    this.root = doc.createElement('div');
    this.root.className = 'rly';
    this.root.dataset.testid = `${p}-root`;

    const menubar = doc.createElement('div');
    menubar.className = 'rly-menubar';
    menubar.dataset.testid = `${p}-menubar`;

    const toolbar = doc.createElement('div');
    toolbar.className = 'rly-toolbar';
    toolbar.dataset.testid = `${p}-toolbar`;

    this.body = doc.createElement('div');
    this.body.className = 'rly-content';
    if (this.config.blockquoteStyle !== false) this.body.classList.add('rly-blockquote-styled');
    this.body.contentEditable = 'true';
    this.body.spellcheck = true;
    this.body.dataset.testid = `${p}-content`;
    this.body.setAttribute('role', 'textbox');
    this.body.setAttribute('aria-multiline', 'true');
    this.body.setAttribute('aria-label', 'Rich text editor');

    const statusbar = doc.createElement('div');
    statusbar.className = 'rly-statusbar';
    statusbar.dataset.testid = `${p}-statusbar`;

    if (this.config.menubar !== false) this.root.append(menubar);
    this.root.append(toolbar, this.body);
    if (this.config.statusbar !== false) this.root.append(statusbar);
    target.appendChild(this.root);
  }

  private bindEvents(): void {
    const doc = this.body.ownerDocument;

    const commitInput = (coalesce = true): void => {
      this.cleanCaretFiller();
      this.undoManager.snapshot(coalesce);
      this.events.emit('input', undefined);
      this.events.emit('change', this.getContent());
    };
    const onInput = (event: Event): void => {
      if (this.composing || (event as InputEvent).isComposing) {
        this.events.emit('input', undefined);
        return;
      }
      commitInput();
    };
    const onCompositionStart = (): void => {
      this.composing = true;
      this.undoManager.snapshot();
    };
    const onCompositionEnd = (): void => {
      this.composing = false;
      // A completed composition is one distinct undo step, even when it starts
      // immediately after a coalesced typing burst.
      commitInput(false);
    };
    this.body.addEventListener('input', onInput);
    this.body.addEventListener('compositionstart', onCompositionStart);
    this.body.addEventListener('compositionend', onCompositionEnd);
    this.cleanups.push(() => {
      this.body.removeEventListener('input', onInput);
      this.body.removeEventListener('compositionstart', onCompositionStart);
      this.body.removeEventListener('compositionend', onCompositionEnd);
    });

    const onSel = (): void => {
      if (!this.composing && this.selection.getRange())
        this.events.emit('selectionchange', undefined);
    };
    doc.addEventListener('selectionchange', onSel);
    this.cleanups.push(() => doc.removeEventListener('selectionchange', onSel));

    const onKeydown = (e: KeyboardEvent): void => {
      this.events.emit('keydown', e);
      if (this.composing || e.isComposing || e.keyCode === 229) return;

      // --- Blockquote escape behaviours ---
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (this._handleEnterInBlockquote(e)) return;
      }
      if (e.key === 'ArrowDown') {
        if (this._handleArrowDownInBlockquote(e)) return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const run = (cmd: string): void => {
        e.preventDefault();
        this.execCommand(cmd);
      };
      if (key === 'b') run('Bold');
      else if (key === 'i') run('Italic');
      else if (key === 'u') run('Underline');
      else if (key === 'z' && e.shiftKey) run('Redo');
      else if (key === 'z') run('Undo');
      else if (key === 'y') run('Redo');
      else if (key === 'f') run('FindReplace');
    };
    this.body.addEventListener('keydown', onKeydown);
    this.cleanups.push(() => this.body.removeEventListener('keydown', onKeydown));

    // --- Click below trailing blockquote ---
    // On mousedown, if the last child is a blockquote and the click is below it,
    // we append a <p> so the browser can place the caret there naturally.
    const onMousedown = (e: MouseEvent): void => {
      const last = this.body.lastElementChild;
      if (!last || last.tagName.toLowerCase() !== 'blockquote') return;
      const bqRect = last.getBoundingClientRect();
      if (e.clientY > bqRect.bottom) {
        // Click is in the empty space below the blockquote.
        e.preventDefault();
        const doc = this.body.ownerDocument;
        const p = doc.createElement('p');
        p.appendChild(doc.createElement('br'));
        this.body.appendChild(p);
        const range = doc.createRange();
        range.setStart(p, 0);
        range.collapse(true);
        this.selection.setRange(range);
        this.body.focus();
      }
    };
    this.body.addEventListener('mousedown', onMousedown);
    this.cleanups.push(() => this.body.removeEventListener('mousedown', onMousedown));

    const onPaste = (e: ClipboardEvent): void => {
      const html = e.clipboardData?.getData('text/html');
      const text = e.clipboardData?.getData('text/plain');
      if (!html && !text) return;
      e.preventDefault();
      const range = this.selection.getRange();
      if (!range) return;
      this.undoManager.snapshot();
      range.deleteContents();
      const doc2 = this.body.ownerDocument;
      const template = doc2.createElement('template');
      if (html) {
        template.innerHTML = sanitize(html, doc2);
      } else {
        const lines = (text ?? '').replace(/\r\n?/g, '\n').split('\n');
        lines.forEach((line, index) => {
          if (index) template.content.appendChild(doc2.createElement('br'));
          template.content.appendChild(doc2.createTextNode(line));
        });
      }
      const frag = template.content;
      const last = frag.lastChild;
      range.insertNode(frag);
      if (last) {
        const r = doc2.createRange();
        r.setStartAfter(last);
        r.collapse(true);
        this.selection.setRange(r);
      }
      this.events.emit('change', this.getContent());
    };
    this.body.addEventListener('paste', onPaste);
    this.cleanups.push(() => this.body.removeEventListener('paste', onPaste));

    const onFocus = (): void => this.events.emit('focus', undefined);
    const onBlur = (): void => this.events.emit('blur', undefined);
    this.body.addEventListener('focus', onFocus);
    this.body.addEventListener('blur', onBlur);
    this.cleanups.push(() => {
      this.body.removeEventListener('focus', onFocus);
      this.body.removeEventListener('blur', onBlur);
    });
  }

  /**
   * Handle Enter inside a <blockquote>.
   * - If the current line is empty → remove the empty line and insert a <p> after the blockquote.
   * - If the caret is at the very end of the blockquote's last block → insert a <p> after the blockquote.
   * Returns true if the event was handled (caller should return early).
   */
  private _handleEnterInBlockquote(e: KeyboardEvent): boolean {
    const range = this.selection.getRange();
    if (!range || !range.collapsed) return false;

    // Walk up to find a blockquote ancestor inside the body.
    let node: Node | null = range.startContainer;
    let bq: HTMLElement | null = null;
    while (node && node !== this.body) {
      if ((node as HTMLElement).tagName?.toLowerCase() === 'blockquote') {
        bq = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }
    if (!bq) return false;

    // Find the innermost block element the caret sits in.
    const doc = this.body.ownerDocument;
    let block: HTMLElement | null = range.startContainer as HTMLElement;
    while (block && block !== bq) {
      const tag = (block as HTMLElement).tagName?.toLowerCase();
      if (tag && ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre'].includes(tag)) break;
      block = block.parentNode as HTMLElement;
    }
    if (!block || block === bq) block = bq;

    const blockText = block.textContent ?? '';
    const isEmptyLine = blockText.replace(/\u200B|\uFEFF/g, '').trim() === '';

    // Check if the caret is at the absolute end of the blockquote.
    const testRange = doc.createRange();
    testRange.selectNodeContents(bq);
    const atEnd = range.compareBoundaryPoints(Range.END_TO_END, testRange) >= 0;

    if (!isEmptyLine && !atEnd) return false;

    e.preventDefault();
    this.undoManager.snapshot();

    if (isEmptyLine && block !== bq) {
      // Remove the empty block from the blockquote.
      block.remove();
      // If blockquote is now empty, remove it too.
      if ((bq.textContent ?? '').trim() === '') bq.remove();
    }

    // Insert a <p> after the blockquote.
    const p = doc.createElement('p');
    p.appendChild(doc.createElement('br'));
    bq.after(p);

    const newRange = doc.createRange();
    newRange.setStart(p, 0);
    newRange.collapse(true);
    this.selection.setRange(newRange);
    this.events.emit('change', this.getContent());
    return true;
  }

  /**
   * Handle ArrowDown when the caret is on the last line of a <blockquote>.
   * Moves the caret to just after the blockquote (or into the next sibling).
   * Returns true if the event was handled.
   */
  private _handleArrowDownInBlockquote(e: KeyboardEvent): boolean {
    const range = this.selection.getRange();
    if (!range || !range.collapsed) return false;

    let node: Node | null = range.startContainer;
    let bq: HTMLElement | null = null;
    while (node && node !== this.body) {
      if ((node as HTMLElement).tagName?.toLowerCase() === 'blockquote') {
        bq = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }
    if (!bq) return false;

    // Only intercept if we are on the last visual line (caret at or near the end).
    const doc = this.body.ownerDocument;
    const testRange = doc.createRange();
    testRange.selectNodeContents(bq);
    const atEnd = range.compareBoundaryPoints(Range.END_TO_END, testRange) >= 0;
    if (!atEnd) return false;

    e.preventDefault();

    const nextSibling = bq.nextElementSibling as HTMLElement | null;
    const newRange = doc.createRange();
    if (nextSibling) {
      // Move into the start of the next block.
      newRange.setStart(nextSibling, 0);
    } else {
      // No next sibling — create a trailing <p> and move there.
      this.undoManager.snapshot();
      const p = doc.createElement('p');
      p.appendChild(doc.createElement('br'));
      bq.after(p);
      newRange.setStart(p, 0);
    }
    newRange.collapse(true);
    this.selection.setRange(newRange);
    return true;
  }

  /** Remove caret fillers and unwrap formatting containers emptied by editing. */
  private cleanCaretFiller(): void {
    const range = this.selection.getRange();
    const node = range?.startContainer;
    if (!range || !node) return;

    let text = node.nodeType === Node.TEXT_NODE ? (node as Text) : null;
    if (text) {
      const idx = text.data.indexOf('﻿');
      if (idx !== -1 && text.data.length > 1) {
        const offset = range.startOffset;
        text.deleteData(idx, 1);
        if (offset > idx) range.setStart(text, Math.min(offset - 1, text.data.length));
        range.collapse(true);
      }
    }

    const inlineSelector = 'span,strong,b,em,i,u,s,strike,del,code,sub,sup';
    let wrapper = text?.parentElement ?? (node as Element).closest?.(inlineSelector) ?? null;
    let fallbackParent: Node | null = null;
    let fallbackOffset = 0;

    while (
      wrapper &&
      wrapper !== this.body &&
      wrapper.matches(inlineSelector) &&
      (wrapper.textContent ?? '').replace(/\uFEFF/g, '') === '' &&
      !wrapper.querySelector('img,hr,table')
    ) {
      const parent = wrapper.parentNode;
      if (!parent) break;
      fallbackParent = parent;
      fallbackOffset = Array.prototype.indexOf.call(parent.childNodes, wrapper);
      const nextWrapper = wrapper.parentElement;
      while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
      wrapper.remove();
      wrapper = nextWrapper;
    }

    text = text?.isConnected ? text : null;
    if (text) {
      range.setStart(text, Math.min(range.startOffset, text.data.length));
    } else if (fallbackParent?.isConnected) {
      range.setStart(fallbackParent, Math.min(fallbackOffset, fallbackParent.childNodes.length));
    }
    range.collapse(true);
    this.selection.setRange(range);
  }

  // ---- public API ----

  getBody(): HTMLElement {
    return this.body;
  }

  getRoot(): HTMLElement {
    return this.root;
  }

  getContent(): string {
    // Serialize without caret-container artifacts (U+FEFF fillers, empty format wrappers).
    const clone = this.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.rly-cell-selected').forEach((cell) => {
      cell.classList.remove('rly-cell-selected');
      if (!cell.classList.length) cell.removeAttribute('class');
    });
    clone.querySelectorAll('strong,b,em,i,u,s,code,sub,sup,span').forEach((el) => {
      if ((el.textContent ?? '').replace(/﻿/g, '') === '' && !el.querySelector('img,br'))
        el.remove();
    });
    clone.querySelectorAll('img[data-rly-uploading]').forEach((img) => img.remove());
    // Transient find/replace highlights (documenttools.ts) never serialize.
    clone.querySelectorAll('mark[data-rly-find-match]').forEach((mark) => {
      mark.replaceWith(...Array.from(mark.childNodes));
    });
    return clone.innerHTML.replace(/﻿/g, '');
  }

  setContent(html: string, opts: { addUndoLevel?: boolean } = {}): void {
    if (opts.addUndoLevel !== false) this.undoManager.snapshot();
    this.body.innerHTML = sanitize(html, this.body.ownerDocument) || '<p><br></p>';
    this.events.emit('change', this.getContent());
  }

  execCommand(name: string, args?: unknown): boolean {
    const ok = this.commands.execute(name, args);
    if (ok) this.events.emit('execcommand', { name, args });
    return ok;
  }

  queryCommandState(name: string): boolean {
    return this.commands.queryState(name);
  }

  queryCommandValue(name: string): string {
    return this.commands.queryValue(name);
  }

  on: Emitter<EditorEvents>['on'] = (event, fn) => this.events.on(event, fn);
  off: Emitter<EditorEvents>['off'] = (event, fn) => this.events.off(event, fn);

  focus(): void {
    this.body.focus();
  }

  destroy(): void {
    this.events.emit('destroy', undefined);
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.root.remove();
    editorConfigs.delete(this);
    this.events.removeAll();
  }
}
