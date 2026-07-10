import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('basic formatting (vanilla instance)', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();
    await editor.type('hello brave world');
  });

  test('bold via toolbar button', async () => {
    await editor.selectWord('brave');
    await editor.clickButton('bold');
    await editor.expectContentMatches(/<strong>brave\s*<\/strong>/);
    await editor.expectButtonActive('bold', true);
  });

  test('bold toggles off', async () => {
    await editor.selectWord('brave');
    await editor.clickButton('bold');
    await editor.selectWord('brave');
    await editor.clickButton('bold');
    await editor.expectButtonActive('bold', false);
    const html = await editor.content.innerHTML();
    expect(html).not.toContain('<strong>');
  });

  test('bold via keyboard shortcut', async ({ page }) => {
    await editor.selectWord('brave');
    await page.keyboard.press('ControlOrMeta+b');
    await editor.expectContentMatches(/<strong>brave\s*<\/strong>/);
  });

  test('toolbar active state tracks the cursor', async () => {
    await editor.selectWord('brave');
    await editor.clickButton('bold');
    await editor.selectWord('hello'); // plain word
    await editor.expectButtonActive('bold', false);
    await editor.selectWord('brave');
    await editor.expectButtonActive('bold', true);
  });

  test('heading + statusbar element path and word count', async () => {
    await editor.selectWord('hello');
    await editor.clickButton('h1');
    await editor.expectContentContains('<h1>');
    await expect(editor.root.getByTestId('status-elpath')).toContainText('h1');
    await editor.expectWordCount('3 words');
  });

  test('undo/redo via toolbar', async () => {
    await editor.selectWord('brave');
    await editor.clickButton('bold');
    await editor.clickButton('undo');
    const html = await editor.content.innerHTML();
    expect(html).not.toContain('<strong>');
    await editor.clickButton('redo');
    await editor.expectContentMatches(/<strong>brave\s*<\/strong>/);
  });
});

test.describe('React instance parity', () => {
  test('same engine behavior in the React wrapper', async ({ page }) => {
    const editor = new EditorPage(page, 'reditor');
    await editor.goto();
    await editor.clear();
    await editor.type('react parity check');
    await editor.selectWord('parity');
    await editor.clickButton('bold');
    await editor.expectContentMatches(/<strong>parity\s*<\/strong>/);
    await editor.expectButtonActive('bold', true);
  });
});
