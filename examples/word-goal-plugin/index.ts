import type { Plugin } from '@richly/core';

export interface WordGoalPluginOptions {
  goal: number;
  warnAt?: number;
  testId?: string;
  eventName?: string;
}

interface WordGoalUpdate {
  words: number;
  goal: number;
  ratio: number;
  state: 'normal' | 'warn' | 'reached';
}

function countWords(text: string): number {
  const normalized = text.replace(/\uFEFF/g, '').trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
}

export function createWordGoalPlugin(options: WordGoalPluginOptions): Plugin {
  const {
    goal,
    warnAt = 0.8,
    testId = 'status-word-goal',
    eventName = 'wordgoal:update'
  } = options;

  return {
    name: `word-goal-${goal}`,
    init(editor) {
      const statusbar = editor.getRoot().querySelector('.rly-statusbar');
      if (!statusbar) return;

      const indicator = statusbar.ownerDocument.createElement('span');
      indicator.className = 'rly-word-goal';
      indicator.dataset.testid = testId;
      indicator.setAttribute('aria-live', 'polite');

      const grow = statusbar.querySelector('.rly-grow');
      if (grow && grow.nextSibling) statusbar.insertBefore(indicator, grow.nextSibling);
      else statusbar.appendChild(indicator);

      const emitter = editor.events as unknown as { emit(name: string, data: unknown): void };
      const refresh = (): void => {
        const words = countWords(editor.getBody().textContent ?? '');
        const ratio = goal > 0 ? words / goal : 0;
        const reached = words >= goal;
        const warn = !reached && ratio >= warnAt;
        const state: WordGoalUpdate['state'] = reached ? 'reached' : warn ? 'warn' : 'normal';

        indicator.textContent = `${words} / ${goal} words`;
        indicator.classList.toggle('rly-goal-warn', warn);
        indicator.classList.toggle('rly-goal-ok', reached);
        emitter.emit(eventName, { words, goal, ratio, state } satisfies WordGoalUpdate);
      };

      editor.on('input', refresh);
      editor.on('change', refresh);
      refresh();
    }
  };
}
