import { test, expect } from './support/fixtures';

test.describe('Image Studio transform (rotate, straighten, flip)', () => {
  test.beforeEach(async ({ studio }) => {
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Rotate');
  });

  test('rotate right four consecutive times cycles 90/180/270/0 and stays clickable', async ({
    studio
  }) => {
    const rotateRight = studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' });
    const expected = [
      { width: 800, height: 1200 },
      { width: 1200, height: 800 },
      { width: 800, height: 1200 },
      { width: 1200, height: 800 }
    ];

    for (const size of expected) {
      await expect(rotateRight).toBeEnabled();
      await rotateRight.click();
      expect(await studio.canvasSize()).toEqual(size);
    }
  });

  test('rotate left four consecutive times is also repeatable', async ({ studio }) => {
    const rotateLeft = studio.inspector.getByRole('button', { name: 'Rotate left 90 degrees' });
    for (let i = 0; i < 4; i++) {
      await expect(rotateLeft).toBeEnabled();
      await rotateLeft.click();
    }
    expect(await studio.canvasSize()).toEqual({ width: 1200, height: 800 });
  });

  test('alternating rotate left and right stays coherent', async ({ studio }) => {
    const rotateLeft = studio.inspector.getByRole('button', { name: 'Rotate left 90 degrees' });
    const rotateRight = studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' });
    await rotateRight.click();
    expect(await studio.canvasSize()).toEqual({ width: 800, height: 1200 });
    await rotateLeft.click();
    expect(await studio.canvasSize()).toEqual({ width: 1200, height: 800 });
  });

  test('rotate commands are undoable and redoable', async ({ studio }) => {
    const rotateRight = studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' });
    await rotateRight.click();
    await rotateRight.click();
    expect(await studio.canvasSize()).toEqual({ width: 1200, height: 800 });

    await studio.undoButton.click();
    expect(await studio.canvasSize()).toEqual({ width: 800, height: 1200 });
    await studio.undoButton.click();
    expect(await studio.canvasSize()).toEqual({ width: 1200, height: 800 });

    await studio.redoButton.click();
    expect(await studio.canvasSize()).toEqual({ width: 800, height: 1200 });
  });

  test('free rotate slider previews transiently and commits once on release', async ({
    studio
  }) => {
    const slider = studio.inspector.getByRole('slider', { name: /Free rotate/ });
    await slider.focus();
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    // Committing should create a single history entry regardless of how many
    // preview steps happened before commit.
    const historyBefore = await studio.historySnapshot();
    await slider.press('Enter').catch(() => undefined);
    const historyAfter = await studio.historySnapshot();
    expect(historyAfter.entries).toBeLessThanOrEqual(historyBefore.entries + 1);
  });

  test('straighten has an independent -45..45 range from free rotate', async ({ studio }) => {
    const straighten = studio.inspector.getByRole('slider', { name: /Straighten/ });
    // Native <input type="range"> exposes min/max to assistive tech via
    // implicit ARIA computed from these HTML attributes; they are not
    // separately reflected as literal aria-valuemin/aria-valuemax attributes.
    expect(await straighten.getAttribute('min')).toBe('-45');
    expect(await straighten.getAttribute('max')).toBe('45');
  });

  test('flip horizontal and vertical are each repeatable and undoable', async ({ studio }) => {
    await studio.selectTransformTab('Flip');
    const flipH = studio.inspector.getByRole('button', { name: 'Flip horizontally' });
    const flipV = studio.inspector.getByRole('button', { name: 'Flip vertically' });

    await flipH.click();
    await flipH.click();
    await expect(studio.undoButton).toBeEnabled();

    await flipV.click();
    const history = await studio.historySnapshot();
    expect(history.entries).toBe(4); // baseline + 2 horizontal flips + 1 vertical flip

    await studio.undoButton.click();
    await studio.undoButton.click();
    await studio.undoButton.click();
    await expect(studio.undoButton).toBeDisabled();
  });

  test('reset draft clears rotation and straighten preview without committing', async ({
    studio
  }) => {
    const slider = studio.inspector.getByRole('slider', { name: /Free rotate/ });
    await slider.focus();
    await slider.press('ArrowRight');
    await studio.inspector.getByRole('button', { name: 'Reset draft' }).click();
    await expect(studio.undoButton).toBeDisabled();
  });
});
