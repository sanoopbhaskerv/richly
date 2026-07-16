import { useState } from 'react';
import { useImageEditorUiState } from '@richly/image-react';
import type { ImageStudioProps } from '../types';
import { ContextPanel } from './panels';
import { TopBar, ToolNavigation } from './toolbar';
import { StudioWorkspace } from '../workspace/StudioWorkspace';
import { ExportDialog } from '../tools/ExportDialog';

/** Responsive shell arranging top bar, tools, canvas, and contextual controls. */
export function StudioShell(props: ImageStudioProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const activeTool = useImageEditorUiState((state) => state.activeTool);
  return (
    <section
      className={`ris-root ris-theme-${props.theme ?? 'dark'}`}
      data-mode={props.mode ?? 'inline'}
    >
      <TopBar onExport={() => setExportOpen(true)} onCancel={props.onCancel} />
      <div className="ris-layout">
        <ToolNavigation placement="rail" />
        <StudioWorkspace />
        <ContextPanel activeTool={activeTool} />
      </div>
      <ToolNavigation placement="bottom" />
      <div className="ris-bottom-sheet">
        <ContextPanel activeTool={activeTool} compact />
      </div>
      {exportOpen ? (
        <ExportDialog
          initialAlt={props.initialAlt}
          suggestedFilename={props.suggestedFilename}
          onClose={() => setExportOpen(false)}
          onSave={props.onSave}
        />
      ) : null}
    </section>
  );
}
