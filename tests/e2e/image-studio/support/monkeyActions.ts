import type { Page } from '@playwright/test';
import type { ImageStudioPage } from './imageStudioPage';
import { dragElementBy, dragFromPointBy, dragSliderByFraction } from './canvasInteractions';
import { pickInt, pickOne, type MonkeyState } from './monkeyModel';

const RATIOS = ['Original', 'Free', '1:1', '4:5', '16:9', '9:16', '3:2', '2:3'] as const;
const CROP_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
const EXPORT_FORMATS = ['PNG', 'JPEG', 'WebP'] as const;
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 }
] as const;

export interface MonkeyContext {
  readonly page: Page;
  readonly studio: ImageStudioPage;
  readonly rng: () => number;
  readonly state: MonkeyState;
}

async function safeClick(locator: ReturnType<Page['getByRole']>): Promise<void> {
  if (await locator.isVisible().catch(() => false)) {
    if (await locator.isEnabled().catch(() => false)) await locator.click();
  }
}

/** Executes one named monkey action against the running app, mutating `ctx.state`. */
export async function executeMonkeyAction(name: string, ctx: MonkeyContext): Promise<void> {
  const { page, studio, rng, state } = ctx;

  switch (name) {
    case 'selectToolAdjust':
      await studio.selectTool('Adjust');
      state.activeTool = 'adjust';
      return;
    case 'selectToolCrop':
      await studio.selectTool('Crop');
      state.activeTool = 'crop';
      return;
    case 'selectToolTransform':
      await studio.selectTool('Transform');
      state.activeTool = 'transform';
      // TransformPanel is unmounted whenever another tool is active and
      // remounts fresh (local `tab` state defaults to 'resize') every time
      // Transform is re-selected — mirror that so later actions don't target
      // a sub-tab the real component isn't actually showing.
      state.transformTab = 'resize';
      return;

    case 'selectAspectRatio':
      await studio.selectRatio(pickOne(rng, RATIOS));
      return;
    case 'dragCropHandle': {
      const handle = pickOne(rng, CROP_HANDLES);
      const dx = pickInt(rng, -60, 60);
      const dy = pickInt(rng, -60, 60);
      await dragElementBy(page, studio.cropHandle(handle), dx, dy).catch(() => undefined);
      return;
    }
    case 'moveCropFrame': {
      const box = await studio.cropOverlay.boundingBox();
      if (!box) return;
      const startX = box.x + box.width * 0.5;
      const startY = box.y + box.height * 0.5;
      await dragFromPointBy(
        page,
        startX,
        startY,
        pickInt(rng, -30, 30),
        pickInt(rng, -30, 30),
        8
      ).catch(() => undefined);
      return;
    }
    case 'applyCrop':
      await safeClick(studio.inspector.getByRole('button', { name: 'Apply crop' }));
      return;
    case 'cancelCrop':
      await safeClick(studio.inspector.getByRole('button', { name: 'Cancel' }));
      return;
    case 'resetCrop':
      await safeClick(studio.inspector.getByRole('button', { name: 'Reset' }));
      return;

    case 'selectTransformTabResize':
      await studio.selectTransformTab('Resize');
      state.transformTab = 'resize';
      return;
    case 'selectTransformTabRotate':
      await studio.selectTransformTab('Rotate');
      state.transformTab = 'rotate';
      return;
    case 'selectTransformTabFlip':
      await studio.selectTransformTab('Flip');
      state.transformTab = 'flip';
      return;

    case 'changeWidth': {
      const width = studio.inspector.getByRole('spinbutton', { name: 'Width' });
      if (await width.isVisible().catch(() => false)) {
        await width.fill(String(pickInt(rng, 50, 1500)));
        await width.blur();
      }
      return;
    }
    case 'changeHeight': {
      const height = studio.inspector.getByRole('spinbutton', { name: 'Height' });
      if (await height.isVisible().catch(() => false)) {
        await height.fill(String(pickInt(rng, 50, 1500)));
        await height.blur();
      }
      return;
    }
    case 'toggleAspectLock':
      await safeClick(studio.inspector.getByRole('button', { name: 'Maintain aspect ratio' }));
      return;
    case 'toggleResizeUnit':
      await safeClick(
        studio.inspector.getByRole('button', { name: rng() > 0.5 ? 'Percent' : 'Pixels' })
      );
      return;
    case 'applyResize':
      await safeClick(studio.inspector.getByRole('button', { name: 'Apply resize' }));
      return;
    case 'cancelResize':
      await safeClick(studio.inspector.getByRole('button', { name: 'Cancel' }));
      return;

    case 'rotateLeft':
      await safeClick(studio.inspector.getByRole('button', { name: 'Rotate left 90 degrees' }));
      return;
    case 'rotateRight':
      await safeClick(studio.inspector.getByRole('button', { name: 'Rotate right 90 degrees' }));
      return;
    case 'changeStraighten': {
      const slider = studio.inspector.getByRole('slider', { name: /Straighten/ });
      if (await slider.isVisible().catch(() => false)) {
        await dragSliderByFraction(page, slider, (rng() - 0.5) * 0.6).catch(() => undefined);
      }
      return;
    }
    case 'resetTransformDraft':
      await safeClick(studio.inspector.getByRole('button', { name: 'Reset draft' }));
      return;
    case 'flipHorizontal':
      await safeClick(studio.inspector.getByRole('button', { name: 'Flip horizontally' }));
      return;
    case 'flipVertical':
      await safeClick(studio.inspector.getByRole('button', { name: 'Flip vertically' }));
      return;

    case 'changeAdjustment': {
      const spins = await studio.inspector.getByRole('spinbutton').all();
      if (spins.length === 0) return;
      const spin = pickOne(rng, spins);
      await spin.fill(String(pickInt(rng, -100, 100)));
      await spin.blur();
      return;
    }
    case 'resetAdjustments':
      await safeClick(studio.inspector.getByRole('button', { name: 'Reset all' }));
      return;

    case 'undo':
      if (await studio.undoButton.isEnabled()) await studio.undoButton.click();
      return;
    case 'redo':
      if (await studio.redoButton.isEnabled()) await studio.redoButton.click();
      return;
    case 'zoomIn':
      await studio.zoomInButton.click();
      return;
    case 'zoomOut':
      await studio.zoomOutButton.click();
      return;
    case 'fit':
      await page.keyboard.press('0');
      return;
    case 'toggleBefore':
      await studio.beforeButton.click();
      return;

    case 'openExport':
      await studio.exportButton.click();
      state.exportOpen = true;
      return;
    case 'changeExportFormat': {
      const dialog = page.getByRole('dialog', { name: 'Export image' });
      await safeClick(
        dialog.getByRole('button', { name: pickOne(rng, EXPORT_FORMATS), exact: true })
      );
      return;
    }
    case 'changeExportQuality': {
      const dialog = page.getByRole('dialog', { name: 'Export image' });
      const slider = dialog.getByRole('slider', { name: /Quality/ });
      if (await slider.isVisible().catch(() => false)) {
        await dragSliderByFraction(page, slider, (rng() - 0.5) * 0.8).catch(() => undefined);
      }
      return;
    }
    case 'cancelExport': {
      const dialog = page.getByRole('dialog', { name: 'Export image' });
      await safeClick(dialog.getByRole('button', { name: 'Cancel' }));
      state.exportOpen = false;
      return;
    }
    case 'exportImage': {
      const dialog = page.getByRole('dialog', { name: 'Export image' });
      const submit = dialog.getByRole('button', { name: 'Export image' });
      if (await submit.isEnabled().catch(() => false)) {
        // The demo host renders a download link rather than triggering a
        // native download directly; wait for that link instead of a
        // 'download' event, which never fires from this click alone.
        await submit.click();
        await studio.downloadLink
          .waitFor({ state: 'visible', timeout: 5000 })
          .catch(() => undefined);
        // Dismiss immediately rather than relying on its auto-dismiss timer,
        // so a fast-paced monkey run doesn't hit its fixed-position overlay
        // over the top bar on a subsequent action.
        await studio.dismissDownloadNotice();
      }
      state.exportOpen = false;
      return;
    }

    case 'clickFilmstripThumbnail': {
      const thumbnails = await page.getByRole('button', { name: /^Image \d$/ }).all();
      if (thumbnails.length > 0) await pickOne(rng, thumbnails).click();
      return;
    }
    case 'resizeViewport': {
      const viewport = pickOne(rng, VIEWPORTS);
      await page.setViewportSize(viewport);
      return;
    }
    default:
      throw new Error(`Unknown monkey action: ${name}`);
  }
}
