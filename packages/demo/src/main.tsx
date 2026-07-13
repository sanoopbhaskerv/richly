import '@richly/core/theme.css';
import './demo.css';
import { Editor as VanillaEditor, type ToolbarMode } from '@richly/core';
import { Editor as ReactEditor } from '@richly/react';
import { createRoot } from 'react-dom/client';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { highlightPlugin } from '../../../examples/highlight-plugin';
import { createWordGoalPlugin } from '../../../examples/word-goal-plugin';

const shouldFailUpload = new URLSearchParams(window.location.search).has('imgfail');
const initialBlockquoteStyle = !new URLSearchParams(window.location.search).has(
  'noBlockquoteStyle'
);

const uploadImage = async (file: File): Promise<{ src: string; alt?: string }> => {
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (shouldFailUpload) throw new Error('Upload failed');

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
  return { src: dataUrl, alt: file.name.replace(/\.[^.]+$/, '') };
};

const FULL_TOOLBAR =
  'undo redo | bold italic highlight | selectall copy cut paste | underline strikethrough superscript subscript | forecolor backcolor fontsize | h1 h2 paragraph blockquote | alignleft aligncenter alignright | bullist numlist outdent indent | link unlink table image | findreplace preview visualblocks | code fullscreen removeformat';

const TOOLBAR_PRESETS = {
  full: FULL_TOOLBAR,
  focused:
    'undo redo | bold italic underline | forecolor backcolor fontsize | h1 h2 paragraph blockquote | bullist numlist | link image table | findreplace removeformat',
  essential: 'undo redo | bold italic | forecolor backcolor | link | removeformat'
} as const;

type ToolbarPreset = keyof typeof TOOLBAR_PRESETS;

// Keep the first two demo colors stable: the integration fixtures exercise these
// values as part of the public `textStyles.themeColors` example.
const DEFAULT_THEME_COLORS = ['#0f766e', '#be123c', '#2563eb'];

const PLAYGROUND_CONTENT = `
  <h1>Vanilla build</h1>
  <p><strong>Configure this editor live.</strong> Change toolbar behavior, chrome, brand colors, and content features from the panel beside it.</p>
  <blockquote>Richly keeps the editing surface small while leaving product-level configuration in your hands.</blockquote>
  <h2>Things to try</h2>
  <ul>
    <li>Select text and apply a brand color or an exact custom color.</li>
    <li>Switch between wrap, more, and sliding toolbar modes.</li>
    <li>Insert a table or image, then inspect the sanitized HTML output.</li>
  </ul>`;

const BooleanControl = ({
  checked,
  label,
  testId,
  onChange
}: {
  checked: boolean;
  label: string;
  testId: string;
  onChange: (checked: boolean) => void;
}): JSX.Element => (
  <label className="toggle-row">
    <span>{label}</span>
    <input
      type="checkbox"
      checked={checked}
      data-testid={testId}
      onChange={(event) => onChange(event.target.checked)}
    />
  </label>
);

function PlaygroundApp(): JSX.Element {
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>('wrap');
  const [toolbarPreset, setToolbarPreset] = useState<ToolbarPreset>('full');
  const [menubar, setMenubar] = useState(true);
  const [statusbar, setStatusbar] = useState(true);
  const [resize, setResize] = useState(true);
  const [wordCount, setWordCount] = useState(true);
  const [images, setImages] = useState(true);
  const [blockquoteStyle, setBlockquoteStyle] = useState(initialBlockquoteStyle);
  const [themeColorsEnabled, setThemeColorsEnabled] = useState(true);
  const [themeColors, setThemeColors] = useState([...DEFAULT_THEME_COLORS]);
  const [html, setHtml] = useState(PLAYGROUND_CONTENT);
  const [copied, setCopied] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof VanillaEditor.init> | null>(null);
  const contentRef = useRef(PLAYGROUND_CONTENT);
  const toolbar = TOOLBAR_PRESETS[toolbarPreset];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();

    const editor = VanillaEditor.init({
      target: host,
      testIdPrefix: 'editor',
      initialContent: contentRef.current,
      toolbar,
      toolbarMode,
      menubar,
      statusbar,
      resize,
      wordCount,
      blockquoteStyle,
      images: images ? { upload: uploadImage } : undefined,
      textStyles: themeColorsEnabled ? { themeColors } : undefined,
      plugins: [
        highlightPlugin,
        createWordGoalPlugin({ goal: 50, testId: 'status-vanilla-word-goal' })
      ]
    });
    editorRef.current = editor;
    const offChange = editor.on('change', (value) => {
      contentRef.current = value;
      setHtml(value);
    });

    return () => {
      offChange();
      editor.destroy();
      if (editorRef.current === editor) editorRef.current = null;
    };
  }, [
    blockquoteStyle,
    images,
    menubar,
    resize,
    statusbar,
    themeColors,
    themeColorsEnabled,
    toolbar,
    toolbarMode,
    wordCount
  ]);

  const resetConfiguration = (): void => {
    setToolbarMode('wrap');
    setToolbarPreset('full');
    setMenubar(true);
    setStatusbar(true);
    setResize(true);
    setWordCount(true);
    setImages(true);
    setBlockquoteStyle(initialBlockquoteStyle);
    setThemeColorsEnabled(true);
    setThemeColors([...DEFAULT_THEME_COLORS]);
  };

  const resetContent = (): void => {
    contentRef.current = PLAYGROUND_CONTENT;
    editorRef.current?.setContent(PLAYGROUND_CONTENT, { addUndoLevel: false });
    setHtml(PLAYGROUND_CONTENT);
  };

  const updateThemeColor = (index: number, value: string): void => {
    setThemeColors((current) =>
      current.map((color, colorIndex) => (colorIndex === index ? value : color))
    );
  };

  const configurationCode = [
    'Editor.init({',
    '  target,',
    `  toolbarMode: '${toolbarMode}',`,
    `  toolbar: '${toolbar}',`,
    `  menubar: ${menubar},`,
    `  statusbar: ${statusbar},`,
    `  resize: ${resize},`,
    `  wordCount: ${wordCount},`,
    `  blockquoteStyle: ${blockquoteStyle},`,
    ...(images ? ['  images: { upload: uploadImage },'] : []),
    ...(themeColorsEnabled
      ? [`  textStyles: { themeColors: ${JSON.stringify(themeColors)} },`]
      : []),
    '  plugins: [highlightPlugin]',
    '});'
  ].join('\n');

  const copyConfiguration = async (): Promise<void> => {
    await navigator.clipboard.writeText(configurationCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="playground-dashboard" data-testid="demo-playground">
      <aside className="config-panel" aria-label="Editor configuration">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true">
            ⚙
          </span>
          <div>
            <p className="eyebrow">Live controls</p>
            <h2>Editor configuration</h2>
          </div>
        </div>

        <div className="config-section">
          <h3>Toolbar</h3>
          <label className="field-label" htmlFor="toolbar-mode">
            Toolbar mode
          </label>
          <select
            id="toolbar-mode"
            className="config-select"
            value={toolbarMode}
            data-testid="demo-config-toolbar-mode"
            onChange={(event) => setToolbarMode(event.target.value as ToolbarMode)}
          >
            <option value="wrap">Wrap — show every group</option>
            <option value="more">More — floating overflow</option>
            <option value="sliding">Sliding — inline drawer</option>
          </select>

          <label className="field-label" htmlFor="toolbar-preset">
            Toolbar preset
          </label>
          <select
            id="toolbar-preset"
            className="config-select"
            value={toolbarPreset}
            data-testid="demo-config-toolbar-preset"
            onChange={(event) => setToolbarPreset(event.target.value as ToolbarPreset)}
          >
            <option value="full">Full editing suite</option>
            <option value="focused">Focused writing</option>
            <option value="essential">Essential formatting</option>
          </select>
        </div>

        <div className="config-section">
          <h3>Editor chrome</h3>
          <BooleanControl
            checked={menubar}
            label="Menubar"
            testId="demo-config-menubar"
            onChange={setMenubar}
          />
          <BooleanControl
            checked={statusbar}
            label="Statusbar"
            testId="demo-config-statusbar"
            onChange={setStatusbar}
          />
          <BooleanControl
            checked={resize}
            label="Resize grip"
            testId="demo-config-resize"
            onChange={setResize}
          />
          <BooleanControl
            checked={wordCount}
            label="Word count"
            testId="demo-config-word-count"
            onChange={setWordCount}
          />
        </div>

        <div className="config-section">
          <h3>Content features</h3>
          <BooleanControl
            checked={images}
            label="Image uploads"
            testId="demo-config-images"
            onChange={setImages}
          />
          <BooleanControl
            checked={blockquoteStyle}
            label="Richly blockquotes"
            testId="demo-config-blockquotes"
            onChange={setBlockquoteStyle}
          />
          <BooleanControl
            checked={themeColorsEnabled}
            label="Brand colors"
            testId="demo-config-theme-colors"
            onChange={setThemeColorsEnabled}
          />
          {themeColorsEnabled && (
            <div className="color-fields" aria-label="Brand theme colors">
              {themeColors.map((color, index) => (
                <label key={index} className="color-field">
                  <span>Brand color {index + 1}</span>
                  <input
                    type="color"
                    value={color}
                    data-testid={`demo-config-theme-color-${index + 1}`}
                    onChange={(event) => updateThemeColor(index, event.target.value)}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="config-actions">
          <button type="button" className="secondary-btn" onClick={resetConfiguration}>
            Reset options
          </button>
          <button type="button" className="secondary-btn" onClick={resetContent}>
            Reset content
          </button>
        </div>
      </aside>

      <div className="playground-workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">Interactive sandbox</p>
            <h1 id="playground-title">Build your Richly setup</h1>
            <p>
              Every control re-creates the core editor with the selected public API options while
              preserving your document.
            </p>
          </div>
          <span className="live-badge">
            <span aria-hidden="true"></span> Live
          </span>
        </div>

        <div className="editor-frame playground-editor">
          <div id="vanilla-host" ref={hostRef}></div>
        </div>

        <div className="inspector-grid">
          <article className="inspector-card">
            <div className="inspector-heading">
              <div>
                <span className="inspector-kicker">Public API</span>
                <h2>Current configuration</h2>
              </div>
              <button type="button" className="copy-btn" onClick={copyConfiguration}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre
              className="code-output"
              data-testid="demo-config-output"
              tabIndex={0}
              aria-label="Current editor configuration code"
            >
              <code>{configurationCode}</code>
            </pre>
          </article>

          <article className="inspector-card">
            <div className="inspector-heading">
              <div>
                <span className="inspector-kicker">Sanitized output</span>
                <h2>Document HTML</h2>
              </div>
              <span className="output-size">{html.length} chars</span>
            </div>
            <pre
              className="code-output code-output--html"
              data-testid="demo-html-output"
              tabIndex={0}
              aria-label="Sanitized document HTML"
            >
              <code>{html}</code>
            </pre>
          </article>
        </div>
      </div>
    </div>
  );
}

VanillaEditor.init({
  target: document.getElementById('vanilla-clean-host')!,
  testIdPrefix: 'editor-clean',
  images: { upload: uploadImage },
  blockquoteStyle: initialBlockquoteStyle,
  initialContent: `
    <h1>Vanilla build (Standard)</h1>
    <p>This instance uses the default plugins and toolbar configuration.</p>`
});

VanillaEditor.init({
  target: document.getElementById('vanilla-sliding-clean-host')!,
  testIdPrefix: 'editor-sliding-clean',
  images: { upload: uploadImage },
  blockquoteStyle: initialBlockquoteStyle,
  toolbarMode: 'sliding',
  initialContent: `
    <h1>Vanilla build (Sliding)</h1>
    <p>Resize the page and reveal overflow groups in the inline drawer.</p>`
});

function CustomReactApp(): JSX.Element {
  const [html, setHtml] = useState(
    '<h1>React build</h1><p>This <strong>&lt;Editor /&gt;</strong> uses custom plugins and floating toolbar overflow.</p>'
  );
  return (
    <ReactEditor
      value={html}
      onChange={setHtml}
      testIdPrefix="reditor"
      toolbarMode="more"
      toolbar={FULL_TOOLBAR}
      images={{ upload: uploadImage }}
      plugins={[
        highlightPlugin,
        createWordGoalPlugin({ goal: 30, testId: 'status-react-word-goal' })
      ]}
    />
  );
}

function CleanReactApp(): JSX.Element {
  const [html, setHtml] = useState(
    '<h1>React build (Standard)</h1><p>This component uses default plugins with the sliding toolbar mode.</p>'
  );
  return (
    <ReactEditor
      value={html}
      onChange={setHtml}
      testIdPrefix="reditor-clean"
      toolbarMode="sliding"
      images={{ upload: uploadImage }}
    />
  );
}

createRoot(document.getElementById('playground-root')!).render(
  <StrictMode>
    <PlaygroundApp />
  </StrictMode>
);

createRoot(document.getElementById('react-host')!).render(
  <StrictMode>
    <CustomReactApp />
  </StrictMode>
);

createRoot(document.getElementById('react-clean-host')!).render(<CleanReactApp />);
