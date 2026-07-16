import { ImageSessionDestroyedError } from './errors';
import { ManifestHistory, sameManifest } from './history';
import { createFakePreview } from './preview';
import { defaultDecoder } from './source';
import { invalid } from './validation';
import { OperationRegistry, builtInOperations } from './operations';
import type {
  CommandResult,
  DecodedImageSource,
  ExportOptions,
  ExportResult,
  ImageCommandMap,
  ImageEditDocument,
  ImageOperation,
  ImageSession,
  ImageSessionOptions,
  ImageSessionState,
  ImageSourceInput,
  OperationDefinition,
  PreviewHandle,
  PreviewOptions,
  PreviewTarget,
  Size,
  ValidationResult
} from './types';

interface SessionConfig {
  readonly decoded: DecodedImageSource;
  readonly baseline: readonly ImageOperation[];
  readonly metadata?: Record<string, unknown>;
  readonly options?: ImageSessionOptions;
}

const defaultId = (): string => `op_${Math.random().toString(36).slice(2, 10)}`;

function cloneOperations(operations: readonly ImageOperation[]): ImageOperation[] {
  return operations.map((operation) => ({
    id: operation.id,
    type: operation.type,
    version: operation.version,
    params: { ...(operation.params as Record<string, unknown>) }
  }));
}

function operationLabel(type: string): string {
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

function resultFromValidation(validation: ValidationResult): CommandResult {
  return validation.ok ? { ok: true } : validation;
}

/** Non-destructive image session implementation. */
class ImageSessionImpl implements ImageSession {
  private readonly registry: OperationRegistry;
  private readonly baseline: readonly ImageOperation[];
  private readonly history: ManifestHistory;
  private readonly listeners = new Set<() => void>();
  private operations: readonly ImageOperation[];
  private transient: ImageOperation | null = null;
  private revision = 0;
  private status: 'ready' | 'destroyed' = 'ready';
  private transaction: { label: string; start: readonly ImageOperation[] } | null = null;

  constructor(private readonly config: SessionConfig) {
    const createId = config.options?.idGenerator ?? defaultId;
    const now = config.options?.now ?? Date.now;
    this.registry = new OperationRegistry([
      ...builtInOperations,
      ...(config.options?.operations ?? [])
    ] as readonly OperationDefinition[]);
    this.baseline = cloneOperations(config.baseline);
    this.operations = cloneOperations(config.baseline);
    this.history = new ManifestHistory(this.baseline, now, createId);
  }

  getState(): ImageSessionState {
    const size = this.reduceSize(this.operations, this.transient);
    return {
      status: this.status,
      source: this.config.decoded.info,
      operations: this.operations,
      transient: this.transient,
      outputWidth: size.width,
      outputHeight: size.height,
      history: {
        entries: this.history.summaries,
        index: this.history.cursor,
        canUndo: this.history.canUndo,
        canRedo: this.history.canRedo
      },
      dirty: !sameManifest(this.baseline, this.operations),
      revision: this.revision
    };
  }

  subscribe(listener: () => void): () => void {
    this.assertReady();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  execute<K extends keyof ImageCommandMap>(command: K, params: ImageCommandMap[K]): CommandResult {
    this.assertReady();
    const operation = this.createOperation(String(command), params);
    if (!operation.ok) return operation;
    this.transient = null;
    const next = upsertOperation(this.operations, operation.operation);
    this.commitOperations(operationLabel(operation.operation.type), next);
    return operation;
  }

  canExecute<K extends keyof ImageCommandMap>(
    command: K,
    params: ImageCommandMap[K]
  ): ValidationResult {
    this.assertReady();
    return this.validate(String(command), params);
  }

  transact(label: string, execute: () => void): CommandResult {
    this.assertReady();
    if (this.transaction)
      return invalid('transaction_active', 'Nested image transactions are not supported');
    this.transaction = { label, start: this.operations };
    try {
      execute();
    } finally {
      const transaction = this.transaction;
      this.transaction = null;
      if (transaction && !sameManifest(transaction.start, this.operations)) {
        this.history.push(label, this.operations);
      }
    }
    this.emit();
    return { ok: true };
  }

  preview<K extends keyof ImageCommandMap>(
    command: K,
    params: ImageCommandMap[K]
  ): ValidationResult {
    this.assertReady();
    const operation = this.createOperation(String(command), params);
    if (!operation.ok) return resultFromValidation(operation);
    this.transient = operation.operation;
    this.revision += 1;
    this.emit();
    return { ok: true };
  }

  commitPreview(): CommandResult {
    this.assertReady();
    if (!this.transient) return { ok: true };
    const operation = this.transient;
    this.transient = null;
    this.commitOperations(
      operationLabel(operation.type),
      upsertOperation(this.operations, operation)
    );
    return { ok: true, operation };
  }

  cancelPreview(): void {
    this.assertReady();
    if (!this.transient) return;
    this.transient = null;
    this.revision += 1;
    this.emit();
  }

  undo(): boolean {
    this.assertReady();
    const next = this.history.undo();
    if (!next) return false;
    this.operations = next;
    this.transient = null;
    this.revision += 1;
    this.emit();
    return true;
  }

  redo(): boolean {
    this.assertReady();
    const next = this.history.redo();
    if (!next) return false;
    this.operations = next;
    this.transient = null;
    this.revision += 1;
    this.emit();
    return true;
  }

  jumpToHistory(index: number): boolean {
    this.assertReady();
    const next = this.history.jump(index);
    if (!next) return false;
    this.operations = next;
    this.transient = null;
    this.revision += 1;
    this.emit();
    return true;
  }

  removeOperation(id: string): CommandResult {
    this.assertReady();
    const next = this.operations.filter((operation) => operation.id !== id);
    if (next.length === this.operations.length) {
      return invalid('operation_not_found', `Operation "${id}" was not found`);
    }
    this.commitOperations('Remove operation', next);
    return { ok: true, removedOperationIds: [id] };
  }

  reset(): CommandResult {
    this.assertReady();
    this.transient = null;
    this.commitOperations('Reset', []);
    return { ok: true };
  }

  toDocument(): ImageEditDocument {
    this.assertReady();
    return {
      schemaVersion: 1,
      source: this.config.decoded.info,
      operations: cloneOperations(this.operations),
      metadata: this.config.metadata
    };
  }

  createPreview(target: PreviewTarget, options?: PreviewOptions): PreviewHandle {
    this.assertReady();
    return createFakePreview(target, options, () => {
      const state = this.getState();
      return {
        revision: state.revision,
        size: { width: state.outputWidth, height: state.outputHeight },
        operations: state.transient ? [...state.operations, state.transient] : state.operations
      };
    });
  }

  async export(options?: ExportOptions): Promise<ExportResult> {
    this.assertReady();
    if (options?.signal?.aborted)
      throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
    const state = this.getState();
    const mimeType = options?.type ?? 'image/png';
    return {
      width: state.outputWidth,
      height: state.outputHeight,
      mimeType,
      blob: new Blob([], { type: mimeType })
    };
  }

  destroy(): void {
    if (this.status === 'destroyed') return;
    this.status = 'destroyed';
    this.transient = null;
    this.config.decoded.destroy();
    this.listeners.clear();
  }

  private validate(type: string, params: unknown): ValidationResult {
    const definition = this.registry.get(type);
    if (!definition) return invalid('unknown_command', `Command "${type}" is not registered`);
    return definition.validateParams(params);
  }

  private createOperation(
    type: string,
    params: unknown
  ): { ok: true; operation: ImageOperation } | { ok: false; code: string; message: string } {
    const validation = this.validate(type, params);
    if (!validation.ok) return validation;
    const definition = this.registry.require(type);
    const serialized = definition.serializeParams?.(params) ?? (params as Record<string, unknown>);
    return {
      ok: true,
      operation: {
        id: this.config.options?.idGenerator?.() ?? defaultId(),
        type: definition.type,
        version: definition.version,
        params: serialized
      }
    };
  }

  private reduceSize(
    operations: readonly ImageOperation[],
    transient: ImageOperation | null
  ): Size {
    return [...operations, ...(transient ? [transient] : [])].reduce<Size>(
      (size, operation) => {
        const definition = this.registry.require(operation.type);
        return definition.reduceSize(size, operation.params);
      },
      { width: this.config.decoded.info.width, height: this.config.decoded.info.height }
    );
  }

  private commitOperations(label: string, operations: readonly ImageOperation[]): void {
    this.operations = operations;
    if (!this.transaction) this.history.push(label, operations);
    this.revision += 1;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private assertReady(): void {
    if (this.status === 'destroyed') throw new ImageSessionDestroyedError();
  }
}

function upsertOperation(
  operations: readonly ImageOperation[],
  operation: ImageOperation
): readonly ImageOperation[] {
  // Adjustment-style canonicalization arrives in Phase 4. For Phase 2, one
  // operation per type keeps history deterministic and avoids duplicate resize
  // or crop stages from direct commands and transient previews.
  const withoutType = operations.filter((candidate) => candidate.type !== operation.type);
  return [...withoutType, operation];
}

function validateDocument(document: ImageEditDocument, registry: OperationRegistry): void {
  if (document.schemaVersion !== 1) throw new Error('Unsupported image edit document schema');
  for (const operation of document.operations) {
    const definition = registry.require(operation.type);
    const validation = definition.validateParams(operation.params);
    if (!validation.ok) throw new Error(validation.message);
  }
}

/** Creates a new image editing session from a source image. */
export async function createImageSession(
  source: ImageSourceInput,
  options?: ImageSessionOptions
): Promise<ImageSession> {
  const decoded = await (options?.decoder ?? defaultDecoder)(source);
  return new ImageSessionImpl({ decoded, baseline: [], metadata: options?.metadata, options });
}

/** Restores a session from a serialized edit document and matching source. */
export async function restoreImageSession(
  document: ImageEditDocument,
  source: ImageSourceInput,
  options?: ImageSessionOptions
): Promise<ImageSession> {
  const registry = new OperationRegistry([...builtInOperations, ...(options?.operations ?? [])]);
  validateDocument(document, registry);
  const decoded = await (options?.decoder ?? defaultDecoder)(source);
  return new ImageSessionImpl({
    decoded,
    baseline: document.operations,
    metadata: document.metadata,
    options
  });
}
