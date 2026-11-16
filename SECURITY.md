# Security policy

Please do not report security vulnerabilities in public issues.

Report potential vulnerabilities privately through the repository's
[GitHub security advisories](https://github.com/sanoopbhaskerv/richly/security/advisories/new).
Include a minimal reproduction, affected version, and impact assessment.

Richly treats HTML sanitization, paste handling, URL validation, and DOM
selection handling as security-sensitive areas.

## URL policy

HTML import and `InsertLink` share a URL security check. It blocks JavaScript and
VBScript schemes, including TAB/LF/CR obfuscations and leading control characters.
Data URLs are restricted to exact PNG/GIF/JPEG/WebP MIME types; HTML, SVG and
MIME-prefix lookalikes are rejected. Rejected commands leave content unchanged.

For 1.x compatibility, existing relative, HTTP(S), FTP, file, blob and custom
application schemes remain accepted. Raster data links and line-wrapped raster
data images also remain accepted. Acceptance is not a guarantee that a custom
protocol handler is safe. Host applications should enforce any stricter protocol
allowlist they require before passing URLs to the editor and before rendering
persisted content. Sanitize untrusted HTML at application rendering boundaries
and use an appropriate Content Security Policy.
