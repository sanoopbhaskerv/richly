/**
 * Richly + Image Studio integration demo.
 *
 * A vanilla Richly editor hosts the nested inline image toolbar from
 * @richly/plugin-image-editor; quick tools stay inline while the Studio
 * entry opens a modal. Persistence stays host-owned: exports are stored as
 * data URLs so undo/redo never resurrects a revoked object URL.
 */
import '@richly/core/theme.css';
import './richly-integration.css';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor } from '@richly/core';
import {
  imageEditorPlugin,
  imageInlineToolbarPlugin,
  type ImageEditorResult,
  type ImageInlineToolbarOpenInput
} from '@richly/plugin-image-editor';
import { ImageStudio, type ImageStudioResult } from '@richly/image-studio';
import { disableStudioOfflineSupport } from './pwa';

const params = new URLSearchParams(window.location.search);
if (params.has('dark')) document.documentElement.dataset.theme = 'dark';
/** `?persistfail` simulates host persistence failures for resilience tests. */
const persistShouldFail = params.has('persistfail');

function createSampleImage(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 420;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required for the demo image');

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#dbeafe');
  gradient.addColorStop(0.5, '#67a3b8');
  gradient.addColorStop(1, '#233247');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#f4cf6d';
  context.beginPath();
  context.arc(500, 96, 52, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#1a2437';
  context.beginPath();
  context.moveTo(0, 330);
  context.lineTo(170, 170);
  context.lineTo(320, 330);
  context.closePath();
  context.fill();

  context.fillStyle = '#2d4159';
  context.beginPath();
  context.moveTo(210, 340);
  context.lineTo(400, 130);
  context.lineTo(600, 340);
  context.closePath();
  context.fill();

  context.fillStyle = 'rgb(255 255 255 / 0.85)';
  context.fillRect(58, 58, 170, 9);
  context.fillRect(58, 80, 120, 9);
  return canvas.toDataURL('image/png');
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

interface StudioRequest {
  readonly input: ImageInlineToolbarOpenInput;
  readonly resolve: (result: ImageEditorResult | null) => void;
}

function IntegrationApp() {
  const hostRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<StudioRequest | null>(null);
  const [request, setRequest] = useState<StudioRequest | null>(null);
  const [html, setHtml] = useState('');
  const [changes, setChanges] = useState(0);
  const [compact, setCompact] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();

    const openEditor = (input: ImageInlineToolbarOpenInput): Promise<ImageEditorResult | null> =>
      new Promise((resolve) => {
        const next: StudioRequest = { input, resolve };
        requestRef.current = next;
        setRequest(next);
      });
    const persist = async (result: ImageEditorResult) => {
      if (persistShouldFail) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
        throw new Error('Demo persistence failure');
      }
      return { src: await blobToDataUrl(result.blob), alt: result.alt };
    };
    const onError = (cause: unknown): void =>
      setError(cause instanceof Error ? cause.message : String(cause));

    const editor = Editor.init({
      target: host,
      testIdPrefix: 'richly',
      toolbar: 'undo redo | bold italic | image imageedit',
      initialContent: `
        <h2>Richly image quick controls</h2>
        <p>Select the image to open the inline toolbar. Crop, Transform, and
        Adjust stay inline; the Studio action opens the full editor and applies
        only after Save and close.</p>
        <p><img src="${createSampleImage()}" alt="Sample mountain scene" width="360"></p>`,
      images: { upload: async (file) => ({ src: await blobToDataUrl(file) }) },
      plugins: [
        imageEditorPlugin({ openEditor, persist, onError }),
        imageInlineToolbarPlugin({ openEditor, persist, onError })
      ]
    });
    setHtml(editor.getContent());
    const offChange = editor.on('change', (value) => {
      setHtml(value);
      setChanges((count) => count + 1);
    });

    return () => {
      offChange();
      editor.destroy();
    };
  }, []);

  const settle = (result: ImageStudioResult | null): void => {
    requestRef.current?.resolve(result);
    requestRef.current = null;
    setRequest(null);
  };

  return (
    <main className="integration-shell">
      <header className="integration-header">
        <h1>Richly integration</h1>
        <label className="integration-toggle">
          <input
            type="checkbox"
            data-testid="richly-compact-toggle"
            checked={compact}
            onChange={(event) => setCompact(event.target.checked)}
          />
          Compact container
        </label>
      </header>
      {error ? (
        <p role="alert" data-testid="richly-host-error" className="integration-error">
          {error}
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}
      <div
        className={compact ? 'integration-editor integration-compact' : 'integration-editor'}
        data-testid="richly-editor-container"
      >
        <div ref={hostRef} />
      </div>
      <section className="integration-inspect">
        <p>
          Change events: <span data-testid="richly-change-count">{changes}</span>
        </p>
        <pre data-testid="richly-html-output" tabIndex={0} aria-label="Editor HTML output">
          {html}
        </pre>
      </section>
      {request ? (
        <div className="integration-studio-modal" data-testid="richly-studio-modal">
          <div className="integration-studio-frame">
            <div className="integration-studio-copy">
              <strong>Image Studio</strong>
              <span>Changes return to Richly only after Save and close.</span>
            </div>
            <ImageStudio
              source={request.input.source}
              initialAlt={request.input.alt}
              initialTool={request.input.initialTool}
              suggestedFilename={request.input.suggestedFilename}
              theme="dark"
              mode="modal"
              onSave={(result) => settle(result)}
              onCancel={() => settle(null)}
              onError={(cause) => {
                setError(cause instanceof Error ? cause.message : String(cause));
                settle(null);
              }}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

disableStudioOfflineSupport();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html');

createRoot(container).render(
  <StrictMode>
    <IntegrationApp />
  </StrictMode>
);
