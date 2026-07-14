import type { Editor } from '../../editor/Editor';
import type { PanelControl } from '../UiRegistry';
import { closePositionedToolbarDropdowns, resetToolbarDropdownPosition } from './ToolbarDropdowns';

/** Result of rendering a panel-backed toolbar button. */
export interface RenderedToolbarPanelControl {
  element: HTMLElement;
  valueIndicator?: { el: HTMLButtonElement; command: string };
}

/**
 * Wrap a toolbar button with a selection-safe, viewport-constrained panel.
 *
 * Panel controls are intentionally isolated from toolbar layout. Responsive
 * strategies may move the returned wrapper as an atomic group and request a
 * reposition through `rly-panel-resize`; they never need to know how the panel
 * preserves selection or clamps itself to the viewport.
 */
export function renderToolbarPanelControl(
  editor: Editor,
  container: HTMLElement,
  name: string,
  spec: PanelControl,
  button: HTMLButtonElement,
  tooltipText: string
): RenderedToolbarPanelControl {
  const doc = container.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = 'rly-tb-wrap';
  // Tooltip on the wrapper anchors it to the complete button area.
  wrap.dataset.tooltip = tooltipText;

  const dropdown = doc.createElement('div');
  dropdown.className = 'rly-tb-dd';
  dropdown.dataset.testid = `dd-${name}`;
  // Simple panels keep the content selection live. Rich interactive panels
  // restore their saved bookmark before applying a command.
  dropdown.addEventListener('mousedown', (event) => {
    const target = event.target as Element | null;
    if (target?.closest('.rly-color-picker[data-view="custom"]')) return;
    event.preventDefault();
  });
  dropdown.addEventListener('click', (event) => event.stopPropagation());

  let boundsFrame: number | null = null;
  const correctHorizontalBounds = (view: Window, margin = 8): void => {
    const renderedRect = dropdown.getBoundingClientRect();
    const maximumLeft = Math.max(margin, view.innerWidth - renderedRect.width - margin);
    const renderedLeft = Math.max(margin, Math.min(maximumLeft, renderedRect.left));
    const correction = renderedLeft - renderedRect.left;
    if (Math.abs(correction) <= 0.01) return;
    const assignedLeft = Number.parseFloat(dropdown.style.left);
    dropdown.style.left = `${(Number.isFinite(assignedLeft) ? assignedLeft : 0) + correction}px`;
  };
  const maintainPanelBounds = (): void => {
    boundsFrame = null;
    const view = doc.defaultView;
    if (!view || !dropdown.classList.contains('rly-open')) return;
    // Firefox may horizontally scroll or finish redistributing the focused
    // trigger after resize and its first frame. Clamp until the panel closes.
    correctHorizontalBounds(view);
    boundsFrame = view.requestAnimationFrame(maintainPanelBounds);
  };
  const monitorPanelBounds = (): void => {
    const view = doc.defaultView;
    if (!view || boundsFrame !== null) return;
    boundsFrame = view.requestAnimationFrame(maintainPanelBounds);
  };
  const positionPanel = (): void => {
    const view = doc.defaultView;
    if (!view) return;
    const update = (): void => {
      if (!dropdown.classList.contains('rly-open')) return;
      resetToolbarDropdownPosition(dropdown);
      const panelRect = dropdown.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const margin = 8;
      const naturalLeft = wrapRect.right - panelRect.width;
      const clampedLeft = Math.max(
        margin,
        Math.min(view.innerWidth - panelRect.width - margin, naturalLeft)
      );
      dropdown.style.left = `${clampedLeft - wrapRect.left}px`;
      dropdown.style.right = 'auto';

      // Firefox can resolve the absolute containing block a fractional pixel
      // differently while a sliding group moves between rows. Correct from the
      // painted rectangle so the viewport gutter remains authoritative.
      correctHorizontalBounds(view, margin);

      const fitsBelow = wrapRect.bottom + 4 + panelRect.height <= view.innerHeight - margin;
      const fitsAbove = wrapRect.top - 4 - panelRect.height >= margin;
      if (!fitsBelow && fitsAbove) {
        dropdown.style.top = 'auto';
        dropdown.style.bottom = '100%';
        dropdown.style.marginTop = '0';
        dropdown.style.marginBottom = '4px';
      } else if (!fitsBelow) {
        dropdown.style.top = `${margin - wrapRect.top}px`;
        dropdown.style.marginTop = '0';
      }
    };
    // Update immediately for view switches, then after layout settles so font
    // loading and responsive styles cannot leave stale bounds.
    update();
    view.requestAnimationFrame(update);
    monitorPanelBounds();
  };
  const close = (): void => {
    const view = doc.defaultView;
    if (view && boundsFrame !== null) view.cancelAnimationFrame(boundsFrame);
    boundsFrame = null;
    resetToolbarDropdownPosition(dropdown);
    dropdown.classList.remove('rly-open');
    button.setAttribute('aria-expanded', 'false');
  };

  dropdown.addEventListener('rly-panel-resize', positionPanel);
  const panelContent = spec.panel(editor, close);
  dropdown.appendChild(panelContent);
  if (panelContent.classList.contains('rly-color-picker')) {
    dropdown.classList.add('rly-tb-dd-color');
  }

  const valueIndicator = spec.valueCommand ? { el: button, command: spec.valueCommand } : undefined;
  if (valueIndicator) button.classList.add('rly-value-indicator');
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const wasOpen = dropdown.classList.contains('rly-open');
    closePositionedToolbarDropdowns(doc);
    if (!wasOpen) {
      // Restore the CSS default before measuring the natural right-aligned
      // position, then replace it with a viewport-clamped inline offset.
      dropdown.style.left = '';
      dropdown.style.right = '';
      dropdown.classList.add('rly-open');
      button.setAttribute('aria-expanded', 'true');
      dropdown.firstElementChild?.dispatchEvent(
        new (doc.defaultView?.Event ?? Event)('rly-panel-open')
      );
      positionPanel();
    }
  });

  doc.addEventListener('click', close);
  // Viewport changes can move the trigger even if toolbar width is unchanged.
  const onViewportResize = (): void => positionPanel();
  doc.defaultView?.addEventListener('resize', onViewportResize);
  editor.events.on('destroy', () => {
    doc.removeEventListener('click', close);
    doc.defaultView?.removeEventListener('resize', onViewportResize);
    if (boundsFrame !== null) doc.defaultView?.cancelAnimationFrame(boundsFrame);
    boundsFrame = null;
  });

  wrap.append(button, dropdown);
  return { element: wrap, valueIndicator };
}
