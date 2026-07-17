import type { Editor } from '@richly/core';
import type { ImageToolbarRootAction } from './types';
import { createAltPopover, createMenu, type MenuItemSpec } from './view';

interface InlineMenuControllerOptions {
  readonly doc: Document;
  readonly editor: Editor;
  readonly rootActions: readonly ImageToolbarRootAction[];
  readonly target: () => HTMLImageElement | null;
  readonly openPopover: (element: HTMLElement, anchor: HTMLElement, sheet: boolean) => void;
  readonly closePopover: (returnFocus?: boolean) => void;
  readonly announce: (message: string) => void;
  readonly reposition: () => void;
  readonly resetDisplaySize: () => void;
  readonly deleteImage: () => void;
}

/** Opens the inline alignment menu and applies Richly alignment commands. */
export function openInlineAlignMenu(
  options: InlineMenuControllerOptions,
  anchor: HTMLElement
): void {
  const aligns: MenuItemSpec[] = (
    [
      ['left', 'alignLeft', 'Align left', 'JustifyLeft'],
      ['center', 'alignCenter', 'Align center', 'JustifyCenter'],
      ['right', 'alignRight', 'Align right', 'JustifyRight']
    ] as const
  ).map(([id, icon, label, command]) => ({
    id: `align-${id}`,
    icon,
    label,
    active: options.editor.queryCommandState(command),
    onSelect: () => {
      options.editor.execCommand(command);
      options.closePopover(true);
      options.reposition();
    }
  }));
  options.openPopover(createMenu(options.doc, 'image-toolbar-align-menu', aligns), anchor, false);
}

/** Opens the inline alt-text editor and records the edit as one Richly change. */
export function openInlineAltPopover(
  options: InlineMenuControllerOptions,
  anchor: HTMLElement
): void {
  const image = options.target();
  if (!image) return;
  const element = createAltPopover(options.doc, {
    value: image.getAttribute('alt') ?? '',
    onCancel: () => options.closePopover(true),
    onSave: (alt) => {
      if (image.isConnected) {
        options.editor.undoManager.snapshot();
        image.setAttribute('alt', alt);
        options.editor.events.emit('change', options.editor.getContent());
      }
      options.closePopover(true);
      options.announce('Image updated');
    }
  });
  options.openPopover(element, anchor, true);
  element.querySelector('input')?.focus();
}

/** Opens the compact overflow menu for secondary image actions. */
export function openInlineMoreMenu(
  options: InlineMenuControllerOptions,
  anchor: HTMLElement,
  compact: boolean
): void {
  const items: MenuItemSpec[] = [];
  if (compact) {
    items.push(
      {
        id: 'align',
        icon: 'align',
        label: 'Alignment',
        onSelect: () => openInlineAlignMenu(options, anchor)
      },
      {
        id: 'alt',
        icon: 'alt',
        label: 'Alternative text',
        onSelect: () => openInlineAltPopover(options, anchor)
      },
      {
        id: 'replace',
        icon: 'replace',
        label: 'Replace image',
        onSelect: () => {
          options.closePopover();
          options.editor.execCommand('InsertImage');
        }
      }
    );
  }
  items.push({
    id: 'reset-size',
    icon: 'resize',
    label: 'Reset display size',
    onSelect: options.resetDisplaySize
  });
  if (!options.rootActions.includes('delete') || compact) {
    items.push({
      id: 'delete',
      icon: 'delete',
      label: 'Delete image',
      danger: true,
      onSelect: options.deleteImage
    });
  }
  options.openPopover(createMenu(options.doc, 'image-toolbar-more-menu', items), anchor, true);
}
