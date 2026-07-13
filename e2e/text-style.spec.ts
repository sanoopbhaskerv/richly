import { expect, test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test.describe('text style ui', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();
    await editor.type('alpha bravo charlie');
  });

  test('forecolor and backcolor swatches apply styles', async () => {
    await editor.selectWord('bravo');
    await editor.clickButton('forecolor');
    await editor.root.getByTestId('dd-forecolor').getByTestId('swatch-ef4444').click();
    await editor.expectContentMatches(/color:\s*(#ef4444|rgb\(239,\s*68,\s*68\))/i);
    await expect
      .poll(() =>
        editor.button('forecolor').evaluate((button) => {
          const indicator = button.querySelector('.rly-icon-color-indicator')!;
          return getComputedStyle(indicator).stroke;
        })
      )
      .toBe('rgb(239, 68, 68)');

    await editor.selectWord('bravo');
    await editor.clickButton('forecolor');
    await expect(
      editor.root.getByTestId('dd-forecolor').getByTestId('swatch-ef4444')
    ).toHaveAttribute('aria-pressed', 'true');
    await editor.root.getByTestId('dd-forecolor').getByTestId('swatch-ef4444').press('Escape');

    await editor.selectWord('bravo');
    await editor.clickButton('backcolor');
    await editor.root.getByTestId('dd-backcolor').getByTestId('swatch-dcfce7').click();
    await editor.expectContentMatches(/background-color:\s*(#dcfce7|rgb\(220,\s*252,\s*231\))/i);
    await expect
      .poll(() =>
        editor.button('backcolor').evaluate((button) => {
          const indicator = button.querySelector('.rly-icon-color-indicator')!;
          return getComputedStyle(indicator).fill;
        })
      )
      .toBe('rgb(220, 252, 231)');
  });

  test('none swatch clears color style', async () => {
    await editor.selectWord('bravo');
    await editor.clickButton('forecolor');
    await editor.root.getByTestId('dd-forecolor').getByTestId('swatch-ef4444').click();

    await editor.selectWord('bravo');
    await editor.clickButton('forecolor');
    await editor.root.getByTestId('dd-forecolor').getByTestId('swatch-none').click();

    const html = await editor.content.innerHTML();
    expect(html).not.toMatch(/color\s*:/i);
  });

  test('custom palette colors apply to text and background', async () => {
    await editor.selectWord('bravo');
    await editor.clickButton('forecolor');
    await editor.root.getByTestId('dd-forecolor').getByTestId('custom-color').click();
    const forePicker = editor.root.getByTestId('dd-forecolor');
    await expect(forePicker.getByTestId('color-picker-hex')).toBeVisible();
    await forePicker.getByTestId('color-picker-hex').fill('#123456');
    await forePicker.getByTestId('color-picker-done').click();
    await editor.expectContentMatches(/color:\s*(#123456|rgb\(18,\s*52,\s*86\))/i);

    await editor.selectWord('bravo');
    await editor.clickButton('backcolor');
    await editor.root.getByTestId('dd-backcolor').getByTestId('custom-color').click();
    const backPicker = editor.root.getByTestId('dd-backcolor');
    await expect(backPicker.getByTestId('color-picker-hex')).toBeVisible();
    await backPicker.getByTestId('color-picker-hex').fill('#fedcba');
    await backPicker.getByTestId('color-picker-done').click();
    await editor.expectContentMatches(/background-color:\s*(#fedcba|rgb\(254,\s*220,\s*186\))/i);

    await editor.selectWord('bravo');
    await editor.clickButton('forecolor');
    await expect(forePicker.getByTestId('recent-color-123456')).toBeVisible();
    await editor.root.getByTestId('dd-forecolor').getByTestId('custom-color').click();
    await expect(forePicker.getByTestId('color-picker-hex')).toHaveValue('#123456');
    await forePicker.getByTestId('color-picker-cancel').click();
  });

  test('canceling an advanced custom color leaves content unchanged', async () => {
    const before = await editor.content.innerHTML();
    await editor.selectWord('alpha');
    await editor.clickButton('backcolor');
    await editor.root.getByTestId('dd-backcolor').getByTestId('custom-color').click();

    const picker = editor.root.getByTestId('dd-backcolor');
    await picker.getByTestId('color-picker-hex').fill('#fedcba');
    await picker.getByTestId('color-picker-cancel').click();

    expect(await editor.content.innerHTML()).toBe(before);
  });

  test('advanced picker validates HEX and supports sliders, back, and escape', async () => {
    await editor.selectWord('charlie');
    await editor.clickButton('forecolor');
    const panel = editor.root.getByTestId('dd-forecolor');
    await panel.getByTestId('custom-color').click();

    const hex = panel.getByTestId('color-picker-hex');
    await hex.fill('#nope');
    await expect(panel.getByTestId('color-picker-done')).toBeDisabled();
    await expect(panel.getByText('Enter a valid HEX color')).toBeVisible();

    await hex.fill('#3b82f6');
    await expect(panel.getByTestId('color-picker-done')).toBeEnabled();
    await panel.getByTestId('color-picker-add-preset').click();
    await expect(panel.getByTestId('color-picker-preset-3B82F6')).toBeVisible();
    await panel.getByTestId('color-picker-sv').press('Shift+ArrowLeft');
    await expect(panel.getByTestId('color-picker-hex')).not.toHaveValue('#3B82F6');
    await panel.getByTestId('color-picker-tab-sliders').click();
    await panel.getByTestId('color-picker-number-h').fill('120');
    await expect(panel.getByTestId('color-picker-hex')).toHaveValue(/^#[0-9A-F]{6}$/);
    await expect(panel.getByTestId('color-picker-hex')).not.toHaveValue('#3B82F6');

    await panel.getByTestId('color-picker-back').click();
    await expect(panel.getByTestId('custom-color')).toBeVisible();
    await panel.getByTestId('custom-color').click();
    await panel.getByTestId('color-picker-hex').press('Escape');
    await expect(panel.getByTestId('custom-color')).toBeVisible();
    await panel.getByTestId('custom-color').press('Escape');
    await expect(panel).not.toHaveClass(/rly-open/);
  });

  test('advanced picker stays inside a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await editor.selectWord('alpha');
    await editor.clickButton('forecolor');
    const panel = editor.root.getByTestId('dd-forecolor');
    await panel.getByTestId('custom-color').click();

    const bounds = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(7);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth - 7);
    expect(bounds.top).toBeGreaterThanOrEqual(7);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight - 7);
  });

  test('collapsed swatch apply styles newly typed text', async ({ page }) => {
    await editor.placeCursorAtEnd();
    await editor.clickButton('forecolor');
    await editor.root.getByTestId('dd-forecolor').getByTestId('swatch-3b82f6').click();
    await page.keyboard.type(' delta');
    await editor.expectContentMatches(/delta/);
    await editor.expectContentMatches(/color:\s*(#3b82f6|rgb\(59,\s*130,\s*246\))/i);
  });

  test('fontsize select applies and tracks values', async () => {
    await editor.selectWord('bravo');
    const select = editor.root.getByTestId('tb-select-fontsize');
    await select.selectOption('24px');
    await editor.expectContentMatches(/font-size:\s*24px/i);

    await editor.selectWord('alpha');
    await expect(select).toHaveValue('');

    await editor.selectWord('bravo');
    await expect(select).toHaveValue('24px');

    await editor.content.evaluate((element) => {
      const bravo = Array.from(element.querySelectorAll('span')).find((span) =>
        span.textContent?.includes('bravo')
      ) as HTMLElement;
      bravo.style.fontSize = '21px';
      const range = document.createRange();
      range.selectNodeContents(bravo);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await expect(select).toHaveValue('21px');
    await expect
      .poll(() =>
        select.evaluate(
          (element: HTMLSelectElement) =>
            Array.from(element.options).find((option) => option.className === 'rly-temp-option')
              ?.textContent
        )
      )
      .toBe('21px');
  });

  test('superscript and subscript are mutually exclusive', async () => {
    await editor.selectWord('bravo');
    await editor.clickButton('superscript');
    await editor.expectButtonActive('superscript', true);

    await editor.selectWord('bravo');
    await editor.clickButton('subscript');

    await editor.expectButtonActive('superscript', false);
    await editor.expectButtonActive('subscript', true);
    await editor.expectContentMatches(/<sub>bravo\s*<\/sub>/i);
  });

  test('panel keyboard keeps focus contained and escape restores editor focus', async ({
    page
  }) => {
    await editor.clickButton('forecolor');
    const panel = editor.root.getByTestId('dd-forecolor');
    await expect(panel).toBeVisible();

    await panel.press('ArrowRight');
    await panel.press('ArrowDown');
    await expect(editor.root.getByTestId('tb-bold')).not.toBeFocused();

    await panel.press('Escape');
    await expect(panel).not.toHaveClass(/rly-open/);
    await expect(editor.content).toBeFocused();

    await page.evaluate(() => window.scrollTo(0, 100));
    await editor.clickButton('forecolor');
    const reset = panel.getByTestId('swatch-none');
    await expect(reset).toBeFocused();
    await reset.press('Tab');
    const focusedSwatch = panel.getByTestId('swatch-fee2e2');
    await expect(focusedSwatch).toBeFocused();
    const before = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowDown');
    const after = await page.evaluate(() => window.scrollY);
    // Firefox can round a sub-pixel layout shift to one CSS pixel under load;
    // keyboard navigation must not cause a meaningful document scroll.
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });
});

test.describe('text style ui in overflow toolbar', () => {
  test('fontsize and forecolor work from more panel', async ({ page }) => {
    const editor = new EditorPage(page, 'reditor');
    await editor.goto();
    await editor.clear();
    await editor.type('overflow target');
    await page.setViewportSize({ width: 545, height: 760 });

    await editor.selectWord('target');
    await editor.clickButton('more');
    const morePanel = editor.root.getByTestId('toolbar-more-panel');
    await expect(morePanel).toBeVisible();
    const select = editor.root.getByTestId('tb-select-fontsize');
    await select.selectOption('18px');
    await editor.expectContentMatches(/font-size:\s*18px/i);

    await editor.selectWord('target');
    await editor.clickButton('more');
    await expect(morePanel).toBeVisible();
    await editor.clickButton('forecolor');
    await editor.root.getByTestId('dd-forecolor').getByTestId('swatch-a855f7').click();
    await editor.expectContentMatches(/color:\s*(#a855f7|rgb\(168,\s*85,\s*247\))/i);
  });
});
