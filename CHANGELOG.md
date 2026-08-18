# Changelog

All notable changes to the WinGet System Manager will be documented in this file.

## [1.5.0] - 2026-05-18

### Added
- Multi-provider AI support (Gemini, OpenAI, Ollama, LM Studio, llama.cpp)
- Local LLM inference via llama.cpp Rust integration
- GitHub repository browsing and management
- Package comparison with AI-generated analysis
- Script generation for batch operations
- Custom theme system with multiple built-in themes
- Secure credential storage via OS keychain
- Progress streaming for long-running operations
- Keyboard shortcuts for mode switching and settings
- Virtual scrolling for large package lists
- Rate limiting for AI API calls

### Changed
- Upgraded to React 19 and TypeScript 5.3
- Migrated to Tauri v2 with plugin-based architecture
- Refactored state management to Zustand slice pattern
- Improved error handling with structured error types

### Fixed
- Concurrent winget operation locking (exit code -1978335212)
- Package ID truncation resolution via winget export
- Command injection prevention in search queries
- CSP header hardening

### Security
- API keys stored in OS keychain (Windows Credential Manager)
- Input validation for all package operations
- Command injection prevention in installer launcher
- CSP directives for font-src, media-src, frame-src

## [1.0.0] - 2025-01-01

### Added
- Initial release with winget package management
- Basic search, install, upgrade, and uninstall operations
- Web mode for development without Tauri runtime
- Dark theme UI with Tailwind CSS
