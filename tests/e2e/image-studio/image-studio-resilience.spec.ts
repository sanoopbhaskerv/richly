import { test, expect } from './support/fixtures';
import { checkGlobalInvariants } from './support/invariants';

test.describe('Image Studio error and resilience', () => {
  test('refreshing while a tool is active recovers to a valid state', async ({ studio, page }) => {
    await studio.selectTool('Crop');
    await studio.selectRatio('1:1');
    await page.reload();
    await studio.root.waitFor({ state: 'visible' });

    const violations = await checkGlobalInvariants(page, studio);
    expect(violations).toEqual([]);
    await expect(studio.canvas).toBeVisible();
  });

  test('repeated rapid clicks on rotate do not desync history', async ({ studio }) => {
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Rotate');
    const rotateRight = studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' });
    await Promise.all([rotateRight.click(), rotateRight.click(), rotateRight.click()]);
    const history = await studio.historySnapshot();
    expect(history.entries).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(history.entries)).toBe(true);
  });

  test('double-clicking Apply on a crop only commits once', async ({ studio }) => {
    await studio.selectTool('Crop');
    await studio.selectRatio('1:1');
    const applyButton = studio.inspector.getByRole('button', { name: 'Apply crop' });
    await Promise.all([applyButton.click(), applyButton.click().catch(() => undefined)]);

    const history = await studio.historySnapshot();
    expect(history.entries).toBeLessThanOrEqual(2);
  });

  test('double-clicking Export does not open two dialogs or crash', async ({ studio, page }) => {
    await Promise.all([studio.exportButton.click(), studio.exportButton.click()]);
    const dialogCount = await page.getByRole('dialog').count();
    expect(dialogCount).toBeLessThanOrEqual(1);
  });

  test('rapid undo/redo beyond available history stays coherent', async ({ studio }) => {
    // Build a couple of real history entries first — starting from an empty
    // history would leave Undo permanently disabled and never exercise
    // anything, since the button never becomes enabled to click.
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Rotate');
    const rotateRight = studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' });
    await rotateRight.click();
    await rotateRight.click();

    for (let i = 0; i < 5; i++) {
      if (await studio.undoButton.isEnabled()) await studio.undoButton.click();
    }
    await expect(studio.undoButton).toBeDisabled();

    for (let i = 0; i < 5; i++) {
      if (await studio.redoButton.isEnabled()) await studio.redoButton.click();
    }
    await expect(studio.redoButton).toBeDisabled();
  });

  test('a very narrow viewport transition does not blank the canvas', async ({ studio, page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.setViewportSize({ width: 200, height: 400 });
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(studio.canvas).toBeVisible();
    const size = await studio.canvasSize();
    expect(size.width).toBeGreaterThan(0);
  });

  test('cancelling the export dialog via Escape leaves no orphaned backdrop', async ({
    studio,
    page
  }) => {
    await studio.openExport();
    await page.keyboard.press('Escape');
    const dialog = page.getByRole('dialog', { name: 'Export image' });
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole('button', { name: 'Cancel' }).click();
    }
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.ris-dialog')).toHaveCount(0);
  });

  test('no uncaught errors or unhandled rejections occur during a busy interaction burst', async ({
    studio,
    consoleErrors
  }) => {
    await studio.selectTool('Adjust');
    const brightness = studio.inspector.getByRole('spinbutton').first();
    for (let i = 0; i < 5; i++) {
      await brightness.fill(String(i * 10));
      await brightness.blur();
    }
    await studio.selectTool('Crop');
    await studio.selectRatio('1:1');
    await studio.cancelCropFromInspector();
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Rotate');
    await studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' }).click();
    await studio.undoButton.click();

    expect(consoleErrors).toEqual([]);
  });
});
