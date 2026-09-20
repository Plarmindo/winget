/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Single source of truth for the app version: package.json. The About tab
  // badge reads this constant at build time instead of hardcoding a version.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: false,
    watch: {
      // Release builds write into src-tauri/target; don't hot-reload the dev app for them
      ignored: ['**/src-tauri/target/**'],
    },
  },
  // to make use of `TAURI_PLATFORM`, `TAURI_ARCH`, `TAURI_FAMILY`,
  // `TAURI_PLATFORM_VERSION`, `TAURI_PLATFORM_TYPE` and `TAURI_DEBUG`
  // env variables
  envPrefix: ['VITE_', 'TAURI_'],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    // Bundle splitting for smaller initial load
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom'],
          // State management
          'state': ['zustand'],
          // Icons
          'icons': ['lucide-react'],
          // AI/API related
          'ai': ['@google/genai'],
        }
      }
    },
    // Reduce chunk size warnings threshold
    chunkSizeWarningLimit: 500,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    // Unit tests live under src/; the Playwright E2E specs in tests/ must not be collected here
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Coverage floors: branches holds a 70% bar; lines/functions/statements are
      // set to current measured coverage so the gate blocks regressions. Raising
      // these toward 70 requires UI/component tests for the untested component
      // layer (AiTab, ChatInterface, GitHubPanel, settings tabs, etc.).
      thresholds: {
        lines: 50,
        branches: 70,
        functions: 40,
        statements: 50,
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/setupTests.ts',
        'src/vite-env.d.ts',
      ],
    },
  },
})