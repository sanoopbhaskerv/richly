import '@richly/core/theme.css';
import { Editor as VanillaEditor } from '@richly/core';
import { Editor as ReactEditor } from '@richly/react';
import { createRoot } from 'react-dom/client';
import { StrictMode, useState } from 'react';

// ---- Vanilla integration (testIdPrefix "editor" → editor-root, tb-bold, …) ----
VanillaEditor.init({
  target: document.getElementById('vanilla-host')!,
  testIdPrefix: 'editor',
  initialContent: `
    <h1>Vanilla build</h1>
    <p>This instance was created with <strong>Editor.init()</strong> — no framework. Select text and use the toolbar or <strong>⌘B</strong>/<strong>⌘I</strong>/<strong>⌘Z</strong>.</p>
    <blockquote>Same engine as the React instance below.</blockquote>`
});

// ---- React integration (testIdPrefix "reditor") ----
function App(): JSX.Element {
  const [html, setHtml] = useState(
    '<h1>React build</h1><p>This one is a <strong>&lt;Editor /&gt;</strong> component with <em>onChange</em> wired to state.</p>'
  );
  return (
    <div>
      <ReactEditor value={html} onChange={setHtml} testIdPrefix="reditor" toolbarOverflow />
    </div>
  );
}

createRoot(document.getElementById('react-host')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
