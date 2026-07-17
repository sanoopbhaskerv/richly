import type { Editor } from '@richly/core';

/** Deletes the selected image as one Richly undoable mutation. */
export function deleteInlineImage(
  editor: Editor,
  image: HTMLImageElement | null,
  afterDelete: () => void
): void {
  if (!image?.isConnected) return;
  editor.undoManager.snapshot();
  image.remove();
  afterDelete();
  editor.events.emit('change', editor.getContent());
  editor.focus();
}

/** Clears explicit display sizing from the selected image. */
export function resetInlineImageDisplaySize(editor: Editor, image: HTMLImageElement | null): void {
  if (!image?.isConnected) return;
  editor.undoManager.snapshot();
  image.removeAttribute('width');
  image.removeAttribute('height');
  image.style.removeProperty('width');
  image.style.removeProperty('height');
  if (!image.getAttribute('style')) image.removeAttribute('style');
  editor.events.emit('change', editor.getContent());
}
