import { useEffect } from 'react';
import {
  createCenteredCrop,
  useCropTool,
  useImageCommands,
  useImageEditorState
} from '@richly/image-react';
import { IconButton, NumberField } from '../controls/fields';
import { FlipHorizontalIcon, FlipVerticalIcon } from '../controls/icons';

const ratios = [
  ['Original', 'original'],
  ['Free', 'free'],
  ['1:1', 1],
  ['4:5', 4 / 5],
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
  ['3:2', 3 / 2],
  ['2:3', 2 / 3]
] as const;

/** Crop inspector with immediate draft creation, ratio presets, and draft actions. */
export function CropPanel() {
  const crop = useCropTool();
  const commands = useImageCommands();
  const sessionSize = useImageEditorState((state) => ({
    width: state.outputWidth,
    height: state.outputHeight
  }));
  const bounds = crop.bounds ?? sessionSize;
  const originalRatio = bounds.width / bounds.height;
  const rect = crop.rect ?? createCenteredCrop(bounds, crop.aspectRatio);

  useEffect(() => {
    if (!crop.rect) crop.setDraft(rect, bounds);
  }, [bounds, crop, crop.rect, rect]);

  const setRatio = (value: (typeof ratios)[number][1]): void => {
    const ratio = value === 'free' ? null : value === 'original' ? originalRatio : value;
    crop.setAspectRatio(ratio);
    crop.setDraft(createCenteredCrop(bounds, ratio), bounds);
  };

  const updateWidth = (width: number): void => {
    crop.setDraft({
      ...rect,
      width: Math.max(1, Math.min(bounds.width - rect.x, Math.round(width)))
    });
  };

  const updateHeight = (height: number): void => {
    crop.setDraft({
      ...rect,
      height: Math.max(1, Math.min(bounds.height - rect.y, Math.round(height)))
    });
  };

  return (
    <section className="ris-inspector-section">
      <h2>Crop &amp; Straighten</h2>
      <div className="ris-tool-group">
        <h3>Aspect Ratio</h3>
        <select
          className="ris-select"
          value={
            crop.aspectRatio === null
              ? 'free'
              : crop.aspectRatio === originalRatio
                ? 'original'
                : String(crop.aspectRatio)
          }
          onChange={(event) => {
            const match = ratios.find(([, value]) => String(value) === event.currentTarget.value);
            if (match) setRatio(match[1]);
          }}
        >
          {ratios.map(([label, value]) => (
            <option value={String(value)} key={label}>
              {label}
            </option>
          ))}
        </select>
        <div className="ris-ratio-grid">
          {ratios.map(([label, value]) => (
            <button type="button" key={label} onClick={() => setRatio(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="ris-tool-group">
        <h3>Dimensions</h3>
        <NumberField label="W" value={Math.round(rect.width)} min={1} onChange={updateWidth} />
        <NumberField label="H" value={Math.round(rect.height)} min={1} onChange={updateHeight} />
      </div>

      <div className="ris-tool-group">
        <h3>Flip image</h3>
        <div className="ris-icon-row">
          <IconButton label="Flip horizontally" onClick={() => commands.flip('horizontal')}>
            <FlipHorizontalIcon />
          </IconButton>
          <IconButton label="Flip vertically" onClick={() => commands.flip('vertical')}>
            <FlipVerticalIcon />
          </IconButton>
        </div>
      </div>

      <div className="ris-actions ris-sticky-actions">
        <button type="button" onClick={crop.cancel}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => crop.setDraft(createCenteredCrop(bounds, crop.aspectRatio), bounds)}
        >
          Reset
        </button>
        <button type="button" className="ris-primary" onClick={crop.apply}>
          Apply crop
        </button>
      </div>
    </section>
  );
}
