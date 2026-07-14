import type { Bookmark } from '../../dom/SelectionManager';
import { colorsEqual, cssColorToHex, hexToHsva, hsvaToHex, normalizeHex } from './ColorUtils';
import { addPresetColor, addRecentColor, getPresetColors, getRecentColors } from './RecentColors';
import type { ColorDefinition, ColorPickerOptions, CustomPickerTab, HsvaColor } from './types';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const testIdColor = (value: string): string => value.replace(/^#/, '').replace(/[^a-z0-9]/gi, '-');

const button = (
  doc: Document,
  className: string,
  label: string,
  testId?: string
): HTMLButtonElement => {
  const element = doc.createElement('button');
  element.type = 'button';
  element.className = className;
  element.setAttribute('aria-label', label);
  if (testId) element.dataset.testid = testId;
  return element;
};

const sectionLabel = (doc: Document, text: string): HTMLElement => {
  const label = doc.createElement('div');
  label.className = 'rly-color-section-label';
  label.textContent = text;
  return label;
};

const colorButton = (
  doc: Document,
  color: ColorDefinition,
  selected: boolean,
  testId: string
): HTMLButtonElement => {
  const swatch = button(
    doc,
    'rly-color-swatch',
    `${color.label ?? 'Color'}, ${color.value}`,
    testId
  );
  swatch.setAttribute('aria-pressed', String(selected));
  swatch.classList.toggle('rly-selected', selected);
  swatch.style.setProperty('--rly-swatch-color', color.value);
  return swatch;
};

/**
 * Installs roving-tabindex navigation without letting focused swatches move
 * the surrounding document viewport.
 */
const installGridKeys = (grid: HTMLElement, swatches: HTMLButtonElement[], columns = 8): void => {
  const focusAt = (index: number): void => {
    const target = clamp(index, 0, swatches.length - 1);
    swatches.forEach((swatch, current) => (swatch.tabIndex = current === target ? 0 : -1));
    const view = grid.ownerDocument.defaultView;
    const viewport = view ? { x: view.scrollX, y: view.scrollY } : null;
    // Moving within the roving-tabindex grid must not move the page when a
    // palette is close to a viewport edge. Firefox can still scroll a few
    // pixels despite preventScroll, so restore that synchronous focus scroll
    // with smooth scrolling temporarily disabled.
    swatches[target]?.focus({ preventScroll: true });
    if (view && viewport) {
      const root = view.document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      const restoreViewport = (): void => {
        view.scrollTo(viewport.x, viewport.y);
      };
      const restoreAfterLayout = (frames: number): void => {
        if (frames === 0) {
          root.style.scrollBehavior = previousBehavior;
          return;
        }
        view.requestAnimationFrame(() => {
          restoreViewport();
          restoreAfterLayout(frames - 1);
        });
      };
      restoreViewport();
      // Firefox may defer the browser-owned focus scroll until layout. Cover
      // that bounded handoff without installing any persistent scroll hook.
      restoreAfterLayout(3);
    }
  };
  swatches.forEach((swatch, index) => (swatch.tabIndex = index === 0 ? 0 : -1));
  grid.addEventListener('keydown', (event) => {
    const index = swatches.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    let next = index;
    if (event.key === 'ArrowLeft') next--;
    else if (event.key === 'ArrowRight') next++;
    else if (event.key === 'ArrowUp') next -= columns;
    else if (event.key === 'ArrowDown') next += columns;
    else if (event.key === 'Home') next = Math.floor(index / columns) * columns;
    else if (event.key === 'End') {
      next = Math.min(swatches.length - 1, Math.floor(index / columns) * columns + columns - 1);
    } else return;
    event.preventDefault();
    event.stopPropagation();
    focusAt(next);
  });
};

const createHeader = (
  doc: Document,
  title: string,
  onClose: () => void,
  onBack?: () => void
): HTMLElement => {
  const header = doc.createElement('div');
  header.className = 'rly-color-header';
  const leading = doc.createElement('div');
  leading.className = 'rly-color-header-leading';
  if (onBack) {
    const back = button(doc, 'rly-color-icon-btn', 'Back to color palette', 'color-picker-back');
    back.textContent = '←';
    back.addEventListener('click', onBack);
    leading.appendChild(back);
  }
  const titleElement = doc.createElement('div');
  titleElement.className = 'rly-color-title';
  titleElement.textContent = title;
  leading.appendChild(titleElement);
  const close = button(doc, 'rly-color-icon-btn', `Close ${title}`, 'color-picker-close');
  close.textContent = '×';
  close.addEventListener('click', onClose);
  header.append(leading, close);
  return header;
};

export const createColorPickerPanel = (options: ColorPickerOptions): HTMLElement => {
  const { editor } = options;
  const doc = editor.getRoot().ownerDocument;
  const root = doc.createElement('div');
  root.className = 'rly-color-picker';
  root.dataset.view = 'palette';
  root.dataset.mode = options.mode;
  root.setAttribute('role', 'dialog');
  const title = options.mode === 'text' ? 'Text color' : 'Highlight color';
  root.setAttribute('aria-label', title);

  let view: 'palette' | 'custom' = 'palette';
  let tab: CustomPickerTab = 'picker';
  let bookmark: Bookmark | null = null;
  let committed = hexToHsva(options.mode === 'text' ? '#000000' : '#FEF08A');
  let draft = { ...committed };
  let hexInput = hsvaToHex(draft);
  let hexError: string | null = null;

  const announceResize = (): void => {
    root.dispatchEvent(
      new (doc.defaultView?.Event ?? Event)('rly-panel-resize', { bubbles: true })
    );
  };
  const close = (): void => {
    options.close();
    editor.selection.moveToBookmark(bookmark);
    editor.focus();
  };
  const apply = (color: string | null): void => {
    editor.selection.moveToBookmark(bookmark);
    options.onApply(color);
    if (color) addRecentColor(editor, color);
    options.close();
    editor.focus();
  };
  const resolveHex = (value: string): string | null => {
    const direct = cssColorToHex(value);
    if (direct || !value) return direct;
    const probe = doc.createElement('span');
    probe.style.color = value;
    if (!probe.style.color) return null;
    probe.hidden = true;
    editor.getRoot().appendChild(probe);
    const computed = doc.defaultView?.getComputedStyle(probe).color ?? probe.style.color;
    probe.remove();
    return cssColorToHex(computed);
  };
  const currentHex = (): string | null => resolveHex(options.getCurrentColor());
  const updateDraft = (next: HsvaColor): void => {
    draft = {
      h: clamp(next.h, 0, 360),
      s: clamp(next.s, 0, 100),
      v: clamp(next.v, 0, 100),
      a: clamp(next.a, 0, 1)
    };
    hexInput = hsvaToHex(draft);
    hexError = null;
  };

  const renderPalette = (focus = false, preserveDraft = false): void => {
    view = 'palette';
    root.dataset.view = 'palette';
    root.replaceChildren();
    const header = createHeader(doc, title, close);
    root.appendChild(header);
    const selectedColor = currentHex();

    const reset = button(
      doc,
      'rly-color-reset',
      options.mode === 'text' ? 'Automatic text color' : 'No highlight',
      'swatch-none'
    );
    const resetPreview = doc.createElement('span');
    resetPreview.className = 'rly-color-reset-preview';
    resetPreview.setAttribute('aria-hidden', 'true');
    const resetText = doc.createElement('span');
    resetText.textContent = options.mode === 'text' ? 'Automatic' : 'No highlight';
    reset.append(resetPreview, resetText);
    reset.classList.toggle('rly-selected', !selectedColor);
    reset.setAttribute('aria-pressed', String(!selectedColor));
    reset.addEventListener('click', () => apply(null));
    root.appendChild(reset);

    root.appendChild(sectionLabel(doc, 'Theme colors'));
    const grid = doc.createElement('div');
    grid.className = 'rly-color-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Theme colors');
    const swatches = options.palette.map((color) => {
      const normalized = resolveHex(color.value) ?? normalizeHex(color.value);
      const swatch = colorButton(
        doc,
        color,
        !!selectedColor && !!normalized && colorsEqual(selectedColor, normalized),
        `swatch-${testIdColor(color.value)}`
      );
      swatch.addEventListener('click', () => apply(color.value));
      grid.appendChild(swatch);
      return swatch;
    });
    installGridKeys(grid, swatches);
    root.appendChild(grid);

    const recent = getRecentColors(editor);
    const recentSection = doc.createElement('div');
    recentSection.className = 'rly-color-recent-section';
    recentSection.appendChild(sectionLabel(doc, 'Recent colors'));
    const recentGrid = doc.createElement('div');
    recentGrid.className = 'rly-color-recent';
    recentGrid.setAttribute('role', 'group');
    recentGrid.setAttribute('aria-label', 'Recent colors');
    const recentSwatches = recent.map((color) => {
      const swatch = colorButton(
        doc,
        { value: color, label: 'Recent color' },
        !!selectedColor && colorsEqual(selectedColor, color),
        `recent-color-${testIdColor(color)}`
      );
      swatch.addEventListener('click', () => apply(color));
      recentGrid.appendChild(swatch);
      return swatch;
    });
    if (recentSwatches.length) installGridKeys(recentGrid, recentSwatches, 6);
    else {
      const empty = doc.createElement('span');
      empty.className = 'rly-color-recent-empty';
      empty.textContent = 'No recent colors';
      recentGrid.appendChild(empty);
    }
    recentSection.appendChild(recentGrid);
    root.appendChild(recentSection);

    const customLabel = sectionLabel(doc, 'Custom color');
    customLabel.classList.add('rly-color-custom-label');
    root.appendChild(customLabel);
    const fallback = preserveDraft
      ? hsvaToHex(draft)
      : (selectedColor ?? recent[0] ?? hsvaToHex(draft));
    const custom = button(
      doc,
      'rly-color-custom-entry',
      `Open custom color picker, current draft ${fallback}`,
      'custom-color'
    );
    const preview = doc.createElement('span');
    preview.className = 'rly-color-custom-preview';
    preview.style.setProperty('--rly-preview-color', fallback);
    const value = doc.createElement('span');
    value.className = 'rly-color-custom-value';
    value.textContent = fallback;
    const arrow = doc.createElement('span');
    arrow.className = 'rly-color-custom-arrow';
    arrow.textContent = '›';
    arrow.setAttribute('aria-hidden', 'true');
    custom.append(preview, value, arrow);
    custom.addEventListener('click', () => {
      const seed = preserveDraft ? fallback : (selectedColor ?? recent[0] ?? fallback);
      committed = hexToHsva(seed);
      updateDraft({ ...committed });
      renderCustom(true);
    });
    root.appendChild(custom);
    announceResize();
    if (focus)
      queueMicrotask(() =>
        (swatches.find((swatch) => swatch.classList.contains('rly-selected')) ?? reset).focus({
          preventScroll: true
        })
      );
  };

  const renderCustom = (focus = false): void => {
    view = 'custom';
    root.dataset.view = 'custom';
    root.replaceChildren();
    const header = createHeader(doc, title, close, () => renderPalette(true, true));
    root.appendChild(header);

    const tabs = doc.createElement('div');
    tabs.className = 'rly-color-tabs';
    tabs.setAttribute('role', 'tablist');
    const pickerTab = button(doc, 'rly-color-tab', 'Picker', 'color-picker-tab-picker');
    const slidersTab = button(doc, 'rly-color-tab', 'Sliders', 'color-picker-tab-sliders');
    pickerTab.textContent = 'Picker';
    slidersTab.textContent = 'Sliders';
    pickerTab.setAttribute('role', 'tab');
    slidersTab.setAttribute('role', 'tab');
    pickerTab.setAttribute('aria-selected', String(tab === 'picker'));
    slidersTab.setAttribute('aria-selected', String(tab === 'sliders'));
    pickerTab.classList.toggle('rly-selected', tab === 'picker');
    slidersTab.classList.toggle('rly-selected', tab === 'sliders');
    pickerTab.addEventListener('click', () => {
      tab = 'picker';
      renderCustom(true);
    });
    slidersTab.addEventListener('click', () => {
      tab = 'sliders';
      renderCustom(true);
    });
    pickerTab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight') return;
      event.preventDefault();
      tab = 'sliders';
      renderCustom(true);
    });
    slidersTab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft') return;
      event.preventDefault();
      tab = 'picker';
      renderCustom(true);
    });
    tabs.append(pickerTab, slidersTab);
    root.appendChild(tabs);

    let syncTab = (): void => {};
    const hexField = doc.createElement('input');
    const errorElement = doc.createElement('small');
    const done = button(
      doc,
      'rly-color-action rly-color-action-primary',
      'Apply custom color',
      'color-picker-done'
    );
    const sync = (overwriteHex = true): void => {
      if (overwriteHex) {
        hexInput = hsvaToHex(draft);
        if (hexField) hexField.value = hexInput;
      }
      syncTab();
      if (errorElement) {
        errorElement.textContent = hexError ?? '';
        errorElement.hidden = !hexError;
      }
      if (hexField) hexField.setAttribute('aria-invalid', String(!!hexError));
      if (done) done.disabled = !!hexError;
    };

    const body = doc.createElement('div');
    body.className = 'rly-color-custom-body';
    if (tab === 'picker') {
      const pickerLayout = doc.createElement('div');
      pickerLayout.className = 'rly-color-picker-layout';
      const sv = doc.createElement('div');
      sv.className = 'rly-color-sv';
      sv.dataset.testid = 'color-picker-sv';
      sv.tabIndex = 0;
      sv.setAttribute('role', 'slider');
      sv.setAttribute('aria-label', 'Color saturation and brightness');
      const thumb = doc.createElement('span');
      thumb.className = 'rly-color-sv-thumb';
      sv.appendChild(thumb);
      const hue = doc.createElement('input');
      hue.type = 'range';
      hue.min = '0';
      hue.max = '360';
      hue.step = '1';
      hue.className = 'rly-color-hue rly-color-hue-vertical';
      hue.dataset.testid = 'color-picker-hue';
      hue.setAttribute('aria-label', 'Hue');
      const updateSv = (event: PointerEvent): void => {
        const rect = sv.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        updateDraft({
          ...draft,
          s: (clamp(event.clientX - rect.left, 0, rect.width) / rect.width) * 100,
          v: (1 - clamp(event.clientY - rect.top, 0, rect.height) / rect.height) * 100
        });
        sync();
      };
      sv.addEventListener('pointerdown', (event) => {
        sv.setPointerCapture?.(event.pointerId);
        updateSv(event);
      });
      sv.addEventListener('pointermove', (event) => {
        if (sv.hasPointerCapture?.(event.pointerId)) updateSv(event);
      });
      sv.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 10 : 1;
        const next = { ...draft };
        if (event.key === 'ArrowLeft') next.s -= step;
        else if (event.key === 'ArrowRight') next.s += step;
        else if (event.key === 'ArrowUp') next.v += step;
        else if (event.key === 'ArrowDown') next.v -= step;
        else return;
        event.preventDefault();
        event.stopPropagation();
        updateDraft(next);
        sync();
      });
      hue.addEventListener('input', () => {
        updateDraft({ ...draft, h: Number(hue.value) });
        sync();
      });
      pickerLayout.append(sv, hue);
      body.appendChild(pickerLayout);

      const opacityRow = doc.createElement('label');
      opacityRow.className = 'rly-color-opacity-row';
      const opacityLabel = doc.createElement('span');
      opacityLabel.textContent = 'Opacity';
      const opacity = doc.createElement('input');
      opacity.type = 'range';
      opacity.min = '0';
      opacity.max = '100';
      opacity.step = '1';
      opacity.className = 'rly-color-opacity';
      opacity.dataset.testid = 'color-picker-opacity';
      opacity.setAttribute('aria-label', 'Opacity');
      const opacityValue = doc.createElement('output');
      opacity.addEventListener('input', () => {
        updateDraft({ ...draft, a: Number(opacity.value) / 100 });
        sync();
      });
      opacityRow.append(opacityLabel, opacity, opacityValue);
      body.appendChild(opacityRow);
      syncTab = () => {
        const opaque = hsvaToHex({ ...draft, a: 1 });
        sv.style.setProperty('--rly-picker-hue', String(draft.h));
        thumb.style.left = `${draft.s}%`;
        thumb.style.top = `${100 - draft.v}%`;
        sv.setAttribute(
          'aria-valuetext',
          `Saturation ${Math.round(draft.s)}%, brightness ${Math.round(draft.v)}%`
        );
        hue.value = String(Math.round(draft.h));
        opacity.value = String(Math.round(draft.a * 100));
        opacityValue.value = `${Math.round(draft.a * 100)}%`;
        opacity.style.setProperty('--rly-opacity-color', opaque);
      };
    } else {
      const sliderList = doc.createElement('div');
      sliderList.className = 'rly-color-slider-list';
      const definitions: Array<{
        key: 'h' | 's' | 'v' | 'a';
        label: string;
        min: number;
        max: number;
        step: number;
        factor?: number;
      }> = [
        { key: 'h', label: 'Hue', min: 0, max: 360, step: 1 },
        { key: 's', label: 'Saturation', min: 0, max: 100, step: 1 },
        { key: 'v', label: 'Brightness', min: 0, max: 100, step: 1 },
        { key: 'a', label: 'Opacity', min: 0, max: 100, step: 1, factor: 100 }
      ];
      const controls = definitions.map((definition) => {
        const row = doc.createElement('label');
        row.className = 'rly-color-slider-row';
        const label = doc.createElement('span');
        label.textContent = definition.label;
        const range = doc.createElement('input');
        range.type = 'range';
        range.min = String(definition.min);
        range.max = String(definition.max);
        range.step = String(definition.step);
        range.dataset.testid = `color-picker-slider-${definition.key}`;
        range.setAttribute('aria-label', definition.label);
        const number = doc.createElement('input');
        number.type = 'number';
        number.min = range.min;
        number.max = range.max;
        number.step = range.step;
        number.dataset.testid = `color-picker-number-${definition.key}`;
        number.setAttribute('aria-label', `${definition.label} value`);
        const update = (value: string): void => {
          const raw = clamp(Number(value), definition.min, definition.max);
          updateDraft({ ...draft, [definition.key]: raw / (definition.factor ?? 1) });
          sync();
        };
        range.addEventListener('input', () => update(range.value));
        number.addEventListener('input', () => update(number.value));
        row.append(label, range, number);
        sliderList.appendChild(row);
        return { definition, range, number };
      });
      body.appendChild(sliderList);
      syncTab = () => {
        controls.forEach(({ definition, range, number }) => {
          const value = draft[definition.key] * (definition.factor ?? 1);
          range.value = String(Math.round(value));
          number.value = String(Math.round(value));
        });
      };
    }
    root.appendChild(body);

    const hexRow = doc.createElement('label');
    hexRow.className = 'rly-color-hex-row';
    const hexLabel = doc.createElement('span');
    hexLabel.textContent = 'HEX';
    hexField.type = 'text';
    hexField.value = hexInput;
    hexField.spellcheck = false;
    hexField.dataset.testid = 'color-picker-hex';
    hexField.setAttribute('aria-label', 'HEX color');
    errorElement.className = 'rly-color-error';
    errorElement.id = `rly-color-error-${options.mode}`;
    errorElement.hidden = true;
    hexField.setAttribute('aria-describedby', errorElement.id);
    hexField.addEventListener('input', () => {
      hexInput = hexField.value;
      const normalized = normalizeHex(hexInput);
      if (!normalized) {
        hexError = 'Enter a valid HEX color';
        sync(false);
        return;
      }
      draft = hexToHsva(normalized);
      hexError = null;
      sync(false);
    });
    hexField.addEventListener('blur', () => {
      const normalized = normalizeHex(hexField.value);
      if (normalized) {
        hexInput = normalized;
        hexField.value = normalized;
      }
    });
    hexRow.append(hexLabel, hexField);
    root.append(hexRow, errorElement);

    const presets = doc.createElement('div');
    presets.className = 'rly-color-presets-section';
    presets.appendChild(sectionLabel(doc, 'Presets'));
    const presetRow = doc.createElement('div');
    presetRow.className = 'rly-color-presets';
    for (const color of getPresetColors(editor)) {
      const preset = colorButton(
        doc,
        { value: color, label: 'Preset' },
        colorsEqual(hsvaToHex(draft), color),
        `color-picker-preset-${testIdColor(color)}`
      );
      preset.addEventListener('click', () => {
        updateDraft(hexToHsva(color));
        sync();
      });
      presetRow.appendChild(preset);
    }
    const addPreset = button(
      doc,
      'rly-color-add-preset',
      'Add current color to presets',
      'color-picker-add-preset'
    );
    addPreset.textContent = '+';
    addPreset.addEventListener('click', () => {
      addPresetColor(editor, hsvaToHex(draft));
      renderCustom(true);
    });
    presetRow.appendChild(addPreset);
    presets.appendChild(presetRow);
    root.appendChild(presets);

    const windowView = doc.defaultView as
      | (Window & {
          EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
        })
      | null;
    if (windowView?.EyeDropper) {
      const eyeDropper = button(
        doc,
        'rly-color-eyedropper',
        'Pick color from page',
        'color-picker-eyedropper'
      );
      eyeDropper.textContent = '⌾ Pick color from page';
      eyeDropper.addEventListener('click', async () => {
        try {
          const EyeDropperConstructor = windowView.EyeDropper;
          if (!EyeDropperConstructor) return;
          const result = await new EyeDropperConstructor().open();
          const normalized = normalizeHex(result.sRGBHex);
          if (normalized) {
            updateDraft(hexToHsva(normalized));
            sync();
          }
        } catch {
          // The browser rejects when the user cancels the eyedropper.
        }
      });
      root.appendChild(eyeDropper);
    }

    const footer = doc.createElement('div');
    footer.className = 'rly-color-actions';
    const cancel = button(doc, 'rly-color-action', 'Cancel custom color', 'color-picker-cancel');
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', close);
    done.textContent = 'Done';
    done.addEventListener('click', () => {
      if (!hexError) apply(hsvaToHex(draft));
    });
    footer.append(cancel, done);
    root.appendChild(footer);
    sync();
    announceResize();
    if (focus)
      queueMicrotask(() =>
        (tab === 'picker'
          ? body.querySelector<HTMLElement>('.rly-color-sv')
          : body.querySelector<HTMLInputElement>('input')
        )?.focus({ preventScroll: true })
      );
  };

  root.addEventListener('rly-panel-open', () => {
    bookmark = editor.selection.getBookmark();
    const selected = currentHex();
    const seed =
      selected ?? getRecentColors(editor)[0] ?? (options.mode === 'text' ? '#000000' : '#FEF08A');
    committed = hexToHsva(seed);
    updateDraft({ ...committed });
    tab = 'picker';
    renderPalette(true);
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && view === 'custom') {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.classList.contains('rly-color-sv')) {
        event.preventDefault();
        event.stopPropagation();
        if (!hexError) apply(hsvaToHex(draft));
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (view === 'custom') renderPalette(true, true);
      else close();
    }
  });

  editor.events.on('destroy', () => options.close());
  renderPalette();
  return root;
};
