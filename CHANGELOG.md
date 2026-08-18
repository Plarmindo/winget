# Changelog

All notable changes to the WinGet System Manager will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note on version history.** This project has not yet been tagged or released. The version
> string in the manifests has read `1.5.0` since 2025-11-28 (the day Tauri support landed); no
> `1.0.0` or other version has ever been tagged. Earlier drafts of this file described a released
> `1.0.0` (2025-01-01) and a dated `1.5.0` (2026-05-18); both predate or misdate the actual
> commit history, which begins 2025-11-26, and have been corrected here.

## [Unreleased]

Version `1.5.0` (unreleased) — the only version this project has ever carried. Features are
grouped by the development windows in which they landed.

### Added — 2025-11-27 to 2025-12-31 (initial development)

Initial build-out of the application from first commit (2025-11-26):

- Web interface for winget package management: search, install, upgrade, and uninstall flows
- Multi-package-manager support (winget, Chocolatey, Scoop, Homebrew, APT)
- Multi-provider AI support (Gemini, OpenAI, Ollama, LM Studio, llama.cpp)
- Local LLM inference via llama.cpp Rust integration
- AI-powered package discovery, analysis, alternatives, and comparison
- GitHub repository search and management integration
- Script generation for batch operations
- Custom theme system with multiple built-in themes
- Compact mode for denser UI
- Secure credential storage via OS keychain
- Rate limiting for AI API calls
- Dynamic port selection and single-instance lock
- Accessibility improvements and onboarding walkthrough
- Status bar and upgrade restrictions
- Onboarding, skeleton loading states, and UX polish pass

### Added — 2026-08-16 to 2026-08-18 (hardening)

- Toast/confirmation-modal system replacing `alert()`/`confirm()` calls
- Rust-side tracing spans around winget commands (results + timings in the dev log)
- Secure storage hardening and winget command cleanup
- AI-settings deep-link focus flow (web mode) and web-mode search fallbacks
- Cargo-fuzz targets behind a lib target for the Rust backend (Tauri-free `winget-core` crate)

### Fixed

- Concurrent winget operation locking (exit code -1978335212)
- Package ID truncation resolution via winget export
- Command injection prevention in search queries
- CSP header hardening
- Ollama model detection and provider persistence
- GitHub buttons and direct install detection
- Package card layout overlap
- Uninstaller performance and hangs
- Faulty NSIS template removal to fix builds
- Local LLM model loading in the AI service and chat interface (2026-05-05)
- Web-mode paste parsing of `winget list`/`winget upgrade` table output (2026-08-18)
- Test Connection reporting success unconditionally; it now validates the key against the
  provider's models endpoint and surfaces the real error (2026-08-18)
- Gemini provider missing a default base URL in web mode (2026-08-18)

### Changed

- Upgraded to React 19 and TypeScript (strict mode)
- Migrated to Tauri v2 with plugin-based architecture
- Refactored state management to the Zustand slice pattern
- Improved error handling with structured error types

### Security

- API keys stored in OS keychain (Windows Credential Manager)
- Input validation for all package operations
- Command injection prevention in the installer launcher
- CSP directives for font-src, media-src, frame-src

### CI / Tooling (2026-08-16 to 2026-08-18)

- CI pipeline gates fixed end-to-end: eslint config, prettier line endings, Vitest isolation,
  coverage threshold (70%), 16 clippy errors, and `cargo fmt`
- E2E suite with per-worker Vite dev servers, flake gate + sticky PR comment
- Rust toolchain build cache (backend job ~11 min → ~1.5 min)
- All GitHub Actions pinned by full commit SHA; weekly staleness check; Dependabot for
  actions/npm/cargo
- OSSF Scorecard analysis (weekly + dispatch)
- SECURITY.md, CodeQL SAST workflow, CODEOWNERS, branch-protection script
- ClusterFuzzLite fuzz workflow (address sanitizer) with digest-pinned base image
- Untracked build artifacts and root debug dumps from version control
