import { test, expect } from './support/fixtures';

test.describe('Image Studio shell', () => {
  test('loads with a valid default state and no console errors', async ({
    studio,
    consoleErrors
  }) => {
    await expect(studio.root).toBeVisible();
    await expect(studio.canvas).toBeVisible();
    await expect(studio.toolNav).toBeVisible();
    await expect(studio.inspector).toBeVisible();

    const size = await studio.canvasSize();
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);

    expect(consoleErrors).toEqual([]);
  });

  test('shows Adjust as the initial active tool', async ({ studio }) => {
    const adjustButton = studio.toolNav.getByRole('button', { name: 'Adjust', exact: true });
    await expect(adjustButton).toHaveClass(/ris-active/);
    await expect(studio.inspector.getByRole('heading', { name: 'Adjust' })).toBeVisible();
  });

  test('disables future tools without allowing activation', async ({ studio }) => {
    const filters = studio.toolNav.getByRole('button', { name: 'Filters', exact: true });
    await expect(filters).toBeDisabled();
    await filters.click({ force: true }).catch(() => undefined);
    // Disabled controls must not change the active tool.
    await expect(studio.inspector.getByRole('heading', { name: 'Adjust' })).toBeVisible();
  });

  test('undo/redo start disabled with no history', async ({ studio }) => {
    await expect(studio.undoButton).toBeDisabled();
    await expect(studio.redoButton).toBeDisabled();
  });

  test('has no unintended page overflow at default desktop size', async ({ studio }) => {
    const overflow = await studio.pageOverflow();
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test('produces a valid, usable state after a full page refresh', async ({ studio, page }) => {
    await studio.selectTool('Crop');
    await expect(studio.cropOverlay).toBeVisible();

    await page.reload();
    await studio.root.waitFor({ state: 'visible' });

    await expect(studio.canvas).toBeVisible();
    const size = await studio.canvasSize();
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
    await expect(studio.undoButton).toBeDisabled();
  });

  test('reports no failed required network requests', async ({ studio, page }) => {
    const failures: string[] = [];
    page.on('requestfailed', (request) => failures.push(request.url()));
    await page.reload();
    await studio.root.waitFor({ state: 'visible' });
    expect(failures).toEqual([]);
  });
});
