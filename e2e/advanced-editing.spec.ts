import { expect, test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('advanced editing', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.clear();
    await editor.type('before');
  });

  test('IME composition commits as a single undoable edit', async () => {
    await editor.content.evaluate((element) => {
      element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      element.innerHTML = '<p>日本語</p>';
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertCompositionText',
          isComposing: true
        })
      );
      element.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, data: '日本語' })
      );
    });
    await expect(editor.content).toContainText('日本語');
    await editor.clickButton('undo');
    await expect(editor.content).toContainText('before');
  });

  test('plain-text paste cannot inject HTML', async () => {
    await editor.placeCursorAtEnd();
    await editor.content.evaluate((element) => {
      const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
      Object.defineProperty(event, 'clipboardData', {
        value: {
          getData: (type: string) =>
            type === 'text/plain' ? '<img src=x onerror=alert(1)>\nnext' : ''
        }
      });
      element.dispatchEvent(event);
    });
    await expect(editor.content).toContainText('<img src=x onerror=alert(1)>');
    expect(await editor.content.evaluate((element) => element.querySelectorAll('img').length)).toBe(
      0
    );
  });

  test('multi-cell selection merges and splits a table', async () => {
    await editor.content.evaluate((element) => {
      element.innerHTML =
        '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table><p><br></p>';
      const cells = element.querySelectorAll('td');
      cells[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      cells[3]!.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true })
      );
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await editor.root.getByTestId('menu-table').click();
    await editor.root.getByTestId('menuitem-mergecells').click();
    expect(
      await editor.content.evaluate((element) => ({
        cells: element.querySelectorAll('td').length,
        colspan: element.querySelector('td')?.colSpan,
        rowspan: element.querySelector('td')?.rowSpan
      }))
    ).toEqual({ cells: 1, colspan: 2, rowspan: 2 });

    await editor.root.getByTestId('menu-table').click();
    await editor.root.getByTestId('menuitem-splitcell').click();
    expect(await editor.content.evaluate((element) => element.querySelectorAll('td').length)).toBe(
      4
    );
  });

  test('search/replace, visual blocks, and preview are available', async ({ page }) => {
    await editor.content.press('ControlOrMeta+f');
    await page.getByTestId('dialog-field-find').fill('before');
    await page.getByTestId('dialog-field-replace').fill('after');
    await page.getByTestId('dialog-field-action').selectOption('replaceAll');
    await page.getByTestId('dialog-submit').click();
    await expect(editor.content).toContainText('after');

    await editor.root.getByTestId('menu-view').click();
    await editor.root.getByTestId('menuitem-visualblocks').click();
    await expect(editor.button('visualblocks')).toHaveAttribute('aria-pressed', 'true');

    await editor.root.getByTestId('menu-view').click();
    await editor.root.getByTestId('menuitem-preview').click();
    await expect(page.getByTestId('preview-overlay')).toBeVisible();
    await page.getByTestId('preview-close').click();
    await expect(page.getByTestId('preview-overlay')).toHaveCount(0);
  });
});
