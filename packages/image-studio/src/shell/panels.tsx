import type { ImageTool } from '@richly/image-react';
import { AdjustPanel } from '../tools/AdjustPanel';
import { CropPanel } from '../tools/CropPanel';
import { TransformPanel } from '../tools/TransformPanel';

/** Props for the active-tool context panel. */
export interface ContextPanelProps {
  /** Tool whose controls should be rendered. */
  readonly activeTool: ImageTool;
  /** Uses the compact bottom-sheet presentation on small screens. */
  readonly compact?: boolean;
}

/** Contextual panel for the active MVP tool. */
export function ContextPanel(props: ContextPanelProps) {
  return (
    <aside
      className={props.compact ? 'ris-panel ris-panel-compact' : 'ris-panel'}
      data-testid={props.compact ? 'image-inspector-compact' : 'image-inspector'}
    >
      {props.activeTool === 'adjust' ? <AdjustPanel /> : null}
      {props.activeTool === 'crop' ? <CropPanel /> : null}
      {props.activeTool === 'transform' ? <TransformPanel /> : null}
    </aside>
  );
}
