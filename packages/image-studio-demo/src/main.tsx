/**
 * Standalone installable host for Richly Image Studio.
 *
 * PWA lifecycle and local export persistence stay here by design; reusable
 * image packages remain unaware of service workers, manifests, or downloads.
 */
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createImageSession,
  type ImageAdjustmentChannel,
  type ImageSession
} from '@richly/image-core';
import { ImageStudio, type ImageStudioResult } from '@richly/image-studio';
import { createDemoAiProvider, type LiteRtAccelerator } from './aiProvider';
import { disableStudioOfflineSupport } from './pwa';
import './main.css';

interface SavedExport {
  readonly url: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
}

interface DownloadNoticeProps {
  readonly saved: SavedExport;
  readonly onDismiss: () => void;
}

interface LocalSmartEnhanceModel {
  readonly url: string;
  readonly name: string;
}

interface SmartEnhanceModelProfile {
  readonly id: string;
  readonly label: string;
  readonly layout: 'nchw' | 'nhwc';
  readonly channels: readonly ImageAdjustmentChannel[];
  readonly outputScale: number;
  readonly minimumVisibleMagnitude?: number;
  readonly outputClamp: number;
}

interface AiModelControlProps {
  readonly imageFilename: string;
  readonly model: LocalSmartEnhanceModel | null;
  readonly profileId: string;
  readonly profiles: readonly SmartEnhanceModelProfile[];
  readonly accelerator: LiteRtAccelerator;
  readonly onChangeImage: () => void;
  readonly onLoadModel: () => void;
  readonly onClearModel: () => void;
  readonly onProfileChange: (profileId: string) => void;
  readonly onAcceleratorChange: (accelerator: LiteRtAccelerator) => void;
}

interface HiddenFileInputsProps {
  readonly imageInputRef: React.RefObject<HTMLInputElement>;
  readonly modelInputRef: React.RefObject<HTMLInputElement>;
  readonly onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onModelChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

interface DemoSessionController {
  readonly session: ImageSession | null;
  readonly filename: string;
  readonly replaceImage: (file: File) => Promise<void>;
}

const SMART_ENHANCE_MODEL_PROFILES: readonly SmartEnhanceModelProfile[] = [
  {
    id: 'mobile-vector-nhwc',
    label: 'MobileNet / NHWC demo',
    layout: 'nhwc',
    channels: ['exposure', 'contrast', 'saturation', 'warmth'],
    outputScale: 4,
    minimumVisibleMagnitude: 0.18,
    outputClamp: 0.35
  },
  {
    id: 'adjustment-vector-nchw',
    label: 'Adjustment vector / NCHW',
    layout: 'nchw',
    channels: ['exposure', 'contrast', 'saturation', 'sharpen'],
    outputScale: 1,
    outputClamp: 1
  }
];
const DEFAULT_SMART_ENHANCE_MODEL_PROFILE = SMART_ENHANCE_MODEL_PROFILES[0]!;

function DownloadNotice(props: DownloadNoticeProps) {
  return (
    <div className="demo-download">
      <a href={props.saved.url} download={props.saved.filename}>
        Download {props.saved.width}x{props.saved.height} {props.saved.mimeType}
      </a>
      <button type="button" aria-label="Dismiss download notice" onClick={props.onDismiss}>
        ×
      </button>
    </div>
  );
}

/** Hidden host-owned file inputs used by the visible demo controls. */
function HiddenFileInputs(props: HiddenFileInputsProps) {
  return (
    <>
      <input
        ref={props.imageInputRef}
        className="demo-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/*"
        onChange={props.onImageChange}
      />
      <input
        ref={props.modelInputRef}
        className="demo-file-input"
        type="file"
        accept=".tflite,application/octet-stream"
        onChange={props.onModelChange}
      />
    </>
  );
}

function AiModelControl(props: AiModelControlProps) {
  return (
    <div className="demo-ai-model">
      <span className="demo-ai-model-file">{props.imageFilename}</span>
      <button type="button" onClick={props.onChangeImage}>
        Change image
      </button>
      <label>
        <span>Model profile</span>
        <select
          value={props.profileId}
          onChange={(event) => props.onProfileChange(event.currentTarget.value)}
        >
          {props.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Runtime</span>
        <select
          value={props.accelerator}
          onChange={(event) =>
            props.onAcceleratorChange(event.currentTarget.value as LiteRtAccelerator)
          }
        >
          <option value="wasm">Wasm</option>
          <option value="webgpu">WebGPU</option>
          <option value="webnn">WebNN</option>
        </select>
      </label>
      <span>{props.model ? props.model.name : 'Smart Enhance model missing'}</span>
      <button type="button" onClick={props.onLoadModel}>
        {props.model ? 'Change model' : 'Load .tflite'}
      </button>
      {props.model ? (
        <button type="button" aria-label="Remove Smart Enhance model" onClick={props.onClearModel}>
          ×
        </button>
      ) : null}
    </div>
  );
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

/** Owns the demo image session lifetime and user-selected image replacement. */
function useDemoSession(
  source: ImageData,
  setError: (message: string | null) => void,
  clearSaved: () => void
): DemoSessionController {
  const [session, setSession] = useState<ImageSession | null>(null);
  const [filename, setFilename] = useState('richly-image-studio-demo.png');
  const sessionRef = useRef<ImageSession | null>(null);

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
        sessionRef.current = next;
        setSession(next);
        setFilename('richly-image-studio-demo.png');
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));

    return () => {
      cancelled = true;
    };
  }, [setError, source]);

  useEffect(() => {
    return () => {
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
  }, []);

  const replaceImage = async (file: File): Promise<void> => {
    setError(null);
    try {
      const next = await createImageSession({
        kind: 'blob',
        blob: file,
        ref: file.name,
        fingerprint: `${file.name}:${file.size}:${file.lastModified}`
      });
      const previous = sessionRef.current;
      sessionRef.current = next;
      setSession(next);
      setFilename(file.name || 'selected-image.png');
      clearSaved();
      window.setTimeout(() => previous?.destroy(), 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return { session, filename, replaceImage };
}

function DemoApp() {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedExport | null>(null);
  const [smartEnhanceModel, setSmartEnhanceModel] = useState<LocalSmartEnhanceModel | null>(null);
  const [profileId, setProfileId] = useState(DEFAULT_SMART_ENHANCE_MODEL_PROFILE.id);
  const [accelerator, setAccelerator] = useState<LiteRtAccelerator>('wasm');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const modelInputRef = useRef<HTMLInputElement | null>(null);
  const source = useMemo(() => createDemoImageData(), []);
  const { session, filename, replaceImage } = useDemoSession(source, setError, () =>
    setSaved(null)
  );
  const modelProfile =
    SMART_ENHANCE_MODEL_PROFILES.find((profile) => profile.id === profileId) ??
    DEFAULT_SMART_ENHANCE_MODEL_PROFILE;
  const aiProvider = useMemo(
    () =>
      createDemoAiProvider({
        accelerator,
        smartEnhanceModelUrl: smartEnhanceModel?.url,
        smartEnhanceLabel: smartEnhanceModel?.name
          ? `Smart Enhance (${smartEnhanceModel.name})`
          : undefined,
        smartEnhanceLayout: modelProfile.layout,
        smartEnhanceChannels: modelProfile.channels,
        smartEnhanceOutputScale: modelProfile.outputScale,
        smartEnhanceMinimumVisibleMagnitude: modelProfile.minimumVisibleMagnitude,
        smartEnhanceOutputClamp: modelProfile.outputClamp
      }),
    [accelerator, modelProfile, smartEnhanceModel?.name, smartEnhanceModel?.url]
  );

  useEffect(() => {
    return () => aiProvider.dispose?.();
  }, [aiProvider]);

  useEffect(() => {
    // Blob URLs are host-owned persistence for the demo; revoke the previous
    // export when a new one replaces it or when the app unmounts.
    return () => {
      if (saved) URL.revokeObjectURL(saved.url);
    };
  }, [saved]);

  useEffect(() => {
    return () => {
      if (smartEnhanceModel) URL.revokeObjectURL(smartEnhanceModel.url);
    };
  }, [smartEnhanceModel]);

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

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    void replaceImage(file);
  };

  const onModelFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    // The browser owns local model bytes through this object URL; the cleanup
    // effect revokes it when the user replaces or removes the model.
    setSmartEnhanceModel({
      url: URL.createObjectURL(file),
      name: file.name || 'local-smart-enhance.tflite'
    });
  };

  return (
    <main className="demo-shell">
      <HiddenFileInputs
        imageInputRef={inputRef}
        modelInputRef={modelInputRef}
        onImageChange={onFileChange}
        onModelChange={onModelFileChange}
      />
      {error ? <p role="alert">{error}</p> : null}
      {session ? (
        <>
          <AiModelControl
            imageFilename={filename}
            model={smartEnhanceModel}
            profileId={profileId}
            profiles={SMART_ENHANCE_MODEL_PROFILES}
            accelerator={accelerator}
            onChangeImage={() => inputRef.current?.click()}
            onLoadModel={() => modelInputRef.current?.click()}
            onClearModel={() => setSmartEnhanceModel(null)}
            onProfileChange={setProfileId}
            onAcceleratorChange={setAccelerator}
          />
          {saved ? <DownloadNotice saved={saved} onDismiss={() => setSaved(null)} /> : null}
          <ImageStudio
            session={session}
            theme="dark"
            initialAlt={filename}
            suggestedFilename={filename}
            aiProvider={aiProvider}
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
