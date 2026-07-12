import { expect, test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('inline text toolbar', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();
    await editor.type('hello brave world');
  });

  test('shows on text selection', async () => {
    await editor.selectWord('brave');
    const inline = editor.root.getByTestId('text-inline-toolbar');
    await expect(inline).toBeVisible();
  });

  test('applies bold from the inline toolbar', async () => {
    await editor.selectWord('brave');
    const inline = editor.root.getByTestId('text-inline-toolbar');
    await inline.getByTestId('inline-text-action-bold').click();
    await editor.expectContentMatches(/<strong>brave\s*<\/strong>/i);
  });

  test('applies italic from the inline toolbar', async () => {
    await editor.selectWord('brave');
    const inline = editor.root.getByTestId('text-inline-toolbar');
    await inline.getByTestId('inline-text-action-italic').click();
    await editor.expectContentMatches(/<em>brave\s*<\/em>/i);
  });

  test('opens and applies link from the inline toolbar', async ({ page }) => {
    await editor.selectWord('brave');
    const inline = editor.root.getByTestId('text-inline-toolbar');
    await inline.getByTestId('inline-text-action-link').click();

    await page.getByTestId('dialog-field-href').fill('https://example.com');
    await page.getByTestId('dialog-submit').click();
    await editor.expectContentMatches(/<a[^>]*href="https:\/\/example\.com"[^>]*>brave<\/a>/i);
  });

  test('applies h2 from the inline toolbar', async () => {
    await editor.selectWord('brave');
    const inline = editor.root.getByTestId('text-inline-toolbar');
    await inline.getByTestId('inline-text-action-h2').click();
    await editor.expectContentMatches(/<h2>.*brave.*<\/h2>/i);
  });

  test('applies h3 from the inline toolbar', async () => {
    await editor.selectWord('brave');
    const inline = editor.root.getByTestId('text-inline-toolbar');
    await inline.getByTestId('inline-text-action-h3').click();
    await editor.expectContentMatches(/<h3>.*brave.*<\/h3>/i);
  });

  test('applies blockquote from the inline toolbar', async () => {
    await editor.selectWord('brave');
    const inline = editor.root.getByTestId('text-inline-toolbar');
    await inline.getByTestId('inline-text-action-blockquote').click();
    await editor.expectContentContains('<blockquote>');
  });

  test('active styles highlight in the inline toolbar', async () => {
    await editor.selectWord('brave');
    const inline = editor.root.getByTestId('text-inline-toolbar');
    await inline.getByTestId('inline-text-action-bold').click();

    await editor.selectWord('brave');
    await expect(inline.getByTestId('inline-text-action-bold')).toHaveClass(/rly-active/);
  });

  test('hides when selection collapses away', async ({ page }) => {
    await editor.selectWord('brave');
    const inline = editor.root.getByTestId('text-inline-toolbar');
    await expect(inline).toBeVisible();

    await editor.placeCursorAtEnd();
    await page.evaluate(() => document.dispatchEvent(new Event('selectionchange')));
    await expect(inline).toBeHidden();
  });
});
