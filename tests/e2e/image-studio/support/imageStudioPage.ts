import type { Locator, Page } from '@playwright/test';

export type ToolName = 'Adjust' | 'Crop' | 'Transform';
export type TransformTab = 'Resize' | 'Rotate' | 'Flip';
export type RatioLabel = 'Original' | 'Free' | '1:1' | '4:5' | '16:9' | '9:16' | '3:2' | '2:3';

/** Page object encapsulating locators and high-level actions for the Image Studio demo. */
export class ImageStudioPage {
  readonly page: Page;
  readonly root: Locator;
  readonly canvas: Locator;
  readonly toolNav: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;
  readonly zoomInButton: Locator;
  readonly zoomOutButton: Locator;
  readonly zoomLabel: Locator;
  readonly beforeButton: Locator;
  readonly exportButton: Locator;
  readonly closeButton: Locator;
  readonly historyStatus: Locator;
  readonly cropOverlay: Locator;
  readonly cropGrid: Locator;
  readonly cropMasks: Locator;
  readonly inspector: Locator;
  readonly bottomSheet: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId('image-studio-root');
    this.canvas = page.getByTestId('image-canvas');
    this.toolNav = page.getByRole('navigation', { name: 'Image tools' });
    this.undoButton = page.getByRole('button', { name: 'Undo' });
    this.redoButton = page.getByRole('button', { name: 'Redo' });
    this.zoomInButton = page.getByRole('button', { name: 'Zoom in' });
    this.zoomOutButton = page.getByRole('button', { name: 'Zoom out' });
    this.zoomLabel = page.locator('.ris-zoom-label');
    this.beforeButton = page.getByRole('button', { name: 'Before' });
    this.exportButton = page.getByRole('button', { name: 'Export', exact: true });
    this.closeButton = page.getByRole('button', { name: 'Close' });
    this.historyStatus = page.getByTestId('image-history-status');
    this.cropOverlay = page.getByTestId('image-crop-overlay');
    this.cropGrid = page.getByTestId('image-crop-grid');
    this.cropMasks = page.getByTestId('image-crop-mask');
    // Both the wide-layout inspector and the compact bottom-sheet inspector
    // are always mounted; CSS toggles which one is visible per breakpoint.
    // Target whichever is actually visible so helpers keep working across a
    // responsive viewport change (e.g. during monkey testing).
    this.inspector = page.locator(
      '[data-testid="image-inspector"]:visible, [data-testid="image-inspector-compact"]:visible'
    );
    this.bottomSheet = page.getByTestId('image-bottom-sheet');
  }

  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
    await this.root.waitFor({ state: 'visible' });
  }

  async selectTool(tool: ToolName): Promise<void> {
    await this.toolNav.getByRole('button', { name: tool, exact: true }).click();
  }

  cropHandle(handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'): Locator {
    return this.page.getByTestId(`image-crop-handle-${handle}`);
  }

  /** The floating Apply button inside the crop overlay (distinct from the inspector's Apply). */
  get cropOverlayApplyButton(): Locator {
    return this.cropOverlay.getByRole('button', { name: 'Apply crop' });
  }

  /** The inspector's Apply/Cancel/Reset row, scoped away from the overlay's floating Apply. */
  get cropInspectorActions(): Locator {
    return this.inspector;
  }

  async applyCropFromInspector(): Promise<void> {
    await this.inspector.getByRole('button', { name: 'Apply crop' }).click();
  }

  async cancelCropFromInspector(): Promise<void> {
    await this.inspector.getByRole('button', { name: 'Cancel' }).click();
  }

  async resetCropFromInspector(): Promise<void> {
    await this.inspector.getByRole('button', { name: 'Reset' }).click();
  }

  async selectRatio(ratio: RatioLabel): Promise<void> {
    await this.inspector.getByRole('button', { name: ratio, exact: true }).click();
  }

  async cropDraftDimensions(): Promise<{ width: number; height: number } | null> {
    const text = await this.page.evaluate(() => {
      const el = document.querySelector('[aria-label="Apply crop"]');
      return el?.parentElement?.textContent ?? null;
    });
    if (!text) return null;
    const match = /(\d+)x(\d+)/.exec(text);
    if (!match) return null;
    return { width: Number(match[1]), height: Number(match[2]) };
  }

  async canvasSize(): Promise<{ width: number; height: number }> {
    return this.canvas.evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      height: el.height
    }));
  }

  async historySnapshot(): Promise<{
    index: number;
    entries: number;
    canUndo: boolean;
    canRedo: boolean;
  }> {
    return this.historyStatus.evaluate((el) => ({
      index: Number(el.getAttribute('data-index')),
      entries: Number(el.getAttribute('data-entries')),
      canUndo: el.getAttribute('data-can-undo') === 'true',
      canRedo: el.getAttribute('data-can-redo') === 'true'
    }));
  }

  async selectTransformTab(tab: TransformTab): Promise<void> {
    await this.inspector.getByRole('tab', { name: tab }).click();
  }

  async openExport(): Promise<Locator> {
    await this.exportButton.click();
    const dialog = this.page.getByRole('dialog', { name: 'Export image' });
    await dialog.waitFor({ state: 'visible' });
    return dialog;
  }

  /** The demo host's post-export download affordance (not part of the reusable Image Studio). */
  get downloadLink(): Locator {
    return this.page.getByRole('link', { name: /^Download/ });
  }

  /**
   * Submits the open export dialog and waits for the demo host's download
   * link to update. The demo does not trigger a native browser download
   * merely by submitting export — it renders a `<a download>` affordance
   * that the user (or a test) must click separately to actually download.
   */
  async submitExport(dialog: Locator): Promise<Locator> {
    await dialog.getByRole('button', { name: 'Export image' }).click();
    await this.downloadLink.waitFor({ state: 'visible' });
    return this.downloadLink;
  }

  /** Dismisses the demo host's download notice so it stops covering the top bar. */
  async dismissDownloadNotice(): Promise<void> {
    const dismiss = this.page.getByRole('button', { name: 'Dismiss download notice' });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  }

  async pressBeforeHold(holdMs = 350): Promise<void> {
    const box = await this.beforeButton.boundingBox();
    if (!box) throw new Error('Before button not visible');
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    try {
      await this.page.waitForTimeout(holdMs);
    } finally {
      await this.page.mouse.up();
    }
  }

  async pageOverflow(): Promise<{ scrollWidth: number; clientWidth: number }> {
    return this.page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
  }
}
