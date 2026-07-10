import type { Plugin } from './types';
import { historyPlugin } from './history';
import { formatsPlugin } from './formats';
import { blocksPlugin } from './blocks';

export type { Plugin } from './types';

/** Built-ins loaded into every editor (they use the public plugin API like anything else). */
export const corePlugins: Plugin[] = [historyPlugin, formatsPlugin, blocksPlugin];
