type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: { platform?: string };
};

/**
 * Convert Richly's platform-neutral shortcut notation into a user-facing label.
 *
 * Plugins register shortcuts with `Mod`, `Shift`, and `Alt` tokens so command
 * metadata remains portable. Apple platforms receive conventional keyboard
 * symbols, while Windows and Linux receive explicit modifier names.
 *
 * @param shortcut - Portable shortcut such as `Mod+C` or `Mod+Shift+Z`.
 * @param doc - Document whose navigator identifies the current platform.
 * @returns A platform-specific label such as `⌘C` or `Ctrl+C`.
 */
export function formatShortcutLabel(shortcut: string, doc: Document): string {
  const navigator = doc.defaultView?.navigator as NavigatorWithUserAgentData | undefined;
  const platform = navigator?.userAgentData?.platform || navigator?.platform || '';
  const isApple = /mac|iphone|ipad|ipod|ios/i.test(platform);

  return shortcut
    .replace(/Mod\+/g, isApple ? '⌘' : 'Ctrl+')
    .replace(/Shift\+/g, isApple ? '⇧' : 'Shift+')
    .replace(/Alt\+/g, isApple ? '⌥' : 'Alt+');
}
