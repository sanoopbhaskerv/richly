import { expect, test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('sliding toolbar mode', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 545, height: 760 });
    editor = new EditorPage(page, 'reditor-clean');
    await editor.goto();
  });

  test('expands overflow inline and collapses without overlaying editor content', async () => {
    const more = editor.button('more');
    const drawer = editor.root.getByTestId('toolbar-sliding-drawer');
    const primary = editor.toolbar.getByTestId('toolbar-primary');
    const collapsedToolbar = (await editor.toolbar.boundingBox())!;
    const collapsedRoot = (await editor.root.boundingBox())!;
    const collapsedContent = (await editor.content.boundingBox())!;

    expect(collapsedToolbar.height).toBeLessThan(50);
    await expect(primary.getByTestId('tb-undo')).toBeVisible();
    await expect(primary.getByTestId('tb-redo')).toBeVisible();
    await expect(primary.getByTestId('tb-bold')).toBeVisible();
    await expect(primary.getByTestId('tb-italic')).toBeVisible();
    expect(await more.getAttribute('aria-haspopup')).toBeNull();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(drawer).toBeHidden();

    const overflowDuringExpansion = await more.evaluate((button) => {
      button.click();
      const drawerId = button.getAttribute('aria-controls')!;
      const content = document
        .getElementById(drawerId)!
        .querySelector<HTMLElement>('[data-testid="toolbar-sliding-content"]')!;
      return getComputedStyle(content).overflow;
    });
    expect(overflowDuringExpansion).toBe('hidden');
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(more).toHaveAttribute('aria-label', 'Hide more tools');
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await expect(drawer).toBeVisible();
    await expect
      .poll(() =>
        drawer
          .getByTestId('toolbar-sliding-content')
          .evaluate((element) => getComputedStyle(element).overflow)
      )
      .toBe('visible');
    await expect.poll(async () => (await editor.toolbar.boundingBox())!.height).toBeGreaterThan(70);

    const expandedToolbar = (await editor.toolbar.boundingBox())!;
    const expandedRoot = (await editor.root.boundingBox())!;
    const expandedContent = (await editor.content.boundingBox())!;
    const primaryBox = (await primary.boundingBox())!;
    const drawerBox = (await drawer.boundingBox())!;
    expect(primaryBox.height).toBeLessThan(40);
    expect(drawerBox.x).toBeGreaterThanOrEqual(expandedToolbar.x - 1);
    expect(drawerBox.x + drawerBox.width).toBeLessThanOrEqual(
      expandedToolbar.x + expandedToolbar.width + 1
    );
    expect(expandedContent.y - expandedRoot.y).toBeGreaterThan(
      collapsedContent.y - collapsedRoot.y
    );

    await more.click();
    await expect(drawer).toBeHidden();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => (await editor.toolbar.boundingBox())!.height).toBeLessThan(50);
  });

  test('keeps an open drawer through responsive redistribution and removes it when all tools fit', async ({
    page
  }) => {
    await page.evaluate(() => {
      const wrap = document.querySelector<HTMLElement>('.wrap')!;
      wrap.style.display = 'block';
      wrap.style.maxWidth = 'none';
    });
    const more = editor.button('more');
    const drawer = editor.root.getByTestId('toolbar-sliding-drawer');

    await expect(more).toBeVisible();
    await more.click();
    await expect(drawer).toBeVisible();

    await page.setViewportSize({ width: 900, height: 760 });
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer).toBeVisible();

    await page.setViewportSize({ width: 1800, height: 760 });
    await expect(more).toBeHidden();
    await expect(drawer).toBeHidden();
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(editor.button('removeformat')).toBeVisible();
    await expect(
      editor.toolbar.getByTestId('toolbar-primary').getByTestId('tb-removeformat')
    ).toBeVisible();
    expect((await editor.toolbar.boundingBox())!.height).toBeLessThan(50);
  });

  test('settles on the final grid width during continuous viewport resizing', async ({ page }) => {
    const primary = editor.toolbar.getByTestId('toolbar-primary');
    const drawer = editor.root.getByTestId('toolbar-sliding-drawer');

    for (const width of [700, 1500, 760, 1420, 810, 1360, 900, 1280]) {
      await page.setViewportSize({ width, height: 760 });
    }

    await expect(primary.getByTestId('tb-undo')).toBeVisible();
    await expect(primary.getByTestId('tb-redo')).toBeVisible();
    await expect(primary.getByTestId('tb-bold')).toBeVisible();
    await expect(primary.getByTestId('tb-italic')).toBeVisible();
    await expect(drawer.getByTestId('tb-bold')).toHaveCount(0);
    await expect(drawer.getByTestId('tb-forecolor')).toHaveCount(1);
  });

  test('retains fitting groups in a fractional two-column grid track', async ({ page }) => {
    await page.setViewportSize({ width: 1415, height: 900 });
    const primary = editor.toolbar.getByTestId('toolbar-primary');
    const toolbarBox = (await editor.toolbar.boundingBox())!;

    expect(toolbarBox.width).toBeGreaterThan(630);
    expect(toolbarBox.width).toBeLessThan(631);
    await expect(primary.getByTestId('tb-undo')).toBeVisible();
    await expect(primary.getByTestId('tb-bold')).toBeVisible();
    await expect(primary.getByTestId('tb-selectall')).toBeVisible();
    await expect(primary.getByTestId('tb-underline')).toBeVisible();
  });

  test('uses the resolved grid width on repeated React StrictMode initial loads', async ({
    page
  }) => {
    for (let load = 0; load < 5; load++) {
      await page.reload();
      const root = page.getByTestId('reditor-clean-root');
      const primary = root.getByTestId('toolbar-primary');

      await expect(root).toHaveCount(1);
      await expect(primary.getByTestId('tb-undo')).toBeVisible();
      await expect(primary.getByTestId('tb-redo')).toBeVisible();
      await expect(primary.getByTestId('tb-bold')).toBeVisible();
      await expect(primary.getByTestId('tb-italic')).toBeVisible();
    }
  });

  test('supports disclosure keyboard navigation and restores focus on Escape', async ({ page }) => {
    const more = editor.button('more');
    const drawer = editor.root.getByTestId('toolbar-sliding-drawer');
    const firstDrawerControl = drawer.getByTestId(/^tb-/).first();

    await more.focus();
    await page.keyboard.press('ArrowRight');
    await expect(editor.button('undo')).toBeFocused();

    await more.focus();
    await page.keyboard.press('Enter');
    await expect(drawer).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(firstDrawerControl).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
  });

  test('preserves selection for an overflow color panel and stays contained on a narrow screen', async ({
    page
  }) => {
    await editor.clear();
    await editor.type('sliding target');
    await editor.selectWord('target');

    await editor.button('more').click();
    const drawer = editor.root.getByTestId('toolbar-sliding-drawer');
    await expect(drawer.getByTestId('tb-forecolor')).toBeVisible();
    await drawer.getByTestId('tb-forecolor').click();
    const colorPanel = editor.root.getByTestId('dd-forecolor');
    await page.setViewportSize({ width: 360, height: 760 });
    await expect(colorPanel).toBeVisible();
    await expect
      .poll(async () => (await colorPanel.boundingBox())?.x ?? Number.NEGATIVE_INFINITY)
      .toBeGreaterThanOrEqual(8);
    const colorPanelBox = (await colorPanel.boundingBox())!;
    expect(colorPanelBox.x).toBeGreaterThanOrEqual(8);
    expect(colorPanelBox.x + colorPanelBox.width).toBeLessThanOrEqual(352);
    await colorPanel.getByTestId('swatch-a855f7').click();
    await editor.expectContentMatches(/color:\s*(#a855f7|rgb\(168,\s*85,\s*247\))/i);

    await page.setViewportSize({ width: 320, height: 760 });
    await expect(drawer).toBeVisible();
    const rootBox = (await editor.root.boundingBox())!;
    const drawerBox = (await drawer.boundingBox())!;
    expect(drawerBox.x).toBeGreaterThanOrEqual(rootBox.x - 1);
    expect(drawerBox.x + drawerBox.width).toBeLessThanOrEqual(rootBox.x + rootBox.width + 1);
    expect(drawerBox.x + drawerBox.width).toBeLessThanOrEqual(320);
  });

  test('disables drawer animation when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const drawer = editor.root.getByTestId('toolbar-sliding-drawer');
    await expect
      .poll(() => drawer.evaluate((element) => getComputedStyle(element).transitionDuration))
      .toBe('0s');
  });
});
