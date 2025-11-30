
# WinGet System Manager (Desktop & Web)

A modern, AI-powered system package manager interface. This application allows you to discover, compare, and manage software packages using `winget`, `chocolatey`, `scoop`, `brew`, or `apt` through a beautiful, unified UI.

**Goal:** To provide a sovereign, intelligent desktop utility that simplifies software management on Windows (and other platforms) without relying on complex CLI commands, while retaining the power of native system interaction.

## 🚀 Features

*   **Hybrid Architecture:** Runs as a **Native Desktop App** (Tauri) for direct system control or as a **Web App** (React) for script generation.
*   **Multi-Manager Support:** Seamlessly switch between Winget, Chocolatey, Scoop, Homebrew, and APT.
*   **AI Integration:** Use local LLMs (Ollama) or Cloud APIs (Gemini, OpenAI) to:
    *   Compare software (Pros/Cons tables).
    *   Find alternatives to popular apps.
    *   Generate complex install/migration scripts.
*   **Direct Execution:** (Desktop Mode) Install, upgrade, or uninstall apps immediately without copy-pasting commands.
*   **Maintenance Mode:** Bulk import lists of installed packages for migration or cleanup.

## 🛠 Tech Stack

*   **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons.
*   **Backend:** Rust (Tauri 1.x) for native system bridges.
*   **AI:** Google Gemini API, OpenAI compatibility layer (for Ollama/LM Studio).
*   **Build System:** Vite.

## 💻 Running as Desktop App (Tauri)

To unleash the full power of the app (Direct Install, Admin Detection), you must run it as a desktop application.

### Prerequisites
*   Node.js (v18+)
*   Rust (latest stable)
*   Build Tools (VS Build Tools on Windows for C++ linkage)

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
*   **Strict Typing:** TypeScript interfaces for all data structures.
*   **Modular Backend:** `main.rs` splits logic from Tauri boilerplate for easier unit testing.
*   **Error Codes:** The backend returns specific string error codes ("Security Violation", "System Error") that can be parsed by automated agents.

## 🛡 Security

*   **Allowlist:** Only specific, safe package manager binaries (`winget`, `choco`, etc.) can be executed.
*   **Isolation:** The web frontend cannot execute arbitrary shell commands.
*   **Admin Checks:** The app detects if it lacks privileges to perform installations and warns the user.
