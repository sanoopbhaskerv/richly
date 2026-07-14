import { expect, test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

test('font-size control uses the first editable position before initial focus', async ({
  page
}) => {
  const editor = new EditorPage(page, 'editor');
  await editor.goto();
  const input = editor.root.getByTestId('font-size-input');

  await expect(input).toHaveValue('29.45');
  await editor.root.getByTestId('font-size-increase').click();

  await expect(input).toHaveValue('30.45');
  expect(await editor.content.innerHTML()).toMatch(/font-size:\s*30\.45px/i);
});

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

  test('configured theme colors are available to text and highlight palettes', async () => {
    await editor.selectWord('bravo');
    await editor.clickButton('forecolor');
    await editor.root.getByTestId('dd-forecolor').getByTestId('swatch-0f766e').click();
    await editor.expectContentMatches(/color:\s*(#0f766e|rgb\(15,\s*118,\s*110\))/i);

    await editor.selectWord('charlie');
    await editor.clickButton('backcolor');
    await editor.root.getByTestId('dd-backcolor').getByTestId('swatch-be123c').click();
    await editor.expectContentMatches(/background-color:\s*(#be123c|rgb\(190,\s*18,\s*60\))/i);
  });

  test('background color preserves list structure when the last item is excluded', async () => {
    await editor.content.evaluate((element) => {
      element.innerHTML = '<ol><li>first</li><li>second</li><li>third</li><li>last</li></ol>';
      element.dispatchEvent(new InputEvent('input', { bubbles: true }));

      const items = element.querySelectorAll('li');
      const range = document.createRange();
      // The fourth text node is a boundary only. This covers the multi-block
      // counterpart to the structural single-item selection below.
      range.setStart(items[0]!.firstChild!, 0);
      range.setEnd(items[3]!.firstChild!, 0);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });

    await editor.clickButton('backcolor');
    await editor.root.getByTestId('dd-backcolor').getByTestId('swatch-fef9c3').click();

    const listState = await editor.content.evaluate((element) =>
      Array.from(element.querySelectorAll('li')).map((item) => ({
        text: item.textContent,
        background: item.querySelector<HTMLElement>('span')?.style.backgroundColor ?? ''
      }))
    );
    expect(listState).toEqual([
      { text: 'first', background: 'rgb(254, 249, 195)' },
      { text: 'second', background: 'rgb(254, 249, 195)' },
      { text: 'third', background: 'rgb(254, 249, 195)' },
      { text: 'last', background: '' }
    ]);
  });

  test('background color on the first list item does not wrap list elements', async () => {
    await editor.content.evaluate((element) => {
      element.innerHTML = '<ul><li>first</li><li>second</li><li>third</li></ul>';
      element.dispatchEvent(new InputEvent('input', { bubbles: true }));

      const list = element.querySelector('ul')!;
      const items = list.querySelectorAll('li');
      const range = document.createRange();
      // Reproduce a real drag boundary: the selection contains the first
      // item's content but ends structurally at offset 0 of the second item.
      range.setStart(list, 0);
      range.setEnd(items[1]!, 0);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });

    await editor.clickButton('backcolor');
    await editor.root.getByTestId('dd-backcolor').getByTestId('swatch-f97316').click();

    const listState = await editor.content.evaluate((element) => ({
      itemCount: element.querySelectorAll('li').length,
      invalidWrapperCount: element.querySelectorAll('span > li').length,
      items: Array.from(element.querySelectorAll('li')).map((item) => ({
        text: item.textContent,
        background: item.querySelector<HTMLElement>('span')?.style.backgroundColor ?? ''
      }))
    }));
    expect(listState).toEqual({
      itemCount: 3,
      invalidWrapperCount: 0,
      items: [
        { text: 'first', background: 'rgb(249, 115, 22)' },
        { text: 'second', background: '' },
        { text: 'third', background: '' }
      ]
    });
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

  test('font-size stepper applies, tracks, validates, and resets values', async () => {
    await editor.selectWord('bravo');
    const input = editor.root.getByTestId('font-size-input');
    await input.fill('24');
    await input.press('Enter');
    await editor.expectContentMatches(/font-size:\s*24px/i);

    await editor.selectWord('alpha');
    await expect(input).toHaveValue('15.5');

    await editor.selectWord('bravo');
    await expect(input).toHaveValue('24');

    await editor.root.getByTestId('font-size-increase').click();
    await editor.expectContentMatches(/font-size:\s*25px/i);

    await editor.selectWord('bravo');
    await input.fill('513');
    await input.press('Enter');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await editor.expectContentMatches(/font-size:\s*25px/i);

    await input.press('Escape');
    await editor.selectWord('bravo');
    await input.fill('');
    await input.press('Enter');
    expect(await editor.content.innerHTML()).not.toMatch(/font-size\s*:/i);
  });

  test('mixed and reverse selections display the document-start size', async () => {
    await editor.content.evaluate((element) => {
      element.innerHTML =
        '<p><span style="font-size: 19px">alpha</span> <span style="font-size: 14px">bravo</span></p>';
      const spans = element.querySelectorAll('span');
      const first = spans[0]!.firstChild!;
      const last = spans[1]!.firstChild!;
      window.getSelection()?.setBaseAndExtent(last, last.textContent!.length, first, 0);
      document.dispatchEvent(new Event('selectionchange'));
    });
    const input = editor.root.getByTestId('font-size-input');
    await expect(input).toHaveValue('19');

    await editor.root.getByTestId('font-size-increase').click();
    const html = await editor.content.innerHTML();
    expect(html).not.toMatch(/font-size:\s*(19|14)px/i);
    expect(html).toMatch(/font-size:\s*20px/i);
  });

  test('font-size input applies keyboard steps', async () => {
    await editor.selectWord('bravo');
    const input = editor.root.getByTestId('font-size-input');
    await input.press('ArrowUp');
    await editor.expectContentMatches(/font-size:\s*16.5px/i);

    await editor.selectWord('bravo');
    await input.press('Shift+ArrowDown');
    await editor.expectContentMatches(/font-size:\s*11.5px/i);
  });

  test('font-size control tracks externally changed values', async () => {
    await editor.selectWord('bravo');
    const input = editor.root.getByTestId('font-size-input');
    await editor.content.evaluate((element) => {
      element.innerHTML = '<p>alpha <span style="font-size: 21px">bravo</span> charlie</p>';
      const span = element.querySelector('span')!;
      const range = document.createRange();
      range.selectNodeContents(span);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await expect(input).toHaveValue('21');
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

    await editor.clickButton('forecolor');
    const reset = panel.getByTestId('swatch-none');
    await expect(reset).toBeFocused();
    await reset.press('Tab');
    const focusedSwatch = panel.getByTestId('swatch-0f766e');
    await expect(focusedSwatch).toBeFocused();
    await page.evaluate(() => {
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      // The marketing demo enables smooth page scrolling. Establish the
      // baseline after click/focus setup, so its animation is not mistaken
      // for keyboard-induced scrolling in Firefox.
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, 100);
      root.style.scrollBehavior = previousBehavior;
    });
    const before = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowDown');
    // Firefox can defer focus scrolling until its next layout frame. Verify
    // the viewport after the component's bounded restoration has settled.
    await expect
      .poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - before))
      .toBeLessThanOrEqual(8);
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
    const input = editor.root.getByTestId('font-size-input');
    await input.fill('18');
    await input.press('Enter');
    await editor.expectContentMatches(/font-size:\s*18px/i);

    await editor.selectWord('target');
    await editor.clickButton('more');
    await expect(morePanel).toBeVisible();
    await editor.clickButton('forecolor');
    await editor.root.getByTestId('dd-forecolor').getByTestId('swatch-a855f7').click();
    await editor.expectContentMatches(/color:\s*(#a855f7|rgb\(168,\s*85,\s*247\))/i);
  });
});
