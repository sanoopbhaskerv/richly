/**
 * DOM builders for the inline image toolbar. Pure element construction —
 * mode/state decisions live in the controller.
 */

import { toolbarIcons } from './icons';

export interface ToolbarButtonSpec {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  readonly onClick: (button: HTMLButtonElement, event: MouseEvent) => void;
  readonly pressed?: boolean;
}

/** Creates one icon-only toolbar button with an accessible name. */
export function createToolbarButton(doc: Document, spec: ToolbarButtonSpec): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.className = 'rly-image-inline-btn';
  button.dataset.testid = `image-toolbar-${spec.id}`;
  button.dataset.tooltip = spec.label;
  button.title = spec.label;
  button.setAttribute('aria-label', spec.label);
  if (spec.pressed !== undefined) button.setAttribute('aria-pressed', String(spec.pressed));
  button.innerHTML = toolbarIcons[spec.icon] ?? '';
  button.addEventListener('click', (event) => spec.onClick(button, event));
  return button;
}

/** Creates the visible sub-toolbar mode label (for example "Transform:"). */
export function createModeLabel(doc: Document, text: string): HTMLSpanElement {
  const label = doc.createElement('span');
  label.className = 'rly-image-inline-label';
  label.textContent = text;
  label.setAttribute('aria-hidden', 'true');
  return label;
}

/** Creates a thin vertical separator between action groups. */
export function createSeparator(doc: Document): HTMLDivElement {
  const sep = doc.createElement('div');
  sep.className = 'rly-image-inline-sep';
  return sep;
}

/** Swaps a button into or out of its busy (spinner) presentation. */
export function setButtonBusy(button: HTMLButtonElement, busy: boolean, icon: string): void {
  button.classList.toggle('rly-busy', busy);
  button.innerHTML = busy ? toolbarIcons.spinner! : (toolbarIcons[icon] ?? '');
  button.disabled = busy;
}

export interface SliderPopoverSpec {
  readonly title: string;
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly onInput: (value: number) => void;
  readonly onReset: () => void;
  readonly onCancel: () => void;
  readonly onApply: () => void;
}

export interface SliderPopoverHandle {
  readonly element: HTMLElement;
  readonly slider: HTMLInputElement;
  readonly apply: HTMLButtonElement;
  setValue(value: number): void;
  setBusy(busy: boolean): void;
}

/** Describes one centered-crop preset button in the inline crop popover. */
export interface CropPresetSpec {
  /** Stable preset id passed back to the crop apply callback. */
  readonly id: string;
  /** Short visible label, usually an aspect ratio such as "1:1". */
  readonly label: string;
}

/** Configuration for the inline crop popover. */
export interface CropPopoverSpec {
  /** Presets the user can choose before applying a crop. */
  readonly presets: readonly CropPresetSpec[];
  /** Called when the user closes the popover without changing the image. */
  readonly onCancel: () => void;
  /** Called only from the explicit Apply crop action. */
  readonly onApply: (preset: string) => void;
}

/** Imperative handle for the inline crop popover. */
export interface CropPopoverHandle {
  /** Root popover element to position near the invoking toolbar button. */
  readonly element: HTMLElement;
  /** Primary Apply crop button, exposed for tests and focus management. */
  readonly apply: HTMLButtonElement;
  /** Toggles disabled/saving state across the popover controls. */
  setBusy(busy: boolean): void;
}

/** Builds the compact centered-crop preset popover. */
export function createCropPopover(doc: Document, spec: CropPopoverSpec): CropPopoverHandle {
  const popover = doc.createElement('div');
  popover.className = 'rly-image-inline-popover';
  popover.dataset.testid = 'image-toolbar-crop-popover';
  popover.setAttribute('role', 'group');
  popover.setAttribute('aria-label', 'Crop image');

  const title = doc.createElement('p');
  title.className = 'rly-image-inline-popover-title';
  title.textContent = 'Crop';
  popover.appendChild(title);

  let selected = spec.presets[0]?.id ?? '';
  const grid = doc.createElement('div');
  grid.className = 'rly-image-inline-crop-grid';
  for (const preset of spec.presets) {
    const button = actionButton(doc, preset.label, `image-toolbar-crop-${preset.id}`, () => {
      selected = preset.id;
      for (const item of grid.querySelectorAll('button')) {
        item.classList.toggle('rly-active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      }
    });
    button.setAttribute('aria-pressed', String(preset.id === selected));
    if (preset.id === selected) button.classList.add('rly-active');
    grid.appendChild(button);
  }
  popover.appendChild(grid);

  const actions = doc.createElement('div');
  actions.className = 'rly-image-inline-popover-actions';
  const cancel = actionButton(doc, 'Cancel', 'image-toolbar-crop-cancel', spec.onCancel);
  const apply = actionButton(doc, 'Apply crop', 'image-toolbar-crop-apply', () =>
    spec.onApply(selected)
  );
  apply.classList.add('rly-primary');
  actions.append(cancel, apply);
  popover.appendChild(actions);

  return {
    element: popover,
    apply,
    setBusy(busy) {
      for (const button of popover.querySelectorAll<HTMLButtonElement>('button')) {
        button.disabled = busy;
      }
      apply.textContent = busy ? 'Saving…' : 'Apply crop';
    }
  };
}

/** Builds the compact adjustment slider popover (Reset / Cancel / Apply). */
export function createSliderPopover(doc: Document, spec: SliderPopoverSpec): SliderPopoverHandle {
  const popover = doc.createElement('div');
  popover.className = 'rly-image-inline-popover';
  popover.dataset.testid = 'image-toolbar-adjust-popover';
  popover.setAttribute('role', 'group');
  popover.setAttribute('aria-label', spec.title);

  const title = doc.createElement('p');
  title.className = 'rly-image-inline-popover-title';
  title.textContent = spec.title;
  const value = doc.createElement('span');
  value.className = 'rly-image-inline-popover-value';
  value.dataset.testid = 'image-toolbar-adjust-value';
  title.appendChild(value);
  popover.appendChild(title);

  const slider = doc.createElement('input');
  slider.type = 'range';
  slider.min = String(spec.min);
  slider.max = String(spec.max);
  slider.step = '1';
  slider.dataset.testid = 'image-toolbar-adjust-slider';
  slider.setAttribute('aria-label', spec.title);
  popover.appendChild(slider);

  const sync = (next: number): void => {
    slider.value = String(next);
    slider.setAttribute('aria-valuetext', String(next));
    value.textContent = String(next);
  };
  sync(spec.value);
  slider.addEventListener('input', () => {
    sync(Number(slider.value));
    spec.onInput(Number(slider.value));
  });

  const actions = doc.createElement('div');
  actions.className = 'rly-image-inline-popover-actions';
  const reset = actionButton(doc, 'Reset', 'image-toolbar-adjust-reset', () => {
    sync(0);
    spec.onReset();
  });
  const cancel = actionButton(doc, 'Cancel', 'image-toolbar-adjust-cancel', spec.onCancel);
  const apply = actionButton(doc, 'Apply', 'image-toolbar-adjust-apply', spec.onApply);
  apply.classList.add('rly-primary');
  actions.append(reset, cancel, apply);
  popover.appendChild(actions);

  return {
    element: popover,
    slider,
    apply,
    setValue: sync,
    setBusy(busy) {
      slider.disabled = busy;
      reset.disabled = busy;
      cancel.disabled = busy;
      apply.disabled = busy;
      apply.textContent = busy ? 'Saving…' : 'Apply';
    }
  };
}

export interface AltPopoverSpec {
  readonly value: string;
  readonly onCancel: () => void;
  readonly onSave: (alt: string) => void;
}

/** Builds the alt-text mini popover. */
export function createAltPopover(doc: Document, spec: AltPopoverSpec): HTMLElement {
  const popover = doc.createElement('div');
  popover.className = 'rly-image-inline-popover';
  popover.dataset.testid = 'image-toolbar-alt-popover';
  popover.setAttribute('role', 'group');
  popover.setAttribute('aria-label', 'Alternative text');

  const title = doc.createElement('p');
  title.className = 'rly-image-inline-popover-title';
  title.textContent = 'Alternative text';
  popover.appendChild(title);

  const input = doc.createElement('input');
  input.type = 'text';
  input.value = spec.value;
  input.placeholder = 'Describe this image';
  input.dataset.testid = 'image-toolbar-alt-input';
  input.setAttribute('aria-label', 'Alternative text');
  popover.appendChild(input);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      spec.onSave(input.value);
    }
  });

  const actions = doc.createElement('div');
  actions.className = 'rly-image-inline-popover-actions';
  const save = actionButton(doc, 'Save', 'image-toolbar-alt-save', () => spec.onSave(input.value));
  save.classList.add('rly-primary');
  actions.append(actionButton(doc, 'Cancel', 'image-toolbar-alt-cancel', spec.onCancel), save);
  popover.appendChild(actions);
  return popover;
}

export interface MenuItemSpec {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly active?: boolean;
  readonly danger?: boolean;
  readonly onSelect: () => void;
}

/** Builds a small vertical menu (alignment, overflow/More). */
export function createMenu(
  doc: Document,
  testid: string,
  items: readonly MenuItemSpec[]
): HTMLElement {
  const menu = doc.createElement('div');
  menu.className = 'rly-image-inline-popover rly-image-inline-menu';
  menu.dataset.testid = testid;
  menu.setAttribute('role', 'menu');
  for (const item of items) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'rly-image-inline-menu-item';
    button.dataset.testid = `image-toolbar-menu-${item.id}`;
    button.setAttribute('role', 'menuitem');
    if (item.active) {
      button.classList.add('rly-active');
      button.setAttribute('aria-checked', 'true');
    }
    if (item.danger) button.classList.add('rly-danger');
    button.innerHTML = item.icon ? (toolbarIcons[item.icon] ?? '') : '';
    button.appendChild(doc.createTextNode(item.label));
    button.addEventListener('click', item.onSelect);
    menu.appendChild(button);
  }
  return menu;
}

export interface ErrorViewSpec {
  readonly message: string;
  readonly onRetry: () => void;
  readonly onDismiss: () => void;
}

/** Builds the retryable inline error state shown after a failed quick edit. */
export function createErrorView(doc: Document, spec: ErrorViewSpec): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  const message = doc.createElement('span');
  message.className = 'rly-image-inline-error';
  message.dataset.testid = 'image-toolbar-error';
  message.setAttribute('role', 'alert');
  message.textContent = spec.message;
  fragment.appendChild(message);

  const actions = doc.createElement('div');
  actions.className = 'rly-image-inline-popover-actions';
  const retry = actionButton(doc, 'Retry', 'image-toolbar-error-retry', spec.onRetry);
  retry.classList.add('rly-primary');
  actions.append(
    retry,
    actionButton(doc, 'Dismiss', 'image-toolbar-error-dismiss', spec.onDismiss)
  );
  fragment.appendChild(actions);
  return fragment;
}

function actionButton(
  doc: Document,
  label: string,
  testid: string,
  onClick: () => void
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.testid = testid;
  button.addEventListener('click', onClick);
  return button;
}
