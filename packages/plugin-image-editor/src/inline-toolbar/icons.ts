/**
 * Richly-owned inline SVG icons for the image toolbar. Stroke style matches
 * the core editor icon set (24 viewBox, 1.9 stroke, currentColor) so the
 * toolbar reads as part of the same icon language as the text toolbar.
 */

const svg = (inner: string): string =>
  `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const toolbarIcons: Record<string, string> = {
  back: svg('<path d="m14 6-6 6 6 6"/>'),
  align: svg(
    '<path d="M4 5h16M4 19h16"/><rect x="4" y="9" width="9" height="6" rx="1"/><path d="M16 12h4"/>'
  ),
  alignInline: svg(
    '<path d="M4 5h16M4 19h16M4 12h4M16 12h4"/><rect x="10" y="9" width="4" height="6" rx="1"/>'
  ),
  alignLeft: svg(
    '<path d="M4 5h16M4 19h16"/><rect x="4" y="9" width="8" height="6" rx="1"/><path d="M15 12h5"/>'
  ),
  alignCenter: svg('<path d="M4 5h16M4 19h16"/><rect x="8" y="9" width="8" height="6" rx="1"/>'),
  alignRight: svg(
    '<path d="M4 5h16M4 19h16"/><rect x="12" y="9" width="8" height="6" rx="1"/><path d="M4 12h5"/>'
  ),
  alignFull: svg('<path d="M4 5h16M4 19h16"/><rect x="4" y="9" width="16" height="6" rx="1"/>'),
  crop: svg('<path d="M7 2v15a1 1 0 0 0 1 1h14"/><path d="M2 7h15a1 1 0 0 1 1 1v14"/>'),
  transform: svg(
    '<path d="M12 3a9 9 0 0 1 9 9"/><path d="m18 9 3 3 3-3" transform="translate(-3 0)"/><rect x="4" y="12" width="8" height="8" rx="1"/>'
  ),
  adjust: svg(
    '<path d="M5 4v6M5 14v6M12 4v2M12 10v10M19 4v10M19 18v2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="19" cy="16" r="2"/>'
  ),
  studio: svg(
    '<path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8Z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z"/>'
  ),
  alt: svg(
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l2.2-6h.4l2.2 6M7.8 13h3.2M15 9v6M13.6 9h2.8"/>'
  ),
  replace: svg(
    '<path d="M4 9a8 8 0 0 1 13.6-3.4L21 9"/><path d="M21 3v6h-6"/><path d="M20 15a8 8 0 0 1-13.6 3.4L3 15"/><path d="M3 21v-6h6"/>'
  ),
  more: svg(
    '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'
  ),
  delete: svg(
    '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>'
  ),
  rotateLeft: svg('<path d="M8 5 4 9l4 4"/><path d="M4 9h9a7 7 0 1 1-7 7"/>'),
  rotateRight: svg('<path d="m16 5 4 4-4 4"/><path d="M20 9h-9a7 7 0 1 0 7 7"/>'),
  flipVertical: svg(
    '<path d="M3 12h18" stroke-dasharray="2.5 2.5"/><path d="M7 8.5 12 3l5 5.5H7Z"/><path d="M7 15.5 12 21l5-5.5H7Z" fill="currentColor" stroke="none"/>'
  ),
  flipHorizontal: svg(
    '<path d="M12 3v18" stroke-dasharray="2.5 2.5"/><path d="M8.5 7 3 12l5.5 5V7Z"/><path d="M15.5 7 21 12l-5.5 5V7Z" fill="currentColor" stroke="none"/>'
  ),
  resize: svg(
    '<path d="M9 15 4 20"/><path d="M4 14v6h6"/><path d="m15 9 5-5"/><path d="M20 10V4h-6"/>'
  ),
  brightness: svg(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
  ),
  contrast: svg(
    '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/>'
  ),
  saturation: svg(
    '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3Z"/><path d="M12 18a3.5 3.5 0 0 0 3.5-3.5"/>'
  ),
  grayscale: svg(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M21 3 3 21"/><path d="M3 12l9 9H5a2 2 0 0 1-2-2Z" fill="currentColor" stroke="none"/>'
  ),
  check: svg('<path d="m5 13 4 4L19 7"/>'),
  spinner: svg('<path d="M12 3a9 9 0 1 1-9 9"/>')
};
