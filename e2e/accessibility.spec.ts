import { expect, test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('keyboard-only accessibility contract', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page, 'editor');
    await editor.goto();
  });

  test('menubar supports arrows, Escape, and focus restoration', async ({ page }) => {
    const format = editor.root.getByTestId('menu-format');
    await format.focus();
    await page.keyboard.press('ArrowDown');
    await expect(editor.root.getByTestId('menuitem-bold')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(editor.root.getByTestId('menuitem-italic')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(format).toBeFocused();
    await expect(format).toHaveAttribute('aria-expanded', 'false');
  });

  test('modal dialog traps focus including its close control', async ({ page }) => {
    await editor.button('link').click();
    const field = page.getByTestId('dialog-field-href');
    await expect(field).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('dialog-close')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(field).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(editor.content).toBeFocused();
  });

  test('Alt+F10 enters and Escape leaves the inline text toolbar', async ({ page }) => {
    await editor.clear();
    await editor.type('keyboard toolbar');
    await editor.selectWord('keyboard');
    await expect(editor.root.getByTestId('text-inline-toolbar')).toBeVisible();

    await page.keyboard.press('Alt+F10');
    await expect(editor.root.getByTestId('inline-text-action-bold')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(editor.root.getByTestId('inline-text-action-italic')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(editor.content).toBeFocused();
  });

  test('Alt+F10 enters the table toolbar and Shift+F10 opens its context menu', async ({
    page
  }) => {
    await editor.clear();
    await editor.button('table').click();
    await editor.root.getByTestId('dd-table').getByTestId('grid-cell-1-1').click();
    const firstCell = editor.content.locator('td').first();
    await firstCell.click();
    await expect(editor.root.getByTestId('table-inline-toolbar')).toBeVisible();

    await page.keyboard.press('Alt+F10');
    await expect(editor.root.getByTestId('inline-table-action-table-props')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(editor.root.getByTestId('inline-table-action-delete-table')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(editor.root.getByTestId('inline-table-action-row-before')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(editor.content).toBeFocused();

    await page.keyboard.press('Shift+F10');
    const menu = editor.root.getByTestId('table-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByTestId('context-table-action-row-before')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByTestId('context-table-action-row-after')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(editor.content).toBeFocused();
  });
});
