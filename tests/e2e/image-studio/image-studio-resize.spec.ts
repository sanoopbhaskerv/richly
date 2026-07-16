import { test, expect } from './support/fixtures';

test.describe('Image Studio resize', () => {
  test.beforeEach(async ({ studio }) => {
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Resize');
  });

  test('width and height fields update the pending result with aspect lock on', async ({
    studio
  }) => {
    const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });
    await width.fill('600');
    await width.blur();

    const result = studio.inspector.getByTestId('image-resize-result');
    await expect(result).toHaveText(/Result 600 x 400px/);
  });

  test('unlocking aspect ratio allows independent width/height', async ({ studio }) => {
    const lock = studio.inspector.getByRole('button', { name: 'Maintain aspect ratio' });
    await expect(lock).toHaveAttribute('aria-pressed', 'true');
    await lock.click();
    await expect(lock).toHaveAttribute('aria-pressed', 'false');

    const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });
    const height = studio.inspector.getByRole('spinbutton', { name: 'Height' });
    await width.fill('900');
    await width.blur();
    await expect(height).toHaveValue('800');
  });

  test('percent mode displays and edits percentages, not raw pixels', async ({ studio }) => {
    const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });
    const height = studio.inspector.getByRole('spinbutton', { name: 'Height' });

    await studio.inspector.getByRole('button', { name: 'Percent' }).click();
    await expect(width).toHaveValue('100');
    await expect(height).toHaveValue('100');

    await width.fill('50');
    await width.blur();
    await expect(width).toHaveValue('50');
    await expect(studio.inspector.getByTestId('image-resize-result')).toHaveText(
      /Result 600 x 400px/
    );

    await studio.inspector.getByRole('button', { name: 'Pixels' }).click();
    await expect(width).toHaveValue('600');
  });

  test('rejects zero, negative, and empty width by clamping to a valid minimum', async ({
    studio
  }) => {
    const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });

    for (const input of ['0', '-50', '']) {
      await width.fill(input);
      await width.blur();
      const value = Number(await width.inputValue());
      expect(value).toBeGreaterThanOrEqual(1);
    }
  });

  test('clamps extremely large dimensions to a supported maximum', async ({ studio }) => {
    const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });
    await width.fill('999999');
    await width.blur();
    const value = Number(await width.inputValue());
    expect(value).toBeLessThanOrEqual(12_000);
    expect(Number.isFinite(value)).toBe(true);
  });

  test('Cancel restores the previously committed dimensions', async ({ studio }) => {
    const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });
    await width.fill('300');
    await width.blur();
    await studio.inspector.getByRole('button', { name: 'Cancel' }).click();

    await studio.selectTool('Adjust');
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Resize');
    await expect(studio.inspector.getByRole('spinbutton', { name: 'Width' })).toHaveValue('1200');
  });

  test('Apply creates one history entry; undo restores and redo reapplies dimensions', async ({
    studio
  }) => {
    const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });
    await width.fill('600');
    await width.blur();
    await studio.inspector.getByRole('button', { name: 'Apply resize' }).click();

    let size = await studio.canvasSize();
    expect(size).toEqual({ width: 600, height: 400 });

    await studio.undoButton.click();
    size = await studio.canvasSize();
    expect(size).toEqual({ width: 1200, height: 800 });

    await studio.redoButton.click();
    size = await studio.canvasSize();
    expect(size).toEqual({ width: 600, height: 400 });
  });

  test('repeated resize operations keep working', async ({ studio }) => {
    for (const target of [900, 600, 300]) {
      const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });
      await width.fill(String(target));
      await width.blur();
      await studio.inspector.getByRole('button', { name: 'Apply resize' }).click();
      const size = await studio.canvasSize();
      expect(size.width).toBe(target);
    }
  });
});
