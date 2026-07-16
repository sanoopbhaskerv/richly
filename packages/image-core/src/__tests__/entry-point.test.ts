import { IMAGE_CORE_PACKAGE_NAME } from '../index';

describe('@richly/image-core entry point', () => {
  it('exposes the canonical package name', () => {
    expect(IMAGE_CORE_PACKAGE_NAME).toBe('@richly/image-core');
  });
});
