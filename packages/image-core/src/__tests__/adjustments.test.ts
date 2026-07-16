import { createImageSession, type DecodedImageSource, type ImageSourceDecoder } from '../index';

const decoder: ImageSourceDecoder = async (): Promise<DecodedImageSource> => ({
  info: { width: 100, height: 80, mimeType: 'image/png' },
  destroy() {}
});

describe('adjustments and transient previews', () => {
  it('canonicalizes each adjustment channel and removes identity values', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });

    session.execute('adjust', { channel: 'brightness', value: 0.2 });
    session.execute('adjust', { channel: 'contrast', value: 0.1 });
    session.execute('adjust', { channel: 'brightness', value: 0.4 });
    expect(session.getState().operations.map((operation) => operation.params)).toEqual([
      { channel: 'contrast', value: 0.1 },
      { channel: 'brightness', value: 0.4 }
    ]);

    session.execute('adjust', { channel: 'brightness', value: 0 });
    expect(session.getState().operations.map((operation) => operation.params)).toEqual([
      { channel: 'contrast', value: 0.1 }
    ]);
  });

  it('commits a continuous adjustment preview as one history entry', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });

    session.preview('adjust', { channel: 'saturation', value: 0.1 });
    session.preview('adjust', { channel: 'saturation', value: 0.3 });
    session.preview('adjust', { channel: 'saturation', value: 0.5 });
    expect(session.toDocument().operations).toHaveLength(0);

    session.commitPreview();
    expect(session.toDocument().operations).toHaveLength(1);
    expect(session.getState().history.entries.map((entry) => entry.label)).toEqual([
      'Restored baseline',
      'Adjust'
    ]);
  });

  it('validates supported adjustment ranges', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });

    expect(session.canExecute('adjust', { channel: 'grayscale', value: 1 })).toEqual({ ok: true });
    expect(session.execute('adjust', { channel: 'grayscale', value: 1.1 }).ok).toBe(false);
    expect(session.execute('adjust', { channel: 'brightness', value: -1.2 }).ok).toBe(false);
  });
});
