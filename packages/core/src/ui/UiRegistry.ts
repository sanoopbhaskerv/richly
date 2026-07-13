import type { Editor } from '../editor/Editor';

export interface SelectOption {
  label: string;
  value: string;
}

/** A command-backed choice rendered inside a toolbar menu or split button. */
export interface ToolbarMenuItem {
  /** Stable value returned by the control's `valueCommand`. */
  value: string;
  label: string;
  /** Optional icon key (ui/icons.ts) or raw SVG/text. */
  icon?: string;
  command: string;
  args?: unknown;
  /** Set false for one-off choices that a split primary button must not remember. */
  repeatable?: boolean;
  /** Draw a visual separator immediately before this choice. */
  separatorBefore?: boolean;
}

export interface ButtonControl {
  type: 'button';
  /** Icon key (ui/icons.ts) or raw SVG/text. */
  icon: string;
  tooltip: string;
  command: string;
  args?: unknown;
  /** Portable shortcut notation appended as a platform-aware tooltip, e.g. `Mod+B`. */
  shortcut?: string;
}

export interface ToggleControl {
  type: 'toggle';
  /** Icon key (ui/icons.ts) or raw SVG/text. */
  icon: string;
  tooltip: string;
  command: string;
  /** Portable shortcut notation appended as a platform-aware tooltip, e.g. `Mod+B`. */
  shortcut?: string;
}

export interface PanelControl {
  type: 'panel';
  /** Icon key (ui/icons.ts) or raw SVG/text. */
  icon: string;
  tooltip: string;
  /**
   * Dropdown button: builds the panel content (e.g. table grid picker).
   * The panel gets data-testid dd-<buttonName>; call close() to dismiss.
   */
  panel: (editor: Editor, close: () => void) => HTMLElement;
  /** Optional command whose current value is rendered by the icon. */
  valueCommand?: string;
  /** Portable shortcut notation appended as a platform-aware tooltip, e.g. `Mod+B`. */
  shortcut?: string;
}

export interface SelectControl {
  type: 'select';
  tooltip: string;
  command: string;
  options: SelectOption[];
}

/** A single toolbar trigger that opens a command-backed choice menu. */
export interface MenuControl {
  type: 'menu';
  icon: string;
  tooltip: string;
  items: ToolbarMenuItem[];
  /** Command queried to mark the selected item and update an optional live label. */
  valueCommand?: string;
  /** Show the selected item's label beside the icon. */
  showLabel?: boolean;
}

/**
 * A two-part control: the primary button repeats the current/last choice while
 * the chevron opens the complete choice menu.
 */
export interface SplitControl {
  type: 'split';
  icon: string;
  tooltip: string;
  command: string;
  args?: unknown;
  items: ToolbarMenuItem[];
  /** Command queried to mark the selected variant. */
  valueCommand?: string;
}

export interface ComponentControl {
  type: 'component';
  render: (editor: Editor) => HTMLElement;
}

export type ButtonSpec =
  | ButtonControl
  | ToggleControl
  | PanelControl
  | SelectControl
  | MenuControl
  | SplitControl
  | ComponentControl;

type LegacyButtonSpec = {
  icon: string;
  tooltip: string;
  command?: string;
  args?: unknown;
  toggle?: boolean;
  shortcut?: string;
  panel?: (editor: Editor, close: () => void) => HTMLElement;
};

export interface MenuItemSpec {
  /** Which menu it lives in: file | edit | view | insert | format | tools | table | help */
  menu: string;
  text: string;
  command: string;
  args?: unknown;
  shortcut?: string;
}

/** Plugins register UI here; Toolbar/Menubar render from it (testids attached centrally). */
export class UiRegistry {
  readonly buttons = new Map<string, ButtonSpec>();
  readonly menuItems = new Map<string, MenuItemSpec>();

  addButton(name: string, spec: ButtonSpec | LegacyButtonSpec): void {
    if ('type' in spec) {
      this.buttons.set(name, spec);
      return;
    }
    if (spec.panel) {
      this.buttons.set(name, {
        type: 'panel',
        icon: spec.icon,
        tooltip: spec.tooltip,
        panel: spec.panel,
        shortcut: spec.shortcut
      });
      return;
    }
    if (spec.command) {
      this.buttons.set(name, {
        type: spec.toggle ? 'toggle' : 'button',
        icon: spec.icon,
        tooltip: spec.tooltip,
        command: spec.command,
        args: spec.args,
        shortcut: spec.shortcut
      });
    }
  }

  addToggleButton(name: string, spec: Omit<ToggleControl, 'type'> | LegacyButtonSpec): void {
    this.buttons.set(name, {
      type: 'toggle',
      icon: spec.icon,
      tooltip: spec.tooltip,
      command: spec.command ?? '',
      shortcut: spec.shortcut
    });
  }

  addMenuItem(name: string, spec: MenuItemSpec): void {
    this.menuItems.set(name, spec);
  }
}
