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
    const session = await createImageSession(
      { kind: 'url', url: '/fixture.png' },
      { decoder, renderEngine: fakeRenderEngine() }
    );
    act(() => root.render(<ImageStudio session={session} />));
    expect(container.querySelector('.ris-topbar')?.textContent).toContain('Richly Image Studio');
    expect(container.querySelector('.ris-tools-rail')?.textContent).toContain('Adjust');
    expect(container.querySelector('.ris-panel')?.textContent).toContain('Adjust');
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
