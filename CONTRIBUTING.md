# Contributing to WinGet System Manager

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- **Node.js** 18+
- **Rust** (latest stable)
- **VS Build Tools** (Windows, for C++ linkage)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/WingetInterfaceAndMore.git
cd WingetInterfaceAndMore/winget

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Or run web-only mode (no native features)
npm run dev
```

## Code Standards

### TypeScript

- Strict mode enabled (`tsconfig.json`)
- No `@ts-ignore` - use proper types
- No `console.log` in production - use `logger` from `src/utils/logger.ts`

### Rust

- Run `cargo clippy` before committing
- All public functions must have doc comments
- Error handling via `Result<T, String>` or custom `WingetError`

### Testing

- All new features require tests
- Run `npm run test` before committing
- Target: 80%+ code coverage

## Pull Request Process

1. **Create a feature branch** from `develop`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code standards above

3. **Run checks**:

   ```bash
   npm run test           # Frontend tests
   cd src-tauri && cargo test   # Backend tests
   cd src-tauri && cargo clippy # Rust lint
   ```

4. **Commit with conventional commits**:

   ```
   feat: add new feature
   fix: resolve bug
   docs: update documentation
   test: add tests
   refactor: code cleanup
   ci: CI/CD changes
   ```

5. **Push and create PR** against `develop` branch

## Project Structure

```
winget/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API clients & business logic
│   ├── stores/             # Zustand state management
│   └── utils/              # Utilities (logger, etc.)
├── src-tauri/              # Rust backend
│   └── src/
│       ├── main.rs         # Tauri entry point
│       ├── winget_commands.rs  # Package manager operations
│       ├── validation.rs   # Input validation
│       └── errors.rs       # Error types
└── .github/workflows/      # CI/CD pipelines
```

## Running Tests

```bash
# Frontend tests
npm run test

# Backend tests
cd src-tauri && cargo test

# Watch mode
npm run test -- --watch
```

## Questions?

Open an issue or discussion on GitHub. We're happy to help!
