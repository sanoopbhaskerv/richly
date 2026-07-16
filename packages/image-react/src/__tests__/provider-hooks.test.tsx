import { createRoot, type Root } from 'react-dom/client';
import { act, useEffect } from 'react';
import {
  createImageSession,
  type DecodedImageSource,
  type ImageSourceDecoder
} from '@richly/image-core';
import {
  CropOverlay,
  ImageEditorProvider,
  ImageToolbarButton,
  useCropTool,
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

function CropProbe() {
  const crop = useCropTool();
  useEffect(() => {
    crop.setDraft({ x: 4, y: 4, width: 20, height: 10 });
  }, []);
  return <CropOverlay />;
}

function CropBehaviorProbe() {
  const crop = useCropTool();
  const state = useImageEditorState((snapshot) => ({
    size: `${snapshot.outputWidth}x${snapshot.outputHeight}`,
    history: snapshot.history.entries.length,
    transient: snapshot.transient?.type ?? 'none'
  }));
  return (
    <div>
      <output data-testid="crop-size">{state.size}</output>
      <output data-testid="crop-history">{state.history}</output>
      <output data-testid="crop-transient">{state.transient}</output>
      <button
        onClick={() =>
          crop.setDraft({ x: 0, y: 0, width: 100, height: 50 }, { width: 100, height: 50 })
        }
      >
        draft full
      </button>
      <button onClick={crop.apply}>apply crop</button>
      <button
        onClick={() =>
          crop.setDraft({ x: 10, y: 5, width: 60, height: 30 }, { width: 100, height: 50 })
        }
      >
        draft smaller
      </button>
    </div>
  );
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

  it('waits for provider-created sessions and cleans up owned source resources', async () => {
    let closed = 0;
    const bitmap = {
      width: 32,
      height: 16,
      close() {
        closed += 1;
      }
    } as ImageBitmap;

    await act(async () => {
      root.render(
        <ImageEditorProvider source={{ kind: 'bitmap', bitmap, transferOwnership: true }}>
          <Probe />
        </ImageEditorProvider>
      );
      expect(container.querySelector('[data-testid="size"]')).toBeNull();
      await flushAsync();
    });

    expect(container.querySelector('[data-testid="size"]')?.textContent).toBe('32x16');
    act(() => root.render(<div />));
    expect(closed).toBe(1);
  });

  it('uses valid crop overlay semantics and prevents page scrolling on keyboard moves', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });
    act(() => {
      root.render(
        <ImageEditorProvider session={session}>
          <CropProbe />
        </ImageEditorProvider>
      );
    });

    const overlay = container.querySelector('[data-testid="image-crop-overlay"]');
    expect(overlay?.getAttribute('role')).toBe('group');
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true
    });
    act(() => {
      overlay?.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps crop drafts local and treats applying a full-image crop as a no-op', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });
    act(() => {
      root.render(
        <ImageEditorProvider session={session}>
          <CropBehaviorProbe />
        </ImageEditorProvider>
      );
    });

    act(() => button('draft full').click());
    expect(container.querySelector('[data-testid="crop-size"]')?.textContent).toBe('100x50');
    expect(container.querySelector('[data-testid="crop-transient"]')?.textContent).toBe('none');

    act(() => button('apply crop').click());
    expect(container.querySelector('[data-testid="crop-size"]')?.textContent).toBe('100x50');
    expect(container.querySelector('[data-testid="crop-history"]')?.textContent).toBe('1');

    act(() => button('draft smaller').click());
    act(() => button('apply crop').click());
    expect(container.querySelector('[data-testid="crop-size"]')?.textContent).toBe('60x30');
    expect(container.querySelector('[data-testid="crop-history"]')?.textContent).toBe('2');
  });
});

function button(text: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text
  );
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Missing button: ${text}`);
  return match;
}
