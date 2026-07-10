import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('editor + table resize, table/cell properties (vanilla instance)', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();
  });

  test('statusbar grip resizes the editor content area', async ({ page }) => {
    const before = (await editor.content.boundingBox())!;
    const grip = editor.root.getByTestId('status-resize');
    const g = (await grip.boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2 + 150, { steps: 5 });
    await page.mouse.up();
    const after = (await editor.content.boundingBox())!;
    expect(after.height).toBeGreaterThan(before.height + 100);
  });

  test('dragging a cell border resizes the column', async ({ page }) => {
    await editor.clickButton('table');
    await editor.root.getByTestId('dd-table').getByTestId('grid-cell-0-1').click(); // 1×2
    const firstCell = editor.content.locator('td').first();
    const box = (await firstCell.boundingBox())!;
    const startWidth = box.width;

    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2 - 60, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();

    const newBox = (await firstCell.boundingBox())!;
    expect(newBox.width).toBeLessThan(startWidth - 30);
    await editor.expectContentMatches(/table-layout:\s*fixed/);
  });

  test('selected table has a clean resize frame and corner handle', async ({ page }) => {
    await editor.clickButton('table');
    await editor.root.getByTestId('dd-table').getByTestId('grid-cell-1-1').click();
    const table = editor.content.locator('table');
    const before = (await table.boundingBox())!;
    const handle = editor.root.getByTestId('table-resize-xy');
    await expect(handle).toBeVisible();
    const h = (await handle.boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 + 70, h.y + h.height / 2 + 55, { steps: 5 });
    await page.mouse.up();
    const after = (await table.boundingBox())!;
    expect(after.width).toBeGreaterThan(before.width + 50);
    expect(after.height).toBeGreaterThan(before.height + 35);
    await editor.expectContentMatches(/width:\s*\d+px/);
    await editor.expectContentMatches(/height:\s*\d+px/);
  });

  test('table properties dialog: width, striped, caption', async ({ page }) => {
    await editor.clickButton('table');
    await editor.root.getByTestId('dd-table').getByTestId('grid-cell-1-1').click(); // 2×2

    await editor.root.getByTestId('menu-table').click();
    await editor.root.getByTestId('menuitem-tableprops').click();
    const dialog = page.getByTestId('dialog-tableprops');
    await expect(dialog).toBeVisible();

    await page.getByTestId('dialog-field-width').fill('60%');
    await page.getByTestId('dialog-field-striped').check();
    await page.getByTestId('dialog-field-caption').check();
    await page.getByTestId('dialog-submit').click();

    await editor.expectContentMatches(/width:\s*60%/);
    await editor.expectContentMatches(/class="rly-striped"/);
    await editor.expectContentContains('<caption>');
  });

  test('cell properties dialog converts a cell to header', async ({ page }) => {
    await editor.clickButton('table');
    await editor.root.getByTestId('dd-table').getByTestId('grid-cell-0-1').click(); // 1×2
    await page.keyboard.type('Name');

    await editor.root.getByTestId('menu-table').click();
    await editor.root.getByTestId('menuitem-cellprops').click();
    await expect(page.getByTestId('dialog-cellprops')).toBeVisible();
    await page.getByTestId('dialog-field-type').selectOption('th');
    await page.getByTestId('dialog-submit').click();

    await editor.expectContentMatches(/<th>Name<\/th>/);
  });

  test('contextual panel opens row properties and creates a semantic header', async ({ page }) => {
    await editor.clickButton('table');
    await editor.root.getByTestId('dd-table').getByTestId('grid-cell-1-1').click();
    await page.keyboard.type('Heading');

    await editor.clickButton('table');
    await editor.root.getByTestId('dd-table').getByTestId('table-action-row-props').click();
    await expect(page.getByTestId('dialog-rowprops')).toBeVisible();
    await page.getByTestId('dialog-field-section').selectOption('head');
    await page.getByTestId('dialog-field-height').fill('52');
    await page.getByTestId('dialog-submit').click();

    await expect(editor.content.locator('thead')).toHaveCount(1);
    await expect(editor.content.locator('thead th')).toHaveCount(2);
    await editor.expectContentMatches(/height:\s*52px/);
  });

  test('right-click opens the same table actions at the pointer', async ({ page }) => {
    await editor.clickButton('table');
    await editor.root.getByTestId('dd-table').getByTestId('grid-cell-1-1').click();
    const firstCell = editor.content.locator('td').first();

    await firstCell.click({ button: 'right' });
    const menu = editor.root.getByTestId('table-context-menu');
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

    await menu.getByTestId('context-table-action-row-after').click();
    await expect(editor.content.locator('tr')).toHaveCount(3);
    await expect(menu).toBeHidden();

    await firstCell.click({ button: 'right' });
    await menu.getByTestId('context-table-action-table-props').click();
    await expect(page.getByTestId('dialog-tableprops')).toBeVisible();
    await page.getByTestId('dialog-cancel').click();
  });
});
