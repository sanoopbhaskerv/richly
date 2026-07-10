export interface ButtonSpec {
  /** Icon key (ui/icons.ts) or raw SVG/text. */
  icon: string;
  tooltip: string;
  command: string;
  args?: unknown;
  /** Toggle buttons reflect queryCommandState as active/aria-pressed. */
  toggle?: boolean;
  /** Optional shortcut label appended to tooltip, e.g. "Mod+B". */
  shortcut?: string;
}

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

  addButton(name: string, spec: ButtonSpec): void {
    this.buttons.set(name, spec);
  }

  addToggleButton(name: string, spec: Omit<ButtonSpec, 'toggle'>): void {
    this.buttons.set(name, { ...spec, toggle: true });
  }

  addMenuItem(name: string, spec: MenuItemSpec): void {
    this.menuItems.set(name, spec);
  }
}
