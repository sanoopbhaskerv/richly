import type { ImageEditorContext, ImageEditorResult } from '../shared';
import { persistEditorResult } from './quickEdit';
import type { QuickEditDeps } from './quickEdit';
import type { ImageInlineToolbarOptions } from './types';

interface StudioLaunchOptions {
  readonly options: ImageInlineToolbarOptions;
  readonly deps: QuickEditDeps;
  readonly signal: AbortSignal;
  readonly isBusy: () => boolean;
  readonly requireContext: () => ImageEditorContext | null;
  readonly announce: (message: string) => void;
  readonly reposition: () => void;
  readonly showError: (message: string, retry: () => void) => void;
}

/** Opens the full Studio and persists only the explicit save/export result. */
export function openToolbarStudio(
  launch: StudioLaunchOptions,
  initialTool: 'crop' | 'transform' | 'adjust',
  initialPanel?: 'resize'
): void {
  const openEditor = launch.options.openEditor;
  if (!openEditor || launch.isBusy()) return;
  const context = launch.requireContext();
  if (!context) return;
  void (async () => {
    try {
      const result: ImageEditorResult | null = await openEditor(
        {
          source: { kind: 'url', url: context.sourceUrl },
          alt: context.alt,
          initialTool,
          initialPanel
        },
        context
      );
      if (!result || !context.image.isConnected) return;
      await persistEditorResult(context, result, launch.deps, 'rendered');
      launch.announce('Image updated');
      launch.reposition();
    } catch (error) {
      if (launch.signal.aborted) return;
      launch.options.onError?.(error, context);
      launch.showError('The image could not be updated.', () =>
        openToolbarStudio(launch, initialTool, initialPanel)
      );
    }
  })();
}
