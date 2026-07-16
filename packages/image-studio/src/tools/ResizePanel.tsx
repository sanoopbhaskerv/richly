import { useEffect, useState } from 'react';
import { useImageCommands, useImageEditorState } from '@richly/image-react';

/** Resize controls for exact output dimensions. */
export function ResizePanel() {
  const commands = useImageCommands();
  const state = useImageEditorState((snapshot) => ({
    width: snapshot.outputWidth,
    height: snapshot.outputHeight
  }));
  const [width, setWidth] = useState(state.width);
  const [height, setHeight] = useState(state.height);
  useEffect(() => {
    setWidth(state.width);
    setHeight(state.height);
  }, [state.height, state.width]);
  return (
    <section>
      <h2>Resize</h2>
      <label className="ris-field">
        <span>Width</span>
        <input
          type="number"
          value={width}
          onChange={(event) => setWidth(Number(event.currentTarget.value))}
        />
      </label>
      <label className="ris-field">
        <span>Height</span>
        <input
          type="number"
          value={height}
          onChange={(event) => setHeight(Number(event.currentTarget.value))}
        />
      </label>
      <button type="button" className="ris-primary" onClick={() => commands.resize(width, height)}>
        Apply resize
      </button>
    </section>
  );
}
