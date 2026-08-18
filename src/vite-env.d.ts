/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by vite.config.ts `define` from package.json (single source of truth
// for the app version; the About tab badge reads it at build time).
declare const __APP_VERSION__: string;
