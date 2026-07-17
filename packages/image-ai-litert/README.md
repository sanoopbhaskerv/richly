# @richly/image-ai-litert

Optional LiteRT.js integration helpers for Richly Image Studio.

This package intentionally does not bundle models or the LiteRT.js Wasm assets.
Hosts opt in by installing `@litertjs/core`, serving its `wasm/` directory, and
passing `.tflite` model URLs or bytes into the provider factory.
