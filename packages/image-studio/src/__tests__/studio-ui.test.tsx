import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  createImageSession,
  type DecodedImageSource,
  type ImageSourceDecoder
} from '@richly/image-core';
import { ImageStudio } from '../index';
import {
  createImageStudioController,
  ImageStudioControllerBusyError,
  ImageStudioControllerNoHostError
} from '../controller';

const decoder: ImageSourceDecoder = async (): Promise<DecodedImageSource> => ({
  info: { width: 320, height: 180 },
  destroy() {}
});

async function createTestSession() {
  return createImageSession(
    { kind: 'url', url: '/fixture.png' },
    { decoder, renderEngine: fakeRenderEngine() }
  );
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ImageStudio UI and controller', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders the responsive shell and MVP tool controls', async () => {
    const session = await createTestSession();
    act(() => root.render(<ImageStudio session={session} />));
    expect(container.querySelector('.ris-topbar')?.textContent).toContain('Richly Image Studio');
    expect(container.querySelector('.ris-tools-rail')?.textContent).toContain('Adjust');
    expect(container.querySelector('.ris-tools-rail')?.textContent).toContain('Filters');
    expect(container.querySelector('.ris-panel')?.textContent).toContain('Adjust');
  });

  it('enables AI Tools and surfaces provider status without auto-applying edits', async () => {
    const session = await createTestSession();
    act(() =>
      root.render(
        <ImageStudio
          session={session}
          aiProvider={{
            getStatus: () => ({
              available: true,
              label: 'Ready',
              detail: 'Smart Enhance will run locally.',
              accelerator: 'wasm'
            }),
            smartEnhance: async () => ({
              label: 'Apply Smart Enhance',
              adjustments: [{ channel: 'contrast', value: 0.2 }]
            })
          }}
        />
      )
    );

    const aiTools = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.ris-tools-rail button')
    ).find((button) => button.textContent?.includes('AI Tools'));
    expect(aiTools?.disabled).toBe(false);

    act(() => aiTools?.click());
    await act(async () => {});

    expect(container.querySelector('.ris-panel')?.textContent).toContain('AI Tools');
    expect(container.querySelector('.ris-ai-status')?.textContent).toContain('Ready');
    expect(container.querySelector('.ris-ai-status')?.textContent).toContain('wasm');
    expect(session.getState().operations).toHaveLength(0);
  });

  it('delegates filmstrip Add image to the host callback', async () => {
    const session = await createTestSession();
    const onAddImage = vi.fn();
    act(() => root.render(<ImageStudio session={session} onAddImage={onAddImage} />));

    const add = container.querySelector<HTMLButtonElement>('.ris-filmstrip-add');
    act(() => add?.click());

    expect(onAddImage).toHaveBeenCalledTimes(1);
  });

  it('applies filter presets as undoable adjustment stacks', async () => {
    const session = await createTestSession();
    act(() => root.render(<ImageStudio session={session} />));

    const filters = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.ris-tools-rail button')
    ).find((button) => button.textContent?.includes('Filters'));
    expect(filters?.disabled).toBe(false);

    act(() => filters?.click());
    const vivid = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.ris-preset-card')
    ).find((button) => button.textContent?.includes('Vivid'));
    act(() => vivid?.click());

    expect(session.getState().operations.map((operation) => operation.params)).toEqual([
      { channel: 'exposure', value: 0.16 },
      { channel: 'contrast', value: 0.18 },
      { channel: 'saturation', value: 0.28 },
      { channel: 'sharpen', value: 0.16 }
    ]);
    expect(session.getState().history.entries.at(-1)?.label).toBe('Apply Vivid filter');
  });

  it('settles controller opens exactly once and rejects double opens', async () => {
    const controller = createImageStudioController();
    const pending = controller.open({ source: { kind: 'url', url: '/fixture.png' } });
    await expect(controller.open({ source: { kind: 'url', url: '/other.png' } })).rejects.toThrow(
      ImageStudioControllerBusyError
    );
    controller.close(null);
    await expect(pending).resolves.toBeNull();
    expect(controller.isOpen()).toBe(false);
  });

  it('rejects an open request when no Studio host subscribes', async () => {
    vi.useFakeTimers();
    try {
      const controller = createImageStudioController({ noHostTimeoutMs: 25 });
      const pending = controller.open({ source: { kind: 'url', url: '/fixture.png' } });
      const rejection = expect(pending).rejects.toThrow(ImageStudioControllerNoHostError);

      await vi.advanceTimersByTimeAsync(25);

      await rejection;
      expect(controller.isOpen()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles a pending request as cancel when the host unsubscribes', async () => {
    const controller = createImageStudioController({ noHostTimeoutMs: 1000 });
    const unsubscribe = controller.subscribe(() => {});
    const pending = controller.open({ source: { kind: 'url', url: '/fixture.png' } });

    unsubscribe();

    await expect(pending).resolves.toBeNull();
    expect(controller.isOpen()).toBe(false);
  });
});

function fakeRenderEngine() {
  return {
    async renderPreview() {
      return { width: 320, height: 180 };
    },
    async export() {
      return { width: 320, height: 180, mimeType: 'image/png', blob: new Blob() };
    }
  };
}
