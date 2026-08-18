
# WinGet System Manager (Desktop & Web)

A modern, AI-powered system package manager interface. This application allows you to discover, compare, and manage software packages using `winget`, `chocolatey`, `scoop`, `brew`, or `apt` through a beautiful, unified UI.

**Goal:** To provide a sovereign, intelligent desktop utility that simplifies software management on Windows (and other platforms) without relying on complex CLI commands, while retaining the power of native system interaction.

## 🚀 Features

* **Hybrid Architecture:** Runs as a **Native Desktop App** (Tauri) for direct system control or as a **Web App** (React) for script generation.
* **Multi-Manager Support:** Seamlessly switch between Winget, Chocolatey, Scoop, Homebrew, and APT.
* **AI Integration:** Use local LLMs (Ollama) or Cloud APIs (Gemini, OpenAI) to:
  * Compare software (Pros/Cons tables).
  * Find alternatives to popular apps.
  * Generate complex install/migration scripts.
* **Direct Execution:** (Desktop Mode) Install, upgrade, or uninstall apps immediately without copy-pasting commands.
* **Maintenance Mode:** Bulk import lists of installed packages for migration or cleanup.

## 🛠 Tech Stack

* **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons.
* **Backend:** Rust (Tauri 2.0) for native system bridges.
* **AI:** Google Gemini API, OpenAI compatibility layer (for Ollama/LM Studio).
* **Build System:** Vite.

## 🏗 Architecture

The project has been refactored for modularity and scalability:

* **Hooks-Based State:** Logic is extracted into custom hooks (`useGitHubData`, `useThemeSync`, `useRateLimit`) for better separation of concerns.
* **Components:** UI is broken down into granular components (`GitHubPanel`, `PackageGrid`, `ChatInterface`).
* **Services:** API and backend interactions are handled by dedicated services (`githubService`, `wingetService`, `aiService`).
* **Skeletons:** Polish and perceived performance are enhanced with skeleton loaders (`GitHubDetailsSkeleton`, `PackageCardSkeleton`).

## 🛡 Security

We take security seriously:

* **Content Security Policy (CSP):** A strict CSP is enforced in `tauri.conf.json`, allowing only trusted sources for scripts (self) and APIs (GitHub, Ollama, Gemini).
* **Allowlist:** Only specific, safe package manager binaries (`winget`, `choco`, etc.) and system commands are allowed by the Tauri backend.
* **Input Validation:** All user inputs (package IDs, search queries) are rigorously validated on the backend before execution to prevent injection attacks.
* **Admin Detection:** The app intelligently detects if it needs elevated privileges for specific operations.

## 💻 Running as Desktop App (Tauri)

To unleash the full power of the app (Direct Install, Admin Detection), you must run it as a desktop application.

### Prerequisites

* Node.js (v18+)
* Rust (latest stable)
* Build Tools (VS Build Tools on Windows for C++ linkage)

### Setup & Run

```bash
# Install frontend dependencies
npm install

# Run in Development Mode (Hot Reload)
npm run tauri dev

# Build for Production (Creates .exe/.msi)
npm run tauri build
```

## 🌐 Running as Web App

If you only need script generation or discovery:

```bash
npm run dev
```

Open `http://localhost:1420` in your browser. Note: Direct execution buttons will be disabled in this mode.

## 🧪 Testing (Antigravity Ready)

The backend is structured to be testable. You can run unit tests to verify the security allowlists and command construction logic.

### Backend Tests

Navigate to the Rust directory and run standard Cargo tests:

```bash
cd src-tauri
cargo test
```

### Automation / Antigravity

This project is designed with automation in mind:

* **Strict Typing:** TypeScript interfaces for all data structures.
* **Modular Backend:** `lib.rs` splits logic from Tauri boilerplate for easier unit testing and fuzzing.
* **Error Codes:** The backend returns specific string error codes ("Security Violation", "System Error") that can be parsed by automated agents.

## 🔄 CI & Supply Chain

Every push runs five pipelines (all action pins are SHA-locked):

* **CI** — lint, format, typecheck, unit tests with 70% coverage, build, and Rust `check`/`test`/`clippy`/`fmt`.
* **E2E** — Playwright suite against per-worker Vite servers; flaky tests are surfaced in a PR comment, not silently retried.
* **CodeQL** — static analysis on every push (scans TypeScript, JavaScript, and Actions files).
* **Scorecard** — OSSF supply-chain scoring (6.5/10 and climbing); skips until a `SCORECARD_TOKEN` secret exists.
* **Fuzz** — ClusterFuzzLite sanitizer fuzzing of the Rust backend (libFuzzer targets in `src-tauri/fuzz/`).

Local verification mirrors the gates:

```bash
npm run test && npx tsc --noEmit
cd src-tauri && cargo test && cargo clippy && cargo fmt --check
node scripts/check-action-pins.mjs   # verifies every pinned action SHA is current
```
