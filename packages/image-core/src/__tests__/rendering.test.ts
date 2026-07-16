import {
  createImageSession,
  type DecodedImageSource,
  type ExportOptions,
  type ExportResult,
  type ImageSourceDecoder,
  type PreviewOptions,
  type PreviewTarget,
  type RenderEngine,
  type RenderPlan,
  type RenderResult
} from '../index';

const decoder: ImageSourceDecoder = async (): Promise<DecodedImageSource> => ({
  info: { width: 200, height: 100, mimeType: 'image/png' },
  destroy() {}
});

class RecordingRenderEngine implements RenderEngine {
  readonly previewPlans: RenderPlan[] = [];
  readonly exportPlans: RenderPlan[] = [];

  async renderPreview(
    _source: DecodedImageSource,
    plan: RenderPlan,
    _target: PreviewTarget,
    options?: PreviewOptions
  ): Promise<RenderResult> {
    if (options?.signal?.aborted)
      throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
    this.previewPlans.push(plan);
    return { width: plan.width, height: plan.height };
  }

  async export(
    _source: DecodedImageSource,
    plan: RenderPlan,
    options?: ExportOptions
  ): Promise<ExportResult> {
    if (options?.signal?.aborted)
      throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
    this.exportPlans.push(plan);
    return {
      width: plan.width,
      height: plan.height,
      mimeType: options?.type ?? 'image/png',
      blob: new Blob([JSON.stringify(plan.stages)], { type: options?.type ?? 'image/png' })
    };
  }
}

describe('render plans and export', () => {
  it('compiles crop, resize, rotate, and flip into shared preview/export geometry', async () => {
    const renderEngine = new RecordingRenderEngine();
    const session = await createImageSession(
      { kind: 'url', url: '/fixture.png' },
      { decoder, renderEngine }
    );

    session.execute('crop', { rect: { x: 10, y: 5, width: 100, height: 50 } });
    session.execute('resize', { width: 40, height: 20 });
    session.execute('rotate', { angle: 90 });
    session.execute('flip', { axis: 'horizontal' });

    const preview = session.createPreview({ kind: 'custom' });
    await expect(preview.render()).resolves.toMatchObject({ width: 20, height: 40 });
    await expect(session.export({ type: 'image/webp' })).resolves.toMatchObject({
      width: 20,
      height: 40,
      mimeType: 'image/webp'
    });

    expect(renderEngine.previewPlans[0]?.stages.map((stage) => stage.type)).toEqual([
      'crop',
      'resize',
      'rotate',
      'flip'
    ]);
    expect(renderEngine.exportPlans[0]?.stages).toEqual(renderEngine.previewPlans[0]?.stages);
  });

  it('renders before/after comparison through the preview handle', async () => {
    const renderEngine = new RecordingRenderEngine();
    const session = await createImageSession(
      { kind: 'url', url: '/fixture.png' },
      { decoder, renderEngine }
    );

    session.execute('resize', { width: 120, height: 80 });
    const preview = session.createPreview({ kind: 'custom' });

    await expect(preview.renderBefore()).resolves.toMatchObject({ width: 200, height: 100 });
    await expect(preview.render()).resolves.toMatchObject({ width: 120, height: 80 });
    expect(renderEngine.previewPlans.map((plan) => plan.stages.map((stage) => stage.type))).toEqual(
      [[], ['resize']]
    );
  });

  it('rejects arbitrary rotate angles that do not match plan geometry', async () => {
    const session = await createImageSession({ kind: 'url', url: '/fixture.png' }, { decoder });

    expect(session.execute('rotate', { angle: 45 })).toMatchObject({
      ok: false,
      code: 'invalid_rotate'
    });
    expect(session.getState()).toMatchObject({ outputWidth: 200, outputHeight: 100 });
    expect(session.toDocument().operations).toHaveLength(0);
  });

  it('honors AbortSignal before preview and export work starts', async () => {
    const renderEngine = new RecordingRenderEngine();
    const session = await createImageSession(
      { kind: 'url', url: '/fixture.png' },
      { decoder, renderEngine }
    );
    const controller = new AbortController();
    controller.abort(new DOMException('Aborted', 'AbortError'));

    const preview = session.createPreview({ kind: 'custom' }, { signal: controller.signal });
    await expect(preview.render()).rejects.toThrow('Aborted');
    await expect(session.export({ signal: controller.signal })).rejects.toThrow('Aborted');
    expect(renderEngine.previewPlans).toHaveLength(0);
    expect(renderEngine.exportPlans).toHaveLength(0);
  });
});
