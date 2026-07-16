import { test, expect } from './support/fixtures';

test.describe('Image Studio export', () => {
  test('opens a labeled, focused export dialog', async ({ studio }) => {
    const dialog = await studio.openExport();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Export' })).toBeVisible();
  });

  test('exports PNG, JPEG, and WebP with the correct suggested extension', async ({ studio }) => {
    const cases: Array<{ format: string; extension: string }> = [
      { format: 'PNG', extension: 'png' },
      { format: 'JPEG', extension: 'jpeg' },
      { format: 'WebP', extension: 'webp' }
    ];

    for (const { format, extension } of cases) {
      const dialog = await studio.openExport();
      await dialog.getByRole('button', { name: format, exact: true }).click();
      const link = await studio.submitExport(dialog);
      const download = await link.getAttribute('download');
      expect(download?.endsWith(`.${extension}`)).toBe(true);
      await studio.dismissDownloadNotice();
    }
  });

  test('a real download can be triggered from the resulting link with correct MIME type', async ({
    studio
  }) => {
    const dialog = await studio.openExport();
    const link = await studio.submitExport(dialog);
    const [download] = await Promise.all([studio.page.waitForEvent('download'), link.click()]);
    expect(download.suggestedFilename().endsWith('.png')).toBe(true);
  });

  test('JPEG quality slider is only shown for lossy formats', async ({ studio }) => {
    const dialog = await studio.openExport();
    await expect(dialog.getByRole('slider', { name: /Quality/ })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'JPEG', exact: true }).click();
    await expect(dialog.getByRole('slider', { name: /Quality/ })).toBeVisible();
  });

  test('filename field updates and sanitizes input', async ({ studio }) => {
    const dialog = await studio.openExport();
    const filename = dialog.getByLabel('Filename');
    await filename.fill('my export/name');
    await expect(filename).toHaveValue('my export/name');
  });

  test('exported dimensions match a previously committed resize', async ({ studio }) => {
    await studio.selectTool('Transform');
    await studio.selectTransformTab('Resize');
    const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });
    await width.fill('500');
    await width.blur();
    await studio.inspector.getByRole('button', { name: 'Apply resize' }).click();

    const dialog = await studio.openExport();
    await expect(dialog.getByTestId('image-export-dimensions')).toHaveText(/Current 500 x 333px/);
  });

  test('export does not mutate editor history', async ({ studio }) => {
    const before = await studio.historySnapshot();
    const dialog = await studio.openExport();
    await studio.submitExport(dialog);
    const after = await studio.historySnapshot();
    expect(after).toEqual(before);
  });

  test('repeated exports keep working and the editor remains usable afterwards', async ({
    studio
  }) => {
    for (let i = 0; i < 2; i++) {
      const dialog = await studio.openExport();
      await studio.submitExport(dialog);
      await studio.dismissDownloadNotice();
    }
    await expect(studio.canvas).toBeVisible();
    await studio.selectTool('Adjust');
    await expect(studio.inspector.getByRole('heading', { name: 'Adjust' })).toBeVisible();
  });

  test('regression: the download notice does not permanently block the Export button', async ({
    studio
  }) => {
    // Regression test for a defect found during exploratory testing: the
    // demo host's post-export download link is fixed-positioned directly
    // over the top bar's Export/Close controls and, left up indefinitely,
    // permanently intercepted clicks meant for a subsequent Export. Fixed by
    // auto-dismissing the notice (packages/image-studio-demo/src/main.tsx)
    // and giving it an explicit dismiss control.
    const firstDialog = await studio.openExport();
    await studio.submitExport(firstDialog);
    await expect(studio.downloadLink).toBeVisible();

    // Without waiting for the auto-dismiss timer, opening Export again must
    // still work — either the notice no longer intercepts the click, or it
    // can be dismissed first.
    await studio.dismissDownloadNotice();
    await expect(studio.downloadLink).toHaveCount(0);
    const secondDialog = await studio.openExport();
    await expect(secondDialog).toBeVisible();
  });

  test('cancel closes the dialog and returns to the same editing state', async ({ studio }) => {
    await studio.selectTool('Crop');
    const dialog = await studio.openExport();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(studio.toolNav.getByRole('button', { name: 'Crop', exact: true })).toHaveClass(
      /ris-active/
    );
  });
});
