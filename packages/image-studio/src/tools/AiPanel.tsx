import { useEffect, useRef, useState } from 'react';
import { useImageEditor } from '@richly/image-react';
import { exportSessionImageData } from '../ai/imageData';
import type { ImageStudioAiProvider, ImageStudioAiStatus } from '../types';

/** Props for the local AI Tools inspector panel. */
export interface AiPanelProps {
  /** Optional host-provided AI provider, such as @richly/image-ai-litert. */
  readonly provider?: ImageStudioAiProvider;
}

const unavailableStatus: ImageStudioAiStatus = {
  available: false,
  label: 'Not configured',
  detail: 'Connect a local AI provider to enable on-device editing tools.'
};

function useAiStatus(provider: ImageStudioAiProvider | undefined): ImageStudioAiStatus {
  const [status, setStatus] = useState<ImageStudioAiStatus>(unavailableStatus);
  useEffect(() => {
    let mounted = true;
    if (!provider?.getStatus) {
      setStatus(unavailableStatus);
      return;
    }
    void Promise.resolve(provider.getStatus())
      .then((next) => {
        if (mounted) setStatus(next);
      })
      .catch((caught) => {
        if (!mounted) return;
        setStatus({
          available: false,
          label: 'Provider error',
          detail: caught instanceof Error ? caught.message : String(caught)
        });
      });
    return () => {
      mounted = false;
    };
  }, [provider]);
  return status;
}

/** Inspector panel for optional local AI editing capabilities. */
export function AiPanel(props: AiPanelProps) {
  const { session } = useImageEditor();
  const status = useAiStatus(props.provider);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const applySmartEnhance = async (): Promise<void> => {
    const provider = props.provider;
    if (!session || !provider?.smartEnhance || busy) return;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setError(null);
    setMessage('Preparing image for local AI');
    try {
      const imageData = await exportSessionImageData(session, abort.signal);
      setMessage('Running Smart Enhance locally');
      const result = await provider.smartEnhance({ imageData, signal: abort.signal });
      if (abort.signal.aborted) return;
      if (result.adjustments.length === 0) {
        setMessage('Smart Enhance found no useful changes');
        return;
      }
      session.transact(result.label, () => {
        for (const adjustment of result.adjustments) {
          session.execute('adjust', {
            channel: adjustment.channel,
            value: adjustment.value
          });
        }
      });
      setMessage(
        `Applied ${result.adjustments.length} adjustment${
          result.adjustments.length === 1 ? '' : 's'
        }${result.model ? ` from ${result.model}` : ''}`
      );
    } catch (caught) {
      if (abort.signal.aborted) {
        setMessage('Smart Enhance cancelled');
        return;
      }
      setError(caught instanceof Error ? caught.message : String(caught));
      setMessage(null);
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
      setBusy(false);
    }
  };

  const cancel = (): void => {
    abortRef.current?.abort();
  };

  const smartEnhanceEnabled = Boolean(status.available && props.provider?.smartEnhance && !busy);

  return (
    <section className="ris-inspector-section">
      <h2>AI Tools</h2>
      <div className="ris-ai-status" data-available={status.available}>
        <span>{status.label}</span>
        {status.accelerator ? <strong>{status.accelerator}</strong> : null}
        {status.detail ? <p>{status.detail}</p> : null}
      </div>

      <div className="ris-tool-group">
        <h3>Enhance</h3>
        <p className="ris-meta">
          Smart Enhance runs locally, then applies regular adjustment operations so undo stays
          predictable.
        </p>
        <div className="ris-actions">
          {busy ? (
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            className="ris-primary"
            disabled={!smartEnhanceEnabled}
            onClick={() => void applySmartEnhance()}
          >
            {busy ? 'Running...' : 'Apply smart enhance'}
          </button>
        </div>
      </div>

      <div className="ris-tool-group">
        <h3>Coming next</h3>
        <div className="ris-ai-feature-list">
          <span>Subject crop</span>
          <span>Background mask</span>
          <span>Upscale</span>
        </div>
      </div>

      <div aria-live="polite">
        {message ? <p className="ris-meta">{message}</p> : null}
        {error ? (
          <p className="ris-ai-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
