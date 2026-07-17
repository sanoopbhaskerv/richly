import { useMemo } from 'react';
import type { ImageAdjustmentChannel } from '@richly/image-core';
import { useImageEditor, useImageEditorState } from '@richly/image-react';
import { editableAdjustmentChannels, filterPresets } from './adjustmentCatalog';
import type { FilterPreset } from './adjustmentCatalog';

function presetMatches(
  preset: FilterPreset,
  values: Partial<Record<ImageAdjustmentChannel, number>>
): boolean {
  return editableAdjustmentChannels.every(
    (channel) => (preset.adjustments[channel] ?? 0) === (values[channel] ?? 0)
  );
}

/** One-click filter looks built from core adjustment operations. */
export function FilterPanel() {
  const { session } = useImageEditor();
  const operations = useImageEditorState((state) => state.operations);
  const values = useMemo(() => {
    const next: Partial<Record<ImageAdjustmentChannel, number>> = {};
    for (const operation of operations) {
      if (operation.type !== 'adjust') continue;
      const params = operation.params as { channel?: ImageAdjustmentChannel; value?: number };
      if (params.channel && typeof params.value === 'number') next[params.channel] = params.value;
    }
    return next;
  }, [operations]);

  const applyPreset = (preset: FilterPreset): void => {
    session?.transact(`Apply ${preset.label} filter`, () => {
      for (const channel of editableAdjustmentChannels) {
        session.execute('adjust', { channel, value: preset.adjustments[channel] ?? 0 });
      }
    });
  };

  return (
    <section className="ris-inspector-section">
      <h2>Filters</h2>
      <p className="ris-meta">Apply a polished look, then refine it in Adjust.</p>
      <div className="ris-preset-grid">
        {filterPresets.map((preset) => {
          const active = presetMatches(preset, values);
          return (
            <button
              type="button"
              key={preset.id}
              className={active ? 'ris-preset-card ris-active' : 'ris-preset-card'}
              aria-pressed={active}
              onClick={() => applyPreset(preset)}
            >
              <span className="ris-preset-swatch" style={{ background: preset.swatch }} />
              <span>{preset.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
