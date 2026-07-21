import type { Editor } from '@richly/core';
import { createToolbarButton } from './view';
import type { ImageInlineToolbarOptions, ImageToolbarRootAction } from './types';

interface RootActionButtonOptions {
  readonly doc: Document;
  readonly editor: Editor;
  readonly options: ImageInlineToolbarOptions;
  readonly action: ImageToolbarRootAction;
  readonly compact: boolean;
  readonly openAlignMenu: (anchor: HTMLElement) => void;
  readonly openCropPopover: (anchor: HTMLElement) => void;
  readonly openStudio: (
    initialTool: 'crop' | 'transform' | 'adjust',
    initialPanel?: 'resize'
  ) => void;
  readonly setMode: (mode: 'root' | 'transform' | 'adjust') => void;
  readonly openAltPopover: (anchor: HTMLElement) => void;
  readonly openMoreMenu: (anchor: HTMLElement, compact: boolean) => void;
  readonly deleteImage: () => void;
}

/** Creates one root toolbar button when the host has enabled its backing feature. */
export function createRootActionButton(options: RootActionButtonOptions): HTMLButtonElement | null {
  const { action, compact, doc, editor } = options;
  const needsStudio = action === 'studio';
  if (needsStudio && !options.options.openEditor) return null;
  if (needsStudio && options.options.enableStudioAction === false) return null;
  if (action === 'crop' && (options.options.quickCrop === false || !options.options.persist))
    return null;
  if (
    action === 'transform' &&
    (options.options.quickTransform === false || !options.options.persist)
  )
    return null;
  if (action === 'adjust' && (options.options.quickAdjust === false || !options.options.persist))
    return null;

  const specs: Record<
    ImageToolbarRootAction,
    [string, string, (button: HTMLButtonElement) => void]
  > = {
    align: ['align', 'Align image', (button) => options.openAlignMenu(button)],
    crop: ['crop', 'Crop image', (button) => options.openCropPopover(button)],
    transform: ['transform', 'Transform image', () => options.setMode('transform')],
    adjust: ['adjust', 'Adjust image', () => options.setMode('adjust')],
    studio: ['studio', 'Open Image Studio', () => options.openStudio('adjust')],
    alt: ['alt', 'Alternative text', (button) => options.openAltPopover(button)],
    replace: ['replace', 'Replace image', () => editor.execCommand('InsertImage')],
    more: ['more', 'More image options', (button) => options.openMoreMenu(button, compact)],
    delete: ['delete', 'Delete image', () => options.deleteImage()]
  };
  const [icon, label, onClick] = specs[action];
  return createToolbarButton(doc, {
    id: action,
    icon,
    label,
    onClick: (button) => onClick(button)
  });
}
