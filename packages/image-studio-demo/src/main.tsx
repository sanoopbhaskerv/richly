/**
 * Standalone demo host for Richly Image Studio.
 *
 * This application is the permanent home for host-level concerns that must
 * never enter the library packages: PWA manifest, service worker, install
 * prompts, and local persistence (architecture.md §18). Until the Studio UI
 * ships (PR 6) it renders a placeholder that also smoke-tests workspace
 * resolution of the scaffolded packages.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { IMAGE_STUDIO_PACKAGE_NAME, IMAGE_STUDIO_UPSTREAM_PACKAGES } from '@richly/image-studio';

function PlaceholderApp() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', margin: '3rem auto', maxWidth: '40rem' }}>
      <h1>Richly Image Studio</h1>
      <p>
        Scaffolding for <code>{IMAGE_STUDIO_PACKAGE_NAME}</code>. The visual editor arrives in a
        later phase; this page only proves the workspace wiring.
      </p>
      <ul>
        {IMAGE_STUDIO_UPSTREAM_PACKAGES.map((name) => (
          <li key={name}>
            <code>{name}</code> resolved
          </li>
        ))}
      </ul>
    </main>
  );
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root element in index.html');
}
createRoot(container).render(
  <StrictMode>
    <PlaceholderApp />
  </StrictMode>
);
