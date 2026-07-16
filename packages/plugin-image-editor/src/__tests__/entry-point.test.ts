import { IMAGE_EDIT_ACTION_NAME, PLUGIN_IMAGE_EDITOR_PACKAGE_NAME } from '../index';

describe('@richly/plugin-image-editor entry point', () => {
  it('exposes the canonical package name', () => {
    expect(PLUGIN_IMAGE_EDITOR_PACKAGE_NAME).toBe('@richly/plugin-image-editor');
  });

  it('reserves the imageedit action identifier', () => {
    expect(IMAGE_EDIT_ACTION_NAME).toBe('imageedit');
  });
});
