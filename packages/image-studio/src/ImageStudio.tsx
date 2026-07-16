import { ImageEditorProvider } from '@richly/image-react';
import { StudioShell } from './shell/StudioShell';
import type { ImageStudioProps } from './types';

/** Thin composition root for the complete Image Studio experience. */
export function ImageStudio(props: ImageStudioProps) {
  return (
    <ImageEditorProvider
      session={props.session}
      source={props.source}
      editDocument={props.editDocument}
      onError={props.onError}
    >
      <StudioShell {...props} />
    </ImageEditorProvider>
  );
}
