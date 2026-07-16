import { Editor } from '@richly/core';
import {
  imageEditorPlugin,
  ImageEditorSelectionError,
  type ImageEditorOpenInput,
  type ImageEditorResult
} from '../index';

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function selectImage(editor: Editor): HTMLImageElement {
  const image = editor.getBody().querySelector('img');
  if (!(image instanceof HTMLImageElement)) throw new Error('Missing test image');
  const range = document.createRange();
  range.selectNode(image);
  editor.selection.setRange(range);
  return image;
}

function createEditor(plugin: ReturnType<typeof imageEditorPlugin>): Editor {
  const target = document.createElement('div');
  document.body.append(target);
  return Editor.init({
    target,
    initialContent: '<p><img src="before.png" alt="Before" width="120" height="80"></p>',
    plugins: [plugin],
    toolbar: 'imageedit'
  });
}

const result: ImageEditorResult = {
  blob: new Blob(['image'], { type: 'image/png' }),
  width: 320,
  height: 180,
  mimeType: 'image/png',
  editDocument: { version: 1 },
  alt: 'After',
  suggestedFilename: 'after.png'
};

describe('imageEditorPlugin', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('opens the host editor from the selected image and leaves HTML unchanged on cancel', async () => {
    const persist = vi.fn();
    const opened: ImageEditorOpenInput[] = [];
    const editor = createEditor(
      imageEditorPlugin({
        openEditor: async (input) => {
          opened.push(input);
          return null;
        },
        persist
      })
    );
    const before = editor.getContent();
    selectImage(editor);

    editor.execCommand('imageedit');
    await flushAsync();

    expect(opened).toEqual([
      {
        source: { kind: 'url', url: 'before.png' },
        editDocument: undefined,
        alt: 'Before',
        suggestedFilename: undefined
      }
    ]);
    expect(persist).not.toHaveBeenCalled();
    expect(editor.getContent()).toBe(before);
    editor.destroy();
  });

  it('persists before applying one undoable DOM update', async () => {
    const editor = createEditor(
      imageEditorPlugin({
        openEditor: async () => result,
        persist: async (_result, context) => {
          expect(context.image.getAttribute('src')).toBe('before.png');
          return {
            src: 'persisted.png',
            alt: _result.alt,
            width: _result.width,
            height: _result.height,
            editDocumentRef: 'edit-ref-1',
            attributes: {
              'data-asset-id': 'asset-1',
              onclick: 'ignored'
            }
          };
        }
      })
    );
    let changes = 0;
    editor.events.on('change', () => {
      changes += 1;
    });
    const image = selectImage(editor);

    editor.execCommand('imageedit');
    await flushAsync();

    expect(image.getAttribute('src')).toBe('persisted.png');
    expect(image.getAttribute('alt')).toBe('After');
    expect(image.getAttribute('width')).toBe('320');
    expect(image.getAttribute('height')).toBe('180');
    expect(image.getAttribute('data-rly-image-edit-ref')).toBe('edit-ref-1');
    expect(image.getAttribute('data-asset-id')).toBe('asset-1');
    expect(image.hasAttribute('onclick')).toBe(false);
    expect(changes).toBe(1);

    editor.execCommand('Undo');
    expect(editor.getContent()).toContain('src="before.png"');
    editor.destroy();
  });

  it('reports a typed selection error when no image is selected', async () => {
    const onError = vi.fn();
    const editor = createEditor(
      imageEditorPlugin({
        openEditor: async () => result,
        persist: async () => ({ src: 'unused.png' }),
        onError
      })
    );

    editor.selection.selectNodeContents(editor.getBody());
    editor.execCommand('imageedit');
    await flushAsync();

    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(ImageEditorSelectionError);
    editor.destroy();
  });
});
