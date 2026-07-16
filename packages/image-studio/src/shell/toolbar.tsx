import {
  useImageEditor,
  useImageEditorUiState,
  useImageHistory,
  useViewport
} from '@richly/image-react';
import type { ImageTool } from '@richly/image-react';

const tools: Array<{ tool: ImageTool; label: string; icon: string }> = [
  { tool: 'adjust', label: 'Adjust', icon: '☼' },
  { tool: 'crop', label: 'Crop', icon: '⌗' },
  { tool: 'resize', label: 'Resize', icon: '□' },
  { tool: 'rotate', label: 'Rotate', icon: '↻' },
  { tool: 'flip', label: 'Flip', icon: '⇋' }
];

/** Props for the Studio top command bar. */
export interface TopBarProps {
  /** Opens the export dialog. */
  readonly onExport: () => void;
  /** Optional host cancellation callback for close controls. */
  readonly onCancel?: () => void;
}

/** Props for a responsive Studio tool navigation instance. */
export interface ToolNavigationProps {
  /** Selects rail or compact bottom navigation styling. */
  readonly placement: 'rail' | 'bottom';
}

/** Top command bar for history, zoom, compare, export, and close. */
export function TopBar(props: TopBarProps) {
  const history = useImageHistory();
  const viewport = useViewport();
  const { uiStore } = useImageEditor();
  const compareMode = useImageEditorUiState((state) => state.compareMode);
  return (
    <header className="ris-topbar">
      <strong>Richly Image Studio</strong>
      <button type="button" onClick={history.undo} aria-label="Undo">
        ↶
      </button>
      <button type="button" onClick={history.redo} aria-label="Redo">
        ↷
      </button>
      <button type="button" onClick={viewport.zoomOut} aria-label="Zoom out">
        −
      </button>
      <span>{Math.round(viewport.zoom * 100)}%</span>
      <button type="button" onClick={viewport.zoomIn} aria-label="Zoom in">
        +
      </button>
      <button
        type="button"
        onClick={() => uiStore.setCompareMode(!compareMode)}
        aria-pressed={compareMode}
      >
        Before
      </button>
      <button type="button" className="ris-primary" onClick={props.onExport}>
        Export
      </button>
      <button type="button" onClick={props.onCancel} aria-label="Close">
        ×
      </button>
    </header>
  );
}

/** Tool navigation rendered as rail on wide layouts and bottom nav on compact layouts. */
export function ToolNavigation(props: ToolNavigationProps) {
  const { uiStore } = useImageEditor();
  const activeTool = useImageEditorUiState((state) => state.activeTool);
  return (
    <nav className={`ris-tools ris-tools-${props.placement}`} aria-label="Image tools">
      {tools.map((item) => (
        <button
          type="button"
          key={item.tool}
          className={activeTool === item.tool ? 'ris-active' : ''}
          onClick={() => uiStore.setActiveTool(item.tool)}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
