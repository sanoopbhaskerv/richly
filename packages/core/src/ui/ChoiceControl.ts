import type { Editor } from '../editor/Editor';
import type { MenuControl, SplitControl, ToolbarMenuItem } from './UiRegistry';
import { icons } from './icons';

/** Selection/value state consumed by `Toolbar.refresh()`. */
export interface ChoiceControlState {
  valueCommand?: string;
  label?: HTMLElement;
  entries: { item: ToolbarMenuItem; el: HTMLButtonElement }[];
}

export interface RenderedChoiceControl {
  element: HTMLElement;
  focusables: HTMLButtonElement[];
  state: ChoiceControlState;
}

/**
 * Render a shared, accessible toolbar menu or split button.
 *
 * Keeping this behavior outside `Toolbar` prevents feature menus from growing
 * the already complex responsive/overflow renderer. All command execution,
 * focus restoration, selection preservation, and keyboard navigation follow
 * the same path regardless of which plugin registered the choices.
 */
export function renderChoiceControl(
  editor: Editor,
  container: HTMLElement,
  name: string,
  spec: MenuControl | SplitControl
): RenderedChoiceControl {
  const doc = container.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = `rly-tb-choice rly-tb-choice-${spec.type}`;
  wrap.dataset.tooltip = spec.tooltip;

  let primaryArgs = spec.type === 'split' ? spec.args : undefined;
  const focusables: HTMLButtonElement[] = [];
  let trigger: HTMLButtonElement;
  let liveLabel: HTMLElement | undefined;

  if (spec.type === 'split') {
    const primary = doc.createElement('button');
    primary.type = 'button';
    primary.className = 'rly-tb-btn rly-tb-split-primary';
    primary.dataset.testid = `tb-${name}`;
    primary.setAttribute('aria-label', spec.tooltip);
    primary.innerHTML = icons[spec.icon] ?? spec.icon;
    primary.addEventListener('mousedown', (event) => event.preventDefault());
    primary.addEventListener('click', () => {
      editor.execCommand(spec.command, primaryArgs);
      editor.focus();
    });
    wrap.appendChild(primary);
    focusables.push(primary);

    trigger = doc.createElement('button');
    trigger.type = 'button';
    trigger.className = 'rly-tb-btn rly-tb-split-chevron';
    trigger.dataset.testid = `tb-${name}-menu`;
    trigger.setAttribute('aria-label', `${spec.tooltip} styles`);
    trigger.innerHTML = '<span aria-hidden="true">⌄</span>';
  } else {
    trigger = doc.createElement('button');
    trigger.type = 'button';
    trigger.className = 'rly-tb-btn rly-tb-menu-trigger';
    trigger.dataset.testid = `tb-${name}`;
    trigger.setAttribute('aria-label', spec.tooltip);
    const icon = doc.createElement('span');
    icon.className = 'rly-tb-menu-icon';
    icon.innerHTML = icons[spec.icon] ?? spec.icon;
    trigger.appendChild(icon);
    if (spec.showLabel) {
      liveLabel = doc.createElement('span');
      liveLabel.className = 'rly-tb-menu-label';
      // Before the editor has a selection, the first option is the control's
      // documented default (Paragraph/Normal in the bundled controls).
      liveLabel.textContent = spec.items[0]?.label ?? spec.tooltip;
      trigger.appendChild(liveLabel);
    }
    const chevron = doc.createElement('span');
    chevron.className = 'rly-tb-menu-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '⌄';
    trigger.appendChild(chevron);
  }

  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('mousedown', (event) => event.preventDefault());
  wrap.appendChild(trigger);
  focusables.push(trigger);

  const menu = doc.createElement('div');
  // Keep the panel class distinct from `rly-tb-choice-menu`, which identifies
  // the outer control by type. Sharing the class would leak panel sizing into
  // the toolbar row and create horizontal overflow on compact screens.
  menu.className = 'rly-tb-dd rly-tb-choice-panel';
  menu.dataset.testid = `dd-${name}`;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', spec.tooltip);
  const itemRole = spec.valueCommand ? 'menuitemradio' : 'menuitem';
  menu.addEventListener('mousedown', (event) => event.preventDefault());
  menu.addEventListener('click', (event) => event.stopPropagation());

  const close = (restoreFocus = false): void => {
    menu.classList.remove('rly-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  };
  const open = (focusFirst = false): void => {
    doc.querySelectorAll('.rly-tb-dd.rly-open').forEach((panel) => {
      panel.classList.remove('rly-open');
      panel.parentElement
        ?.querySelector<HTMLButtonElement>('[aria-haspopup]')
        ?.setAttribute('aria-expanded', 'false');
    });
    menu.classList.add('rly-open');
    trigger.setAttribute('aria-expanded', 'true');
    if (focusFirst) menu.querySelector<HTMLButtonElement>(`[role="${itemRole}"]`)?.focus();
  };

  const entries = spec.items.map((item) => {
    const entry = doc.createElement('button');
    entry.type = 'button';
    entry.className = 'rly-tb-choice-item';
    if (item.separatorBefore) entry.classList.add('rly-tb-choice-separated');
    entry.dataset.testid = `menuitem-${name}-${item.value}`;
    entry.setAttribute('role', itemRole);
    if (spec.valueCommand) entry.setAttribute('aria-checked', 'false');
    if (item.icon) {
      const icon = doc.createElement('span');
      icon.className = 'rly-tb-choice-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = icons[item.icon] ?? item.icon;
      entry.appendChild(icon);
    }
    const label = doc.createElement('span');
    label.textContent = item.label;
    entry.appendChild(label);
    entry.addEventListener('click', () => {
      if (spec.type === 'split' && item.repeatable !== false) primaryArgs = item.args;
      close();
      editor.execCommand(item.command, item.args);
      editor.focus();
    });
    menu.appendChild(entry);
    return { item, el: entry };
  });

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    if (menu.classList.contains('rly-open')) close();
    else open();
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(true);
    } else if (event.key === 'Escape') {
      close(true);
    }
  });
  menu.addEventListener('keydown', (event) => {
    const choices = entries.map(({ el }) => el);
    const index = choices.indexOf(doc.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      choices[(index + offset + choices.length) % choices.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      choices[event.key === 'Home' ? 0 : choices.length - 1]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      close();
    }
  });

  const documentClose = (): void => close();
  doc.addEventListener('click', documentClose);
  editor.events.on('destroy', () => doc.removeEventListener('click', documentClose));
  wrap.appendChild(menu);
  return {
    element: wrap,
    focusables,
    state: { valueCommand: spec.valueCommand, label: liveLabel, entries }
  };
}
