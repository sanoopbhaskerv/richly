import { useEffect, useMemo, useState } from 'react';
import type { ImageAdjustmentChannel, ImageOperation } from '@richly/image-core';
import { useImageEditor, useImageEditorState } from '@richly/image-react';
import { SliderField } from '../controls/fields';
import { adjustmentControls, editableAdjustmentChannels } from './adjustmentCatalog';
import type { AdjustmentControl } from './adjustmentCatalog';

type AdjustmentValues = Record<ImageAdjustmentChannel, number>;

const groups = ['Light', 'Color', 'Detail', 'Effects'] as const;

function emptyValues(): AdjustmentValues {
  return Object.fromEntries(
    editableAdjustmentChannels.map((channel) => [channel, 0])
  ) as AdjustmentValues;
}

function valuesFromOperations(operations: readonly ImageOperation[]): AdjustmentValues {
  const next = emptyValues();
  for (const operation of operations) {
    if (operation.type !== 'adjust') continue;
    const params = operation.params as { channel?: ImageAdjustmentChannel; value?: number };
    const control = adjustmentControls.find((candidate) => candidate.channel === params.channel);
    if (control && typeof params.value === 'number')
      next[control.channel] = control.fromCore(params.value);
  }
  return next;
}

function AdjustmentGroup(props: {
  readonly title: (typeof groups)[number];
  readonly controls: readonly AdjustmentControl[];
  readonly values: AdjustmentValues;
  readonly onPreview: (control: AdjustmentControl, value: number) => void;
  readonly onCommit: () => void;
}) {
  return (
    <div className="ris-tool-group ris-adjustment-group">
      <h3>{props.title}</h3>
      {props.controls.map((control) => (
        <SliderField
          key={control.channel}
          label={control.label}
          min={control.min}
          max={control.max}
          step={control.step}
          suffix={control.suffix}
          value={props.values[control.channel]}
          onPreview={(value) => props.onPreview(control, value)}
          onChange={(value) => props.onPreview(control, value)}
          onCommit={props.onCommit}
        />
      ))}
    </div>
  );
}

/** Adjustment sliders with live preview, grouped controls, and one-entry commits. */
export function AdjustPanel() {
  const { session } = useImageEditor();
  const operations = useImageEditorState((state) => state.operations);
  const [values, setValues] = useState<AdjustmentValues>(() => emptyValues());
  const grouped = useMemo(
    () =>
      groups.map((group) => ({
        group,
        controls: adjustmentControls.filter((control) => control.group === group)
      })),
    []
  );

  useEffect(() => {
    setValues(valuesFromOperations(operations));
  }, [operations]);

  const preview = (control: AdjustmentControl, value: number): void => {
    setValues((current) => ({ ...current, [control.channel]: value }));
    session?.preview('adjust', { channel: control.channel, value: control.toCore(value) });
  };

  const commit = (): void => {
    session?.commitPreview();
  };

  const resetAll = (): void => {
    session?.transact('Reset adjustments', () => {
      for (const channel of editableAdjustmentChannels) {
        session.execute('adjust', { channel, value: 0 });
      }
    });
    setValues(emptyValues());
  };

  return (
    <section className="ris-inspector-section">
      <h2>Adjust</h2>
      <p className="ris-meta">Fine-tune tone, color, detail, and creative effects.</p>
      <div className="ris-adjustment-stack">
        {grouped.map(({ group, controls }) => (
          <AdjustmentGroup
            key={group}
            title={group}
            controls={controls}
            values={values}
            onPreview={preview}
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
