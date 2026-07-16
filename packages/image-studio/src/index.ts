/**
 * @richly/image-studio — complete responsive Image Studio UI.
 *
 * @packageDocumentation
 */

import './styles/index.css';
import { IMAGE_CORE_PACKAGE_NAME } from '@richly/image-core';
import { IMAGE_REACT_PACKAGE_NAME } from '@richly/image-react';
export { ImageStudio } from './ImageStudio';
export { IMAGE_STUDIO_PACKAGE_NAME } from './types';
export type { ImageStudioProps, ImageStudioTheme } from './types';
export type { ImageStudioResult } from './controller';

export const IMAGE_STUDIO_UPSTREAM_PACKAGES = [
  IMAGE_CORE_PACKAGE_NAME,
  IMAGE_REACT_PACKAGE_NAME
] as const;
