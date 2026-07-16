import {
  useImageEditor,
  useImageEditorUiState,
  useImageHistory,
  useViewport
} from '@richly/image-react';
import type { ImageTool } from '@richly/image-react';
import { IconButton } from '../controls/fields';
import {
  AdjustIcon,
  CloseIcon,
  CropIcon,
  FutureIcon,
  RedoIcon,
  TransformIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon
} from '../controls/icons';

interface ToolItem {
  readonly tool?: ImageTool;
  readonly label: string;
  readonly disabled?: boolean;
  readonly icon: typeof AdjustIcon;
}

const tools: ToolItem[] = [
  { tool: 'adjust', label: 'Adjust', icon: AdjustIcon },
  { label: 'Filters', disabled: true, icon: FutureIcon },
  { tool: 'crop', label: 'Crop', icon: CropIcon },
  { tool: 'transform', label: 'Transform', icon: TransformIcon },
  { label: 'Draw', disabled: true, icon: FutureIcon },
  { label: 'Text', disabled: true, icon: FutureIcon },
  { label: 'Stickers', disabled: true, icon: FutureIcon },
  { label: 'Frames', disabled: true, icon: FutureIcon },
  { label: 'AI Tools', disabled: true, icon: FutureIcon }
];

/** Props for the Studio top command bar. */
export interface TopBarProps {
  /** Opens the export inspector or modal. */
  readonly onExport: () => void;
  /** Optional host cancellation callback for close controls. */
  readonly onCancel?: () => void;
}

/** Props for a responsive Studio tool navigation instance. */
export interface ToolNavigationProps {
  /** Selects rail or compact bottom navigation styling. */
  readonly placement: 'rail' | 'bottom';
}

/** Top workspace command bar for history, zoom, before/after, export, and close. */
export function TopBar(props: TopBarProps) {
  const history = useImageHistory();
  const viewport = useViewport();
  const { uiStore } = useImageEditor();
  const compareMode = useImageEditorUiState((state) => state.compareMode);
  const setBefore = (value: boolean): void => uiStore.setCompareMode(value);
  return (
    <header className="ris-topbar">
      <strong>Richly Image Studio</strong>
      <div className="ris-topbar-actions">
        <IconButton label="Undo" disabled={!history.canUndo} onClick={history.undo}>
          <UndoIcon />
        </IconButton>
        <IconButton label="Redo" disabled={!history.canRedo} onClick={history.redo}>
          <RedoIcon />
        </IconButton>
        <IconButton label="Zoom out" onClick={viewport.zoomOut}>
          <ZoomOutIcon />
        </IconButton>
        <span className="ris-zoom-label">{Math.round(viewport.zoom * 100)}%</span>
        <IconButton label="Zoom in" onClick={viewport.zoomIn}>
          <ZoomInIcon />
        </IconButton>
        <button
          type="button"
          className="ris-before-button"
          aria-pressed={compareMode}
          onClick={() => setBefore(!compareMode)}
          onPointerDown={() => setBefore(true)}
          onPointerUp={() => setBefore(false)}
          onPointerLeave={() => setBefore(false)}
          onKeyDown={(event) => {
            if (event.key === ' ') setBefore(true);
          }}
          onKeyUp={(event) => {
            if (event.key === ' ') setBefore(false);
          }}
        >
          Before
        </button>
        <button type="button" className="ris-primary" onClick={props.onExport}>
          Export
        </button>
        <IconButton label="Close" onClick={props.onCancel}>
          <CloseIcon />
        </IconButton>
      </div>
    </header>
  );
}

/** Tool navigation rendered as rail on wide layouts and bottom nav on compact layouts. */
export function ToolNavigation(props: ToolNavigationProps) {
  const { uiStore } = useImageEditor();
  const activeTool = useImageEditorUiState((state) => state.activeTool);
  return (
    <nav className={`ris-tools ris-tools-${props.placement}`} aria-label="Image tools">
      {tools.map((item) => {
        const Icon = item.icon;
        const active = item.tool === activeTool;
        return (
          <button
            type="button"
            key={item.label}
            className={active ? 'ris-active' : ''}
            disabled={item.disabled}
            title={item.disabled ? 'Coming soon' : item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => item.tool && uiStore.setActiveTool(item.tool)}
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
