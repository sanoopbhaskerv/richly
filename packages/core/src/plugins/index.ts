import type { Plugin } from './types';
import { historyPlugin } from './history';
import { formatsPlugin } from './formats';
import { blocksPlugin } from './blocks';
import { alignPlugin } from './align';
import { listsPlugin } from './lists';
import { indentPlugin } from './indent';
import { linkPlugin } from './link';

export type { Plugin } from './types';

/** Built-ins loaded into every editor (they use the public plugin API like anything else). */
export const corePlugins: Plugin[] = [
  historyPlugin,
  formatsPlugin,
  blocksPlugin,
  alignPlugin,
  listsPlugin,
  indentPlugin,
  linkPlugin
];
