import '@richly/core/theme.css';
import { Editor as VanillaEditor } from '@richly/core';
import { Editor as ReactEditor } from '@richly/react';
import { createRoot } from 'react-dom/client';
import { StrictMode, useState } from 'react';
import { highlightPlugin } from '../../../examples/highlight-plugin';
import { createWordGoalPlugin } from '../../../examples/word-goal-plugin';

const shouldFailUpload = new URLSearchParams(window.location.search).has('imgfail');
const blockquoteStyle = !new URLSearchParams(window.location.search).has('noBlockquoteStyle');

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

// Mirrors the core default toolbar with the custom Highlight button added, so
// the custom-plugin demo instances still expose every standard tool.
const demoToolbar =
  'undo redo | selectall copy cut paste | bold italic highlight underline strikethrough superscript subscript | forecolor backcolor fontsize | h1 h2 paragraph blockquote | alignleft aligncenter alignright | bullist numlist outdent indent | link unlink table image | findreplace preview visualblocks | code fullscreen removeformat';

// ---- Vanilla integration (with custom plugins) ----
VanillaEditor.init({
  target: document.getElementById('vanilla-host')!,
  testIdPrefix: 'editor',
  images: { upload: uploadImage },
  textStyles: { themeColors: ['#0f766e', '#be123c'] },
  plugins: [
    highlightPlugin,
    createWordGoalPlugin({ goal: 50, testId: 'status-vanilla-word-goal' })
  ],
  toolbar: demoToolbar,
  initialContent: `
    <h1>Vanilla build</h1>
    <p>This instance was created with <strong>Editor.init()</strong> and has the custom Highlight and Word Goal plugins registered.</p>`
});

// ---- Vanilla integration (standard) ----
VanillaEditor.init({
  target: document.getElementById('vanilla-clean-host')!,
  testIdPrefix: 'editor-clean',
  images: { upload: uploadImage },
  blockquoteStyle,
  initialContent: `
    <h1>Vanilla build (Standard)</h1>
    <p>This instance has <strong>no custom plugins</strong> registered. It uses default plugins and toolbar configurations.</p>`
});
// ---- Vanilla integration (standard) toolbar mode sliding----

VanillaEditor.init({
  target: document.getElementById('vanilla-sliding-clean-host')!,
  testIdPrefix: 'editor-sliding-clean',
  images: { upload: uploadImage },
  blockquoteStyle,
  toolbarMode: 'sliding',
  initialContent: `
    <h1>Vanilla build (Standard)</h1>
    <p>This instance has <strong>no custom plugins</strong> registered. It uses default plugins and toolbar configurations.</p>`
});

// ---- React integration (with custom plugins) ----
function App(): JSX.Element {
  const [html, setHtml] = useState(
    '<h1>React build</h1><p>This one is a <strong>&lt;Editor /&gt;</strong> component with custom plugins and custom toolbar.</p>'
  );
  return (
    <div>
      <ReactEditor
        value={html}
        onChange={setHtml}
        testIdPrefix="reditor"
        toolbarMode="more"
        toolbar={demoToolbar}
        images={{ upload: uploadImage }}
        plugins={[
          highlightPlugin,
          createWordGoalPlugin({ goal: 30, testId: 'status-react-word-goal' })
        ]}
      />
    </div>
  );
}

// ---- React integration (standard) ----
function CleanApp(): JSX.Element {
  const [html, setHtml] = useState(
    '<h1>React build (Standard)</h1><p>This component has <strong>no custom plugins</strong> and uses default toolbar configurations.</p>'
  );
  return (
    <div>
      <ReactEditor
        value={html}
        onChange={setHtml}
        testIdPrefix="reditor-clean"
        toolbarMode="sliding"
        images={{ upload: uploadImage }}
      />
    </div>
  );
}

createRoot(document.getElementById('react-host')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

createRoot(document.getElementById('react-clean-host')!).render(
  <StrictMode>
    <CleanApp />
  </StrictMode>
);
