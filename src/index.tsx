import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initConsoleBridge } from './services/consoleBridge';
import './index.css';

// Forward WebView2 console output into the Rust tracing log (tauri-dev.log)
// before React mounts so early errors are captured too.
initConsoleBridge();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
