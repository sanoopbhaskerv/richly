import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '../editor/Editor';
import { SANITIZER_SCHEMA } from '../model/Sanitizer';

let editor: Editor | undefined;

/** Reads the ordered source partials represented by the theme manifest. */
function readThemeSource(): string {
  const entryPath = resolve(process.cwd(), 'src/ui/theme.css');
  const manifest = readFileSync(entryPath, 'utf8');
  const partialPaths = [...manifest.matchAll(/@import\s+['"](.+?)['"]\s*;/g)].map((match) =>
    resolve(dirname(entryPath), match[1])
  );
  if (partialPaths.length === 0) throw new Error('Theme manifest does not import any partials');
  return partialPaths.map((path) => readFileSync(path, 'utf8')).join('');
}

afterEach(() => {
  editor?.destroy();
  editor = undefined;
  document.body.innerHTML = '';
});

function interfaceMembers(file: string, interfaceName: string): Record<string, string> {
  const sourceText = readFileSync(resolve(process.cwd(), file), 'utf8');
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === interfaceName
  );
  if (!declaration) throw new Error(`Missing ${interfaceName} in ${file}`);
  return Object.fromEntries(
    declaration.members.flatMap((member) => {
      if (!ts.isPropertySignature(member) || !member.name || !member.type) return [];
      const name = member.name.getText(source);
      const type = member.type
        .getText(source)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return [[name, type]];
    })
  );
}

function typeAlias(file: string, aliasName: string): string {
  const sourceText = readFileSync(resolve(process.cwd(), file), 'utf8');
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === aliasName
  );
  if (!declaration) throw new Error(`Missing ${aliasName} in ${file}`);
  return declaration.type.getText(source).replace(/\s+/g, ' ').trim();
}

describe('1.0 public contract tripwires', () => {
  it('freezes toolbar layout mode names', () => {
    expect(typeAlias('src/editor/Editor.ts', 'ToolbarMode')).toBe("'wrap' | 'more' | 'sliding'");
  });

  it('freezes EditorConfig option names', () => {
    expect(Object.keys(interfaceMembers('src/editor/Editor.ts', 'EditorConfig')).sort()).toEqual(
      [
        'blockquoteStyle',
        'images',
        'initialContent',
        'listStyles',
        'menubar',
        'plugins',
        'resize',
        'selector',
        'statusbar',
        'target',
        'testIdPrefix',
        'textStyles',
        'toolbar',
        'toolbarMode',
        'toolbarOverflow',
        'toolbarPreset',
        'wordCount'
      ].sort()
    );
  });

  it('freezes the textStyles personalization surface', () => {
    expect(interfaceMembers('src/editor/Editor.ts', 'EditorConfig').textStyles).toBe(
      '{ colors?: string[]; themeColors?: string[]; fontSizes?: string[]; lineHeights?: LineHeightOption[]; }'
    );
  });

  it('freezes React EditorProps option names', () => {
    expect(Object.keys(interfaceMembers('../react/src/Editor.tsx', 'EditorProps')).sort()).toEqual(
      [
        'blockquoteStyle',
        'className',
        'images',
        'initialValue',
        'listStyles',
        'menubar',
        'onChange',
        'onInit',
        'plugins',
        'resize',
        'statusbar',
        'testIdPrefix',
        'textStyles',
        'toolbar',
        'toolbarMode',
        'toolbarOverflow',
        'toolbarPreset',
        'value',
        'wordCount'
      ].sort()
    );
  });

  it('freezes built-in event payloads', () => {
    expect(interfaceMembers('src/editor/Editor.ts', 'EditorEvents')).toEqual({
      init: 'void',
      change: 'string',
      input: 'void',
      selectionchange: 'void',
      focus: 'void',
      blur: 'void',
      keydown: 'KeyboardEvent',
      execcommand: '{ name: string; args?: unknown }',
      imageuploadstart: '{ file: File }',
      imageuploadend: '{ file: File; src: string }',
      imageuploaderror: '{ file: File; error: unknown }',
      destroy: 'void'
    });
  });

  it('freezes built-in command names', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    editor = Editor.init({ target });
    const registry = editor.commands as unknown as { commands: Map<string, unknown> };

    expect([...registry.commands.keys()].sort()).toEqual(
      [
        'Alignment',
        'ApplyList',
        'BackColor',
        'Bold',
        'BulletListStyle',
        'CellProps',
        'Copy',
        'Cut',
        'FindReplace',
        'FontSize',
        'ForeColor',
        'FormatBlock',
        'FormatBlock:blockquote',
        'FormatBlock:h1',
        'FormatBlock:h2',
        'FormatBlock:h3',
        'FormatBlock:h4',
        'FormatBlock:h5',
        'FormatBlock:h6',
        'FormatBlock:p',
        'FormatBlock:pre',
        'Indent',
        'InsertHorizontalRule',
        'InsertImage',
        'InsertLink',
        'InsertOrderedList',
        'InsertTable',
        'InsertUnorderedList',
        'Italic',
        'JustifyCenter',
        'JustifyFull',
        'JustifyLeft',
        'JustifyRight',
        'LineHeight',
        'NumberListStyle',
        'Outdent',
        'Paste',
        'Preview',
        'Redo',
        'RemoveFormat',
        'RemoveList',
        'RowProps',
        'SelectAll',
        'SourceCode',
        'Strikethrough',
        'Subscript',
        'Superscript',
        'TableDelete',
        'TableDeleteCol',
        'TableDeleteRow',
        'TableInsertColAfter',
        'TableInsertColBefore',
        'TableInsertRowAfter',
        'TableInsertRowBefore',
        'TableMergeCells',
        'TableProps',
        'TableSplitCell',
        'ToggleFullscreen',
        'Underline',
        'Undo',
        'Unlink',
        'VisualBlocks'
      ]
        .map((name) => name.toLowerCase())
        .sort()
    );
  });

  it('freezes the sanitizer schema', () => {
    expect(SANITIZER_SCHEMA).toEqual({
      tags: [
        'p',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'blockquote',
        'pre',
        'div',
        'br',
        'hr',
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'strike',
        'del',
        'code',
        'sub',
        'sup',
        'span',
        'ul',
        'ol',
        'li',
        'a',
        'img',
        'table',
        'colgroup',
        'col',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'td',
        'th',
        'caption',
        'figure',
        'figcaption'
      ],
      globalAttributes: ['style', 'class', 'id', 'dir', 'lang', 'title'],
      attributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'width', 'height'],
        td: ['colspan', 'rowspan'],
        th: ['colspan', 'rowspan', 'scope']
      },
      styles: [
        'color',
        'background-color',
        'text-align',
        'text-decoration',
        'font-weight',
        'font-style',
        'font-size',
        'font-family',
        'line-height',
        'list-style-type',
        'margin-left',
        'margin-right',
        'padding-left',
        'width',
        'height',
        'vertical-align',
        'border-width',
        'border-color',
        'padding',
        'table-layout'
      ],
      dropEntirely: [
        'script',
        'style',
        'iframe',
        'object',
        'embed',
        'form',
        'meta',
        'link',
        'head',
        'title'
      ]
    });
  });

  it('keeps the documented theme tokens and CSS hooks', () => {
    const css = readThemeSource();
    for (const token of [
      '--rly-surface',
      '--rly-surface-2',
      '--rly-border',
      '--rly-text',
      '--rly-text-dim',
      '--rly-accent',
      '--rly-hover',
      '--rly-active',
      '--rly-radius'
    ])
      expect(css).toContain(token);
    for (const className of [
      '.rly',
      '.rly-content',
      '.rly-blockquote-styled',
      '.rly-striped',
      '.rly-match',
      '.rly-match-current'
    ])
      expect(css).toContain(className);
  });
});
