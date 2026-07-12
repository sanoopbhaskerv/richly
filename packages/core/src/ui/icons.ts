/** Inline SVG icons (17px, stroke-based) for the default editor theme. */
const svg = (inner: string): string =>
  `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const icons: Record<string, string> = {
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
  selectall: svg(
    '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" stroke-dasharray="2 2"/>'
  ),
  copy: svg(
    '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'
  ),
  cut: svg(
    '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m8.5 8.5 10 7M8.5 15.5l10-7"/>'
  ),
  paste: svg(
    '<path d="M9 5h6M9 3h6v4H9z"/><path d="M8 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-2"/>'
  ),
  more: svg(
    '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
  ),
  search: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>'),
  preview: svg(
    '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/>'
  ),
  visualblocks: svg(
    '<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="8" height="6" rx="1"/><rect x="14" y="14" width="7" height="6" rx="1"/>'
  ),
  bold: svg('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'),
  italic: svg('<path d="M11 5h6M7 19h6M14 5l-4 14"/>'),
  underline: svg('<path d="M7 4v7a5 5 0 0 0 10 0V4M6 20h12"/>'),
  strikethrough: svg(
    '<path d="M4 12h16M17 6.5C16 5 14.5 4.5 12 4.5c-3 0-4.5 1.4-4.5 3 0 .9.4 1.6 1.2 2.1M7 17.5c1 1.5 2.5 2 5 2 3 0 4.5-1.4 4.5-3 0-.9-.4-1.6-1.2-2.1"/>'
  ),
  forecolor: svg(
    '<path d="m7 18 5-14 5 14M9 13h6"/><path class="rly-icon-color-indicator" d="M5 21h14" stroke-width="3"/>'
  ),
  backcolor: svg(
    '<rect class="rly-icon-color-indicator" x="4" y="16" width="16" height="5" rx="1" fill="currentColor" stroke="none"/><path d="m7 15 5-10 5 10M9 11h6"/>'
  ),
  superscript: svg('<path d="M3 18 10 8M3 8l7 10"/><path d="M14 7h6M14 12h6M14 7l6 5"/>'),
  subscript: svg('<path d="M3 16 10 6M3 6l7 10"/><path d="M14 16h6M14 16l3 3h3"/>'),
  h1: svg('<path d="M4 6v12M11 6v12M4 12h7M16 10l3-2v10" />'),
  h2: svg('<path d="M4 6v12M11 6v12M4 12h7M15.5 10a2.5 2.5 0 0 1 4.3 1.7c0 2-4.3 3.3-4.3 6.3h5"/>'),
  h3: svg(
    '<path d="M4 6v12M11 6v12M4 12h7M16 9.5h2.5a2 2 0 0 1 0 4H17.5M18 13.5h.5a2 2 0 0 1 0 4H16"/>'
  ),
  paragraph: svg('<path d="M13 5v14M17 5v14M17 5h-6a4 4 0 0 0 0 8h2"/>'),
  blockquote: svg(
    '<path d="M8 7c-2 1-3 2.7-3 5v5h5v-5H7c0-1.8.8-3 2.5-3.8zM19 7c-2 1-3 2.7-3 5v5h5v-5h-3c0-1.8.8-3 2.5-3.8z" fill="currentColor" stroke="none"/>'
  ),
  removeformat: svg('<path d="M6 5h12M12 5 9 19M6 19h6"/><path d="m16 15 5 5M21 15l-5 5"/>'),
  alignleft: svg('<path d="M4 6h16M4 12h10M4 18h14"/>'),
  aligncenter: svg('<path d="M4 6h16M7 12h10M5 18h14"/>'),
  alignright: svg('<path d="M4 6h16M10 12h10M6 18h14"/>'),
  alignjustify: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  bullist: svg(
    '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none"/>'
  ),
  numlist: svg(
    '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5.5 5.5 4v5M4 11.5h2.5L4 14.5h2.5M4 17h2a1 1 0 0 1 0 2 1 1 0 0 1 0 2H4" stroke-width="1.4"/>'
  ),
  outdent: svg('<path d="M4 6h16M11 12h9M4 18h16M8 10l-3 2 3 2"/>'),
  indent: svg('<path d="M4 6h16M11 12h9M4 18h16M5 10l3 2-3 2"/>'),
  link: svg(
    '<path d="M10 14a4 4 0 0 0 6 .4l2.6-2.6a4 4 0 1 0-5.7-5.7L11.5 7.5"/><path d="M14 10a4 4 0 0 0-6-.4L5.4 12.2a4 4 0 1 0 5.7 5.7l1.4-1.4"/>'
  ),
  unlink: svg(
    '<path d="M10 14a4 4 0 0 0 6 .4l2.6-2.6a4 4 0 1 0-5.7-5.7L11.5 7.5"/><path d="M14 10a4 4 0 0 0-6-.4L5.4 12.2a4 4 0 1 0 5.7 5.7l1.4-1.4"/><path d="m4 4 16 16"/>'
  ),
  table: svg(
    '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M4 14.5h16M10 5v14M15 5v14" stroke-width="1.4"/>'
  ),
  image: svg(
    '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 4.5-4.5L14 17l3-3 3 3"/>'
  ),
  sourcecode: svg('<path d="m9 8-4 4 4 4M15 8l4 4-4 4"/>'),
  fullscreen: svg('<path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"/>')
};
