import { expect, test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

/** Select text in the editor without relying on browser-specific drag geometry. */
async function selectText(editor: EditorPage, text: string): Promise<void> {
  await editor.content.evaluate((root, value) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const offset = node.textContent?.indexOf(value) ?? -1;
      if (offset < 0) continue;
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(node, offset + value.length);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      (root as HTMLElement).focus();
      return;
    }
    throw new Error(`Text not found: ${value}`);
  }, text);
}

test.describe('exploratory defect regressions', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
  });

  test('Home/End navigate block and document boundaries', async ({ page }) => {
    await editor.content.evaluate((root) => {
      root.innerHTML = '<p>alpha</p><p>omega</p>';
      const text = root.firstElementChild!.firstChild!;
      const range = document.createRange();
      range.setStart(text, 2);
      range.collapse(true);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      (root as HTMLElement).focus();
    });

    await page.keyboard.press('End');
    await page.keyboard.type('X');
    await page.keyboard.press('Home');
    await page.keyboard.type('Y');
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('Z');

    await expect(editor.content.locator('p').first()).toHaveText('YalphaX');
    await expect(editor.content.locator('p').last()).toHaveText('omegaZ');
  });

  test('Select All and Delete leave one valid empty block', async ({ page }) => {
    await editor.content.evaluate((root) => {
      root.innerHTML = '<h1>Heading</h1><p>Body</p><ul><li>one</li><li>two</li></ul>';
    });
    await editor.content.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Delete');

    await expect(editor.content.locator('ul')).toHaveCount(0);
    await expect(editor.content.locator(':scope > *')).toHaveCount(1);
    expect(await editor.content.innerHTML()).toBe('<p><br></p>');
  });

  test('multi-block format toggles do not retain empty boundary wrappers', async () => {
    await editor.content.evaluate((root) => {
      root.innerHTML = '<p>first</p><p>second</p>';
    });
    await editor.selectAll();
    await editor.clickButton('bold');
    await editor.clickButton('bold');
    await editor.clickButton('italic');
    await editor.clickButton('italic');

    await expect(editor.content.locator('strong:empty, em:empty')).toHaveCount(0);
    expect(await editor.content.innerHTML()).toBe('<p>first</p><p>second</p>');
  });

  test('Escape closes a pointer-opened alignment menu and restores its trigger', async ({
    page
  }) => {
    const trigger = editor.button('alignment');
    const panel = editor.root.getByTestId('dd-alignment');
    await trigger.click();
    await expect(panel).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(panel).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('Clear formatting removes a custom font size ancestor', async () => {
    await editor.content.evaluate((root) => {
      root.innerHTML = '<p><span style="font-size: 16.5px"><em>formatted text</em></span></p>';
    });
    await selectText(editor, 'formatted text');
    await editor.clickButton('removeformat');

    expect(await editor.content.innerHTML()).toBe('<p>formatted text</p>');
  });

  test('More tools panel remains inside the viewport', async ({ page }) => {
    const compact = new EditorPage(page, 'reditor');
    await page.setViewportSize({ width: 545, height: 672 });
    const toolbar = compact.toolbar;
    await toolbar.evaluate((element) => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, top - (window.innerHeight - 70)));
    });
    const more = compact.button('more');
    await expect(more).toBeVisible();
    await more.click();

    const panel = compact.root.getByTestId('toolbar-more-panel');
    await expect(panel).toBeVisible();
    const bounds = await panel.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(7);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(665);
  });

  test('mobile menubar wraps within the editor boundary', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    const menubar = editor.root.getByTestId('editor-menubar');
    const metrics = await menubar.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const rootRect = element.parentElement!.getBoundingClientRect();
      return {
        flexWrap: style.flexWrap,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        left: rect.left,
        right: rect.right,
        rootLeft: rootRect.left,
        rootRight: rootRect.right
      };
    });

    expect(metrics.flexWrap).toBe('wrap');
    expect(metrics.left).toBeGreaterThanOrEqual(metrics.rootLeft - 1);
    expect(metrics.right).toBeLessThanOrEqual(metrics.rootRight + 1);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  });

  test('native cut and paste preserve clean same-editor markup', async ({ page }) => {
    await editor.content.evaluate((root) => {
      root.innerHTML =
        '<p>Before</p><blockquote>Clean output. Flexible APIs.</blockquote><p>After</p>';
    });
    await selectText(editor, 'Clean output. Flexible APIs.');

    await page.keyboard.press('ControlOrMeta+x');
    await page.keyboard.press('ControlOrMeta+v');

    const blockquote = editor.content.locator('blockquote');
    await expect(blockquote).toHaveText('Clean output. Flexible APIs.');
    await expect(blockquote.locator('span')).toHaveCount(0);
    expect(await blockquote.getAttribute('style')).toBeNull();
  });
});
