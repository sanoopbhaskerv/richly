import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('lists, indent, alignment (vanilla instance)', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();
  });

  test('bullet list from typed paragraphs, then Tab nests', async ({ page }) => {
    await editor.type('alpha');
    await page.keyboard.press('Enter');
    await page.keyboard.type('beta');

    await editor.selectAll();
    await editor.clickButton('bullist');
    await editor.expectContentMatches(/<ul><li>alpha<\/li><li>beta<\/li><\/ul>/);
    await editor.expectButtonActive('bullist', true);

    // Caret is in the list — Tab nests the item under its previous sibling.
    await editor.selectWord('beta');
    await page.keyboard.press('Tab');
    await editor.expectContentMatches(/<li>alpha<ul><li>beta<\/li><\/ul><\/li>/);

    await page.keyboard.press('Shift+Tab');
    await editor.expectContentMatches(/<ul><li>alpha<\/li><li>beta<\/li><\/ul>/);
  });

  test('numbered list toggle and switch', async () => {
    await editor.type('one');
    await editor.selectWord('one');
    await editor.clickButton('numlist');
    await editor.expectContentMatches(/<ol><li>one<\/li><\/ol>/);
    await editor.expectButtonActive('numlist', true);

    await editor.clickButton('bullist'); // switch type in place
    await editor.expectContentMatches(/<ul><li>one<\/li><\/ul>/);
    await editor.expectButtonActive('bullist', true);
    await editor.expectButtonActive('numlist', false);

    await editor.clickButton('bullist'); // toggle off
    await editor.expectContentMatches(/<p>one<\/p>/);
  });

  test('alignment buttons set text-align and track state', async () => {
    await editor.type('centered text');
    await editor.selectWord('centered');
    await editor.clickButton('aligncenter');
    await editor.expectContentMatches(/text-align:\s*center/);
    await editor.expectButtonActive('aligncenter', true);

    await editor.clickButton('alignleft');
    await editor.expectButtonActive('alignleft', true);
    const html = await editor.content.innerHTML();
    expect(html).not.toContain('text-align');
  });

  test('indent/outdent step block padding', async () => {
    await editor.type('indented');
    await editor.clickButton('indent');
    await editor.expectContentMatches(/padding-left:\s*40px/);
    await editor.clickButton('outdent');
    const html = await editor.content.innerHTML();
    expect(html).not.toContain('padding-left');
  });

  test('bold with collapsed cursor formats the next typed text', async ({ page }) => {
    await editor.type('before after');
    // Place caret (collapsed) inside the text, then toggle bold and type.
    await editor.selectWord('before');
    await page.keyboard.press('ArrowRight'); // collapse selection
    await editor.clickButton('bold');
    await editor.expectButtonActive('bold', true);
    await page.keyboard.type('BOLD');
    await editor.expectContentMatches(/<strong>BOLD<\/strong>/);
  });
});
