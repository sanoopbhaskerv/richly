import { test, expect } from './support/fixtures';
import { dragElementBy } from './support/canvasInteractions';

test.describe('Image Studio crop', () => {
  test.beforeEach(async ({ studio }) => {
    await studio.selectTool('Crop');
  });

  test('starts immediately with a full-bounds draft, grid, mask, and eight handles', async ({
    studio
  }) => {
    await expect(studio.cropOverlay).toBeVisible();
    await expect(studio.cropGrid).toBeVisible();
    expect(await studio.cropMasks.count()).toBe(4);

    const handles: Array<'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'> = [
      'nw',
      'n',
      'ne',
      'e',
      'se',
      's',
      'sw',
      'w'
    ];
    for (const handle of handles) {
      await expect(studio.cropHandle(handle)).toBeVisible();
    }

    const draft = await studio.cropDraftDimensions();
    expect(draft).toEqual({ width: 1200, height: 800 });
  });

  test('dragging each corner and edge handle updates the crop dimensions', async ({
    studio,
    page
  }) => {
    const before = await studio.cropDraftDimensions();
    expect(before).not.toBeNull();

    // The draft starts at full image bounds, so each handle must be dragged
    // *inward* (toward the crop center) to reliably shrink the rect — dragging
    // outward from a full-bounds crop is a no-op because it's already clamped
    // at the image edge.
    const handles: Record<'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w', [number, number]> = {
      nw: [20, 20],
      n: [0, 20],
      ne: [-20, 20],
      e: [-20, 0],
      se: [-20, -20],
      s: [0, -20],
      sw: [20, -20],
      w: [20, 0]
    };
    for (const handle of Object.keys(handles) as Array<keyof typeof handles>) {
      await studio.selectTool('Adjust');
      await studio.selectTool('Crop');
      const beforeDrag = await studio.cropDraftDimensions();
      const [dx, dy] = handles[handle];
      await dragElementBy(page, studio.cropHandle(handle), dx, dy);
      const afterDrag = await studio.cropDraftDimensions();
      expect(afterDrag, `handle ${handle} should change crop dimensions`).not.toEqual(beforeDrag);
    }
  });

  test('dragging the crop interior moves the frame without changing its size', async ({
    studio,
    page
  }) => {
    await dragElementBy(page, studio.cropHandle('se'), -200, -200);
    const sizeBeforeMove = await studio.cropDraftDimensions();

    await studio.cropOverlay.click({ position: { x: 5, y: 5 } }).catch(() => undefined);
    const box = await studio.cropOverlay.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 4 + 15, box.y + box.height / 4 + 10, {
        steps: 10
      });
      await page.mouse.up();
    }

    const sizeAfterMove = await studio.cropDraftDimensions();
    expect(sizeAfterMove).toEqual(sizeBeforeMove);
  });

  test('aspect ratio presets constrain the crop rectangle', async ({ studio }) => {
    await studio.selectRatio('1:1');
    const square = await studio.cropDraftDimensions();
    expect(square?.width).toBe(square?.height);

    await studio.selectRatio('16:9');
    const widescreen = await studio.cropDraftDimensions();
    expect(widescreen).not.toBeNull();
    if (widescreen) {
      expect(Math.abs(widescreen.width / widescreen.height - 16 / 9)).toBeLessThan(0.02);
    }
  });

  test('editing width and height fields updates the draft', async ({ studio }) => {
    await studio.selectRatio('Free');
    const width = studio.inspector.getByRole('spinbutton', { name: 'W' });
    const height = studio.inspector.getByRole('spinbutton', { name: 'H' });
    await width.fill('500');
    await width.blur();
    await height.fill('300');
    await height.blur();

    const draft = await studio.cropDraftDimensions();
    expect(draft).toEqual({ width: 500, height: 300 });
  });

  test('Apply creates exactly one history entry and commits the crop', async ({ studio }) => {
    await studio.selectRatio('1:1');
    await studio.applyCropFromInspector();

    await expect(studio.undoButton).toBeEnabled();
    const size = await studio.canvasSize();
    expect(size.width).toBe(size.height);

    const history = await studio.historySnapshot();
    expect(history.entries).toBe(2); // baseline entry + one committed crop
  });

  test('Cancel creates no history entry and restores the previous image', async ({ studio }) => {
    await studio.selectRatio('1:1');
    await studio.cancelCropFromInspector();

    await expect(studio.undoButton).toBeDisabled();
    const size = await studio.canvasSize();
    expect(size).toEqual({ width: 1200, height: 800 });
  });

  test('Escape cancels the active crop draft without creating history', async ({
    studio,
    page
  }) => {
    await studio.selectRatio('1:1');
    await studio.cropOverlay.focus();
    await page.keyboard.press('Escape');
    await expect(studio.undoButton).toBeDisabled();
  });

  test('Enter applies the active crop draft', async ({ studio, page }) => {
    await studio.selectRatio('1:1');
    await studio.cropOverlay.focus();
    await page.keyboard.press('Enter');
    await expect(studio.undoButton).toBeEnabled();
    const size = await studio.canvasSize();
    expect(size.width).toBe(size.height);
  });

  test('crop works again after a previous crop is applied', async ({ studio }) => {
    await studio.selectRatio('1:1');
    await studio.applyCropFromInspector();
    const firstSize = await studio.canvasSize();

    await studio.selectRatio('Free');
    const width = studio.inspector.getByRole('spinbutton', { name: 'W' });
    await width.fill(String(Math.round(firstSize.width / 2)));
    await width.blur();
    await studio.applyCropFromInspector();

    const secondSize = await studio.canvasSize();
    expect(secondSize.width).toBe(Math.round(firstSize.width / 2));
  });

  test('crop remains usable after switching to another tool and back', async ({ studio }) => {
    await studio.selectTool('Adjust');
    await studio.selectTool('Crop');
    await expect(studio.cropOverlay).toBeVisible();
    const draft = await studio.cropDraftDimensions();
    expect(draft).toEqual({ width: 1200, height: 800 });
  });

  test('no crop overlay remains attached after leaving the Crop tool', async ({ studio }) => {
    await studio.selectTool('Adjust');
    await expect(studio.cropOverlay).toHaveCount(0);
  });

  test('regression: crop draft resyncs with the real image after Undo (not a stale coordinate space)', async ({
    studio
  }) => {
    // Regression test for a defect found during exploratory testing: after
    // applying a crop and then undoing it, the crop draft's frozen `bounds`
    // stayed pinned to the post-crop size instead of the restored image size.
    // Any further drag/apply against that stale draft silently mis-cropped
    // the real (larger) image. See fix in packages/image-react/src/hooks.ts
    // (useCropTool) which resyncs the draft whenever the session's committed
    // output size changes for a reason other than the draft itself.
    await studio.selectRatio('1:1');
    await studio.applyCropFromInspector();
    const croppedSize = await studio.canvasSize();
    expect(croppedSize).toEqual({ width: 800, height: 800 });

    await studio.undoButton.click();
    const restoredSize = await studio.canvasSize();
    expect(restoredSize).toEqual({ width: 1200, height: 800 });

    // Set an explicit crop size that only fits within the *restored* 1200x800
    // bounds, not the stale 800x800 bounds. If the draft were still stale,
    // the width would be silently clamped and the final crop would not match.
    await studio.selectRatio('Free');
    const width = studio.inspector.getByRole('spinbutton', { name: 'W' });
    const height = studio.inspector.getByRole('spinbutton', { name: 'H' });
    await width.fill('1000');
    await width.blur();
    await height.fill('700');
    await height.blur();

    await studio.applyCropFromInspector();
    const finalSize = await studio.canvasSize();
    expect(finalSize).toEqual({ width: 1000, height: 700 });
  });
});
