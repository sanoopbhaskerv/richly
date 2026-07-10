import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('link plugin + menubar (vanilla instance)', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();
  });

  test('insert link via toolbar dialog', async ({ page }) => {
    await editor.type('visit the docs today');
    await editor.selectWord('docs');
    await editor.clickButton('link');

    const dialog = page.getByTestId('dialog-link');
    await expect(dialog).toBeVisible();
    await page.getByTestId('dialog-field-href').fill('https://example.com');
    await page.getByTestId('dialog-submit').click();

    await editor.expectContentMatches(/<a href="https:\/\/example\.com">docs\s*<\/a>/);
    await expect(dialog).not.toBeVisible();
  });

  test('dialog cancel and Escape leave content untouched', async ({ page }) => {
    await editor.type('plain text');
    await editor.selectWord('plain');
    await editor.clickButton('link');
    await page.getByTestId('dialog-cancel').click();
    let html = await editor.content.innerHTML();
    expect(html).not.toContain('<a');

    await editor.selectWord('plain');
    await editor.clickButton('link');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dialog-link')).not.toBeVisible();
    html = await editor.content.innerHTML();
    expect(html).not.toContain('<a');
  });

  test('Mod+K opens the link dialog', async ({ page }) => {
    await editor.type('shortcut test');
    await editor.selectWord('shortcut');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByTestId('dialog-link')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('autolink fires when typing a URL followed by space', async ({ page }) => {
    await editor.type('go to https://cool.dev now');
    await editor.expectContentMatches(/<a href="https:\/\/cool\.dev">https:\/\/cool\.dev<\/a>/);
  });

  test('unlink removes the anchor', async ({ page }) => {
    await editor.type('some linked word here');
    await editor.selectWord('linked');
    await editor.clickButton('link');
    await page.getByTestId('dialog-field-href').fill('https://x.com');
    await page.getByTestId('dialog-submit').click();
    await editor.expectContentContains('<a');

    await editor.selectWord('linked');
    await editor.clickButton('unlink');
    const html = await editor.content.innerHTML();
    expect(html).not.toContain('<a');
  });

  test('menubar: Format > Bold applies to selection', async ({ page }) => {
    await editor.type('menu driven');
    await editor.selectWord('driven');
    await editor.root.getByTestId('menu-format').click();
    await editor.root.getByTestId('menuitem-bold').click();
    await editor.expectContentMatches(/<strong>driven\s*<\/strong>/);
  });
});
