import { IMAGE_STUDIO_PACKAGE_NAME, IMAGE_STUDIO_UPSTREAM_PACKAGES } from '../index';
import { IMAGE_STUDIO_CONTROLLER_ENTRY } from '../controller';

describe('@richly/image-studio entry points', () => {
  it('exposes the canonical package name', () => {
    expect(IMAGE_STUDIO_PACKAGE_NAME).toBe('@richly/image-studio');
  });

  it('links against both workspace image packages', () => {
    // Proves the @richly/image-core and @richly/image-react dependency edges
    // resolve; a broken workspace link would fail at collection time.
    expect(IMAGE_STUDIO_UPSTREAM_PACKAGES).toEqual(['@richly/image-core', '@richly/image-react']);
  });

  it('advertises the dedicated React-free controller subpath', () => {
    expect(IMAGE_STUDIO_CONTROLLER_ENTRY).toBe('@richly/image-studio/controller');
  });
});
