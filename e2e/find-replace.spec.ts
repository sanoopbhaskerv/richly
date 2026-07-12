import { expect, test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('find and replace', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.clear();
    await editor.type('dialogue dialogue dialogue');
    await editor.content.press('ControlOrMeta+f');
    await expect(page.getByTestId('dialog-find-replace')).toBeVisible();
  });

  const count = (page: EditorPage['page']) => page.getByTestId('findreplace-count');
  const find = (page: EditorPage['page']) => page.getByTestId('dialog-field-find');
  const replace = (page: EditorPage['page']) => page.getByTestId('dialog-field-replace');

  test('shows a live counter and navigates with buttons and keyboard', async ({ page }) => {
    await find(page).fill('dialogue');
    await expect(count(page)).toHaveText('1 of 3');
    // Exactly one current highlight, three total.
    await expect(page.locator('mark.rly-match')).toHaveCount(3);
    await expect(page.locator('mark.rly-match-current')).toHaveCount(1);

    await page.getByTestId('findreplace-find-next').click();
    await expect(count(page)).toHaveText('2 of 3');

    await find(page).press('Enter');
    await expect(count(page)).toHaveText('3 of 3');

    // Wrap forward, then back with Shift+Enter.
    await find(page).press('Enter');
    await expect(count(page)).toHaveText('1 of 3');
    await find(page).press('Shift+Enter');
    await expect(count(page)).toHaveText('3 of 3');
  });

  test('replaces one at a time with stable ordinals, never reprocessing the replacement', async ({
    page
  }) => {
    await find(page).fill('dialogue');
    await replace(page).fill('dialogue23');
    await expect(count(page)).toHaveText('1 of 3');

    // Ordinals stay stable (2 of 3, not 1 of 2) as matches are consumed.
    await page.getByTestId('findreplace-replace').click();
    await expect(count(page)).toHaveText('2 of 3');

    await page.getByTestId('findreplace-replace').click();
    await expect(count(page)).toHaveText('3 of 3');

    // Final replacement clears all markers, so content serializes cleanly.
    await page.getByTestId('findreplace-replace').click();
    await editor.expectContentContains('dialogue23 dialogue23 dialogue23');
    await expect.poll(async () => editor.content.innerHTML()).not.toContain('dialogue2323');
  });

  test('Replace All acts on remaining matches and reports the count', async ({ page }) => {
    await find(page).fill('dialogue');
    await replace(page).fill('chat');

    await page.getByTestId('findreplace-replace').click();
    await page.getByTestId('findreplace-replace-all').click();

    await expect(count(page)).toHaveText('Replaced 2 occurrences');
    await editor.expectContentContains('chat chat chat');
  });

  test('cleans transient markers from the DOM on close', async ({ page }) => {
    await find(page).fill('dialogue');
    await expect(page.locator('mark.rly-match')).toHaveCount(3);

    await page.getByTestId('dialog-close').click();
    await expect(page.getByTestId('dialog-find-replace')).toBeHidden();
    await expect(page.locator('mark.rly-match')).toHaveCount(0);
    await editor.expectContentContains('dialogue dialogue dialogue');
  });
});
