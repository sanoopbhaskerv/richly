import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import {
  Editor as CoreEditor,
  type EditorConfig,
  type Plugin,
  type WordCountOptions
} from '@richly/core';

export interface EditorProps {
  /** Controlled value. Prefer `initialValue` unless you need two-way binding. */
  value?: string;
  initialValue?: string;
  onChange?: (html: string) => void;
  onInit?: (editor: CoreEditor) => void;
  toolbar?: string;
  toolbarOverflow?: boolean;
  menubar?: boolean;
  statusbar?: boolean;
  wordCount?: boolean | WordCountOptions;
  resize?: boolean;
  plugins?: Plugin[];
  testIdPrefix?: string;
  className?: string;
}

export interface EditorHandle {
  editor: CoreEditor | null;
}

/**
 * Thin React wrapper over @richly/core (DESIGN.md §2.1).
 * The core instance is created once; re-renders never re-init it.
 */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CoreEditor | null>(null);
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;

  useImperativeHandle(
    ref,
    () => ({
      get editor() {
        return editorRef.current;
      }
    }),
    []
  );

  useEffect(() => {
    const config: EditorConfig = {
      target: hostRef.current!,
      initialContent: props.value ?? props.initialValue ?? '',
      toolbar: props.toolbar,
      toolbarOverflow: props.toolbarOverflow,
      menubar: props.menubar,
      statusbar: props.statusbar,
      wordCount: props.wordCount,
      resize: props.resize,
      plugins: props.plugins,
      testIdPrefix: props.testIdPrefix
    };
    const editor = CoreEditor.init(config);
    editorRef.current = editor;
    editor.on('change', (html) => onChangeRef.current?.(html));
    props.onInit?.(editor);
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  // Controlled mode: push external value changes into the editor.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && typeof props.value === 'string' && props.value !== editor.getContent()) {
      editor.setContent(props.value, { addUndoLevel: false });
    }
  }, [props.value]);

  return <div ref={hostRef} className={props.className} />;
});
