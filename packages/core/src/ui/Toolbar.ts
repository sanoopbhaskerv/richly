import type { Editor, ToolbarMode } from '../editor/Editor';
import { installToolbarKeyboardNavigation } from './toolbar/ToolbarKeyboard';
import {
  availableToolbarWidth as measureAvailableToolbarWidth,
  occupiedToolbarWidth as measureOccupiedToolbarWidth,
  toolbarWidthBoundaries as collectToolbarWidthBoundaries
} from './toolbar/ToolbarMetrics';
import type { ToolbarLayoutServices, ToolbarRenderModel } from './toolbar/ToolbarModel';
import { OverflowToolbar } from './toolbar/OverflowToolbar';
import { renderToolbar } from './toolbar/ToolbarRenderer';
import { SlidingToolbar } from './toolbar/SlidingToolbar';
import { refreshToolbarState } from './toolbar/ToolbarState';

/**
 * Coordinates toolbar rendering, responsive layout, command-state refresh,
 * and keyboard behavior.
 *
 * The class deliberately remains the stable editor-facing integration point.
 * Feature rendering and layout modes live behind internal modules so adding a
 * control type cannot accidentally alter responsive measurement, and adding a
 * layout strategy cannot reach into command-state synchronization.
 *
 * Toolbar specifications use spaces between controls, `|` between atomic
 * groups, and `||` between intentional rows. Test IDs follow `tb-<name>` as
 * documented in TESTING.md.
 */
export class Toolbar {
  private readonly model: ToolbarRenderModel;

  constructor(
    private readonly editor: Editor,
    private readonly container: HTMLElement,
    spec: string,
    mode: ToolbarMode = 'wrap'
  ) {
    container.setAttribute('role', 'toolbar');
    container.setAttribute('aria-label', 'Editor toolbar');
    this.model = renderToolbar(editor, container, spec);

    // Strategies depend on capabilities instead of the coordinator itself.
    // Keeping these callbacks here also preserves one measurement seam for
    // deterministic tests and future host-specific layout adapters.
    const layout: ToolbarLayoutServices = {
      availableWidth: () => this.availableToolbarWidth(),
      widthBoundaries: () => this.toolbarWidthBoundaries(),
      occupiedWidth: (parent) => this.occupiedWidth(parent)
    };
    if (mode === 'more') {
      const overflow = new OverflowToolbar(editor, container, this.model.sections, layout);
      this.model.focusables.push(overflow.toggleButton);
    } else if (mode === 'sliding') {
      const sliding = new SlidingToolbar(editor, container, this.model.sections, layout);
      this.model.focusables.push(sliding.toggleButton);
    }

    editor.events.on('selectionchange', () => this.refresh());
    editor.events.on('change', () => this.refresh());
    editor.events.on('execcommand', () => this.refresh());
    const removeKeyboardNavigation = installToolbarKeyboardNavigation(
      container,
      this.model.focusables
    );
    editor.events.on('destroy', removeKeyboardNavigation);
  }

  /** Synchronize every rendered control with the current editor command state. */
  refresh(): void {
    refreshToolbarState(this.editor, this.container, this.model);
  }

  /** Measure usable width across the toolbar's complete consumer boundary chain. */
  private availableToolbarWidth(): number {
    return measureAvailableToolbarWidth(this.container);
  }

  /** Return elements observed by responsive strategies for width changes. */
  private toolbarWidthBoundaries(): HTMLElement[] {
    return collectToolbarWidthBoundaries(this.container);
  }

  /** Measure visible child width for a responsive toolbar row. */
  private occupiedWidth(parent: HTMLElement): number {
    return measureOccupiedToolbarWidth(this.container, parent);
  }
}
