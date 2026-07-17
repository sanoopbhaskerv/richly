/**
 * Controller for the nested inline image toolbar.
 *
 * Owns the mode state machine (root → transform/adjust), selection tracking,
 * popover lifecycle, busy/error states, and the escape chain. All pixel work
 * happens in ./quickEdit; all element construction lives in ./view.
 */

import type { Editor, Plugin } from '@richly/core';
import { captureImageContext, currentImage } from '../shared';
import type { ImageEditorContext } from '../shared';
import { syncGrayscalePressed } from './adjustPopover';
import { openInlineCropPopover } from './cropController';
import { deleteInlineImage, resetInlineImageDisplaySize } from './imageActions';
import { installRovingNavigation } from './keyboard';
import { openInlineAlignMenu, openInlineAltPopover, openInlineMoreMenu } from './menuControllers';
import { createToolbarPositioner, positionPopover } from './positioner';
import {
  AdjustQuickDraft,
  runQuickTransform,
  type AdjustDraftChannel,
  type QuickEditDeps,
  type QuickTransformKind
} from './quickEdit';
import { createRootActionButton } from './rootActions';
import { ensureInlineToolbarStyles } from './styles';
import { openToolbarStudio } from './studioLauncher';
import {
  COMPACT_ROOT_ACTIONS,
  INLINE_ADJUSTMENTS,
  MODE_LABELS,
  TRANSFORM_ACTIONS
} from './toolbarConfig';
import {
  createErrorView,
  createModeLabel,
  createSeparator,
  createSliderPopover,
  createToolbarButton,
  setButtonBusy
} from './view';
import {
  DEFAULT_COMPACT_BREAKPOINT,
  DEFAULT_ROOT_ACTIONS,
  type ImageInlineToolbarOptions,
  type ImageToolbarMode,
  type ImageToolbarRootAction
} from './types';

/** Stable plugin name for the inline image toolbar. */
export const IMAGE_INLINE_TOOLBAR_PLUGIN_NAME = 'imageinlinetoolbar';

function installInlineImageToolbar(editor: Editor, options: ImageInlineToolbarOptions): void {
  const root = editor.getRoot();
  const body = editor.getBody();
  const doc = body.ownerDocument;
  ensureInlineToolbarStyles(doc);

  const abort = new AbortController();
  const deps: QuickEditDeps = { options, signal: abort.signal };
  const rootActions = options.rootActions ?? DEFAULT_ROOT_ACTIONS;
  const breakpoint = options.compactBreakpoint ?? DEFAULT_COMPACT_BREAKPOINT;

  const bar = doc.createElement('div');
  bar.className = 'rly-image-inline-toolbar';
  bar.dataset.testid = 'image-inline-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', MODE_LABELS.root);
  // Keep the editor selection while clicking toolbar buttons (same trick as
  // the core text inline toolbar).
  bar.addEventListener('mousedown', (event) => event.preventDefault());
  root.appendChild(bar);

  const live = doc.createElement('div');
  live.className = 'rly-image-inline-live';
  live.dataset.testid = 'image-toolbar-live';
  live.setAttribute('aria-live', 'polite');
  root.appendChild(live);

  let target: HTMLImageElement | null = null;
  let mode: ImageToolbarMode = 'root';
  let busy = false;
  let wasCompact: boolean | null = null;
  let draft: AdjustQuickDraft | null = null;
  let errorState: { message: string; retry: () => void } | null = null;
  let popover: { element: HTMLElement; anchor: HTMLElement } | null = null;

  const positioner = createToolbarPositioner(editor, bar, () => target, breakpoint);
  const nav = installRovingNavigation(bar, () => escape());

  const announce = (message: string): void => {
    live.textContent = '';
    live.textContent = message;
  };

  const disposeDraft = (): void => {
    draft?.dispose();
    draft = null;
  };

  const closePopover = (returnFocus = false): void => {
    if (!popover) return;
    const { element, anchor } = popover;
    popover = null;
    element.remove();
    if (returnFocus) anchor.focus();
    positioner.reposition();
  };

  const openPopover = (element: HTMLElement, anchor: HTMLElement, sheet: boolean): void => {
    closePopover();
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePopover(true);
      }
    });
    root.appendChild(element);
    element.classList.add('rly-open');
    positionPopover(root, element, anchor, sheet && positioner.isCompact());
    popover = { element, anchor };
  };

  const hide = (): void => {
    if (!bar.classList.contains('rly-open')) return;
    bar.classList.remove('rly-open');
    closePopover();
    disposeDraft();
    errorState = null;
    nav.reset();
    target = null;
    positioner.observe(null);
  };

  const escape = (): void => {
    if (busy) return;
    if (popover) {
      closePopover(true);
    } else if (mode !== 'root') {
      setMode('root', true);
    } else {
      hide();
      editor.focus();
    }
  };

  const setMode = (next: ImageToolbarMode, moveFocus = false): void => {
    if (mode === 'adjust' && next !== 'adjust') disposeDraft();
    mode = next;
    closePopover();
    const hadFocus = bar.contains(doc.activeElement);
    render();
    positioner.reposition();
    if (moveFocus || hadFocus) nav.focusFirst();
  };

  const requireContext = (): ImageEditorContext | null => {
    const context = captureImageContext(editor);
    if (!context || context.image !== target) {
      showError('Select an image to edit.', () => undefined);
      return null;
    }
    return context;
  };

  const showError = (message: string, retry: () => void): void => {
    errorState = { message, retry };
    announce('Image update failed');
    render();
    positioner.reposition();
  };

  const clearError = (): void => {
    errorState = null;
    render();
    positioner.reposition();
  };

  const finishQuickEdit = (): void => {
    busy = false;
    bar.removeAttribute('aria-busy');
    if (bar.classList.contains('rly-open')) {
      render();
      positioner.reposition();
    }
  };

  const runTransform = (kind: QuickTransformKind, label: string): void => {
    if (busy) return;
    const context = requireContext();
    if (!context) return;
    busy = true;
    bar.setAttribute('aria-busy', 'true');
    const button = bar.querySelector<HTMLButtonElement>(`[data-testid="image-toolbar-${kind}"]`);
    for (const other of bar.querySelectorAll<HTMLButtonElement>('button')) other.disabled = true;
    if (button) setButtonBusy(button, true, '');
    announce(`${label} image`);
    void runQuickTransform(context, kind, deps)
      .then(() => announce('Image updated'))
      .catch((error) => {
        if (abort.signal.aborted) return;
        options.onError?.(error, context);
        finishQuickEdit();
        showError('The image could not be updated.', () => {
          clearError();
          runTransform(kind, label);
        });
      })
      .finally(finishQuickEdit);
  };

  const openCropPopover = (anchor: HTMLElement): void => {
    openInlineCropPopover({
      doc,
      anchor,
      bar,
      deps,
      signal: abort.signal,
      isBusy: () => busy,
      setBusy: (next) => {
        busy = next;
      },
      requireContext,
      openPopover,
      closePopover,
      announce,
      finishQuickEdit,
      showError,
      onError: options.onError,
      reposition: () => positioner.reposition()
    });
  };

  const openStudio = (
    initialTool: 'crop' | 'transform' | 'adjust',
    initialPanel?: 'resize'
  ): void => {
    openToolbarStudio(
      {
        options,
        deps,
        signal: abort.signal,
        isBusy: () => busy,
        requireContext,
        announce,
        reposition: () => positioner.reposition(),
        showError
      },
      initialTool,
      initialPanel
    );
  };

  const openAdjustPopover = (
    channel: AdjustDraftChannel,
    label: string,
    anchor: HTMLElement
  ): void => {
    if (busy) return;
    void (async () => {
      try {
        if (!draft) {
          const context = requireContext();
          if (!context) return;
          draft = new AdjustQuickDraft(context, deps);
        }
        await draft.begin(channel);
      } catch (error) {
        if (abort.signal.aborted) return;
        disposeDraft();
        options.onError?.(error);
        showError('The image could not be loaded for editing.', () => clearError());
        return;
      }
      const active = draft;
      const handle = createSliderPopover(doc, {
        title: label,
        min: channel === 'grayscale' ? 0 : -100,
        max: 100,
        value: active.value(),
        onInput: (value) => {
          active.preview(value);
          syncGrayscalePressed(bar, draft, popover);
        },
        onReset: () => {
          active.preview(0);
          syncGrayscalePressed(bar, draft, popover);
        },
        onCancel: () => {
          active.cancelCurrent();
          syncGrayscalePressed(bar, draft, popover);
          closePopover(true);
        },
        onApply: () => {
          if (busy) return;
          busy = true;
          bar.setAttribute('aria-busy', 'true');
          handle.setBusy(true);
          announce('Saving image');
          void active
            .apply()
            .then(() => {
              draft = null;
              closePopover(true);
              announce('Image updated');
            })
            .catch((error) => {
              draft = null;
              closePopover(true);
              if (abort.signal.aborted) return;
              options.onError?.(error);
              finishQuickEdit();
              showError('The image could not be updated.', () => clearError());
            })
            .finally(finishQuickEdit);
        }
      });
      openPopover(handle.element, anchor, true);
      handle.slider.focus();
      syncGrayscalePressed(bar, draft, popover);
    })();
  };

  const deleteImage = (): void => {
    deleteInlineImage(editor, target, hide);
  };

  const resetDisplaySize = (): void => {
    resetInlineImageDisplaySize(editor, target);
    closePopover(true);
    positioner.reposition();
  };

  const menuOptions = {
    doc,
    editor,
    rootActions,
    target: () => target,
    openPopover,
    closePopover,
    announce,
    reposition: () => positioner.reposition(),
    resetDisplaySize,
    deleteImage
  };

  const openAlignMenu = (anchor: HTMLElement): void => {
    openInlineAlignMenu(menuOptions, anchor);
  };

  const openAltPopover = (anchor: HTMLElement): void => {
    openInlineAltPopover(menuOptions, anchor);
  };

  const openMoreMenu = (anchor: HTMLElement, compact: boolean): void => {
    openInlineMoreMenu(menuOptions, anchor, compact);
  };

  const rootButton = (
    action: ImageToolbarRootAction,
    compact: boolean
  ): HTMLButtonElement | null => {
    return createRootActionButton({
      doc,
      editor,
      options,
      action,
      compact,
      openAlignMenu,
      openCropPopover,
      openStudio,
      setMode,
      openAltPopover,
      openMoreMenu,
      deleteImage
    });
  };

  const renderRoot = (): void => {
    const compact = positioner.isCompact();
    const actions = compact
      ? [
          ...COMPACT_ROOT_ACTIONS.filter(
            (action) => action !== 'more' && rootActions.includes(action)
          ),
          'more' as const
        ]
      : rootActions;
    for (const action of actions) {
      const button = rootButton(action, compact);
      if (button) bar.appendChild(button);
    }
  };

  const backButton = (): HTMLButtonElement =>
    createToolbarButton(doc, {
      id: 'back',
      icon: 'back',
      label: 'Back to image actions',
      onClick: () => setMode('root')
    });

  const renderTransform = (): void => {
    bar.append(backButton(), createModeLabel(doc, 'Transform:'));
    for (const { kind, icon, label, busyLabel } of TRANSFORM_ACTIONS) {
      bar.appendChild(
        createToolbarButton(doc, {
          id: kind,
          icon,
          label,
          onClick: () => runTransform(kind, busyLabel)
        })
      );
    }
    if (options.openEditor) {
      bar.appendChild(
        createToolbarButton(doc, {
          id: 'resize',
          icon: 'resize',
          label: 'Resize image',
          onClick: () => openStudio('transform', 'resize')
        })
      );
    }
  };

  const renderAdjust = (): void => {
    bar.append(backButton(), createModeLabel(doc, 'Adjust:'));
    for (const { channel, icon, label } of INLINE_ADJUSTMENTS) {
      bar.appendChild(
        createToolbarButton(doc, {
          id: channel,
          icon,
          label,
          pressed: channel === 'grayscale' ? false : undefined,
          onClick: (button) => openAdjustPopover(channel, label, button)
        })
      );
    }
    if (options.openEditor) {
      bar.append(
        createSeparator(doc),
        createToolbarButton(doc, {
          id: 'adjust-studio',
          icon: 'studio',
          label: 'More adjustments in Image Studio',
          onClick: () => openStudio('adjust')
        })
      );
    }
  };

  const render = (): void => {
    bar.replaceChildren();
    bar.setAttribute('aria-label', MODE_LABELS[mode]);
    if (errorState) {
      const { message, retry } = errorState;
      bar.appendChild(
        createErrorView(doc, {
          message,
          onRetry: () => {
            clearError();
            retry();
          },
          onDismiss: () => clearError()
        })
      );
      return;
    }
    if (mode === 'root') renderRoot();
    else if (mode === 'transform') renderTransform();
    else renderAdjust();
    wasCompact = positioner.isCompact();
  };

  const show = (image: HTMLImageElement): void => {
    if (target !== image) {
      closePopover();
      disposeDraft();
      errorState = null;
      target = image;
      mode = 'root';
      render();
    } else if (wasCompact !== positioner.isCompact() && !busy) {
      render();
    }
    bar.classList.add('rly-open');
    positioner.observe(image);
    positioner.reposition();
  };

  const syncFromSelection = (): void => {
    if (busy) return;
    const image = currentImage(editor);
    if (image && body.contains(image) && !image.hasAttribute('data-rly-uploading')) show(image);
    else hide();
  };

  const onDocMouseDown = (event: MouseEvent): void => {
    if (!root.contains(event.target as Node)) hide();
  };
  const onEditorKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey && event.key === 'F10' && bar.classList.contains('rly-open')) {
      event.preventDefault();
      nav.focusFirst();
    }
  };
  const onChange = (): void => {
    if (target && (!target.isConnected || !body.contains(target))) hide();
    else positioner.reposition();
  };

  doc.addEventListener('mousedown', onDocMouseDown);
  // Alt+F10 must reach the toolbar from the editable body and from the image
  // selection frame, both of which live inside the editor root.
  root.addEventListener('keydown', onEditorKeyDown);
  editor.events.on('selectionchange', syncFromSelection);
  editor.events.on('change', onChange);
  editor.events.on('execcommand', () => positioner.reposition());
  editor.events.on('destroy', () => {
    abort.abort();
    hide();
    positioner.destroy();
    nav.destroy();
    doc.removeEventListener('mousedown', onDocMouseDown);
    root.removeEventListener('keydown', onEditorKeyDown);
    bar.remove();
    live.remove();
  });
}

/** Creates the nested inline image toolbar plugin. */
export function imageInlineToolbarPlugin(options: ImageInlineToolbarOptions = {}): Plugin {
  return {
    name: IMAGE_INLINE_TOOLBAR_PLUGIN_NAME,
    init(editor) {
      if (options.enabled === false) return;
      installInlineImageToolbar(editor, options);
    }
  };
}
