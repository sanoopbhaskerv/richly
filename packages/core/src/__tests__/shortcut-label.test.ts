import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '../editor/Editor';
import { formatShortcutLabel } from '../ui/Shortcut';
import { createTestEditor, destroyAll } from './test-utils';

let editor: Editor | undefined;

afterEach(() => {
  if (editor) destroyAll(editor);
  editor = undefined;
  vi.restoreAllMocks();
});

function usePlatform(platform: string): void {
  vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue(platform);
}

describe('platform-aware shortcut labels', () => {
  it('uses Apple keyboard symbols on macOS', () => {
    usePlatform('MacIntel');

    expect(formatShortcutLabel('Mod+C', document)).toBe('⌘C');
    expect(formatShortcutLabel('Mod+Shift+Z', document)).toBe('⌘⇧Z');
    expect(formatShortcutLabel('Mod+Alt+K', document)).toBe('⌘⌥K');
  });

  it('uses explicit modifier names on Windows and Linux', () => {
    usePlatform('Win32');

    expect(formatShortcutLabel('Mod+C', document)).toBe('Ctrl+C');
    expect(formatShortcutLabel('Mod+Shift+Z', document)).toBe('Ctrl+Shift+Z');
    expect(formatShortcutLabel('Mod+Alt+K', document)).toBe('Ctrl+Alt+K');
  });

  it('uses the same formatted shortcut in toolbar and menubar UI', () => {
    usePlatform('MacIntel');
    editor = createTestEditor('<p>copy me</p>');

    const toolbarCopy = editor.getRoot().querySelector<HTMLElement>('[data-testid="tb-copy"]');
    const menuCopy = editor
      .getRoot()
      .querySelector<HTMLElement>('[data-testid="menuitem-copy"] .rly-kbd');

    expect(toolbarCopy?.dataset.tooltip).toBe('Copy (⌘C)');
    expect(menuCopy?.textContent).toBe('⌘C');
  });
});
