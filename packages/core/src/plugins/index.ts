import type { Plugin } from './types';
import { historyPlugin } from './history';
import { formatsPlugin } from './formats';
import { blocksPlugin } from './blocks';
import { alignPlugin } from './align';
import { listsPlugin } from './lists';
import { indentPlugin } from './indent';
import { linkPlugin } from './link';
import { tablePlugin } from './table';
import { imagePlugin } from './image';
import { hrPlugin } from './hr';
import { sourceCodePlugin } from './sourcecode';
import { fullscreenPlugin } from './fullscreen';
import { clipboardPlugin } from './clipboard';
import { documentToolsPlugin } from './documenttools';
import { textStylePlugin } from './textstyle';
import { textSelectionToolbarPlugin } from './textselectiontoolbar';
import { lineHeightPlugin } from './lineheight';
import { toolbarMenusPlugin } from './toolbarmenus';

export type { Plugin } from './types';

/** Built-ins loaded into every editor (they use the public plugin API like anything else). */
export const corePlugins: Plugin[] = [
  historyPlugin,
  clipboardPlugin,
  documentToolsPlugin,
  formatsPlugin,
  blocksPlugin,
  alignPlugin,
  listsPlugin,
  indentPlugin,
  linkPlugin,
  tablePlugin,
  imagePlugin,
  hrPlugin,
  sourceCodePlugin,
  fullscreenPlugin,
  textStylePlugin,
  lineHeightPlugin,
  toolbarMenusPlugin,
  textSelectionToolbarPlugin
];
