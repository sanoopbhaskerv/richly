import type { Editor } from '../editor/Editor';

/** Element path + word count. data-testids: status-elpath, status-wordcount. */
export class Statusbar {
  private elpath: HTMLElement;
  private wordcount: HTMLElement;

  constructor(
    private editor: Editor,
    container: HTMLElement
  ) {
    const doc = container.ownerDocument;
    this.elpath = doc.createElement('div');
    this.elpath.className = 'sbe-elpath';
    this.elpath.dataset.testid = 'status-elpath';

    const grow = doc.createElement('div');
    grow.className = 'sbe-grow';

    this.wordcount = doc.createElement('div');
    this.wordcount.dataset.testid = 'status-wordcount';

    container.append(this.elpath, grow, this.wordcount);

    editor.events.on('selectionchange', () => this.refresh());
    editor.events.on('change', () => this.refresh());
    editor.events.on('input', () => this.refresh());
    this.refresh();
  }

  refresh(): void {
    const body = this.editor.getBody();
    const range = this.editor.selection.getRange();
    const path: string[] = [];
    let node: Node | null = range ? range.startContainer : null;
    while (node && node !== body) {
      if (node.nodeType === Node.ELEMENT_NODE) path.unshift((node as HTMLElement).tagName.toLowerCase());
      node = node.parentNode;
    }
    this.elpath.textContent = path.join(' › ') || 'p';

    const words = (body.textContent ?? '').trim().split(/\s+/).filter(Boolean).length;
    this.wordcount.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
  }
}
