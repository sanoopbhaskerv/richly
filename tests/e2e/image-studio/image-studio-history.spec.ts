import { test, expect } from './support/fixtures';

test.describe('Image Studio undo/redo/history', () => {
  test('a mixed sequence of operations undoes and redoes coherently', async ({ studio }) => {
    // 1. Adjust brightness
    await studio.selectTool('Adjust');
    const brightness = studio.inspector.getByRole('spinbutton').first();
    await brightness.fill('30');
    await brightness.blur();

    // 2. Crop
    await studio.selectTool('Crop');
    await studio.selectRatio('1:1');
    await studio.applyCropFromInspector();

    // 3. Rotate right
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Rotate');
    await studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' }).click();

    // 4. Resize
    await studio.selectTransformTab('Resize');
    const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });
    await width.fill('400');
    await width.blur();
    await studio.inspector.getByRole('button', { name: 'Apply resize' }).click();

    // 5. Flip horizontally
    await studio.selectTransformTab('Flip');
    await studio.inspector.getByRole('button', { name: 'Flip horizontally' }).click();

    // 6. Adjust contrast
    await studio.selectTool('Adjust');
    const contrast = studio.inspector.getByRole('spinbutton').nth(1);
    await contrast.fill('-20');
    await contrast.blur();

    const afterAll = await studio.historySnapshot();
    expect(afterAll.entries).toBe(7); // baseline + 6 operations
    expect(afterAll.canUndo).toBe(true);
    expect(afterAll.canRedo).toBe(false);

    // Undo each operation one by one back to the baseline.
    for (let i = 0; i < 6; i++) {
      await studio.undoButton.click();
    }
    await expect(studio.undoButton).toBeDisabled();
    const size = await studio.canvasSize();
    expect(size).toEqual({ width: 1200, height: 800 });

    // Redo each operation one by one back to the end state.
    for (let i = 0; i < 6; i++) {
      await studio.redoButton.click();
    }
    await expect(studio.redoButton).toBeDisabled();
    const finalSize = await studio.canvasSize();
    expect(finalSize).toEqual({ width: 400, height: 400 });
  });

  test('a new operation after undo clears the stale redo tail', async ({ studio }) => {
    await studio.selectTool('Adjust');
    const brightness = studio.inspector.getByRole('spinbutton').first();
    await brightness.fill('10');
    await brightness.blur();
    await brightness.fill('20');
    await brightness.blur();

    await studio.undoButton.click();
    await expect(studio.redoButton).toBeEnabled();

    await brightness.fill('99');
    await brightness.blur();

    await expect(studio.redoButton).toBeDisabled();
    expect(await brightness.inputValue()).toBe('99');
  });

  test('switching tools during history navigation keeps state coherent', async ({ studio }) => {
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Rotate');
    const rotateRight = studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' });
    await rotateRight.click();
    await rotateRight.click();

    await studio.undoButton.click();
    await studio.selectTool('Adjust');
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Rotate');

    expect(await studio.canvasSize()).toEqual({ width: 800, height: 1200 });
  });

  test('export after a partial undo does not further mutate history', async ({ studio }) => {
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Rotate');
    await studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' }).click();
    await studio.undoButton.click();

    const before = await studio.historySnapshot();
    const dialog = await studio.openExport();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    const after = await studio.historySnapshot();

    expect(after).toEqual(before);
  });
});
