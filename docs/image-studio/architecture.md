# Richly Image Studio — Consolidated Approved Baseline

Status: Approved for implementation planning  
Inputs reconciled:

- `IMAGE-STUDIO-RELEASE-PREP-PLAN.md`
- `IMAGE-CORE-DESIGN.md`
- `IMAGE-STUDIO-REACT-DESIGN.md`

This document resolves differences between the three Cowork outputs and becomes the authoritative baseline for Claude Code. Where this document differs from an individual Cowork output, this document wins.

---

## 1. Final Package Architecture

```text
@richly/image-core
        ↑
@richly/image-react
        ↑
@richly/image-studio

@richly/core
        ↑
@richly/plugin-image-editor
```

Host applications compose the two independent dependency trees:

```text
Host application
├── @richly/core or @richly/react
├── @richly/plugin-image-editor
├── @richly/image-studio
└── storage/persistence adapter
```

Rules:

1. `@richly/image-core` has no dependency on React or Richly.
2. `@richly/image-react` depends only on `@richly/image-core`; React and React DOM are peer dependencies.
3. `@richly/image-studio` depends on the image core and React primitives; React and React DOM remain peer dependencies.
4. `@richly/plugin-image-editor` peer-depends on `@richly/core`, not `@richly/react`.
5. Existing lightweight image insertion/resizing remains inside Richly core.
6. Advanced editing is exposed as an optional `imageedit` plugin action.
7. The complete Image Studio implementation must never enter the default Richly core or React bundles.

---

## 2. Release Strategy Decision

### Approved direction

Use Changesets for independent package versioning:

- `@richly/core` and `@richly/react` remain a fixed group.
- Image packages version independently.
- Demo packages remain private and ignored.
- npm provenance and the protected npm environment remain mandatory.

### Important sequencing correction

The full release migration must not block Image Studio engineering.

Approved sequence:

```text
PR 1  Workspace script discovery + private package scaffolding
PR 2  Image core foundation
PR 3+ Image functionality and UI
Separate release track:
      finish Richly 1.0 stable
      introduce Changesets
      prove core/react release
      enable image package publication
```

Therefore:

- Create image packages now as `private: true`, version `0.0.0`.
- Continue using the existing core/react release workflow during early development.
- Finish the current Richly release-candidate train before cutting release management over to Changesets.
- Complete the Changesets migration before the first public Image Studio npm release.
- Do not append image packages to the existing lockstep publishing script.

This preserves release safety without delaying product implementation.

---

## 3. Core Ownership Boundary

### `@richly/image-core` owns

- Decoded source image
- Committed edit operations
- Transient preview operation
- Operation validation and normalization
- Output dimensions
- Non-destructive manifest
- Undo/redo history
- History navigation
- Preview rendering
- Final export
- Plugin operation definitions
- Cancellation and resource disposal

### `@richly/image-react` owns

- Active UI tool
- Crop draft handles and aspect-ratio selection
- Viewport zoom and pan
- Pointer and touch gestures
- Keyboard interaction state
- Export busy/error presentation state
- Focus and accessibility interaction state

### `@richly/image-studio` owns

- Complete visual composition
- Responsive layout
- Toolbar/panels/footer
- Modal/inline hosting
- Programmatic open/close controller
- Save/cancel workflow
- Theming and labels
- Discard confirmation

Core must not contain React-specific or UI-navigation state such as:

```text
activeTool
panel state
modal state
viewport controls
focus state
export dialog state
```

---

## 4. Approved Image Core Public API

```ts
export function createImageSession(
  source: ImageSourceInput,
  options?: ImageSessionOptions
): Promise<ImageSession>;

export function restoreImageSession(
  document: ImageEditDocument,
  source: ImageSourceInput,
  options?: ImageSessionOptions
): Promise<ImageSession>;
```

### Source input

```ts
export type ImageSourceInput =
  | { kind: 'blob'; blob: Blob }
  | { kind: 'url'; url: string }
  | { kind: 'imageData'; data: ImageData }
  | {
      kind: 'bitmap';
      bitmap: ImageBitmap;
      transferOwnership?: boolean;
    };
```

React packages may offer convenience normalization for `File | Blob | string | ImageBitmap`, but image core keeps the explicit discriminated union.

### Session

```ts
export interface ImageSession {
  getState(): ImageSessionState;

  subscribe(listener: () => void): () => void;

  execute<K extends keyof ImageCommandMap>(command: K, params: ImageCommandMap[K]): CommandResult;

  canExecute<K extends keyof ImageCommandMap>(
    command: K,
    params: ImageCommandMap[K]
  ): ValidationResult;

  transact(label: string, execute: () => void): CommandResult;

  preview<K extends keyof ImageCommandMap>(
    command: K,
    params: ImageCommandMap[K]
  ): ValidationResult;

  commitPreview(): CommandResult;
  cancelPreview(): void;

  undo(): boolean;
  redo(): boolean;
  jumpToHistory(index: number): boolean;

  removeOperation(id: string): CommandResult;
  reset(): CommandResult;

  toDocument(): ImageEditDocument;

  createPreview(target: PreviewTarget, options?: PreviewOptions): PreviewHandle;

  export(options?: ExportOptions): Promise<ExportResult>;

  destroy(): void;
}
```

### Resolved API conflicts

Approved:

```text
execute(command, params)
```

Rejected:

```text
execute(operation)
```

Approved:

```text
toDocument()
```

Rejected:

```text
serialize()
```

Approved:

```text
createPreview(...)
```

Rejected:

```text
attachRenderTarget(...)
```

Approved:

```text
subscribe(() => ...)
```

The subscriber reads the latest immutable snapshot through `getState()`, matching the external-store pattern used by React.

---

## 5. Approved Core State

```ts
export interface ImageSessionState {
  readonly status: 'ready' | 'destroyed';
  readonly source: SourceInfo;

  readonly operations: readonly ImageOperation[];
  readonly transient: ImageOperation | null;

  readonly outputWidth: number;
  readonly outputHeight: number;

  readonly history: {
    readonly entries: readonly HistoryEntrySummary[];
    readonly index: number;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
  };

  readonly dirty: boolean;
  readonly revision: number;
}
```

### History entries

```ts
export interface HistoryEntrySummary {
  readonly id: string;
  readonly label: string;
  readonly timestamp: number;
}
```

The operations arrays associated with each history entry remain internal. The UI gets summaries and a cursor, not mutable historical manifests.

`dirty` is derived from whether the current committed operation manifest differs from the initial restored document state.

---

## 6. Approved Operation Format

Use one consistent extensible structure in memory and serialization:

```ts
export interface ImageOperation<TType extends string = string, TParams = Record<string, unknown>> {
  readonly id: string;
  readonly type: TType;
  readonly version: number;
  readonly params: TParams;
}
```

Built-ins are typed aliases:

```ts
type CropOperation = ImageOperation<'crop', { rect: Rect }>;

type ResizeOperation = ImageOperation<'resize', { width: number; height: number }>;

type RotateOperation = ImageOperation<'rotate', { angle: number }>;

type FlipOperation = ImageOperation<'flip', { axis: 'horizontal' | 'vertical' }>;

type AdjustOperation = ImageOperation<
  'adjust',
  {
    channel: 'brightness' | 'contrast' | 'saturation' | 'exposure' | 'temperature';
    value: number;
  }
>;
```

This resolves the mismatch where runtime operations used top-level fields but serialized operations used `params`.

### Command rules

- Commands validate and normalize.
- Operations are immutable persisted results.
- Identity operations are removed.
- Adjustment channels are canonicalized to one operation per channel.
- UI code must not construct committed operations directly.
- UI gestures use `preview(command, params)`, followed by `commitPreview()` or `cancelPreview()`.

---

## 7. Approved Edit Document

```ts
export interface ImageEditDocument {
  schemaVersion: 1;

  source: {
    width: number;
    height: number;
    mimeType?: string;
    ref?: string;
    fingerprint?: string;
  };

  operations: ImageOperation[];

  metadata?: Record<string, unknown>;
}
```

Rules:

- History is not serialized.
- Transient preview is not serialized.
- UI state is not serialized.
- Unknown operation types fail explicitly unless the matching operation plugin is registered.
- Restore establishes the supplied document as the session baseline.
- Undo after restore operates on changes made during the current editing session; it does not unexpectedly erase the entire restored document with one undo.
- A separate explicit Reset command returns to the original source.

This corrects the proposal to restore all pre-existing edits as one new undo entry.

---

## 8. History Decision

History stores manifest versions using structural sharing.

```text
Entry 0: restored baseline
Entry 1: first change in this editing session
Entry 2: second change
...
```

Consequences:

- Undo/redo is synchronous.
- Bitmap copies are not stored.
- A transaction becomes one entry.
- A slider drag becomes one entry.
- Branching after undo truncates the redo tail.
- `jumpToHistory(index)` supports the Studio history panel.
- Reset is history-tracked and can itself be undone.

---

## 9. Rendering Decision

### Approved architecture

```text
operations
    ↓
RenderPlan compiler
    ↓
RenderEngine
    ├── preview pipeline
    └── export pipeline
```

Preview and export share:

- Operation semantics
- Render-plan compilation
- Geometry calculations
- Color calculations

They do not share output buffers.

### Preview

- Downscaled working source
- Default maximum preview dimension: 2048
- requestAnimationFrame coalescing
- Stale-result suppression by revision
- Transient command appended to the committed operation plan
- Before/after comparison through the preview handle
- Cancellation on disposal

### Export

- Original source resolution
- Optional maximum width/height
- PNG, JPEG and WebP
- JPEG alpha flattening
- AbortSignal support
- Actual output MIME type reported
- Intermediate resources released in `finally`

### Threading

MVP may render previews on the main thread, but:

- `RenderEngine` remains asynchronous.
- Worker/WebGL/WASM engines can be added later.
- No worker-specific concept appears in the public editing APIs.

### Performance caution

Render-stage fusion is an optimization, not a public guarantee. Implement correctness first, then fuse only transformations proven equivalent through golden tests.

---

## 10. Plugin Operation Contract

```ts
export interface OperationDefinition<TParams = unknown> {
  type: string;
  version: number;

  validateParams(params: unknown): ValidationResult;

  reduceSize(input: Size, params: TParams): Size;

  createStage(params: TParams): RenderStage;

  serializeParams?(params: TParams): Record<string, unknown>;

  deserializeParams?(value: Record<string, unknown>): TParams;
}
```

Rules:

- Type and version identify the serialized contract.
- Built-in and external operations use the same registry.
- Duplicate operation types fail at session creation.
- Plugin operations must be registered before restoring a document that uses them.
- UI tool registration is not part of image core; it belongs to image-react/image-studio.

---

## 11. React State Architecture

The React design uses two state domains.

### Core state subscription

```ts
useImageEditorState(selector, isEqual?)
```

is based on:

```ts
useSyncExternalStore(session.subscribe, () => selector(session.getState()), getServerSnapshot);
```

### UI interaction store

`ImageEditorProvider` also creates a small internal UI store for:

```text
activeTool
viewport
crop draft
aspect ratio
export status
compare mode
interaction errors
```

This store:

- Is framework-local
- Is not serialized
- Does not enter image core
- Uses immutable snapshots and selector subscriptions
- May use refs for frame-by-frame pointer movement
- Commits React-visible state at bounded intervals or gesture boundaries

No Redux or Zustand is required.

### High-frequency gesture behavior

```text
pointer move
  → update UI draft/ref
  → session.preview(command, params)
  → canvas refresh

pointer up
  → session.commitPreview()
  → one history entry
  → one document change notification
```

Pan and zoom do not modify the image manifest.

---

## 12. Approved React API Direction

### Provider

```ts
export interface ImageEditorProviderProps {
  session?: ImageSession;

  source?: File | Blob | string | ImageBitmap;
  editDocument?: ImageEditDocument;

  onDocumentChange?: (document: ImageEditDocument) => void;

  onReady?: (session: ImageSession) => void;

  onError?: (error: unknown) => void;

  children: React.ReactNode;
}
```

Use `onDocumentChange`, not the ambiguous `onChange`.

### Hooks

```ts
useImageEditor()
useImageEditorState(selector, isEqual?)
useImageCommands()
useImageHistory()
useCropTool()
useViewport()
useImageExport()
```

`useImageHistory()` exposes summaries, index, undo, redo and `jumpTo`.

`useViewport()` reads from the React UI store, not core state.

`useCropTool()` combines UI draft state with core preview commands.

---

## 13. Image Canvas Contract

`ImageCanvas`:

1. Creates a preview through `session.createPreview`.
2. Disposes it on session/canvas replacement or unmount.
3. Handles DPR and ResizeObserver.
4. Delegates crop geometry to `CropOverlay`.
5. Handles pan, wheel and pinch as viewport interactions.
6. Does not own committed image operations.
7. Uses the preview handle for compare mode.

The final API should use standard DOM callback types where possible and avoid inventing a broad `CanvasPointerEvent` public abstraction in MVP.

---

## 14. Image Studio Controller Decision

The programmatic controller design is approved with one packaging change.

### Dedicated subpath

Export the framework-independent controller from:

```text
@richly/image-studio/controller
```

Do not rely solely on tree-shaking from the main React entry.

Recommended package exports:

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  },
  "./controller": {
    "types": "./dist/controller.d.ts",
    "import": "./dist/controller.js",
    "require": "./dist/controller.cjs"
  },
  "./styles.css": "./dist/styles.css"
}
```

The controller entry must not import React.

### Controller

```ts
export interface ImageStudioController {
  open(input: ImageStudioOpenInput): Promise<ImageStudioResult | null>;

  close(result?: ImageStudioResult | null): void;

  isOpen(): boolean;

  subscribe(listener: () => void): () => void;

  getSnapshot(): ImageStudioControllerSnapshot;
}
```

Use external-store semantics for controller subscriptions too.

Approved behavior:

- Save resolves with a result.
- Cancel resolves `null`.
- Only one open request at a time.
- Double-open rejects with a typed busy error.
- Host unmount settles the pending request as `null`.
- No-host timeout rejects with a typed error.
- Promise settles exactly once.
- Discard confirmation belongs to the host.

---

## 15. Approved Save Result

```ts
export interface ImageStudioResult {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;

  editDocument: ImageEditDocument;

  alt?: string;
  suggestedFilename?: string;
}
```

Save flow:

```text
session.export()
        +
session.toDocument()
        +
Studio metadata
        ↓
ImageStudioResult
        ↓
Richly plugin persistence callback
        ↓
Persisted asset URL/reference
        ↓
Richly image DOM update
```

Image Studio does not upload automatically.

---

## 16. Richly Adapter Decision

```ts
const controller = createImageStudioController();

const plugin = imageEditorPlugin({
  openEditor: controller.open,
  persist: mediaRepository.persist
});
```

The plugin:

- Targets `@richly/core`
- Uses `skipUndo: true` for asynchronous launch
- Captures the intended image and selection bookmark
- Performs no document mutation on cancel
- Persists before changing Richly HTML
- Takes exactly one Richly undo snapshot immediately before successful DOM mutation
- Updates `src`, optional `alt`, optional metadata references
- Emits one `change`
- Does not embed the complete edit manifest in HTML
- Lazy-loads the Image Studio host in the application layer

---

## 17. Bundle Budgets

Do not freeze an unrealistic 16 KiB limit before the first implementation exists.

Approved initial gates:

```text
@richly/core                 Existing budget unchanged
@richly/react                Existing behavior unchanged
@richly/plugin-image-editor  8 KiB gzip maximum target
@richly/image-core           30 KiB gzip temporary hard ceiling
@richly/image-react          15 KiB gzip excluding peers
@richly/image-studio         Establish after first complete UI build
```

For image core:

- Target 20–25 KiB gzip.
- Temporary ceiling 30 KiB.
- Measure after each phase.
- Move heavy engines or advanced filters to optional entry points/packages.
- Tighten the ceiling after MVP stabilization.

---

## 18. PWA Boundary

PWA functionality belongs to the standalone application:

```text
@richly/image-studio-demo
or a future hosted Richly Image Studio app
```

Library packages must not register service workers.

Future PWA scope:

- Installable manifest
- Offline application shell
- Local project persistence
- Deferred cloud synchronization
- File-handling integration where supported
- Share-target integration where supported

The editing engine remains local-first and usable offline without knowing that it is hosted in a PWA.

---

## 19. Approved Implementation Sequence

### PR 1 — Safe foundation

- Add workspace script discovery.
- Scaffold:
  - `packages/image-core`
  - `packages/image-react`
  - `packages/image-studio`
  - `packages/plugin-image-editor`
  - `packages/image-studio-demo`
- Keep four future public packages `private: true`, version `0.0.0`.
- Add manifests, tsconfig, tsup, empty entry points, tests, READMEs and boundary tests.
- Do not change the current release workflow.
- Do not implement image editing.

### PR 2 — Image core session foundation

- Source loading
- ImageSession lifecycle
- Immutable state/store
- Operation registry
- Command registry
- History
- Serialization
- Fake render engine tests

### PR 3 — Canvas rendering and export

- Canvas2D engine
- Render plans
- Crop, resize, rotate, flip
- Preview controller
- PNG/JPEG/WebP export
- Golden tests

### PR 4 — Adjustments and performance

- Brightness
- Contrast
- Saturation
- Grayscale
- Transient preview
- Cancellation
- Performance measurements
- Resource cleanup

### PR 5 — React primitives

- Provider
- Core selectors
- UI interaction store
- Canvas
- Crop overlay
- Hooks
- Accessibility foundations

### PR 6 — Complete Image Studio

- Responsive shell
- Toolbar/panels/footer
- Programmatic controller subpath
- Modal/inline host
- Save/cancel
- Theming
- Keyboard interaction

### PR 7 — Richly adapter

- Public selected-image helper if needed
- Optional metadata references
- `imageedit` plugin
- Persistence bridge
- Undo and integration tests

### Separate release migration before publication

- Finish Richly stable 1.0 release.
- Add Changesets.
- Keep core/react fixed.
- Prove two successful package-aware releases.
- Make image packages public and release `0.1.0`.

---

## 20. First Claude Code Prompt

```text
Open the latest Richly repository.

Implement PR 1 only: safe repository foundation and package scaffolding.

Do not implement image editing.
Do not modify the current npm publishing workflow.
Do not introduce Nx or Turborepo.

Create:
- packages/image-core
- packages/image-react
- packages/image-studio
- packages/plugin-image-editor
- packages/image-studio-demo

Rules:
- Use Yarn 1 workspace conventions already present in the repository.
- Future public image packages must initially be private with version 0.0.0.
- image-studio-demo remains private.
- image-core must not depend on React or Richly.
- image-react may depend on image-core; React and React DOM are peer dependencies.
- image-studio may depend on image-core and image-react; React and React DOM are peer dependencies.
- plugin-image-editor may peer-depend on @richly/core and must not depend on @richly/react.
- Add strict TypeScript configs, tsup configs, entry points, Vitest scaffolding, README stubs, package exports, and boundary tests.
- Add a repository script that discovers workspaces and runs supported scripts in dependency order.
- Update root build/test/size scripts to use discovery without altering current package behavior.
- Existing @richly/core, @richly/react and demo behavior must remain unchanged.
- Existing image insertion/upload/resizing behavior must remain unchanged.
- No package may be published.

Run:
- yarn install --frozen-lockfile
- yarn lint
- yarn format
- yarn test
- yarn build
- yarn e2e if the environment supports browsers

Return:
1. Changed files
2. Final package dependency graph
3. Commands and results
4. Any behavior or bundle-size differences in existing packages
5. Unresolved issues
```

---

## 21. Approval Summary

The three Cowork outputs are directionally strong and compatible after resolving these points:

1. Core owns document state; React owns interaction state.
2. Commands, not raw operations, are the public write API.
3. Preview uses command parameters and one transient slot.
4. Runtime and serialized operation shapes are unified.
5. History summaries and navigation are public; manifests remain internal.
6. Restored edits form the baseline, not a single undoable new change.
7. Controller has a dedicated non-React package subpath.
8. Release migration is required before publication, but it does not block engineering.
9. PWA support belongs to the standalone application, not the libraries.
