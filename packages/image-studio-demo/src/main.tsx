/**
 * Standalone installable host for Richly Image Studio.
 *
 * PWA lifecycle and local export persistence stay here by design; reusable
 * image packages remain unaware of service workers, manifests, or downloads.
 */
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createImageSession, type ImageSession } from '@richly/image-core';
import { ImageStudio, type ImageStudioResult } from '@richly/image-studio';
import { disableStudioOfflineSupport } from './pwa';
import './main.css';

interface SavedExport {
  readonly url: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
}

function createDemoImageData(): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required for the demo image');

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#edf5ff');
  gradient.addColorStop(0.42, '#78b7c5');
  gradient.addColorStop(1, '#2d3a4f');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#f7d67a';
  context.beginPath();
  context.arc(930, 190, 92, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#1c2538';
  context.beginPath();
  context.moveTo(0, 620);
  context.lineTo(280, 330);
  context.lineTo(520, 620);
  context.closePath();
  context.fill();

  context.fillStyle = '#31465c';
  context.beginPath();
  context.moveTo(340, 640);
  context.lineTo(650, 250);
  context.lineTo(980, 640);
  context.closePath();
  context.fill();

  context.fillStyle = 'rgb(255 255 255 / 0.82)';
  context.fillRect(120, 118, 300, 12);
  context.fillRect(120, 150, 210, 12);
  context.fillRect(120, 182, 260, 12);

  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function filenameFor(result: ImageStudioResult): string {
  const extension = result.mimeType.split('/')[1] ?? 'png';
  return `richly-image-studio-export.${extension}`;
}

function DemoApp() {
  const [session, setSession] = useState<ImageSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedExport | null>(null);
  const [filename, setFilename] = useState('richly-image-studio-demo.png');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const source = useMemo(() => createDemoImageData(), []);

  useEffect(() => {
    let cancelled = false;
    void createImageSession(
      { kind: 'imageData', data: source, mimeType: 'image/png', ref: 'generated-demo' },
      { metadata: { demo: true } }
    )
      .then((next) => {
        if (cancelled) {
          next.destroy();
          return;
        }
        setSession(next);
        setFilename('richly-image-studio-demo.png');
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));

    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => () => session?.destroy(), [session]);

  useEffect(() => {
    // Blob URLs are host-owned persistence for the demo; revoke the previous
    // export when a new one replaces it or when the app unmounts.
    return () => {
      if (saved) URL.revokeObjectURL(saved.url);
    };
  }, [saved]);

  useEffect(() => {
    // The download link is fixed-positioned over the studio's top bar. Left
    // up indefinitely it permanently overlaps the Export/Close controls and
    // blocks a subsequent export; auto-dismiss it like a transient toast.
    if (!saved) return;
    const timeout = window.setTimeout(() => setSaved(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  const save = (result: ImageStudioResult): void => {
    setSaved({
      url: URL.createObjectURL(result.blob),
      filename: filenameFor(result),
      mimeType: result.mimeType,
      width: result.width,
      height: result.height
    });
  };

  const replaceImage = async (file: File): Promise<void> => {
    setError(null);
    try {
      const next = await createImageSession({
        kind: 'blob',
        blob: file,
        ref: file.name,
        fingerprint: `${file.name}:${file.size}:${file.lastModified}`
      });
      setSession((previous) => {
        previous?.destroy();
        return next;
      });
      setFilename(file.name || 'selected-image.png');
      setSaved(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    void replaceImage(file);
  };

  return (
    <main className="demo-shell">
      <input
        ref={inputRef}
        className="demo-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/*"
        onChange={onFileChange}
      />
      {error ? <p role="alert">{error}</p> : null}
      {session ? (
        <>
          {saved ? (
            <div className="demo-download">
              <a href={saved.url} download={saved.filename}>
                Download {saved.width}x{saved.height} {saved.mimeType}
              </a>
              <button
                type="button"
                aria-label="Dismiss download notice"
                onClick={() => setSaved(null)}
              >
                ×
              </button>
            </div>
          ) : null}
          <ImageStudio
            session={session}
            theme="dark"
            initialAlt={filename}
            suggestedFilename={filename}
            onAddImage={() => inputRef.current?.click()}
            onSave={save}
            onError={(cause) => setError(cause instanceof Error ? cause.message : String(cause))}
          />
        </>
      ) : (
        <p className="demo-loading">Preparing editor…</p>
      )}
    </main>
  );
}

disableStudioOfflineSupport();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html');

createRoot(container).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>
);
