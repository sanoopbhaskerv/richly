import { expect, test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('blockquote styling opt-out', () => {
  test('default: Richly applies its accent-bordered blockquote styling', async ({ page }) => {
    const editor = new EditorPage(page, 'editor-clean');
    await editor.goto();
    await editor.clear();
    await editor.type('quoted text');
    await editor.selectWord('quoted');
    await editor.button('blockquote').click();

    const bq = editor.content.locator('blockquote');
    await expect(bq).toBeVisible();
    const borderLeftWidth = await bq.evaluate((el) => getComputedStyle(el).borderLeftWidth);
    expect(borderLeftWidth).not.toBe('0px');
  });

  test('blockquoteStyle: false omits the default styling hook', async ({ page }) => {
    await page.goto('/?noBlockquoteStyle');
    const editor = new EditorPage(page, 'editor-clean');
    await expect(editor.content).toBeVisible();
    await editor.clear();
    await editor.type('quoted text');
    await editor.selectWord('quoted');
    await editor.button('blockquote').click();

    const bq = editor.content.locator('blockquote');
    await expect(bq).toBeVisible();
    await expect(editor.content).not.toHaveClass(/rly-blockquote-styled/);
    const borderLeftWidth = await bq.evaluate((el) => getComputedStyle(el).borderLeftWidth);
    expect(borderLeftWidth).toBe('0px');
  });
});
