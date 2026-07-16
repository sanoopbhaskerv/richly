import { useImageCommands } from '@richly/image-react';

/** Rotate and flip controls. */
export function TransformPanel() {
  const commands = useImageCommands();
  return (
    <section>
      <h2>Transform</h2>
      <div className="ris-grid">
        <button type="button" onClick={() => commands.rotate(-90)}>
          Rotate left
        </button>
        <button type="button" onClick={() => commands.rotate(90)}>
          Rotate right
        </button>
        <button type="button" onClick={() => commands.flip('horizontal')}>
          Flip horizontal
        </button>
        <button type="button" onClick={() => commands.flip('vertical')}>
          Flip vertical
        </button>
      </div>
    </section>
  );
}
