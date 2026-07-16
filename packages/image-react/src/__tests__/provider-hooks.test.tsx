import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import {
  createImageSession,
  type DecodedImageSource,
  type ImageSourceDecoder
} from '@richly/image-core';
import {
  ImageEditorProvider,
  ImageToolbarButton,
  useImageCommands,
  useImageEditorState,
  useImageHistory,
  useViewport
} from '../index';

const decoder: ImageSourceDecoder = async (): Promise<DecodedImageSource> => ({
  info: { width: 100, height: 50 },
  destroy() {}
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const size = useImageEditorState((state) => `${state.outputWidth}x${state.outputHeight}`);
  const commands = useImageCommands();
  const history = useImageHistory();
  const viewport = useViewport();
  return (
    <div>
      <output data-testid="size">{size}</output>
      <output data-testid="history">{history.entries.length}</output>
      <output data-testid="zoom">{viewport.zoom.toFixed(1)}</output>
      <button onClick={() => commands.resize(40, 20)}>resize</button>
      <button onClick={() => history.undo()}>undo</button>
      <button onClick={() => viewport.zoomIn()}>zoom</button>
    </div>
  );
}

describe('@richly/image-react primitives', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('subscribes to core state and keeps viewport state in React', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });
    act(() => {
      root.render(
        <ImageEditorProvider session={session}>
          <Probe />
        </ImageEditorProvider>
      );
    });

    expect(container.querySelector('[data-testid="size"]')?.textContent).toBe('100x50');
    act(() => button('resize').click());
    expect(container.querySelector('[data-testid="size"]')?.textContent).toBe('40x20');
    expect(container.querySelector('[data-testid="history"]')?.textContent).toBe('2');

    act(() => button('zoom').click());
    expect(container.querySelector('[data-testid="zoom"]')?.textContent).toBe('1.2');
    act(() => button('undo').click());
    expect(container.querySelector('[data-testid="size"]')?.textContent).toBe('100x50');
    expect(container.querySelector('[data-testid="zoom"]')?.textContent).toBe('1.2');
  });

  it('renders accessible primitive controls', () => {
    act(() => root.render(<ImageToolbarButton label="Apply crop">Apply</ImageToolbarButton>));
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Apply crop');
  });
});

function button(text: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text
  );
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Missing button: ${text}`);
  return match;
}
