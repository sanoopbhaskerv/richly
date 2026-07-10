/** Inline SVG icons (17px, stroke-based) — matches mockup.html design language. */
const svg = (inner: string): string =>
  `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const icons: Record<string, string> = {
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
  bold: svg('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'),
  italic: svg('<path d="M11 5h6M7 19h6M14 5l-4 14"/>'),
  underline: svg('<path d="M7 4v7a5 5 0 0 0 10 0V4M6 20h12"/>'),
  strikethrough: svg(
    '<path d="M4 12h16M17 6.5C16 5 14.5 4.5 12 4.5c-3 0-4.5 1.4-4.5 3 0 .9.4 1.6 1.2 2.1M7 17.5c1 1.5 2.5 2 5 2 3 0 4.5-1.4 4.5-3 0-.9-.4-1.6-1.2-2.1"/>'
  ),
  h1: svg('<path d="M4 6v12M11 6v12M4 12h7M16 10l3-2v10" />'),
  h2: svg('<path d="M4 6v12M11 6v12M4 12h7M15.5 10a2.5 2.5 0 0 1 4.3 1.7c0 2-4.3 3.3-4.3 6.3h5"/>'),
  paragraph: svg('<path d="M13 5v14M17 5v14M17 5h-6a4 4 0 0 0 0 8h2"/>'),
  blockquote: svg('<path d="M8 7c-2 1-3 2.7-3 5v5h5v-5H7c0-1.8.8-3 2.5-3.8zM19 7c-2 1-3 2.7-3 5v5h5v-5h-3c0-1.8.8-3 2.5-3.8z" fill="currentColor" stroke="none"/>'),
  removeformat: svg('<path d="M6 5h12M12 5 9 19M6 19h6"/><path d="m16 15 5 5M21 15l-5 5"/>')
};
