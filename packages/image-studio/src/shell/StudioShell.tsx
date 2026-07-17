import { useEffect, useState } from 'react';
import { useImageEditor, useImageEditorUiState } from '@richly/image-react';
import type { ImageStudioProps } from '../types';
import { ContextPanel } from './panels';
import { TopBar, ToolNavigation } from './toolbar';
import { StudioWorkspace } from '../workspace/StudioWorkspace';
import { ExportDialog } from '../tools/ExportDialog';
import { useStudioShortcuts } from '../a11y/useStudioShortcuts';

/** Responsive shell arranging top bar, tools, canvas, and contextual controls. */
export function StudioShell(props: ImageStudioProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const activeTool = useImageEditorUiState((state) => state.activeTool);
  const { uiStore } = useImageEditor();
  const initialTool = props.initialTool;
  useEffect(() => {
    // Deep-link entry point: hosts such as the Richly inline image toolbar
    // open Studio directly on Crop, Transform, or Adjust.
    if (initialTool) uiStore.setActiveTool(initialTool);
  }, [initialTool, uiStore]);
  useStudioShortcuts();
  return (
    <section
      className={`ris-root ris-theme-${props.theme ?? 'dark'}`}
      data-mode={props.mode ?? 'inline'}
      data-testid="image-studio-root"
    >
      <TopBar onExport={() => setExportOpen(true)} onCancel={props.onCancel} />
      <div className="ris-layout">
        <ToolNavigation placement="rail" />
        <StudioWorkspace />
        <ContextPanel activeTool={activeTool} />
      </div>
      <ToolNavigation placement="bottom" />
      <div className="ris-bottom-sheet" data-testid="image-bottom-sheet">
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
