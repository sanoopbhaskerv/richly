import { describe, it, expect } from 'vitest';
import { isAllowedUrl } from '../model/Url';

describe('URL security policy', () => {
  it.each([
    'JaVaScRiPt:alert(1)',
    '\u00a0javascript:alert(1)',
    '\ufeffjavascript:alert(1)',
    ' javascript:alert(1)',
    '\u0000javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'java\rscript:alert(1)',
    'java\r\n\tscript:alert(1)',
    'javascript :alert(1)',
    'vb\tscript:msgbox(1)',
    'data:text/html,x',
    'da\tta:text/html,x',
    'data:image/svg+xml,x',
    'data:image/pngfoo,x'
  ])('rejects dangerous URL %s', (url) => {
    expect(isAllowedUrl(url)).toBe(false);
  });

  it('rejects every ASCII-control variant that the URL parser recognizes as executable', () => {
    for (const scheme of ['javascript:', 'vbscript:']) {
      for (let code = 0; code <= 32; code++) {
        for (let position = 0; position <= scheme.length; position++) {
          const value =
            scheme.slice(0, position) +
            String.fromCharCode(code) +
            scheme.slice(position) +
            'alert(1)';
          const protocol = new URL(value, 'https://example.com/').protocol;
          if (protocol === 'javascript:' || protocol === 'vbscript:') {
            expect(isAllowedUrl(value)).toBe(false);
          }
        }
      }
    }
  });

  it.each([
    'HTTPS://example.com',
    ' https://example.com ',
    '/path',
    '../path',
    '#fragment',
    '//example.com',
    'mailto:a@example.com',
    'tel:+123456',
    'ftp://example.com/file',
    'file:///tmp/document',
    'myapp:document/123',
    'slack://channel?id=123',
    'blob:https://example.com/id',
    'data:image/png;base64,AA==',
    'data:image/jpeg;base64,AA\nBB',
    'https://exam\tple.com'
  ])('preserves previously accepted URL %s', (url) => {
    expect(isAllowedUrl(url)).toBe(true);
  });
});
