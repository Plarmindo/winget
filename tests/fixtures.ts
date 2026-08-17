import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';

// Playwright runs tests with cwd at the package root (winget/), so resolve
// Vite's CLI entry relative to it and boot it with the current Node binary
// (avoids npm/shell shims that differ across platforms).
const repoRoot = process.cwd();
const viteCli = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');

type DevServer = { url: string };

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        server.close(() => resolve(address.port));
      } else {
        server.close(() => reject(new Error('Failed to allocate a free port')));
      }
    });
  });
}

async function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not up yet — retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Vite dev server did not answer at ${url} within ${timeoutMs}ms`);
}

function stopServer(proc: ChildProcess): void {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  if (process.platform === 'win32') {
    // Kill the whole tree so Vite's esbuild child process doesn't linger.
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    proc.kill('SIGTERM');
  }
}

// Each worker boots its own Vite dev server on a unique port. This removes the
// shared-server load that caused flakes under fully-parallel runs, and gives
// every worker an isolated origin (and thus isolated localStorage). The
// per-worker baseURL replaces the global webServer block in playwright.config.ts.
export const test = base.extend<{ baseURL: string }, { devServer: DevServer }>({
  devServer: [
    async (
      // Playwright requires an object destructuring pattern for fixture
      // dependencies even when a fixture has none.
      // eslint-disable-next-line no-empty-pattern
      {},
      use
    ) => {
      const port = await getFreePort();
      const url = `http://127.0.0.1:${port}`;
      const proc = spawn(process.execPath, [viteCli, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
        cwd: repoRoot,
        stdio: 'ignore',
      });
      try {
        await waitForServer(url);
        await use({ url });
      } finally {
        stopServer(proc);
      }
    },
    { scope: 'worker' },
  ],
  // baseURL is a built-in test-scoped fixture, so it must stay test-scoped;
  // it just reads the URL owned by the worker-scoped devServer fixture above.
  baseURL: async ({ devServer }, use) => {
    await use(devServer.url);
  },
});

export { expect };
