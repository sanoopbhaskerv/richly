import { expect, type Page } from '@playwright/test';
import type { ImageStudioPage } from './imageStudioPage';

export interface InvariantViolation {
  readonly rule: string;
  readonly detail: string;
}

/**
 * Checks the global invariants that must hold after every user action, per the
 * exploratory/monkey testing charters. Returns violations instead of throwing
 * so callers (e.g. the monkey runner) can decide whether to stop immediately.
 */
export async function checkGlobalInvariants(
  page: Page,
  studio: ImageStudioPage
): Promise<InvariantViolation[]> {
  const violations: InvariantViolation[] = [];

  const rootVisible = await studio.root.isVisible().catch(() => false);
  if (!rootVisible) violations.push({ rule: 'editor-root-present', detail: 'root not visible' });

  const canvasCount = await page.locator('canvas').count();
  if (canvasCount < 1) violations.push({ rule: 'canvas-present', detail: `count=${canvasCount}` });

  const overflow = await studio.pageOverflow();
  if (overflow.scrollWidth > overflow.clientWidth + 1) {
    violations.push({
      rule: 'no-page-overflow',
      detail: `scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`
    });
  }

  if (canvasCount > 0) {
    const size = await studio.canvasSize();
    if (
      !Number.isFinite(size.width) ||
      !Number.isFinite(size.height) ||
      size.width <= 0 ||
      size.height <= 0
    ) {
      violations.push({ rule: 'finite-positive-output', detail: JSON.stringify(size) });
    }
  }

  const dialogCount = await page.getByRole('dialog').count();
  if (dialogCount > 1) {
    violations.push({ rule: 'single-modal-owner', detail: `dialog count=${dialogCount}` });
  }

  const bodyText = await page.evaluate(() => document.body.innerText);
  if (/\bNaN\b/.test(bodyText) || /\bundefined\b/.test(bodyText)) {
    violations.push({
      rule: 'no-nan-or-undefined-rendered',
      detail: 'found NaN/undefined in body text'
    });
  }

  return violations;
}

/** Asserts no invariant violations, formatting failures for readable test output. */
export async function assertGlobalInvariants(page: Page, studio: ImageStudioPage): Promise<void> {
  const violations = await checkGlobalInvariants(page, studio);
  expect(violations, `Invariant violations: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
}

/** Collects console errors and page errors raised while a callback runs. */
export async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  const onConsole = (msg: { type: () => string; text: () => string }): void => {
    if (msg.type() === 'error') errors.push(msg.text());
  };
  const onPageError = (error: Error): void => {
    errors.push(error.message);
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  return errors;
}
