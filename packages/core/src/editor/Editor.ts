import { Emitter } from '../events/Emitter';
import { CommandRegistry } from '../commands/Registry';
import { SelectionManager } from '../dom/SelectionManager';
import { UndoManager } from '../undo/UndoManager';
import { UiRegistry } from '../ui/UiRegistry';
import { Toolbar } from '../ui/Toolbar';
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
  statusbar?: boolean;
  plugins?: Plugin[];
  /** Prefix for chrome data-testids (default "editor"): editor-root, editor-toolbar, editor-content, editor-statusbar. */
  testIdPrefix?: string;
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
  destroy: void;
}

const DEFAULT_TOOLBAR =
  'undo redo | bold italic underline strikethrough | h1 h2 paragraph blockquote | removeformat';

export class Editor {
  readonly events = new Emitter<EditorEvents>();
  readonly ui = new UiRegistry();
  readonly commands: CommandRegistry;
  readonly selection: SelectionManager;
  readonly undoManager: UndoManager;

  private root!: HTMLElement;
  private body!: HTMLElement;
  private cleanups: (() => void)[] = [];

  static init(config: EditorConfig): Editor {
    return new Editor(config);
  }

  constructor(private config: EditorConfig) {
    const target =
      config.target ??
      (config.selector ? (document.querySelector(config.selector) as HTMLElement | null) : null);
    if (!target) throw new Error('Editor.init: config.target or config.selector is required');

    this.buildChrome(target);
    this.selection = new SelectionManager(this.body);
    this.commands = new CommandRegistry(this);
    this.undoManager = new UndoManager(this);

    for (const plugin of [...corePlugins, ...(config.plugins ?? [])]) plugin.init(this);

    const toolbarEl = this.root.querySelector<HTMLElement>('.sbe-toolbar')!;
    new Toolbar(this, toolbarEl, config.toolbar ?? DEFAULT_TOOLBAR);
    if (config.statusbar !== false) {
      new Statusbar(this, this.root.querySelector<HTMLElement>('.sbe-statusbar')!);
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
    this.root.className = 'sbe';
    this.root.dataset.testid = `${p}-root`;

    const toolbar = doc.createElement('div');
    toolbar.className = 'sbe-toolbar';
    toolbar.dataset.testid = `${p}-toolbar`;

    this.body = doc.createElement('div');
    this.body.className = 'sbe-content';
    this.body.contentEditable = 'true';
    this.body.spellcheck = true;
    this.body.dataset.testid = `${p}-content`;
    this.body.setAttribute('role', 'textbox');
    this.body.setAttribute('aria-multiline', 'true');
    this.body.setAttribute('aria-label', 'Rich text editor');

    const statusbar = doc.createElement('div');
    statusbar.className = 'sbe-statusbar';
    statusbar.dataset.testid = `${p}-statusbar`;

    this.root.append(toolbar, this.body);
    if (this.config.statusbar !== false) this.root.append(statusbar);
    target.appendChild(this.root);
  }

  private bindEvents(): void {
    const doc = this.body.ownerDocument;

    const onInput = (): void => {
      this.undoManager.snapshot(true); // coalesced typing
      this.events.emit('input', undefined);
      this.events.emit('change', this.getContent());
    };
    this.body.addEventListener('input', onInput);
    this.cleanups.push(() => this.body.removeEventListener('input', onInput));

    const onSel = (): void => {
      if (this.selection.getRange()) this.events.emit('selectionchange', undefined);
    };
    doc.addEventListener('selectionchange', onSel);
    this.cleanups.push(() => doc.removeEventListener('selectionchange', onSel));

    const onKeydown = (e: KeyboardEvent): void => {
      this.events.emit('keydown', e);
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
    };
    this.body.addEventListener('keydown', onKeydown);
    this.cleanups.push(() => this.body.removeEventListener('keydown', onKeydown));

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
      template.innerHTML = html ? sanitize(html, doc2) : (text ?? '').replace(/\n/g, '<br>');
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

  // ---- public API ----

  getBody(): HTMLElement {
    return this.body;
  }

  getRoot(): HTMLElement {
    return this.root;
  }

  getContent(): string {
    return this.body.innerHTML;
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
    this.events.removeAll();
  }
}
