import { expect, test } from '@playwright/test';
import path from 'node:path';
import { EditorPage } from './pages/EditorPage';

const pixelPng = path.resolve(__dirname, 'fixtures', 'pixel.png');

test.describe('image upload and resize', () => {
  test('dialog file upload succeeds and getContent omits uploading marker', async ({ page }) => {
    const editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();

    await editor.clickButton('image');
    await page.getByTestId('dialog-field-file').setInputFiles(pixelPng);
    await page.getByTestId('dialog-submit').click();

    await expect(editor.content.locator('img[data-rly-uploading]')).toHaveCount(1);
    const image = editor.content.locator('img').first();
    await expect(image).toHaveAttribute('src', /^data:image\/png;base64,/);

    await editor.clickButton('code');
    await expect(page.getByTestId('dialog-field-code')).not.toContainText('data-rly-uploading');
    await page.getByTestId('dialog-cancel').click();
  });

  test('upload failure removes placeholder and keeps content unchanged', async ({ page }) => {
    await page.goto('/?imgfail');
    const editor = new EditorPage(page, 'editor');
    await expect(editor.content).toBeVisible();
    await editor.clear();

    const before = await editor.content.innerHTML();
    await editor.clickButton('image');
    await page.getByTestId('dialog-field-file').setInputFiles(pixelPng);
    await page.getByTestId('dialog-submit').click();

    await expect(editor.content.locator('img')).toHaveCount(0);
    await expect.poll(async () => editor.content.innerHTML()).toBe(before);
  });

  test('paste image file routes to upload pipeline', async ({ page }) => {
    const editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();

    await editor.content.click();
    await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-testid="editor-content"]');
      if (!host) return;
      host.focus();
      const file = new File([new Uint8Array([137, 80, 78, 71])], 'paste.png', {
        type: 'image/png'
      });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
      Object.defineProperty(event, 'clipboardData', { value: transfer });
      host.dispatchEvent(event);
    });

    await expect(editor.content.locator('img').first()).toHaveAttribute('src', /^data:image\//);
  });

  test('resize drag shows frame and serializes width/height attributes', async ({ page }) => {
    const editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();

    await editor.content.evaluate((el) => {
      el.innerHTML =
        '<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" width="40" height="20" alt="x"></p>';
    });

    const image = editor.content.locator('img').first();
    await image.click();
    const frame = editor.root.getByTestId('image-selection');
    await expect(frame).toBeVisible();

    const handle = editor.root.getByTestId('image-resize-xy');
    const box = await handle.boundingBox();
    if (!box) throw new Error('Resize handle not visible');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10);
    await page.mouse.up();

    const attrs = await image.evaluate((img) => ({
      width: Number(img.getAttribute('width')),
      height: Number(img.getAttribute('height'))
    }));
    expect(attrs.width).toBeGreaterThan(40);
    expect(attrs.height).toBeGreaterThan(20);
    expect(Math.abs(attrs.width / attrs.height - 2)).toBeLessThanOrEqual(1);

    await editor.clickButton('code');
    await expect(page.getByTestId('dialog-field-code')).toHaveValue(/width="/);
    await expect(page.getByTestId('dialog-field-code')).toHaveValue(/height="/);
    await page.getByTestId('dialog-cancel').click();
  });

  test('width handle overrides pasted inline dimensions using the rendered size', async ({
    page
  }) => {
    const editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();
    await editor.content.evaluate((el) => {
      // Generate the fixture in the current browser so this sizing test is not
      // coupled to differences in how engines decode a hand-authored PNG.
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      el.innerHTML = `<p><img src="${canvas.toDataURL('image/png')}" width="100" height="50" style="width: 40px; height: 20px;" alt="x"></p>`;
    });

    const image = editor.content.locator('img').first();
    await image.click();
    const handle = editor.root.getByTestId('image-resize-x');
    const box = await handle.boundingBox();
    if (!box) throw new Error('Width resize handle not visible');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
    await page.mouse.up();

    const result = await image.evaluate((img) => ({
      width: Number(img.getAttribute('width')),
      height: Number(img.getAttribute('height')),
      inlineWidth: (img as HTMLElement).style.width,
      inlineHeight: (img as HTMLElement).style.height,
      renderedWidth: img.getBoundingClientRect().width
    }));
    expect(result.width).toBeGreaterThan(40);
    expect(result.width).toBeLessThan(100);
    expect(result.height).toBe(20);
    expect(result.inlineWidth).toBe('');
    expect(result.inlineHeight).toBe('');
    expect(Math.round(result.renderedWidth)).toBe(result.width);
  });

  test('image dialog accepts exact pixel dimensions', async ({ page }) => {
    const editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();
    await editor.content.evaluate((el) => {
      // A canvas-generated URL is a complete, browser-decodable image. The
      // former truncated PNG fixture raced image decoding under parallel CI.
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      el.innerHTML = `<p><img src="${canvas.toDataURL('image/png')}" width="40" height="20" alt="x"></p>`;
    });

    const image = editor.content.locator('img').first();
    await image.click();
    await editor.clickButton('image');
    await expect(page.getByTestId('dialog-field-width')).toHaveValue('40');
    await expect(page.getByTestId('dialog-field-height')).toHaveValue('20');
    await page.getByTestId('dialog-field-width').fill('72');
    await page.getByTestId('dialog-field-height').fill('36');
    await page.getByTestId('dialog-submit').click();

    await expect(image).toHaveAttribute('width', '72');
    await expect(image).toHaveAttribute('height', '36');
  });

  test('keyboard resize works only when frame is focused', async ({ page }) => {
    const editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();

    await editor.content.evaluate((el) => {
      el.innerHTML =
        '<p>before <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" width="40" height="20" alt="x"> after</p>';
    });

    const image = editor.content.locator('img').first();
    await image.click();
    const frame = editor.root.getByTestId('image-selection');
    await expect(frame).toBeVisible();

    await frame.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    const widthAfterFrame = await image.evaluate((img) => Number(img.getAttribute('width')));
    expect(widthAfterFrame).toBeGreaterThanOrEqual(43);

    await editor.content.click();
    await page.keyboard.press('ArrowRight');
    const widthAfterText = await image.evaluate((img) => Number(img.getAttribute('width')));
    expect(widthAfterText).toBe(widthAfterFrame);
  });

  test('Escape hides frame and typing resumes', async ({ page }) => {
    const editor = new EditorPage(page, 'editor');
    await editor.goto();
    await editor.clear();

    await editor.content.evaluate((el) => {
      el.innerHTML =
        '<p>text <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" width="40" height="20" alt="x"> tail</p>';
    });

    await editor.content.locator('img').first().click();
    const frame = editor.root.getByTestId('image-selection');
    await expect(frame).toBeVisible();

    await frame.focus();
    await page.keyboard.press('Escape');
    await expect(frame).toBeHidden();

    await editor.content.click();
    await page.keyboard.type('!');
    await expect(editor.content).toContainText('!');
  });
});
