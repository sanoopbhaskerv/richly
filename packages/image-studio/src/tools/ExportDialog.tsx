import { useState } from 'react';
import { useImageEditor, useImageExport } from '@richly/image-react';
import type { ImageStudioResult } from '../controller';

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

/** Focused export flow returning a result without host persistence. */
export function ExportDialog(props: ExportDialogProps) {
  const { session } = useImageEditor();
  const exportFlow = useImageExport();
  const [alt, setAlt] = useState(props.initialAlt ?? '');
  const [type, setType] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const save = async (): Promise<void> => {
    if (!session) return;
    const exported = await exportFlow.exportImage({ type });
    // Hosts receive the rendered Blob plus the edit manifest, but Studio never
    // uploads or persists media on their behalf.
    props.onSave?.({
      ...exported,
      editDocument: session.toDocument(),
      alt,
      suggestedFilename: props.suggestedFilename
    });
    props.onClose();
  };
  return (
    <div className="ris-dialog" role="dialog" aria-modal="true" aria-label="Export image">
      <h2>Export</h2>
      <label className="ris-field">
        <span>Format</span>
        <select
          value={type}
          onChange={(event) => setType(event.currentTarget.value as typeof type)}
        >
          <option value="image/png">PNG</option>
          <option value="image/jpeg">JPEG</option>
          <option value="image/webp">WebP</option>
        </select>
      </label>
      <label className="ris-field">
        <span>Alt text</span>
        <input value={alt} onChange={(event) => setAlt(event.currentTarget.value)} />
      </label>
      {exportFlow.error ? <p role="alert">{exportFlow.error}</p> : null}
      <div className="ris-actions">
        <button type="button" onClick={props.onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="ris-primary"
          disabled={exportFlow.busy}
          onClick={() => void save()}
        >
          Export
        </button>
      </div>
    </div>
  );
}
