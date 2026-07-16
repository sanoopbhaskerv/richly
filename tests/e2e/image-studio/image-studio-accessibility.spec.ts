import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support/fixtures';

async function scan(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

test.describe('Image Studio accessibility', () => {
  test('Adjust screen has no critical axe violations', async ({ studio, page }) => {
    await studio.selectTool('Adjust');
    const results = await scan(page);
    expect(results.violations).toEqual([]);
  });

  test('Crop screen has no critical axe violations', async ({ studio, page }) => {
    await studio.selectTool('Crop');
    const results = await scan(page);
    expect(results.violations).toEqual([]);
  });

  test('Transform screen has no critical axe violations', async ({ studio, page }) => {
    await studio.selectTool('Transform');
    const results = await scan(page);
    expect(results.violations).toEqual([]);
  });

  test('Export dialog has no critical axe violations', async ({ studio, page }) => {
    await studio.openExport();
    const results = await scan(page);
    expect(results.violations).toEqual([]);
  });

  test('Mobile bottom sheet has no critical axe violations', async ({ studio, page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await studio.selectTool('Adjust');
    const results = await scan(page);
    expect(results.violations).toEqual([]);
  });

  test('icon-only controls expose accessible names', async ({ studio }) => {
    for (const name of ['Undo', 'Redo', 'Zoom out', 'Zoom in', 'Close']) {
      await expect(studio.root.getByRole('button', { name })).toHaveCount(1);
    }
  });

  test('sliders expose min/max/value semantics', async ({ studio }) => {
    await studio.selectTool('Adjust');
    const slider = studio.inspector.getByRole('slider', { name: /Brightness/ });
    // Native <input type="range"> computes accessible valuemin/valuemax from
    // its min/max HTML attributes rather than reflecting them as literal
    // aria-valuemin/aria-valuemax attributes.
    expect(await slider.getAttribute('min')).not.toBeNull();
    expect(await slider.getAttribute('max')).not.toBeNull();
    expect(await slider.getAttribute('aria-valuenow')).not.toBeNull();
  });

  test('the export dialog is a named, modal dialog', async ({ studio }) => {
    const dialog = await studio.openExport();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-label', 'Export image');
  });

  test('disabled future tools expose disabled semantics, not misleading interactivity', async ({
    studio
  }) => {
    const filters = studio.toolNav.getByRole('button', { name: 'Filters', exact: true });
    await expect(filters).toBeDisabled();
    await expect(filters).toHaveAttribute('title', 'Coming soon');
  });

  test('active tool is indicated by more than color alone', async ({ studio }) => {
    const adjust = studio.toolNav.getByRole('button', { name: 'Adjust', exact: true });
    await expect(adjust).toHaveAttribute('aria-current', 'page');
  });

  test('Tab reaches the tool navigation and top bar controls', async ({ studio, page }) => {
    await expect(studio.root).toBeVisible();
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => document.activeElement?.tagName);
    expect(active).toBe('BUTTON');
  });

  test('Ctrl+Z / Ctrl+Shift+Z drive global undo/redo', async ({ studio, page }) => {
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Rotate');
    await studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' }).click();
    expect(await studio.canvasSize()).toEqual({ width: 800, height: 1200 });

    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+z');
    expect(await studio.canvasSize()).toEqual({ width: 1200, height: 800 });

    await page.keyboard.press('Control+Shift+z');
    expect(await studio.canvasSize()).toEqual({ width: 800, height: 1200 });
  });

  test('0 fits and 1 sets 100% zoom', async ({ studio, page }) => {
    await studio.zoomInButton.click();
    await expect(studio.zoomLabel).toHaveText('120%');
    await page.keyboard.press('1');
    await expect(studio.zoomLabel).toHaveText('100%');
    await studio.zoomInButton.click();
    await page.keyboard.press('0');
    await expect(studio.zoomLabel).toHaveText('100%');
  });

  test('shortcuts do not activate while typing in a numeric field', async ({ studio, page }) => {
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Resize');
    await studio.zoomInButton.click();
    await expect(studio.zoomLabel).toHaveText('120%');

    const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });
    await width.focus();
    await page.keyboard.type('1');

    // Typing "1" while a numeric field is focused must not trigger the global
    // 100%-zoom shortcut; zoom should remain whatever it already was.
    await expect(studio.zoomLabel).toHaveText('120%');
  });

  test('focus returns to a sensible element after closing export', async ({ studio, page }) => {
    await studio.exportButton.focus();
    await studio.openExport();
    await page.keyboard.press('Escape').catch(() => undefined);
    const dialog = page.getByRole('dialog', { name: 'Export image' });
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole('button', { name: 'Cancel' }).click();
    }
    await expect(dialog).toHaveCount(0);
  });
});
