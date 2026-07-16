import { ImageOperationRegistryError } from './errors';
import { invalid, positiveNumber, valid } from './validation';
import type { OperationDefinition, Rect, Size, ValidationResult } from './types';

function rectFrom(params: unknown): Rect | null {
  if (!params || typeof params !== 'object') return null;
  const rect = (params as { rect?: unknown }).rect;
  if (!rect || typeof rect !== 'object') return null;
  const value = rect as Record<string, unknown>;
  const x = positiveNumberOrZero(value.x);
  const y = positiveNumberOrZero(value.y);
  const width = positiveNumber(value.width);
  const height = positiveNumber(value.height);
  return x === null || y === null || width === null || height === null
    ? null
    : { x, y, width, height };
}

function positiveNumberOrZero(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function dimensionsFrom(params: unknown): Size | null {
  if (!params || typeof params !== 'object') return null;
  const value = params as Record<string, unknown>;
  const width = positiveNumber(value.width);
  const height = positiveNumber(value.height);
  return width === null || height === null ? null : { width, height };
}

function adjustmentFrom(params: unknown): { channel: string; value: number } | null {
  if (!params || typeof params !== 'object') return null;
  const value = params as Record<string, unknown>;
  const channel = value.channel;
  const amount = value.value;
  if (
    channel !== 'brightness' &&
    channel !== 'contrast' &&
    channel !== 'saturation' &&
    channel !== 'grayscale'
  ) {
    return null;
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (channel === 'grayscale')
    return amount >= 0 && amount <= 1 ? { channel, value: amount } : null;
  return amount >= -1 && amount <= 1 ? { channel, value: amount } : null;
}

/** Built-in crop operation definition. */
export const cropOperation: OperationDefinition<{ rect: Rect }> = {
  type: 'crop',
  version: 1,
  validateParams(params): ValidationResult {
    return rectFrom(params) ? valid : invalid('invalid_crop', 'Crop requires a positive rectangle');
  },
  reduceSize(_input, params) {
    return { width: Math.round(params.rect.width), height: Math.round(params.rect.height) };
  },
  createStage(params) {
    return { type: 'crop', version: 1, params };
  }
};

/** Built-in resize operation definition. */
export const resizeOperation: OperationDefinition<Size> = {
  type: 'resize',
  version: 1,
  validateParams(params): ValidationResult {
    return dimensionsFrom(params)
      ? valid
      : invalid('invalid_resize', 'Resize requires width and height');
  },
  reduceSize(_input, params) {
    return { width: Math.round(params.width), height: Math.round(params.height) };
  },
  createStage(params) {
    return { type: 'resize', version: 1, params };
  }
};

/** Built-in rotate operation definition. */
export const rotateOperation: OperationDefinition<{ angle: number }> = {
  type: 'rotate',
  version: 1,
  validateParams(params): ValidationResult {
    const angle = (params as { angle?: unknown } | null)?.angle;
    return typeof angle === 'number' && Number.isFinite(angle)
      ? valid
      : invalid('invalid_rotate', 'Rotate requires a finite angle');
  },
  reduceSize(input, params) {
    const normalized = ((params.angle % 360) + 360) % 360;
    return normalized === 90 || normalized === 270
      ? { width: input.height, height: input.width }
      : input;
  },
  createStage(params) {
    return { type: 'rotate', version: 1, params };
  }
};

/** Built-in flip operation definition. */
export const flipOperation: OperationDefinition<{ axis: 'horizontal' | 'vertical' }> = {
  type: 'flip',
  version: 1,
  validateParams(params): ValidationResult {
    const axis = (params as { axis?: unknown } | null)?.axis;
    return axis === 'horizontal' || axis === 'vertical'
      ? valid
      : invalid('invalid_flip', 'Flip axis must be horizontal or vertical');
  },
  reduceSize(input) {
    return input;
  },
  createStage(params) {
    return { type: 'flip', version: 1, params };
  }
};

/** Built-in adjustment operation definition. */
export const adjustOperation: OperationDefinition<{
  channel: 'brightness' | 'contrast' | 'saturation' | 'grayscale';
  value: number;
}> = {
  type: 'adjust',
  version: 1,
  validateParams(params): ValidationResult {
    return adjustmentFrom(params)
      ? valid
      : invalid(
          'invalid_adjustment',
          'Adjustment requires a supported channel and normalized value'
        );
  },
  reduceSize(input) {
    return input;
  },
  createStage(params) {
    return { type: 'adjust', version: 1, params };
  }
};

/** Registry shared by command execution, restore validation, and render planning. */
export class OperationRegistry {
  private readonly definitions = new Map<string, OperationDefinition>();

  constructor(definitions: readonly OperationDefinition[]) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: OperationDefinition): void {
    if (this.definitions.has(definition.type)) {
      throw new ImageOperationRegistryError(
        'duplicate_operation',
        `Operation "${definition.type}" is already registered`
      );
    }
    this.definitions.set(definition.type, definition);
  }

  get(type: string): OperationDefinition | undefined {
    return this.definitions.get(type);
  }

  require(type: string): OperationDefinition {
    const definition = this.get(type);
    if (!definition) {
      throw new ImageOperationRegistryError(
        'unknown_operation',
        `Operation "${type}" is not registered`
      );
    }
    return definition;
  }
}

/** Built-in MVP operation definitions available to every session. */
export const builtInOperations = [
  cropOperation,
  resizeOperation,
  rotateOperation,
  flipOperation,
  adjustOperation
] as const;
