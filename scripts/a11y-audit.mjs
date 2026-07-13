import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const url = process.env.RICHLY_DEMO_URL ?? 'http://127.0.0.1:5181';
const shouldStartServer = !process.env.RICHLY_DEMO_URL;
let server;

const waitForDemo = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The demo is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for the Richly demo at ${url}`);
};

const formatViolation = (violation) => {
  const nodes = violation.nodes
    .map((node) => `    ${node.target.join(' ')}\n      ${node.failureSummary ?? node.html}`)
    .join('\n');
  return `  ${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n${nodes}`;
};

const scan = async (page, name) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  if (results.violations.length) {
    throw new Error(
      `${name}: ${results.violations.length} accessibility violation(s)\n${results.violations
        .map(formatViolation)
        .join('\n')}`
    );
  }
  console.log(`\u2713 ${name}`);
};

try {
  console.log(`Auditing ${url}`);
  if (shouldStartServer) {
    server = spawn(
      'yarn',
      [
        'workspace',
        '@richly/demo',
        'run',
        'vite',
        '--host',
        '127.0.0.1',
        '--port',
        '5181',
        '--strictPort'
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' },
        detached: process.platform !== 'win32'
      }
    );
    server.stdout.on('data', () => {});
    server.stderr.on('data', () => {});
  }

  await waitForDemo();
  console.log('Demo is ready; launching Chromium.');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    await scan(page, 'Demo: default state');

    const primaryEditor = page.getByTestId('editor-root');
    const formatMenu = primaryEditor.getByTestId('menu-format');
    await formatMenu.click();
    await scan(page, 'Demo: open menubar menu');
    await formatMenu.press('Escape');

    await primaryEditor.getByTestId('tb-link').click();
    await scan(page, 'Demo: modal dialog');
    await page.keyboard.press('Escape');

    await primaryEditor.getByTestId('tb-forecolor').click();
    await scan(page, 'Demo: color palette');
    await primaryEditor.getByTestId('dd-forecolor').getByTestId('custom-color').click();
    await scan(page, 'Demo: advanced color picker');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    const slidingToolbar = page.getByTestId('reditor-clean-root');
    await slidingToolbar.getByTestId('tb-more').click();
    const slidingDrawer = await slidingToolbar
      .getByTestId('toolbar-sliding-drawer')
      .elementHandle();
    if (!slidingDrawer) throw new Error('Sliding toolbar drawer was not rendered.');
    try {
      await page.waitForFunction(
        (drawer) => drawer.classList.contains('rly-expanded'),
        slidingDrawer
      );
    } finally {
      await slidingDrawer.dispose();
    }
    await scan(page, 'Demo: open sliding toolbar drawer');
    await page.keyboard.press('Escape');

    console.log('Accessibility audit passed.');
  } finally {
    await browser.close();
  }
} finally {
  if (server && server.exitCode === null) {
    if (process.platform === 'win32') server.kill('SIGTERM');
    else process.kill(-server.pid, 'SIGTERM');
    await new Promise((resolve) => {
      server.once('exit', resolve);
      setTimeout(resolve, 2_000);
    });
  }
}
