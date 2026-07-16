import { useImageEditor } from '@richly/image-react';

const adjustments = [
  ['brightness', 'Brightness'],
  ['contrast', 'Contrast'],
  ['saturation', 'Saturation'],
  ['grayscale', 'Grayscale']
] as const;

/** Adjustment sliders with transient preview and explicit gesture commit. */
export function AdjustPanel() {
  const { session } = useImageEditor();
  return (
    <section>
      <h2>Adjust</h2>
      {adjustments.map(([channel, label]) => (
        <label className="ris-field" key={channel}>
          <span>{label}</span>
          <input
            type="range"
            min={channel === 'grayscale' ? 0 : -1}
            max={1}
            step={0.01}
            defaultValue={0}
            // Slider movement renders against a transient preview so a cancel
            // or uncommitted gesture never mutates the persisted edit history.
            onChange={(event) =>
              session?.preview('adjust', { channel, value: Number(event.currentTarget.value) })
            }
            onPointerUp={() => session?.commitPreview()}
            onKeyUp={(event) => {
              if (event.key === 'Enter') session?.commitPreview();
            }}
          />
        </label>
      ))}
    </section>
  );
}
