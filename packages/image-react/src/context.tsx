import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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

  useEffect(() => {
    if (props.session) {
      setSession(props.session);
      props.onReady?.(props.session);
      return;
    }
    if (!props.source) return;

    let cancelled = false;
    const create = async (source: ImageSourceInput): Promise<void> => {
      try {
        const next = props.editDocument
          ? await restoreImageSession(props.editDocument, source)
          : await createImageSession(source);
        if (cancelled) {
          next.destroy();
          return;
        }
        setSession(next);
        props.onReady?.(next);
      } catch (error) {
        if (!cancelled) props.onError?.(error);
      }
    };

    void create(props.source);
    return () => {
      cancelled = true;
    };
  }, [props.editDocument, props.onError, props.onReady, props.session, props.source]);

  useEffect(() => {
    if (!session || !props.onDocumentChange) return;
    return session.subscribe(() => props.onDocumentChange?.(session.toDocument()));
  }, [props.onDocumentChange, session]);

  return (
    <ImageEditorContext.Provider value={{ session, uiStore }}>
      {props.children}
    </ImageEditorContext.Provider>
  );
}

/** Reads the current image editor context. */
export function useImageEditor(): ImageEditorContextValue {
  const value = useContext(ImageEditorContext);
  if (!value) throw new Error('useImageEditor must be used within ImageEditorProvider');
  return value;
}
