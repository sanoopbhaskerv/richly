import { describe, it, expect } from 'vitest';
import { sanitize } from '../model/Sanitizer';

describe('Sanitizer', () => {
  it('drops script/style/iframe entirely', () => {
    expect(
      sanitize('<p>ok</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe>')
    ).toBe('<p>ok</p>');
  });

  it('strips on* event handler attributes', () => {
    expect(sanitize('<p onclick="evil()">hi</p>')).toBe('<p>hi</p>');
  });

  it('blocks javascript: URLs', () => {
    expect(sanitize('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitize('<a href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com">x</a>'
    );
  });

  it('unwraps unknown tags but keeps content (Word paste)', () => {
    expect(sanitize('<o:p><b>bold</b></o:p>')).toBe('<b>bold</b>');
  });

  it('removes HTML comments', () => {
    expect(sanitize('<p>a<!--[if mso]>junk<![endif]-->b</p>')).toBe('<p>ab</p>');
  });

  it('whitelists style declarations', () => {
    expect(sanitize('<span style="color: red; position: fixed">x</span>')).toBe(
      '<span style="color: red">x</span>'
    );
  });

  it('keeps allowed structural content intact', () => {
    const html = '<h1>t</h1><ul><li>a</li></ul><table><tbody><tr><td>c</td></tr></tbody></table>';
    expect(sanitize(html)).toBe(html);
  });
});
