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

/** Plugins register UI here; Toolbar/Menubar render from it (testids attached centrally). */
export class UiRegistry {
  readonly buttons = new Map<string, ButtonSpec>();

  addButton(name: string, spec: ButtonSpec): void {
    this.buttons.set(name, spec);
  }

  addToggleButton(name: string, spec: Omit<ButtonSpec, 'toggle'>): void {
    this.buttons.set(name, { ...spec, toggle: true });
  }
}
