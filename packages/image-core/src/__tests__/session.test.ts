import {
  ImageSessionDestroyedError,
  createImageSession,
  restoreImageSession,
  type DecodedImageSource,
  type ImageSourceDecoder,
  type ImageSourceInput
} from '../index';

const decoder: ImageSourceDecoder = async (
  source: ImageSourceInput
): Promise<DecodedImageSource> => ({
  info: {
    width: source.kind === 'imageData' ? source.data.width : 640,
    height: source.kind === 'imageData' ? source.data.height : 480,
    mimeType: 'image/png',
    ref: 'fixture'
  },
  destroy() {}
});

describe('ImageSession', () => {
  it('executes commands into immutable history entries', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });
    const result = session.execute('resize', { width: 320, height: 240 });

    expect(result.ok).toBe(true);
    expect(session.getState()).toMatchObject({
      outputWidth: 320,
      outputHeight: 240,
      dirty: true
    });
    expect(session.getState().history.entries.map((entry) => entry.label)).toEqual([
      'Restored baseline',
      'Resize'
    ]);
  });

  it('keeps transient preview out of the serialized manifest until committed', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });

    expect(session.preview('crop', { rect: { x: 0, y: 0, width: 100, height: 80 } })).toEqual({
      ok: true
    });
    expect(session.getState().outputWidth).toBe(100);
    expect(session.toDocument().operations).toHaveLength(0);

    session.commitPreview();
    expect(session.toDocument().operations).toHaveLength(1);
    expect(session.getState().history.entries.at(-1)?.label).toBe('Crop');
  });

  it('restores documents as the baseline instead of an undoable edit', async () => {
    const original = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });
    original.execute('resize', { width: 300, height: 200 });

    const restored = await restoreImageSession(
      original.toDocument(),
      { kind: 'url', url: '/fixture.png' },
      { decoder }
    );
    expect(restored.getState().dirty).toBe(false);
    expect(restored.undo()).toBe(false);

    restored.execute('flip', { axis: 'horizontal' });
    expect(restored.undo()).toBe(true);
    expect(restored.getState().operations).toHaveLength(1);
  });

  it('supports undo, redo, history jumps, reset, and operation removal', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });
    session.execute('resize', { width: 320, height: 240 });
    session.execute('rotate', { angle: 90 });

    expect(session.getState().outputWidth).toBe(240);
    expect(session.undo()).toBe(true);
    expect(session.redo()).toBe(true);
    expect(session.jumpToHistory(1)).toBe(true);

    const resize = session.getState().operations[0];
    expect(resize).toBeDefined();
    expect(session.removeOperation(resize!.id).ok).toBe(true);
    expect(session.reset().ok).toBe(true);
    expect(session.getState().operations).toHaveLength(0);
  });

  it('accumulates repeatable rotate commands and toggles flips per axis', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });

    session.execute('rotate', { angle: 90 });
    expect(session.toDocument().operations.at(-1)?.params).toEqual({ angle: 90 });
    session.execute('rotate', { angle: 90 });
    expect(session.toDocument().operations.at(-1)?.params).toEqual({ angle: 180 });
    session.execute('rotate', { angle: 90 });
    expect(session.toDocument().operations.at(-1)?.params).toEqual({ angle: 270 });
    session.execute('rotate', { angle: 90 });
    expect(session.toDocument().operations.some((operation) => operation.type === 'rotate')).toBe(
      false
    );

    session.execute('flip', { axis: 'horizontal' });
    session.execute('flip', { axis: 'vertical' });
    expect(
      session.toDocument().operations.filter((operation) => operation.type === 'flip')
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ params: { axis: 'horizontal' } }),
        expect.objectContaining({ params: { axis: 'vertical' } })
      ])
    );

    session.execute('flip', { axis: 'horizontal' });
    expect(
      session.toDocument().operations.filter((operation) => operation.type === 'flip')
    ).toEqual([expect.objectContaining({ params: { axis: 'vertical' } })]);
  });
});

describe('ImageSession lifecycle', () => {
  it('notifies subscribers and rejects invalid commands', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    const invalid = session.execute('resize', { width: 0, height: 20 });
    expect(invalid.ok).toBe(false);
    session.execute('resize', { width: 200, height: 100 });
    unsubscribe();
    session.execute('flip', { axis: 'vertical' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('exposes a disposable fake preview and releases decoded resources on destroy', async () => {
    const destroy = vi.fn();
    const renderEngine = {
      async renderPreview() {
        return { width: 20, height: 10 };
      },
      async export() {
        return { width: 20, height: 10, mimeType: 'image/png', blob: new Blob() };
      }
    };
    const localDecoder: ImageSourceDecoder = async () => ({
      info: { width: 20, height: 10 },
      destroy
    });
    const session = await createImageSession(
      { kind: 'url', url: '/fixture.png' },
      { decoder: localDecoder, renderEngine }
    );
    const preview = session.createPreview({ kind: 'custom' });

    await expect(preview.render()).resolves.toMatchObject({ width: 20, height: 10 });
    preview.dispose();
    expect(() => preview.getFrame()).toThrow('Preview handle has been disposed');

    session.destroy();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(session.getState().status).toBe('destroyed');
    expect(() => session.execute('flip', { axis: 'horizontal' })).toThrow(
      ImageSessionDestroyedError
    );
  });
});
