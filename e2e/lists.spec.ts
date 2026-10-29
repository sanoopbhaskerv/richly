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
    await editor.clickButton('bulliststyles');
    await editor.expectContentMatches(/<ul><li>alpha<\/li><li>beta<\/li><\/ul>/);
    await editor.expectChoiceActive('bulliststyles', 'disc', true);

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
    await editor.clickButton('numliststyles');
    await editor.expectContentMatches(/<ol><li>one<\/li><\/ol>/);
    await editor.expectChoiceActive('numliststyles', 'decimal', true);

    await editor.clickButton('bulliststyles'); // switch type in place
    await editor.expectContentMatches(/<ul><li>one<\/li><\/ul>/);
    await editor.expectChoiceActive('bulliststyles', 'disc', true);

    await editor.clickButton('bulliststyles'); // toggle off
    await editor.expectContentMatches(/<p>one<\/p>/);
  });

  for (const { control, marker, tag } of [
    { control: 'bulliststyles', marker: 'disc', tag: 'ul' },
    { control: 'numliststyles', marker: 'decimal', tag: 'ol' }
  ]) {
    test(`${marker} markers survive host CSS resets in edit mode`, async ({ page }) => {
      await page.addStyleTag({
        content:
          'ul, ol { list-style: none; padding: 0; margin: 0; } li { display: block; list-style: none; }'
      });
      await editor.type('first');
      await page.keyboard.press('Enter');
      await page.keyboard.type('second');
      await editor.selectAll();
      await editor.clickButton(control);

      const list = editor.content.locator(tag);
      const item = list.locator('li').first();
      await expect(list).toHaveCSS('list-style-type', marker);
      await expect(item).toHaveCSS('display', 'list-item');
      await expect(item).toHaveCSS('list-style-type', marker);
      await expect(item).toHaveCSS('list-style-position', 'outside');
      expect(
        await list.evaluate((el) => parseFloat(getComputedStyle(el).paddingInlineStart))
      ).toBeGreaterThan(20);

      await editor.selectWord('second');
      await page.keyboard.press('Tab');
      await expect(editor.content.locator(`${tag} ${tag} > li`)).toHaveCSS(
        'list-style-type',
        marker
      );
      // Explicit alternatives must still override the theme's defaults.
      const alternative = tag === 'ul' ? 'square' : 'upper-roman';
      await editor.choose(control, alternative, true);
      await expect(editor.content.locator(`${tag} ${tag} > li`)).toHaveCSS(
        'list-style-type',
        alternative
      );
    });
  }

  test('alignment buttons set text-align and track state', async () => {
    await editor.type('centered text');
    await editor.selectWord('centered');
    await editor.choose('alignment', 'center');
    await editor.expectContentMatches(/text-align:\s*center/);
    await editor.expectChoiceActive('alignment', 'center');

    await editor.choose('alignment', 'left');
    await editor.expectChoiceActive('alignment', 'left');
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
