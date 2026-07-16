import { test, expect } from './support/fixtures';
import { mulberry32, chooseAction, type MonkeyState } from './support/monkeyModel';
import { executeMonkeyAction } from './support/monkeyActions';
import { checkGlobalInvariants } from './support/invariants';

declare const process: { env: Record<string, string | undefined> };

interface LogEntry {
  readonly step: number;
  readonly action: string;
  readonly activeTool: string;
}

const ACTION_TIMEOUT_MS = 15_000;

/**
 * Bounds a single monkey action to a short, fixed timeout. Without this, a
 * Playwright action stuck waiting on a never-actionable locator (hidden,
 * disabled, permanently intercepted) inherits whatever time is left in the
 * enclosing test timeout, so a single stuck step silently burns the entire
 * budget instead of failing fast with a diagnosable step number.
 */
async function withActionTimeout<T>(promise: Promise<T>, action: string, step: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `Action "${action}" at step ${step} did not settle within ${ACTION_TIMEOUT_MS}ms`
          )
        ),
      ACTION_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Seeds run when IMAGE_STUDIO_MONKEY_SEED is not set: bounded, CI-friendly default. */
const DEFAULT_SEEDS: readonly number[] = [101];
const DEFAULT_ACTIONS = 90;

/** Extended local coverage: `IMAGE_STUDIO_MONKEY_EXTENDED=1` runs all three seeds. */
const EXTENDED_PLAN: ReadonlyMap<number, number> = new Map([
  [101, 150],
  [202, 250],
  [303, 400]
]);

function resolveSessions(): Array<{ seed: number; actions: number }> {
  const envSeed = process.env.IMAGE_STUDIO_MONKEY_SEED
    ? Number(process.env.IMAGE_STUDIO_MONKEY_SEED)
    : undefined;
  const envActions = process.env.IMAGE_STUDIO_MONKEY_ACTIONS
    ? Number(process.env.IMAGE_STUDIO_MONKEY_ACTIONS)
    : undefined;
  const extended = process.env.IMAGE_STUDIO_MONKEY_EXTENDED === '1';

  if (envSeed !== undefined) {
    return [
      { seed: envSeed, actions: envActions ?? EXTENDED_PLAN.get(envSeed) ?? DEFAULT_ACTIONS }
    ];
  }
  if (extended) {
    return Array.from(EXTENDED_PLAN.entries()).map(([seed, actions]) => ({
      seed,
      actions: envActions ?? actions
    }));
  }
  return DEFAULT_SEEDS.map((seed) => ({ seed, actions: envActions ?? DEFAULT_ACTIONS }));
}

for (const { seed, actions } of resolveSessions()) {
  test(`seeded monkey session (seed=${seed}, actions=${actions})`, async ({
    studio,
    page
  }, testInfo) => {
    // Scale the test timeout to the action count — each action is a real
    // page interaction plus an invariant check, so long extended sessions
    // (up to 400 actions) need far more than the suite's default 30s.
    testInfo.setTimeout(Math.max(30_000, actions * 1_800 + 30_000));

    const rng = mulberry32(seed);
    const state: MonkeyState = { activeTool: 'adjust', transformTab: 'resize', exportOpen: false };
    const log: LogEntry[] = [];

    for (let step = 1; step <= actions; step++) {
      const action = chooseAction(rng, state);
      log.push({ step, action, activeTool: state.activeTool });

      try {
        await withActionTimeout(
          executeMonkeyAction(action, { page, studio, rng, state }),
          action,
          step
        );
      } catch (error) {
        await testInfo.attach('monkey-sequence', {
          body: JSON.stringify({ seed, actions, failedAtStep: step, log }, null, 2),
          contentType: 'application/json'
        });
        throw new Error(
          `Monkey action "${action}" threw at step ${step} (seed=${seed}): ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error }
        );
      }

      const violations = await checkGlobalInvariants(page, studio);
      if (violations.length > 0) {
        await testInfo.attach('monkey-sequence', {
          body: JSON.stringify({ seed, actions, failedAtStep: step, violations, log }, null, 2),
          contentType: 'application/json'
        });
        await page
          .screenshot({ path: testInfo.outputPath(`monkey-failure-seed-${seed}-step-${step}.png`) })
          .catch(() => undefined);
        throw new Error(
          `Global invariant violated at step ${step} (seed=${seed}, action="${action}"): ${JSON.stringify(
            violations
          )}`
        );
      }
    }

    const finalHistory = await studio.historySnapshot();
    const finalCanvas = await studio.canvasSize();

    await testInfo.attach('monkey-summary', {
      body: JSON.stringify(
        {
          seed,
          actionCount: actions,
          finalActiveTool: state.activeTool,
          finalHistory,
          finalCanvas,
          sequence: log
        },
        null,
        2
      ),
      contentType: 'application/json'
    });

    expect(finalCanvas.width).toBeGreaterThan(0);
    expect(finalCanvas.height).toBeGreaterThan(0);
    expect(Number.isFinite(finalHistory.entries)).toBe(true);
  });
}
