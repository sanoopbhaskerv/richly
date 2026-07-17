import type { ImageTool } from '@richly/image-react';
import { AdjustPanel } from '../tools/AdjustPanel';
import { AiPanel } from '../tools/AiPanel';
import { CropPanel } from '../tools/CropPanel';
import { FilterPanel } from '../tools/FilterPanel';
import { TransformPanel } from '../tools/TransformPanel';
import type { ImageStudioAiProvider } from '../types';

/** Props for the active-tool context panel. */
export interface ContextPanelProps {
  /** Tool whose controls should be rendered. */
  readonly activeTool: ImageTool;
  /** Optional local AI provider used only by the AI Tools panel. */
  readonly aiProvider?: ImageStudioAiProvider;
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
      {props.activeTool === 'filters' ? <FilterPanel /> : null}
      {props.activeTool === 'crop' ? <CropPanel /> : null}
      {props.activeTool === 'transform' ? <TransformPanel /> : null}
      {props.activeTool === 'ai' ? <AiPanel provider={props.aiProvider} /> : null}
    </aside>
  );
}
