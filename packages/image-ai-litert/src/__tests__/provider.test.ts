import { createLiteRtImageAiProvider, createLiteRtRuntime } from '../provider';
import type { LiteRtCompiledModel, LiteRtCoreModule, LiteRtTensor } from '../types';

class FakeTensor implements LiteRtTensor {
  deleted = false;

  constructor(
    readonly dataValue: Float32Array,
    readonly shape: readonly number[]
  ) {}

  toTypedArray(): Float32Array {
    return this.dataValue;
  }

  delete(): void {
    this.deleted = true;
  }
}

function imageData(width: number, height: number): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255
    ]),
    colorSpace: 'srgb'
  } as ImageData;
}

describe('@richly/image-ai-litert provider', () => {
  it('reports setup guidance when no Smart Enhance model is configured', async () => {
    const provider = createLiteRtImageAiProvider({
      wasmUrl: '/litert/wasm/',
      importCore: async () => fakeCore(new Float32Array())
    });

    await expect(provider.getStatus()).resolves.toMatchObject({
      available: false,
      label: 'Model missing'
    });
  });

  it('loads LiteRT once and maps Smart Enhance outputs to adjustment suggestions', async () => {
    const loadedSources: unknown[] = [];
    const createdTensors: FakeTensor[] = [];
    const output = new FakeTensor(new Float32Array([0.2, -0.1, 0.35, 0]), [4]);
    const model: LiteRtCompiledModel = {
      async run(input) {
        expect((input as FakeTensor).shape).toEqual([1, 3, 2, 2]);
        return [output];
      },
      delete: vi.fn()
    };
    const core = fakeCore(output, {
      onLoadSource: (source) => loadedSources.push(source),
      onTensor: (tensor) => createdTensors.push(tensor),
      model
    });
    const provider = createLiteRtImageAiProvider({
      wasmUrl: '/litert/wasm/',
      accelerator: 'wasm',
      importCore: async () => core,
      smartEnhance: {
        id: 'enhance-v1',
        label: 'Smart Enhance',
        source: '/models/enhance.tflite',
        input: { width: 2, height: 2 },
        output: {
          channels: ['exposure', 'contrast', 'saturation', 'sharpen'],
          scale: 0.5
        }
      }
    });

    const result = await provider.smartEnhance?.({ imageData: imageData(2, 2) });

    expect(loadedSources).toEqual(['/models/enhance.tflite']);
    expect(result).toEqual({
      label: 'Apply Smart Enhance',
      adjustments: [
        { channel: 'exposure', value: 0.10000000149011612 },
        { channel: 'contrast', value: -0.05000000074505806 },
        { channel: 'saturation', value: 0.17499999701976776 }
      ],
      model: 'Smart Enhance',
      accelerator: 'wasm'
    });
    expect(createdTensors[0]?.deleted).toBe(true);
    expect(output.deleted).toBe(true);
  });

  it('caches compiled models until the runtime is disposed', async () => {
    const model = { run: vi.fn(), delete: vi.fn() };
    const runtime = createLiteRtRuntime({
      wasmUrl: '/litert/wasm/',
      importCore: async () => fakeCore(new Float32Array(), { model })
    });

    const first = await runtime.loadModel('model', 'Model', '/model.tflite');
    const second = await runtime.loadModel('model', 'Model', '/model.tflite');
    runtime.dispose();

    expect(first).toBe(second);
    expect(model.delete).toHaveBeenCalledTimes(1);
  });
});

function fakeCore(
  output: Float32Array | FakeTensor,
  options: {
    readonly onLoadSource?: (source: unknown) => void;
    readonly onTensor?: (tensor: FakeTensor) => void;
    readonly model?: LiteRtCompiledModel;
  } = {}
): LiteRtCoreModule {
  return {
    async loadLiteRt() {},
    async loadAndCompile(source) {
      options.onLoadSource?.(source);
      return (
        options.model ?? {
          async run() {
            return [
              output instanceof FakeTensor ? output : new FakeTensor(output, [output.length])
            ];
          }
        }
      );
    },
    Tensor: class extends FakeTensor {
      constructor(data: Float32Array, shape: readonly number[]) {
        super(data, shape);
        options.onTensor?.(this);
      }
    }
  };
}
