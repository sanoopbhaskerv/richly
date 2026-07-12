import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sanitize } from '../model/Sanitizer';

const fixture = (name: string): string =>
  readFileSync(resolve(process.cwd(), 'src/__tests__/__fixtures__', name), 'utf8');

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
    expect(
      sanitize(
        '<span style="color: red; background-color: yellow; font-size: 18px; position: fixed">x</span>'
      )
    ).toBe('<span style="color: red; background-color: yellow; font-size: 18px">x</span>');
  });

  it('keeps allowed structural content intact', () => {
    const html = '<h1>t</h1><ul><li>a</li></ul><table><tbody><tr><td>c</td></tr></tbody></table>';
    expect(sanitize(html)).toBe(html);
  });

  it('strips internal upload marker attributes from images', () => {
    expect(sanitize('<p><img src="x.png" alt="x" data-rly-uploading="true"></p>')).toBe(
      '<p><img src="x.png" alt="x"></p>'
    );
  });

  it('cleans a representative Microsoft Word document while preserving structure', () => {
    const html = sanitize(fixture('word-paragraphs.html'));

    expect(html).toContain('Quarterly update');
    expect(html).toContain('<b>');
    expect(html).toContain(
      '<i><span style="background-color: #fff2cc; font-size: 12pt">24%</span></i>'
    );
    expect(html).toContain('color: #1f4e79');
    expect(html).toContain('font-size: 16pt');
    expect(html).toContain('background-color: #fff2cc');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li class="MsoListParagraph">First market</li>');
    expect(html).not.toMatch(/<script|<style|onclick=|mso-pagination/i);
    expect(html).not.toContain('office metadata');
  });

  it('cleans a representative Word table while preserving its cells', () => {
    const html = sanitize(fixture('word-table.html'));

    expect(html).toContain('<table class="MsoTableGrid">');
    expect(html).toContain('<b>Name</b>');
    expect(html).toContain('<b>Status</b>');
    expect(html).toContain('Alpha');
    expect(html.match(/<td/g)).toHaveLength(4);
    expect(html).not.toMatch(/cellspacing=|cellpadding=|mso-table/i);
  });

  it('cleans representative Google Docs HTML and keeps safe links and lists', () => {
    const html = sanitize(fixture('google-docs.html'));

    expect(html).toContain('Planning notes');
    expect(html).toContain('Confirm the launch date');
    expect(html).toContain('color: #0f766e');
    expect(html).toContain('background-color: #dcfce7');
    expect(html).toContain('font-size: 11pt');
    expect(html).toContain('<ul');
    expect(html).toContain('href="https://example.com/roadmap"');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toMatch(/<meta|<iframe/);
  });
});
