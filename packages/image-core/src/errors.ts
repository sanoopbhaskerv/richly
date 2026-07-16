/** Base class for typed image-core failures. */
export class ImageCoreError extends Error {
  constructor(
    /** Stable machine-readable error code. */
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ImageCoreError';
  }
}

/** Raised when a method is called after the session has been destroyed. */
export class ImageSessionDestroyedError extends ImageCoreError {
  constructor() {
    super('session_destroyed', 'Image session has been destroyed');
    this.name = 'ImageSessionDestroyedError';
  }
}

/** Raised when an operation type is unknown or registered twice. */
export class ImageOperationRegistryError extends ImageCoreError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = 'ImageOperationRegistryError';
  }
}

/** Raised when source decoding cannot determine usable image dimensions. */
export class ImageSourceDecodeError extends ImageCoreError {
  constructor(message: string) {
    super('source_decode_failed', message);
    this.name = 'ImageSourceDecodeError';
  }
}
