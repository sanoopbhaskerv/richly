import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import {
  createImageSession,
  restoreImageSession,
  type ImageSession,
  type ImageSourceInput
} from '@richly/image-core';
import { createImageEditorUiStore, type ImageEditorUiStore } from './uiStore';
import type { ImageEditorProviderProps } from './types';

interface ImageEditorContextValue {
  readonly session: ImageSession | null;
  readonly uiStore: ImageEditorUiStore;
}

const ImageEditorContext = createContext<ImageEditorContextValue | null>(null);

/** Provides an image session plus React-owned interaction state. */
export function ImageEditorProvider(props: ImageEditorProviderProps): ReactNode {
  const uiStore = useMemo(() => createImageEditorUiStore(), []);
  const [session, setSession] = useState<ImageSession | null>(props.session ?? null);
  const onErrorRef = useRef(props.onError);
  const onReadyRef = useRef(props.onReady);

  useEffect(() => {
    onErrorRef.current = props.onError;
    onReadyRef.current = props.onReady;
  }, [props.onError, props.onReady]);

  useEffect(() => {
    if (props.session) {
      setSession(props.session);
      onReadyRef.current?.(props.session);
      return;
    }
    setSession(null);
    if (!props.source) return;

    let cancelled = false;
    let ownedSession: ImageSession | null = null;
    const create = async (source: ImageSourceInput): Promise<void> => {
      try {
        const next = props.editDocument
          ? await restoreImageSession(props.editDocument, source)
          : await createImageSession(source);
        if (cancelled) {
          next.destroy();
          return;
        }
        ownedSession = next;
        setSession(next);
        onReadyRef.current?.(next);
      } catch (error) {
        if (!cancelled) onErrorRef.current?.(error);
      }
    };

    void create(props.source);
    return () => {
      cancelled = true;
      ownedSession?.destroy();
      ownedSession = null;
    };
  }, [props.editDocument, props.session, props.source]);

  useEffect(() => {
    if (!session || !props.onDocumentChange) return;
    return session.subscribe(() => props.onDocumentChange?.(session.toDocument()));
  }, [props.onDocumentChange, session]);

  return (
    <ImageEditorContext.Provider value={{ session, uiStore }}>
      {session ? props.children : null}
    </ImageEditorContext.Provider>
  );
}

/** Reads the current image editor context. */
export function useImageEditor(): ImageEditorContextValue {
  const value = useContext(ImageEditorContext);
  if (!value) throw new Error('useImageEditor must be used within ImageEditorProvider');
  return value;
}
