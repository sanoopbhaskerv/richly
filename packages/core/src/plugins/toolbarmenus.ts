import type { Plugin } from './types';

/**
 * Progressive-disclosure menus composed from existing commands.
 *
 * These controls intentionally contain no editing logic. They are opt-in
 * building blocks for compact custom toolbars; the built-in standard and
 * complete presets keep unrelated actions independently visible.
 */
export const toolbarMenusPlugin: Plugin = {
  name: 'toolbarmenus',
  init(editor) {
    editor.ui.addButton('moretext', {
      type: 'menu',
      icon: 'textmore',
      tooltip: 'More text formatting',
      items: [
        {
          value: 'superscript',
          label: 'Superscript',
          icon: 'superscript',
          command: 'Superscript'
        },
        { value: 'subscript', label: 'Subscript', icon: 'subscript', command: 'Subscript' },
        {
          value: 'removeformat',
          label: 'Clear formatting',
          icon: 'removeformat',
          command: 'RemoveFormat',
          separatorBefore: true
        }
      ]
    });

    editor.ui.addButton('insertmenu', {
      type: 'menu',
      icon: 'insertmore',
      tooltip: 'More insert options',
      items: [
        { value: 'link', label: 'Insert link', icon: 'link', command: 'InsertLink' },
        { value: 'image', label: 'Insert image', icon: 'image', command: 'InsertImage' },
        { value: 'table', label: 'Insert table', icon: 'table', command: 'InsertTable' },
        {
          value: 'hr',
          label: 'Horizontal rule',
          command: 'InsertHorizontalRule',
          separatorBefore: true
        }
      ]
    });

    editor.ui.addButton('moretools', {
      type: 'menu',
      icon: 'documenttools',
      tooltip: 'Document tools',
      items: [
        { value: 'find', label: 'Search and replace', icon: 'search', command: 'FindReplace' },
        { value: 'preview', label: 'Preview', icon: 'preview', command: 'Preview' },
        {
          value: 'visualblocks',
          label: 'Visual blocks',
          icon: 'visualblocks',
          command: 'VisualBlocks'
        },
        {
          value: 'source',
          label: 'Source code',
          icon: 'sourcecode',
          command: 'SourceCode',
          separatorBefore: true
        },
        {
          value: 'fullscreen',
          label: 'Fullscreen',
          icon: 'fullscreen',
          command: 'ToggleFullscreen'
        }
      ]
    });
  }
};
