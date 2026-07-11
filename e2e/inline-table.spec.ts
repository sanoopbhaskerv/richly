import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('inline table options toolbar (vanilla instance)', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();
    // Insert a 2×2 table — the caret lands in the first cell, selecting the table.
    await editor.clickButton('table');
    await editor.root.getByTestId('dd-table').getByTestId('grid-cell-1-1').click();
  });

  test('appears under the selected table and hides outside it', async () => {
    const bar = editor.root.getByTestId('table-inline-toolbar');
    await expect(bar).toBeVisible();

    // Positioned below the table, horizontally near its center.
    const tableBox = (await editor.content.locator('table').boundingBox())!;
    const barBox = (await bar.boundingBox())!;
    expect(barBox.y).toBeGreaterThan(tableBox.y + tableBox.height - 1);

    // Clicking a paragraph outside the table hides the bar. Click near the
    // paragraph's left edge — the bar is centered and click-transparent only
    // in its gaps, so the edge is guaranteed to be clear of its buttons.
    await editor.content
      .locator('p')
      .last()
      .click({ position: { x: 5, y: 5 } });
    await expect(bar).toBeHidden();
  });

  test('chains row and column edits without closing', async () => {
    const bar = editor.root.getByTestId('table-inline-toolbar');
    await bar.getByTestId('inline-table-action-row-after').click();
    await expect(editor.content.locator('tr')).toHaveCount(3);
    await expect(bar).toBeVisible(); // stays open for chained edits

    await bar.getByTestId('inline-table-action-col-after').click();
    await expect(editor.content.locator('tr').first().locator('td')).toHaveCount(3);

    await bar.getByTestId('inline-table-action-delete-row').click();
    await expect(editor.content.locator('tr')).toHaveCount(2);
  });

  test('opens the table properties dialog', async ({ page }) => {
    await editor.root
      .getByTestId('table-inline-toolbar')
      .getByTestId('inline-table-action-table-props')
      .click();
    await expect(page.getByTestId('dialog-tableprops')).toBeVisible();
    await page.getByTestId('dialog-cancel').click();
  });

  test('delete table removes it and hides the bar', async () => {
    const bar = editor.root.getByTestId('table-inline-toolbar');
    await bar.getByTestId('inline-table-action-delete-table').click();
    await expect(editor.content.locator('table')).toHaveCount(0);
    await expect(bar).toBeHidden();
  });
});
