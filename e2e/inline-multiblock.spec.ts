import { expect, test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('inline formatting across block boundaries', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
  });

  test('select-all + Bold formats each block without corrupting structure', async ({ page }) => {
    // Reproduces the reported bug: bolding a selection that spans a heading,
    // a paragraph, and a list used to wrap the blocks in one <strong> and add
    // a stray empty <li>.
    await editor.content.evaluate((el) => {
      el.innerHTML = '<h1>Title</h1><p>Body</p><ul><li>one</li><li>two</li></ul>';
    });
    await editor.content.click();
    await page.keyboard.press('ControlOrMeta+a');
    await editor.clickButton('bold');

    // No inline element may contain a block element.
    const malformed = await editor.content.evaluate(
      (el) => el.querySelectorAll('strong p, strong h1, strong li, strong ul').length
    );
    expect(malformed).toBe(0);

    // Structure preserved: still exactly two list items, no stray empty one.
    await expect(editor.content.locator('li')).toHaveCount(2);
    await editor.expectContentContains('<strong>Title</strong>');
    await editor.expectContentContains('<strong>one</strong>');
  });
});
