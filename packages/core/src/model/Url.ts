/** Shared URL security policy, not a guarantee that every custom protocol is safe. */
export function isAllowedUrl(value: string): boolean {
  // WHATWG URL parsing strips TAB/LF/CR anywhere, and leading/trailing C0
  // controls/spaces. Validate that interpretation without rewriting safe URLs.
  const normalized = value
    .replace(/[\t\n\r]/g, '')
    // eslint-disable-next-line no-control-regex -- match URL-parser trimming rules
    .replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');

  if (/^\s*(?:javascript|vbscript)\s*:/i.test(normalized)) return false;
  if (/^\s*data\s*:/i.test(normalized)) {
    // Preserve existing raster data URLs (including anchors), but reject MIME
    // prefix tricks such as image/pngfoo and active HTML/SVG data documents.
    return /^data:image\/(?:png|gif|jpe?g|webp)(?:;[^,]*)?,/i.test(normalized.trim());
  }
  // Retain the 1.x contract for relative, FTP, blob and custom-scheme URLs.
  // Applications must separately restrict protocols according to their needs.
  return true;
}
