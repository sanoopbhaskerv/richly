import { test, expect } from './support/fixtures';

const viewports = [
  { width: 2048, height: 935, label: 'target-reference' },
  { width: 1440, height: 900, label: 'wide-desktop' },
  { width: 1024, height: 768, label: 'tablet-landscape' },
  { width: 768, height: 1024, label: 'tablet-portrait' },
  { width: 390, height: 844, label: 'mobile' },
  { width: 360, height: 800, label: 'mobile-small' },
  { width: 320, height: 568, label: 'mobile-minimum' }
] as const;

test.describe('Image Studio responsive layout', () => {
  for (const viewport of viewports) {
    test(`no page overflow at ${viewport.label} (${viewport.width}x${viewport.height})`, async ({
      studio,
      page
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const overflow = await studio.pageOverflow();
      expect(
        overflow.scrollWidth,
        `scrollWidth (${overflow.scrollWidth}) must not exceed clientWidth (${overflow.clientWidth}) at ${viewport.label}`
      ).toBeLessThanOrEqual(overflow.clientWidth);
    });
  }

  test('regression: bottom tool navigation does not blow out the page at 320px', async ({
    studio,
    page
  }) => {
    // Regression test for a defect found during exploratory testing: a bare
    // `1fr` grid track (equivalent to `minmax(auto, 1fr)`) let the compact
    // single-column layout grow past the viewport to fit its widest row,
    // instead of clamping to `minmax(0, 1fr)`. Fixed in
    // packages/image-studio/src/styles/index.css (.ris-root, .ris-layout).
    await page.setViewportSize({ width: 320, height: 568 });
    const overflow = await studio.pageOverflow();
    expect(overflow.scrollWidth).toBe(overflow.clientWidth);
  });

  test('desktop shows a tool rail and inspector; compact shows bottom nav and sheet', async ({
    studio,
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('.ris-tools-rail')).toBeVisible();
    await expect(studio.inspector).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.ris-tools-bottom')).toBeVisible();
    await expect(studio.bottomSheet).toBeVisible();
  });

  test('crop remains usable at the minimum supported width', async ({ studio, page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await studio.selectTool('Crop');
    await expect(studio.cropOverlay).toBeVisible();
    await expect(studio.cropHandle('se')).toBeVisible();
  });

  test('tool and session state survive a viewport resize', async ({ studio, page }) => {
    await studio.selectTool('Adjust');
    const brightness = studio.inspector.getByRole('spinbutton').first();
    await brightness.fill('42');
    await brightness.blur();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1440, height: 900 });

    await expect(studio.inspector.getByRole('spinbutton').first()).toHaveValue('42');
    await expect(studio.toolNav.getByRole('button', { name: 'Adjust', exact: true })).toHaveClass(
      /ris-active/
    );
  });
});
