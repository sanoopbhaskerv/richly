import { useEffect, useMemo, useState } from 'react';
import { useImageCommands, useImageEditor, useImageEditorState } from '@richly/image-react';
import { IconButton, NumberField, SliderField } from '../controls/fields';
import {
  FlipHorizontalIcon,
  FlipVerticalIcon,
  RotateLeftIcon,
  RotateRightIcon
} from '../controls/icons';

type TransformTab = 'resize' | 'rotate' | 'flip';
type Unit = 'px' | '%';

interface ResizeTabProps {
  readonly width: number;
  readonly height: number;
  readonly resultWidth: number;
  readonly resultHeight: number;
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly unit: Unit;
  readonly locked: boolean;
  readonly onUnitChange: (unit: Unit) => void;
  readonly onLockedChange: (locked: boolean) => void;
  readonly onWidthChange: (width: number) => void;
  readonly onHeightChange: (height: number) => void;
  readonly onCancel: () => void;
  readonly onApply: () => void;
}

interface RotateTabProps {
  readonly rotation: number;
  readonly straighten: number;
  readonly onPreviewRotation: (value: number) => void;
  readonly onPreviewStraighten: (value: number) => void;
  readonly onCommitRotation: () => void;
  readonly onCommitStraighten: () => void;
  readonly onReset: () => void;
  readonly onRotateLeft: () => void;
  readonly onRotateRight: () => void;
}

interface FlipTabProps {
  readonly onFlipHorizontal: () => void;
  readonly onFlipVertical: () => void;
}

function clampDimension(value: number): number {
  return Math.max(1, Math.min(12_000, Math.round(value)));
}

function ResizeTab(props: ResizeTabProps) {
  return (
    <div className="ris-tool-group">
      <h3>Resize</h3>
      <div className="ris-inline-controls">
        <button
          type="button"
          className={props.unit === 'px' ? 'ris-active' : ''}
          onClick={() => props.onUnitChange('px')}
        >
          Pixels
        </button>
        <button
          type="button"
          className={props.unit === '%' ? 'ris-active' : ''}
          onClick={() => props.onUnitChange('%')}
        >
          Percent
        </button>
      </div>
      <NumberField label="Width" value={props.width} min={1} onChange={props.onWidthChange} />
      <NumberField label="Height" value={props.height} min={1} onChange={props.onHeightChange} />
      <button
        type="button"
        className={props.locked ? 'ris-active ris-lock' : 'ris-lock'}
        aria-pressed={props.locked}
        onClick={() => props.onLockedChange(!props.locked)}
      >
        Maintain aspect ratio
      </button>
      <p className="ris-meta" data-testid="image-resize-result">
        Current {props.outputWidth} x {props.outputHeight}px · Result {props.resultWidth} x{' '}
        {props.resultHeight}px
      </p>
      <div className="ris-actions">
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="button" className="ris-primary" onClick={props.onApply}>
          Apply resize
        </button>
      </div>
    </div>
  );
}

function RotateTab(props: RotateTabProps) {
  return (
    <div className="ris-tool-group">
      <h3>Rotate</h3>
      <div className="ris-icon-row">
        <IconButton label="Rotate left 90 degrees" onClick={props.onRotateLeft}>
          <RotateLeftIcon />
        </IconButton>
        <IconButton label="Rotate right 90 degrees" onClick={props.onRotateRight}>
          <RotateRightIcon />
        </IconButton>
      </div>
      <SliderField
        label="Free rotate"
        value={props.rotation}
        min={-180}
        max={180}
        suffix="deg"
        onPreview={props.onPreviewRotation}
        onChange={props.onPreviewRotation}
        onCommit={props.onCommitRotation}
      />
      <SliderField
        label="Straighten"
        value={props.straighten}
        min={-45}
        max={45}
        suffix="deg"
        onPreview={props.onPreviewStraighten}
        onChange={props.onPreviewStraighten}
        onCommit={props.onCommitStraighten}
      />
      <button type="button" onClick={props.onReset}>
        Reset draft
      </button>
    </div>
  );
}

function FlipTab(props: FlipTabProps) {
  return (
    <div className="ris-tool-group">
      <h3>Flip</h3>
      <div className="ris-icon-row">
        <IconButton label="Flip horizontally" onClick={props.onFlipHorizontal}>
          <FlipHorizontalIcon />
        </IconButton>
        <IconButton label="Flip vertically" onClick={props.onFlipVertical}>
          <FlipVerticalIcon />
        </IconButton>
      </div>
      <p className="ris-meta">Flip commands are repeatable and undoable per axis.</p>
    </div>
  );
}

/** Inspector for committed resize plus repeatable rotate, straighten, and flip controls. */
export function TransformPanel() {
  const commands = useImageCommands();
  const { session } = useImageEditor();
  const state = useImageEditorState((snapshot) => ({
    width: snapshot.outputWidth,
    height: snapshot.outputHeight
  }));
  const [tab, setTab] = useState<TransformTab>('resize');
  const [unit, setUnit] = useState<Unit>('px');
  const [locked, setLocked] = useState(true);
  const [width, setWidth] = useState(state.width);
  const [height, setHeight] = useState(state.height);
  const [rotation, setRotation] = useState(0);
  const [straighten, setStraighten] = useState(0);
  const ratio = useMemo(() => state.width / state.height, [state.height, state.width]);

  useEffect(() => {
    setWidth(state.width);
    setHeight(state.height);
  }, [state.height, state.width]);

  const updateWidth = (next: number): void => {
    const value = clampDimension(unit === '%' ? (state.width * next) / 100 : next);
    setWidth(value);
    if (locked) setHeight(clampDimension(value / ratio));
  };

  const updateHeight = (next: number): void => {
    const value = clampDimension(unit === '%' ? (state.height * next) / 100 : next);
    setHeight(value);
    if (locked) setWidth(clampDimension(value * ratio));
  };

  // The Width/Height fields must echo the active unit: percent mode shows a
  // percentage of the current output size, not the raw pixel value, or the
  // toggle has no visible effect and every edit looks like it "snaps back".
  const displayWidth = unit === '%' ? Math.round((width / state.width) * 100) : width;
  const displayHeight = unit === '%' ? Math.round((height / state.height) * 100) : height;

  const previewRotation = (value: number, setter: (value: number) => void): void => {
    setter(value);
    session?.preview('rotate', { angle: value });
  };

  const commitRotation = (setter: (value: number) => void): void => {
    session?.commitPreview();
    setter(0);
  };

  const resetResize = (): void => {
    setWidth(state.width);
    setHeight(state.height);
  };

  const resetRotation = (): void => {
    session?.cancelPreview();
    setRotation(0);
    setStraighten(0);
  };

  return (
    <section className="ris-inspector-section">
      <h2>Transform</h2>
      <div className="ris-segmented" role="tablist" aria-label="Transform tools">
        {(['resize', 'rotate', 'flip'] as const).map((item) => (
          <button
            type="button"
            key={item}
            className={tab === item ? 'ris-active' : ''}
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {item[0]!.toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'resize' ? (
        <ResizeTab
          width={displayWidth}
          height={displayHeight}
          resultWidth={width}
          resultHeight={height}
          outputWidth={state.width}
          outputHeight={state.height}
          unit={unit}
          locked={locked}
          onUnitChange={setUnit}
          onLockedChange={setLocked}
          onWidthChange={updateWidth}
          onHeightChange={updateHeight}
          onCancel={resetResize}
          onApply={() => commands.resize(width, height)}
        />
      ) : null}

      {tab === 'rotate' ? (
        <RotateTab
          rotation={rotation}
          straighten={straighten}
          onPreviewRotation={(value) => previewRotation(value, setRotation)}
          onPreviewStraighten={(value) => previewRotation(value, setStraighten)}
          onCommitRotation={() => commitRotation(setRotation)}
          onCommitStraighten={() => commitRotation(setStraighten)}
          onReset={resetRotation}
          onRotateLeft={() => commands.rotate(-90)}
          onRotateRight={() => commands.rotate(90)}
        />
      ) : null}

      {tab === 'flip' ? (
        <FlipTab
          onFlipHorizontal={() => commands.flip('horizontal')}
          onFlipVertical={() => commands.flip('vertical')}
        />
      ) : null}
    </section>
  );
}
