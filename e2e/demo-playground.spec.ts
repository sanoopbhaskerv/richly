import { expect, test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('demo configuration playground', () => {
  test('keeps every integration fixture mounted in the redesigned page', async ({ page }) => {
    const editor = new EditorPage(page, 'editor');
    await editor.goto();

    await expect(page.getByTestId('demo-playground')).toBeVisible();
    await expect(page.getByTestId('demo-config-toolbar-mode')).toHaveValue('wrap');
    await expect(page.getByTestId('demo-config-toolbar-preset')).toHaveValue('standard');
    await expect(page.getByTestId('demo-config-output')).toContainText("toolbarMode: 'wrap'");

    await expect(page.getByTestId('editor-root')).toBeVisible();
    await expect(page.getByTestId('editor-clean-root')).toBeVisible();
    await expect(page.getByTestId('editor-sliding-clean-root')).toBeVisible();
    await expect(page.getByTestId('reditor-root')).toBeVisible();
    await expect(page.getByTestId('reditor-clean-root')).toBeVisible();
    const reactSlidingPrimary = page
      .getByTestId('reditor-clean-root')
      .getByTestId('toolbar-primary');
    await expect(reactSlidingPrimary.getByTestId('tb-undo')).toBeVisible();
    await expect(reactSlidingPrimary.getByTestId('tb-bold')).toBeVisible();
    await expect(reactSlidingPrimary.getByTestId('tb-italic')).toBeVisible();
  });

  test('applies live options while preserving edited content', async ({ page }) => {
    const editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();
    await editor.type('persistent playground text');

    await page.getByTestId('demo-config-toolbar-mode').selectOption('sliding');
    await page.getByTestId('demo-config-toolbar-preset').selectOption('essential');
    await page.getByTestId('demo-config-menubar').setChecked(false);
    await page.getByTestId('demo-config-statusbar').setChecked(false);

    await expect(editor.content).toContainText('persistent playground text');
    await expect(page.getByTestId('editor-menubar')).toHaveCount(0);
    await expect(page.getByTestId('editor-statusbar')).toHaveCount(0);
    await expect(editor.button('bold')).toBeVisible();
    await expect(editor.button('table')).toHaveCount(0);
    await expect(page.getByTestId('demo-config-output')).toContainText("toolbarMode: 'sliding'");
    await expect(page.getByTestId('demo-config-output')).toContainText('menubar: false');

    await page.getByTestId('demo-config-theme-color-1').fill('#123456');
    await expect(editor.content).toContainText('persistent playground text');
    await editor.clickButton('forecolor');
    await expect(
      editor.root.getByTestId('dd-forecolor').getByTestId('swatch-123456')
    ).toBeVisible();
  });

  test('switches the page theme without remounting the playground content', async ({ page }) => {
    const editor = new EditorPage(page, 'editor');
    await editor.goto();
    const theme = page.getByTestId('theme-toggle');

    await expect(page.locator('html')).toHaveAttribute('data-theme', '');
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(editor.content).toContainText('Configure this editor live');
  });
});
