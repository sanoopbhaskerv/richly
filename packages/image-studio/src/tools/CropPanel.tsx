import { useCropTool, useImageEditorState } from '@richly/image-react';

/** Crop controls with explicit apply/cancel. */
export function CropPanel() {
  const crop = useCropTool();
  const size = useImageEditorState((state) => ({
    width: state.outputWidth,
    height: state.outputHeight
  }));
  const startCrop = (): void => {
    crop.setDraft({
      x: 0,
      y: 0,
      width: Math.round(size.width * 0.8),
      height: Math.round(size.height * 0.8)
    });
  };
  return (
    <section>
      <h2>Crop</h2>
      <div className="ris-grid">
        {[null, 1, 4 / 5, 16 / 9].map((ratio) => (
          <button type="button" key={String(ratio)} onClick={() => crop.setAspectRatio(ratio)}>
            {ratio ? ratio.toFixed(2) : 'Free'}
          </button>
        ))}
      </div>
      <button type="button" onClick={startCrop}>
        Start crop
      </button>
      <div className="ris-actions">
        <button type="button" onClick={crop.cancel}>
          Cancel
        </button>
        <button type="button" className="ris-primary" onClick={crop.apply}>
          Apply
        </button>
      </div>
    </section>
  );
}
