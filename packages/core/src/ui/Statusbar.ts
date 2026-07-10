import type { Editor, WordCountOptions } from '../editor/Editor';

/** Element path + word count. data-testids: status-elpath, status-wordcount. */
export class Statusbar {
  private elpath: HTMLElement;
  private wordcount: HTMLElement;

  constructor(
    private editor: Editor,
    container: HTMLElement,
    resizable = true,
    wordCount: boolean | WordCountOptions = true
  ) {
    const doc = container.ownerDocument;
    this.elpath = doc.createElement('div');
    this.elpath.className = 'sbe-elpath';
    this.elpath.dataset.testid = 'status-elpath';

    const grow = doc.createElement('div');
    grow.className = 'sbe-grow';

    this.wordcount = doc.createElement('div');
    this.wordcount.dataset.testid = 'status-wordcount';
    const countOptions: WordCountOptions =
      typeof wordCount === 'object' ? wordCount : { words: wordCount !== false };
    this.wordcount.dataset.words = String(countOptions.words !== false);
    this.wordcount.dataset.characters = String(countOptions.characters === true);
    this.wordcount.dataset.selection = String(countOptions.selection === true);

    container.append(this.elpath, grow);
    if (wordCount !== false) container.append(this.wordcount);
    if (resizable) container.append(this.buildResizeGrip(doc));

    editor.events.on('selectionchange', () => this.refresh());
    editor.events.on('change', () => this.refresh());
    editor.events.on('input', () => this.refresh());
    this.refresh();
  }

  /** Vertical drag grip — resizes the editor's content area (view state, no undo). */
  private buildResizeGrip(doc: Document): HTMLElement {
    const grip = doc.createElement('div');
    grip.className = 'sbe-resize-grip';
    grip.dataset.testid = 'status-resize';
    grip.setAttribute('aria-label', 'Resize editor');
    grip.textContent = '⋰';
    grip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const body = this.editor.getBody();
      const startY = e.clientY;
      const startH = body.offsetHeight;
      body.style.flex = '0 0 auto'; // explicit height takes over from flex sizing
      const onMove = (ev: MouseEvent): void => {
        body.style.height = `${Math.max(120, startH + ev.clientY - startY)}px`;
      };
      const onUp = (): void => {
        doc.removeEventListener('mousemove', onMove);
        doc.removeEventListener('mouseup', onUp);
      };
      doc.addEventListener('mousemove', onMove);
      doc.addEventListener('mouseup', onUp);
    });
    return grip;
  }

  refresh(): void {
    const body = this.editor.getBody();
    const range = this.editor.selection.getRange();
    const path: string[] = [];
    let node: Node | null = range ? range.startContainer : null;
    while (node && node !== body) {
      if (node.nodeType === Node.ELEMENT_NODE)
        path.unshift((node as HTMLElement).tagName.toLowerCase());
      node = node.parentNode;
    }
    this.elpath.textContent = path.join(' › ') || 'p';

    if (!this.wordcount.isConnected) return;
    const useSelection =
      this.wordcount.dataset.selection === 'true' && range && !range.collapsed && range.toString();
    const text = String(useSelection || body.textContent || '').replace(/\uFEFF/g, '');
    const parts: string[] = [];
    if (this.wordcount.dataset.words === 'true') {
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      parts.push(`${words} ${words === 1 ? 'word' : 'words'}`);
    }
    if (this.wordcount.dataset.characters === 'true') {
      const characters = text.length;
      parts.push(`${characters} ${characters === 1 ? 'character' : 'characters'}`);
    }
    this.wordcount.textContent = `${useSelection ? 'Selection: ' : ''}${parts.join(' · ')}`;
  }
}
