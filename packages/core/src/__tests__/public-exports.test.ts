import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function parseExportsFromIndex(source: string): string[] {
  const out = new Set<string>();
  const re = /export(?:\s+type)?\s*\{([\s\S]*?)\}\s*from\s*['"][^'"]+['"]/g;
  for (const match of source.matchAll(re)) {
    const captured = match[1];
    if (!captured) continue;
    const names = captured
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^type\s+/, ''));
    for (const name of names) out.add(name);
  }
  return [...out].sort();
}

describe('public exports snapshot (1.0 freeze tripwire)', () => {
  it('matches the expected public export surface', () => {
    const indexPath = resolve(process.cwd(), 'src/index.ts');
    const source = readFileSync(indexPath, 'utf8');
    const actual = parseExportsFromIndex(source);

    const expected = [
      'Bookmark',
      'ButtonSpec',
      'Command',
      'ComponentControl',
      'DEFAULT_COLORS',
      'DEFAULT_FONT_SIZES',
      'DialogField',
      'DialogResult',
      'DialogSpec',
      'Editor',
      'EditorConfig',
      'EditorEvents',
      'FindReplaceArgs',
      'FontSizeCommandArgs',
      'FontSizeControl',
      'FontSizeControlOptions',
      'ImagesConfig',
      'createFontSizeControl',
      'formatFontSizeValue',
      'getReferenceFontSize',
      'openDialog',
      'parseFontSizeInput',
      'Plugin',
      'ToolbarMode',
      'WordCountOptions',
      'sanitize'
    ].sort();

    expect(actual).toEqual(expected);
  });

  it('contains the plugin-authoring minimum required types', () => {
    const indexPath = resolve(process.cwd(), 'src/index.ts');
    const source = readFileSync(indexPath, 'utf8');
    const actual = new Set(parseExportsFromIndex(source));

    const required = [
      'Plugin',
      'Command',
      'ButtonSpec',
      'EditorEvents',
      'openDialog',
      'DialogField',
      'DialogSpec',
      'DialogResult'
    ];

    required.forEach((name) => {
      expect(actual.has(name)).toBe(true);
    });
  });
});
