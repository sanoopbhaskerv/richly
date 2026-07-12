# WP3 — Text-style UI

Implement the user interface components for text styles: color swatches dropdown panels for text color and background color, a font size dropdown select on the toolbar, and superscript/subscript buttons/menu entries.

## Approved Design Deviations

- **UiRegistry modification**: Although `IMPLEMENTATION-0.5.md` originally stated "UiRegistry: no change expected", we are intentionally restructuring the control schema using a discriminated union so invalid field combinations fail at compile time. This is a correct architectural correction, not scope creep.

---

## User Review Required

> [!IMPORTANT]
> **Keyboard Guard for Native Select**
> The toolbar roving handler at `Toolbar.ts:303` currently intercepts all arrow keys at container level. We will add an explicit early-exit guard using the toolbar document context: `const active = this.container.ownerDocument.activeElement; if (active instanceof HTMLSelectElement) return;`. This ensures native OS/browser select interaction is preserved across embedded/non-default document contexts.

> [!IMPORTANT]
> **Arrow Key Containment Inside Color Panel**
> Keydown events for `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` inside the color panel will call both `e.stopPropagation()` and `e.preventDefault()`, routing focus deterministically inside the grid cell matrix without triggering toolbar roving or browser scroll.

---

## Proposed Changes

### UI Registry Control Schema

#### [MODIFY] [UiRegistry.ts](file:///Users/sanoopbhaskerv/workspace/tinymce_clone/HTMlEditor/packages/core/src/ui/UiRegistry.ts)

Replace the current open-ended `ButtonSpec` interface with a **discriminated union** of explicit control variants. Invalid field combinations (e.g. `select + panel`) will fail at compile time.

```typescript
export interface SelectOption {
  label: string;
  value: string;
}

/** A standard momentary action button. */
export interface ButtonControl {
  type: 'button';
  icon: string;
  tooltip: string;
  command: string;
  args?: unknown;
  shortcut?: string;
}

/** A stateful toggle button (bold, italic, etc.). */
export interface ToggleControl {
  type: 'toggle';
  icon: string;
  tooltip: string;
  command: string;
  shortcut?: string;
}

/** A button that opens a floating panel (dropdowns, color pickers). */
export interface PanelControl {
  type: 'panel';
  icon: string;
  tooltip: string;
  panel: (editor: Editor, close: () => void) => HTMLElement;
}

/** A <select> dropdown control bound to a command. */
export interface SelectControl {
  type: 'select';
  tooltip: string;
  command: string;
  options: SelectOption[];
}

export type ButtonSpec = ButtonControl | ToggleControl | PanelControl | SelectControl;
```

> [!NOTE]
> Existing button registrations in core and plugins will need `type` discriminants added. Because this is an additive required field, TypeScript exhaustive checking will surface any missing callsites at compile time.
>
> **UiRegistry helper compatibility**: `addButton` and `addToggleButton` will remain as compatibility shims during migration. Their signatures will be updated to construct union-safe controls (`type: 'button'` and `type: 'toggle'`) while preserving existing plugin callsites. New callsites may still register full `ButtonSpec` variants directly.

---

### Icons Registry

#### [MODIFY] [icons.ts](file:///Users/sanoopbhaskerv/workspace/tinymce_clone/HTMlEditor/packages/core/src/ui/icons.ts)

- Add SVG paths for 4 new icons: `forecolor`, `backcolor`, `superscript`, and `subscript`.

---

### Toolbar Renderer

#### [MODIFY] [Toolbar.ts](file:///Users/sanoopbhaskerv/workspace/tinymce_clone/HTMlEditor/packages/core/src/ui/Toolbar.ts)

- Change type of `this.buttons` from `HTMLButtonElement[]` to `HTMLElement[]`.
- Add `private selects: { name: string; el: HTMLSelectElement; command: string }[] = [];`.
- **Roving keyboard guard** (add at top of the existing arrow-key handler block at `Toolbar.ts:303`):
  ```typescript
  const active = this.container.ownerDocument.activeElement;
  if (active instanceof HTMLSelectElement) return;
  ```
- In `Toolbar.render(spec)`:
  - Switch on `buttonSpec.type` to render the appropriate control element.
  - For `type === 'select'`: render `<select class="rly-tb-select" data-testid="tb-select-${name}">`. Populate options from `SelectOption[]` using `document.createElement('option')` plus `.textContent` and `.value` assignment (no template-string injection). Add a `change` listener that executes `editor.execCommand(spec.command, select.value)` **without** calling `editor.focus()` afterwards.
  - Register it in `this.selects` and push to `this.buttons` for roving tabindex participation.
- In `Toolbar.refresh()`:
  - Loop through `this.selects`:
    - Fetch the active value via `editor.queryCommandValue(s.command)`.
    - Remove any prior temporary option: `el.querySelector('.rly-temp-option')?.remove()`.
    - If the value is non-empty and not matched in preset options:
      ```typescript
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      opt.className = 'rly-temp-option';
      el.appendChild(opt);
      ```
    - Set `el.value = value`.

---

### Editor Defaults

#### [MODIFY] [Editor.ts](file:///Users/sanoopbhaskerv/workspace/tinymce_clone/HTMlEditor/packages/core/src/editor/Editor.ts)

- Update `DEFAULT_TOOLBAR`:
  ```typescript
  const DEFAULT_TOOLBAR =
    'undo redo | selectall copy cut paste | bold italic underline strikethrough superscript subscript | forecolor backcolor fontsize | h1 h2 paragraph blockquote | alignleft aligncenter alignright | bullist numlist outdent indent | link unlink table image | findreplace preview visualblocks | code fullscreen removeformat';
  ```

---

### Swatch Panel & Button Definitions

#### [MODIFY] [textstyle.ts](file:///Users/sanoopbhaskerv/workspace/tinymce_clone/HTMlEditor/packages/core/src/plugins/textstyle.ts)

- Create `createColorPanel(editor, command, close): HTMLElement`:
  - Grid container: `role="grid"`, 8-column layout.
  - Swatch buttons: `role="gridcell"`, `data-testid="swatch-<hex-no-hash>"`, `aria-label="<human-readable color name>"` from a static map.
  - Roving tabindex inside the panel — only the focused swatch has `tabIndex=0`.
  - "None" button: `data-testid="swatch-none"`, `aria-label="No color"`.
  - Keydown handler on panel:
    - `ArrowLeft/Right/Up/Down`: `e.stopPropagation()` + `e.preventDefault()` + deterministic grid focus movement.
    - `Escape`: `e.stopPropagation()` + `close()` + `editor.focus()`.
  - `mousedown` on all interactive elements: `e.preventDefault()` to preserve editor selection.
  - On swatch click: execute command, close panel, `editor.focus()`.
- `textStylePlugin.init` registers:
  - `forecolor` as `PanelControl` using `createColorPanel`.
  - `backcolor` as `PanelControl` using `createColorPanel`.
  - `fontsize` as `SelectControl` with `options: [{ label: 'Size', value: '' }, ...fontSizes.map(s => ({ label: s, value: s }))]`.
  - `superscript` and `subscript` as `ToggleControl`.
  - Format menu items for `superscript`, `subscript`, and per-preset flat font size entries.

---

### Style Sheets

#### [MODIFY] [theme.css](file:///Users/sanoopbhaskerv/workspace/tinymce_clone/HTMlEditor/packages/core/src/ui/theme.css)

- `.rly-tb-select`: styled toolbar select control.
- `.rly-color-panel`, `.rly-color-grid`, `.rly-color-swatch`, `.rly-color-clear-btn`: color picker panel layout.

---

### Test-ID Registry

#### [MODIFY] [TESTING.md](file:///Users/sanoopbhaskerv/workspace/tinymce_clone/HTMlEditor/TESTING.md)

Add canonical rows to the test-id registry for all new WP3 identifiers:

| Test ID                | Element                          | Owner          | Notes                          |
| ---------------------- | -------------------------------- | -------------- | ------------------------------ |
| `dd-forecolor`         | Toolbar panel button (forecolor) | `Toolbar.ts`   | Dropdown trigger               |
| `dd-backcolor`         | Toolbar panel button (backcolor) | `Toolbar.ts`   | Dropdown trigger               |
| `tb-select-fontsize`   | Toolbar `<select>`               | `Toolbar.ts`   | Generates id from control name |
| `swatch-<hex-no-hash>` | Swatch button inside panel       | `textstyle.ts` | e.g. `swatch-ff0000`           |
| `swatch-none`          | Clear button inside panel        | `textstyle.ts` | Clears style                   |

---

## Verification Plan

### Automated Tests

- `yarn test` — all Vitest unit tests pass.
- `yarn typecheck` — discriminated union catches any invalid `ButtonSpec` mixes.
- `yarn lint && yarn format:check`.

### Playwright E2E Tests

#### [NEW] [text-style.spec.ts](file:///Users/sanoopbhaskerv/workspace/tinymce_clone/HTMlEditor/e2e/text-style.spec.ts)

1. **Swatch Color Selection**: Select text → click `forecolor`/`backcolor` → pick swatch → verify HTML color.
2. **Swatch Clear**: Click "None" → verify color removed.
3. **Collapsed Caret Styling**: Place cursor → pick swatch → type → verify new content inherits style.
4. **Font Size Preset**: Select text → choose size from `tb-select-fontsize` → verify `font-size` CSS applied.
5. **Font Size Fallback**: Inject non-preset size via DOM → move cursor into it → verify `tb-select-fontsize` shows temporary option.
6. **Selection Tracking**: Move cursor across styled / unstyled regions → verify `tb-select-fontsize` updates.
7. **Sub/Superscript Mutual Exclusion**: Enable superscript → enable subscript → verify superscript inactive.
8. **Accessibility**:
   - Arrow keys inside color panel do not shift toolbar focus or scroll page.
   - `Escape` closes panel and restores editor focus.
   - All swatches have descriptive `aria-label` values.
9. **Overflow Toolbar**:
   - Shrink viewport to force formatting group into `tb-more`.
   - Open overflow → trigger font-size select and color swatch → verify identical formatting behavior.

```bash
yarn e2e --project=chromium
```
