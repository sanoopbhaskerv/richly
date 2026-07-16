import { test as base, expect } from '@playwright/test';
import { ImageStudioPage } from './imageStudioPage';

export interface ImageStudioFixtures {
  studio: ImageStudioPage;
  consoleErrors: string[];
}

/**
 * Extends the base Playwright test with an `ImageStudioPage` object and a
 * running list of console/page errors captured for the lifetime of the test.
 * Individual specs assert `consoleErrors` is empty where that is a
 * requirement (most functional charters); resilience tests may inspect it
 * directly instead of asserting emptiness.
 */
export const test = base.extend<ImageStudioFixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
  },
  studio: async ({ page }, use) => {
    const studio = new ImageStudioPage(page);
    await studio.goto('/');
    await use(studio);
  }
});

export { expect };
