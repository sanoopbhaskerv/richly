import { defineConfig, devices } from '@playwright/test';

declare const process: {
  env: Record<string, string | undefined>;
};

const PORT = 5178;
const baseURL = process.env.IMAGE_STUDIO_BASE_URL ?? `http://localhost:${PORT}/`;

export default defineConfig({
  testDir: './tests/e2e/image-studio',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  outputDir: './test-results/image-studio',
  reporter: [['html', { outputFolder: './playwright-report/image-studio', open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // Without this, most locator actions (boundingBox, click, etc.) have no
    // default timeout at all and can hang indefinitely when a locator never
    // resolves to a visible element, rather than rejecting so a test's own
    // error handling can react.
    actionTimeout: 10_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      testMatch: /image-studio-(responsive|monkey)\.spec\.ts/
    }
  ],
  webServer: {
    command: 'yarn workspace @richly/image-studio-demo dev --host 127.0.0.1 --port 5178',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000
  }
});
