import { test, expect } from './support/fixtures';

test.describe('Image Studio before/after comparison', () => {
  test('pointer press-and-hold toggles compare mode without creating history', async ({
    studio,
    page
  }) => {
    const box = await studio.beforeButton.boundingBox();
    if (!box) throw new Error('Before button not visible');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(studio.beforeButton).toHaveAttribute('aria-pressed', 'true');
    // A real hold is a sustained press, not an instantaneous down/up — wait
    // past the app's tap/hold duration threshold before releasing.
    await page.waitForTimeout(300);
    await page.mouse.up();
    await expect(studio.beforeButton).toHaveAttribute('aria-pressed', 'false');
    await expect(studio.undoButton).toBeDisabled();
  });

  test('click/tap toggles before mode for touch accessibility', async ({ studio }) => {
    await studio.beforeButton.click();
    await expect(studio.beforeButton).toHaveAttribute('aria-pressed', 'true');
    await studio.beforeButton.click();
    await expect(studio.beforeButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('keyboard space toggles before mode while focused', async ({ studio, page }) => {
    await studio.beforeButton.focus();
    await page.keyboard.down(' ');
    await expect(studio.beforeButton).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.up(' ');
    await expect(studio.beforeButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('comparison during an active adjustment does not clear the draft', async ({ studio }) => {
    await studio.selectTool('Adjust');
    const brightness = studio.inspector.getByRole('spinbutton').first();
    await brightness.fill('40');
    await brightness.blur();

    await studio.pressBeforeHold();

    expect(await brightness.inputValue()).toBe('40');
    await expect(studio.undoButton).toBeEnabled();
  });

  test('comparison while a crop draft is active preserves the draft and active tool', async ({
    studio
  }) => {
    await studio.selectTool('Crop');
    await studio.selectRatio('1:1');
    const draftBefore = await studio.cropDraftDimensions();

    await studio.pressBeforeHold();

    await expect(studio.toolNav.getByRole('button', { name: 'Crop', exact: true })).toHaveClass(
      /ris-active/
    );
    const draftAfter = await studio.cropDraftDimensions();
    expect(draftAfter).toEqual(draftBefore);
  });

  test('comparison after multiple transforms creates no additional history', async ({ studio }) => {
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Rotate');
    await studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' }).click();
    const before = await studio.historySnapshot();

    await studio.pressBeforeHold();

    const after = await studio.historySnapshot();
    expect(after).toEqual(before);
  });
});
