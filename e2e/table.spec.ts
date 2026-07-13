import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('table, image, source view, fullscreen (vanilla instance)', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();
  });

  test('insert 3×2 table via grid picker and type into a cell', async ({ page }) => {
    await editor.clickButton('table');
    const dd = editor.root.getByTestId('dd-table');
    await expect(dd).toBeVisible();
    await dd.getByTestId('grid-cell-1-2').hover(); // 2 rows × 3 cols
    await dd.getByTestId('grid-cell-1-2').click();

    const table = editor.content.locator('table');
    await expect(table.locator('tr')).toHaveCount(2);
    await expect(table.locator('tr').first().locator('td')).toHaveCount(3);

    const cells = table.locator('tr').first().locator('td');
    const widthsBefore = await cells.evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().width)
    );
    await page.keyboard.type('cell text'); // caret starts in first cell
    await editor.expectContentMatches(/<td>cell text/);
    const widthsAfter = await cells.evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().width)
    );
    widthsAfter.forEach((width, index) => expect(width).toBeCloseTo(widthsBefore[index]!, 0));

    const longWordCell = cells.nth(1);
    const heightBeforeLongWord = (await longWordCell.boundingBox())!.height;
    await longWordCell.click();
    await page.keyboard.type('averyveryveryveryveryveryveryveryveryveryverylongsingleword');
    const cellAfterLongWord = (await longWordCell.boundingBox())!;
    expect(cellAfterLongWord.width).toBeGreaterThan(widthsBefore[1]! + 50);
    expect(cellAfterLongWord.height).toBeCloseTo(heightBeforeLongWord, 0);
  });

  test('Tab navigates cells; table menu adds a row below', async ({ page }) => {
    await editor.clickButton('table');
    await editor.root.getByTestId('dd-table').getByTestId('grid-cell-0-1').click(); // 1×2
    await page.keyboard.type('A');
    await page.keyboard.press('Tab');
    await page.keyboard.type('B');
    await editor.expectContentMatches(/<td>A<\/td><td>B/);

    await editor.root.getByTestId('menu-table').click();
    await editor.root.getByTestId('menuitem-rowbelow').click();
    await expect(editor.content.locator('tr')).toHaveCount(2);
  });

  test('insert image via dialog', async ({ page }) => {
    await editor.type('img: ');
    await editor.clickButton('image');
    await expect(page.getByTestId('dialog-image')).toBeVisible();
    await page.getByTestId('dialog-field-src').fill('https://example.com/pic.png');
    await page.getByTestId('dialog-field-alt').fill('a picture');
    await page.getByTestId('dialog-submit').click();
    await editor.expectContentMatches(
      /<img src="https:\/\/example\.com\/pic\.png" alt="a picture">/
    );
  });

  test('source code view edits raw HTML', async ({ page }) => {
    await editor.type('replace me');
    await editor.clickButton('code');
    const area = page.getByTestId('dialog-field-code');
    await expect(area).toBeVisible();
    await area.fill('<h2>from source view</h2>');
    await page.getByTestId('dialog-submit').click();
    await editor.expectContentContains('<h2>from source view</h2>');
  });

  test('fullscreen toggles on and off', async () => {
    await editor.clickButton('fullscreen');
    await expect(editor.root).toHaveClass(/rly-fullscreen/);
    await editor.clickButton('fullscreen');
    await expect(editor.root).not.toHaveClass(/rly-fullscreen/);
  });
});
