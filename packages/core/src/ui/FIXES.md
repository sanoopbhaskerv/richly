# UI Fixes — Table Menu Positioning & Responsive Layout

> **Date:** 2026-07-10  
> **Files changed:** `Toolbar.ts`, `theme.css`  
> **Reported issue:** The table toolbar dropdown was overflowing past the left edge of the screen on narrow viewports, and at small widths the "Edit current table" section was being clipped/hidden instead of stacking below the grid picker.

---

## Fix 1 — Dynamic dropdown positioning (`Toolbar.ts`)

### Problem

Every panel-type toolbar button renders a `div.sbe-tb-dd` that is `position: absolute` relative
to its `div.sbe-tb-wrap` parent. The table dropdown was styled with `right: 0` (right-aligned to
the button). The panel is **466 px wide** (`174 px` grid picker + `292 px` context section), so
on a narrow editor the panel's left edge spills off the viewport.

An earlier attempted fix used `max-width` + `transform: translateX(…)` to nudge the element.
**This did not work** because:
- `max-width` shrinks the container but the inner grid still has fixed column widths (`174px 292px`),
  so content inside overflowed/was clipped rather than reflowing.
- `translateX` shifts a visually painted element but does not change its layout rect — content
  that was already clipped by an ancestor remains clipped.

### Solution — compute exact `left` in JS

After painting the open panel, a `requestAnimationFrame` callback:

1. Reads the panel's actual viewport rect via `dd.getBoundingClientRect()`.
2. Reads the button wrap's viewport rect via `wrap.getBoundingClientRect()`.
3. Computes the **natural desired left** in viewport coords: right-align the panel to the wrap
   (`wrapRect.right − panelWidth`).
4. **Clamps** that value to `[8px, viewportWidth − panelWidth − 8px]`.
5. Converts back to **local coordinates** (relative to the `wrap` containing block):
   `clampedViewportLeft − wrapRect.left`.
6. Sets `dd.style.left` and `dd.style.right = 'auto'` directly — this repositions the panel
   layout itself, not just a visual shift on top of a clipped element.

On close (and before re-opening), the inline `left`/`right` styles are cleared so the CSS
default `right: 0` applies cleanly next time.

### Code location

**`packages/core/src/ui/Toolbar.ts`** — inside the `if (buttonSpec.panel)` branch of `render()`:

```ts
const close = (): void => {
  // Clear dynamic positioning so CSS defaults apply on next open.
  dd.style.left = '';
  dd.style.right = '';
  dd.classList.remove('sbe-open');
};

btn.addEventListener('click', (e) => {
  e.stopPropagation();
  const wasOpen = dd.classList.contains('sbe-open');
  doc.querySelectorAll('.sbe-tb-dd').forEach((p) => {
    const el = p as HTMLElement;
    el.style.left = '';
    el.style.right = '';
    el.classList.remove('sbe-open');
  });
  if (!wasOpen) {
    // Reset to CSS default before measuring.
    dd.style.left = '';
    dd.style.right = '';
    dd.classList.add('sbe-open');
    dd.firstElementChild?.dispatchEvent(new (doc.defaultView?.Event ?? Event)('sbe-panel-open'));

    const view = doc.defaultView;
    if (view) {
      requestAnimationFrame(() => {
        const panelRect = dd.getBoundingClientRect();
        const wrapRect  = wrap.getBoundingClientRect();
        const margin    = 8;
        const vpWidth   = view.innerWidth;

        // Right-align panel to the button wrap, then clamp to viewport.
        const naturalLeft = wrapRect.right - panelRect.width;
        const clampedLeft = Math.max(
          margin,
          Math.min(vpWidth - panelRect.width - margin, naturalLeft)
        );
        // Convert from viewport coords → local coords (wrap is the containing block).
        dd.style.left  = `${clampedLeft - wrapRect.left}px`;
        dd.style.right = 'auto';
      });
    }
  }
});
```

### Why `requestAnimationFrame`?

The panel must be visible (`display: block` via `.sbe-open`) before `getBoundingClientRect()`
returns a non-zero width. `rAF` fires after the browser has performed layout, guaranteeing
accurate measurements.

---

## Fix 2 — Responsive table panel layout (`theme.css`)

### Problem

The `.sbe-table-panel` used a hard two-column grid:

```css
.sbe-table-panel {
  display: grid;
  grid-template-columns: 174px 292px;
}
```

The `@media (max-width: 640px)` override previously collapsed it to `174px` (one column),
which **hid the right-hand "Edit current table" context section** entirely.

### Solution

At `≤ 640 px` the panel switches to a **single-column, two-row** layout so both sections are
visible and stacked vertically:

```css
@media (max-width: 640px) {
  /* Stack grid picker above context section instead of side-by-side. */
  .sbe-table-panel {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }
  .sbe-table-context {
    border-left: 0;
    border-top: 1px solid var(--sbe-border);
    padding: 12px 4px 4px;
  }
  /* Dropdown position clamping on narrow screens is handled by JS in Toolbar.ts.
     No static position/transform override needed here. */
}
```

The base `right: 0` rule on the table dropdown is kept as the **CSS default** (for when JS
has not yet run or has been reset), with a comment pointing to the JS for the actual clamping:

```css
.sbe-tb-dd[data-testid='dd-table'] {
  /* Default: right-align to the button.
     Actual clamped position is computed in Toolbar.ts (requestAnimationFrame)
     and applied as inline left/right style to stay within the viewport. */
  left: auto;
  right: 0;
}
```

---

## What was removed

| Removed | Reason |
|---------|--------|
| `max-width: min(466px, calc(100vw - 16px))` on table dropdown | Did not help — inner grid columns are fixed width, content clipped rather than reflow |
| `transform: translateX(-50%)` in media query | CSS transforms shift visual paint only; do not fix layout clipping |
| `left: 50%` in media query | Superseded by JS dynamic positioning |

---

## Summary

| # | File | Change | Effect |
|---|------|--------|--------|
| 1 | `Toolbar.ts` | `rAF` measures panel + wrap rects, sets `dd.style.left` exactly so panel stays within 8 px of both viewport edges | Panel repositioned in the DOM, not just visually shifted — fully fixes the left-overflow bug |
| 2 | `theme.css` | `@media ≤640px`: `grid-template-columns: 1fr; grid-template-rows: auto auto` | "Edit current table" section stacks below grid picker instead of being clipped |
| 3 | `theme.css` | Removed `max-width` / `transform` / `left: 50%` hacks | Eliminated conflicting static overrides that were interfering with the JS fix |
