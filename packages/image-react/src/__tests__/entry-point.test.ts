import { IMAGE_REACT_PACKAGE_NAME, IMAGE_REACT_UPSTREAM_PACKAGES } from '../index';

describe('@richly/image-react entry point', () => {
  it('exposes the canonical package name', () => {
    expect(IMAGE_REACT_PACKAGE_NAME).toBe('@richly/image-react');
  });

  it('links against the workspace image engine', () => {
    // Proves the @richly/image-core dependency edge resolves; a broken
    // workspace link would fail this import at collection time.
    expect(IMAGE_REACT_UPSTREAM_PACKAGES).toEqual(['@richly/image-core']);
  });
});
