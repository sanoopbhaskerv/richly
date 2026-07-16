import { useEffect, useState } from 'react';
import { useImageEditor, useImageEditorState } from '@richly/image-react';
import { SliderField } from '../controls/fields';

const adjustments = [
  ['brightness', 'Brightness', -100, 100],
  ['contrast', 'Contrast', -100, 100],
  ['saturation', 'Saturation', -100, 100],
  ['grayscale', 'Grayscale', 0, 100]
] as const;

type AdjustmentChannel = (typeof adjustments)[number][0];
type AdjustmentValues = Record<AdjustmentChannel, number>;

const neutralValues: AdjustmentValues = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  grayscale: 0
};

function toCoreValue(channel: AdjustmentChannel, value: number): number {
  return channel === 'grayscale' ? value / 100 : value / 100;
}

function fromCoreValue(value: number): number {
  return Math.round(value * 100);
}

/** Adjustment sliders with live preview, synchronized values, and one-entry commits. */
export function AdjustPanel() {
  const { session } = useImageEditor();
  const operations = useImageEditorState((state) => state.operations);
  const [values, setValues] = useState<AdjustmentValues>(neutralValues);

  useEffect(() => {
    const next = { ...neutralValues };
    for (const operation of operations) {
      if (operation.type !== 'adjust') continue;
      const params = operation.params as { channel?: AdjustmentChannel; value?: number };
      if (params.channel && typeof params.value === 'number') {
        next[params.channel] = fromCoreValue(params.value);
      }
    }
    setValues(next);
  }, [operations]);

  const preview = (channel: AdjustmentChannel, value: number): void => {
    setValues((current) => ({ ...current, [channel]: value }));
    session?.preview('adjust', { channel, value: toCoreValue(channel, value) });
  };

  const commit = (): void => {
    session?.commitPreview();
  };

  const resetAll = (): void => {
    session?.transact('Reset adjustments', () => {
      for (const channel of Object.keys(neutralValues) as AdjustmentChannel[]) {
        session.execute('adjust', { channel, value: 0 });
      }
    });
    setValues(neutralValues);
  };

  return (
    <section className="ris-inspector-section">
      <h2>Adjust</h2>
      <div className="ris-tool-group">
        <h3>Light</h3>
        {adjustments.map(([channel, label, min, max]) => (
          <SliderField
            key={channel}
            label={label}
            min={min}
            max={max}
            value={values[channel]}
            onPreview={(value) => preview(channel, value)}
            onChange={(value) => preview(channel, value)}
            onCommit={commit}
          />
        ))}
      </div>
      <div className="ris-actions">
        <button type="button" onClick={resetAll}>
          Reset all
        </button>
      </div>
    </section>
  );
}
