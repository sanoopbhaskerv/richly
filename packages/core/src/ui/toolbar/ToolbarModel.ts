import type { ChoiceControlState } from '../ChoiceControl';

/** State required to refresh a command-backed toggle button. */
export interface ToolbarToggleState {
  name: string;
  el: HTMLButtonElement;
  command: string;
}

/** State required to refresh a native select control. */
export interface ToolbarSelectState {
  name: string;
  el: HTMLSelectElement;
  command: string;
}

/** State required to render the current command value on a panel trigger. */
export interface ToolbarValueIndicatorState {
  el: HTMLButtonElement;
  command: string;
}

/**
 * Complete render result shared by the coordinator, state refresher, and
 * responsive layout strategies.
 *
 * Responsive modes move `sections` atomically. `focusables` intentionally
 * contains the individual controls in their current DOM-independent order;
 * keyboard navigation sorts them by live DOM position after redistribution.
 */
export interface ToolbarRenderModel {
  toggles: ToolbarToggleState[];
  selects: ToolbarSelectState[];
  valueIndicators: ToolbarValueIndicatorState[];
  choiceMenus: ChoiceControlState[];
  focusables: HTMLElement[];
  sections: HTMLElement[][];
}

/** Narrow measurement boundary consumed by responsive toolbar strategies. */
export interface ToolbarLayoutServices {
  availableWidth: () => number;
  widthBoundaries: () => HTMLElement[];
  occupiedWidth: (parent: HTMLElement) => number;
}
