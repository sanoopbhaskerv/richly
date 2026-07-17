import type { ImageEditorContext } from '../shared';
import { runQuickCrop } from './quickEdit';
import type { QuickCropPreset, QuickEditDeps } from './quickEdit';
import { createCropPopover } from './view';

interface CropPopoverOptions {
  readonly doc: Document;
  readonly anchor: HTMLElement;
  readonly bar: HTMLElement;
  readonly deps: QuickEditDeps;
  readonly signal: AbortSignal;
  readonly isBusy: () => boolean;
  readonly setBusy: (busy: boolean) => void;
  readonly requireContext: () => ImageEditorContext | null;
  readonly openPopover: (element: HTMLElement, anchor: HTMLElement, sheet: boolean) => void;
  readonly closePopover: (returnFocus?: boolean) => void;
  readonly announce: (message: string) => void;
  readonly finishQuickEdit: () => void;
  readonly showError: (message: string, retry: () => void) => void;
  readonly onError?: (error: unknown, context?: ImageEditorContext) => void;
  readonly reposition: () => void;
}

const cropPresets = [
  { id: 'square', label: '1:1' },
  { id: 'portrait', label: '4:5' },
  { id: 'landscape', label: '3:2' },
  { id: 'wide', label: '16:9' }
] as const;

/** Opens the lightweight inline crop popover and commits only from Apply crop. */
export function openInlineCropPopover(options: CropPopoverOptions): void {
  if (options.isBusy()) return;
  const handleRef: { current?: ReturnType<typeof createCropPopover> } = {};
  const handle = createCropPopover(options.doc, {
    presets: cropPresets,
    onCancel: () => options.closePopover(true),
    onApply: (preset) => {
      const current = handleRef.current;
      if (current) applyCropPreset(options, current, preset as QuickCropPreset);
    }
  });
  handleRef.current = handle;
  options.openPopover(handle.element, options.anchor, true);
}

function applyCropPreset(
  options: CropPopoverOptions,
  handle: ReturnType<typeof createCropPopover>,
  preset: QuickCropPreset
): void {
  const context = options.requireContext();
  if (!context || options.isBusy()) return;
  options.setBusy(true);
  options.bar.setAttribute('aria-busy', 'true');
  handle.setBusy(true);
  options.announce('Cropping image');
  void runQuickCrop(context, preset, options.deps)
    .then(() => {
      options.closePopover(true);
      options.announce('Image updated');
      options.reposition();
    })
    .catch((error) => {
      if (options.signal.aborted) return;
      options.onError?.(error, context);
      options.closePopover(true);
      options.showError('The image could not be cropped.', () => openInlineCropPopover(options));
    })
    .finally(options.finishQuickEdit);
}
