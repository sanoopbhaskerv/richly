import { useRef, useState } from 'react';
import { useImageEditor, useImageEditorState, useImageExport } from '@richly/image-react';
import { NumberField, SliderField } from '../controls/fields';
import type { ImageStudioResult } from '../controller';

type ExportType = 'image/png' | 'image/jpeg' | 'image/webp';

const formats: Array<{ type: ExportType; label: string; extension: string }> = [
  { type: 'image/png', label: 'PNG', extension: 'png' },
  { type: 'image/jpeg', label: 'JPEG', extension: 'jpg' },
  { type: 'image/webp', label: 'WebP', extension: 'webp' }
];

/** Props for the local export dialog. */
export interface ExportDialogProps {
  /** Initial alt text value to show in the dialog. */
  readonly initialAlt?: string;
  /** Suggested output filename passed through to the host. */
  readonly suggestedFilename?: string;
  /** Closes the dialog without saving. */
  readonly onClose: () => void;
  /** Receives rendered bytes and the serialized edit manifest. */
  readonly onSave?: (result: ImageStudioResult) => void;
}

function filenameWithExtension(filename: string, extension: string): string {
  const base = filename
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.[a-z0-9]+$/i, '');
  return `${base || 'richly-image-studio-export'}.${extension}`;
}

/** Focused export flow returning a result without host persistence. */
export function ExportDialog(props: ExportDialogProps) {
  const { session } = useImageEditor();
  const exportFlow = useImageExport();
  const outputSize = useImageEditorState((state) => ({
    width: state.outputWidth,
    height: state.outputHeight,
    sourceWidth: state.source.width,
    sourceHeight: state.source.height
  }));
  const abortRef = useRef<AbortController | null>(null);
  const [alt, setAlt] = useState(props.initialAlt ?? '');
  const [type, setType] = useState<ExportType>('image/png');
  const [quality, setQuality] = useState(92);
  const [filename, setFilename] = useState(props.suggestedFilename ?? 'richly-image-studio.png');
  const [width, setWidth] = useState(outputSize.width);
  const [height, setHeight] = useState(outputSize.height);
  const format = formats.find((item) => item.type === type) ?? formats[0]!;

  const save = async (): Promise<void> => {
    if (!session) return;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const exported = await exportFlow.exportImage({
        type,
        quality: type === 'image/png' ? undefined : quality / 100,
        maxWidth: width,
        maxHeight: height,
        signal: controller.signal
      });
      props.onSave?.({
        ...exported,
        editDocument: session.toDocument(),
        alt,
        suggestedFilename: filenameWithExtension(filename, format.extension)
      });
      props.onClose();
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <div className="ris-dialog" role="dialog" aria-modal="true" aria-label="Export image">
      <h2>Export</h2>
      <div className="ris-tool-group">
        <h3>Format</h3>
        <div className="ris-segmented">
          {formats.map((item) => (
            <button
              type="button"
              key={item.type}
              className={type === item.type ? 'ris-active' : ''}
              onClick={() => setType(item.type)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {type !== 'image/png' ? (
        <SliderField
          label="Quality"
          value={quality}
          min={1}
          max={100}
          suffix="%"
          onPreview={setQuality}
          onChange={setQuality}
        />
      ) : null}
      <div className="ris-tool-group">
        <h3>Dimensions</h3>
        <NumberField label="W" value={width} min={1} onChange={setWidth} />
        <NumberField label="H" value={height} min={1} onChange={setHeight} />
        <p className="ris-meta" data-testid="image-export-dimensions">
          Source {outputSize.sourceWidth} x {outputSize.sourceHeight}px · Current {outputSize.width}{' '}
          x {outputSize.height}px
        </p>
      </div>
      <label className="ris-field">
        <span>Filename</span>
        <input value={filename} onChange={(event) => setFilename(event.currentTarget.value)} />
      </label>
      <label className="ris-field">
        <span>Alt text</span>
        <input value={alt} onChange={(event) => setAlt(event.currentTarget.value)} />
      </label>
      {type === 'image/jpeg' ? (
        <p className="ris-meta">Transparent pixels flatten to white.</p>
      ) : null}
      {exportFlow.error ? <p role="alert">{exportFlow.error}</p> : null}
      <div className="ris-actions">
        <button type="button" onClick={props.onClose}>
          Cancel
        </button>
        {exportFlow.busy ? (
          <button type="button" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        ) : null}
        <button
          type="button"
          className="ris-primary"
          disabled={exportFlow.busy}
          data-testid="image-export-submit"
          data-busy={exportFlow.busy}
          onClick={() => void save()}
        >
          {exportFlow.busy ? 'Exporting...' : 'Export image'}
        </button>
      </div>
    </div>
  );
}
