import { useEffect } from 'react';
import { useImageHistory, useViewport } from '@richly/image-react';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName)) return true;
  return target.isContentEditable;
}

/**
 * Wires the documented keyboard baseline (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z,
 * Ctrl+Y, 0 for fit, 1 for 100%) to the existing history and viewport
 * commands. Shortcuts are suppressed while focus is inside a text/numeric
 * input, a select, or a contenteditable element so typing "0" or "1" into a
 * dimension field never triggers a zoom change.
 */
export function useStudioShortcuts(): void {
  const history = useImageHistory();
  const viewport = useViewport();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;

      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        history.undo();
        return;
      }

      if (
        (modifier && event.shiftKey && event.key.toLowerCase() === 'z') ||
        (event.ctrlKey && event.key.toLowerCase() === 'y')
      ) {
        event.preventDefault();
        history.redo();
        return;
      }

      if (!modifier && event.key === '0') {
        event.preventDefault();
        viewport.fit();
        return;
      }

      if (!modifier && event.key === '1') {
        event.preventDefault();
        viewport.setViewport({ zoom: 1, fit: false });
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [history, viewport]);
}
