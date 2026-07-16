import type { Locator, Page } from '@playwright/test';

/** Drags a locator's center by a screen-pixel delta using explicit pointer events. */
export async function dragElementBy(
  page: Page,
  locator: Locator,
  deltaX: number,
  deltaY: number,
  steps = 12
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Cannot drag an element with no bounding box');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  try {
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps });
  } finally {
    // If the move throws mid-drag (e.g. the element re-renders and detaches),
    // the virtual mouse button must still be released — otherwise every
    // subsequent click on the page can misbehave, since the browser is left
    // believing the mouse button is still held down.
    await page.mouse.up();
  }
}

/** Drags starting from an explicit point (used for handles positioned at rectangle corners). */
export async function dragFromPointBy(
  page: Page,
  startX: number,
  startY: number,
  deltaX: number,
  deltaY: number,
  steps = 12
): Promise<void> {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  try {
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps });
  } finally {
    await page.mouse.up();
  }
}

/** Reads the current numeric value of a native range input via its accessible label. */
export async function sliderValue(page: Page, label: string | RegExp): Promise<number> {
  const slider = page.getByRole('slider', { name: label });
  const value = await slider.getAttribute('aria-valuenow');
  return value ? Number(value) : Number(await slider.inputValue());
}

/** Drags a native range slider by a fraction of its track width (-1..1). */
export async function dragSliderByFraction(
  page: Page,
  slider: Locator,
  fraction: number
): Promise<void> {
  const box = await slider.boundingBox();
  if (!box) throw new Error('Slider has no bounding box');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  try {
    await page.mouse.move(startX + fraction * box.width, startY, { steps: 10 });
  } finally {
    await page.mouse.up();
  }
}
