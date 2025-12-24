# Architecture Overview

## System Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend (React + TypeScript)"]
        UI[UI Components]
        Store[Zustand Store]
        Hooks[Custom Hooks]
        Services[Services Layer]
    end

    subgraph Backend["Backend (Rust + Tauri)"]
        Commands[Tauri Commands]
        Validation[Validation Module]
        Errors[Error Handling]
        PackageManagers[Package Manager Bridges]
    end

    subgraph External["External Services"]
        Winget[winget CLI]
        Choco[chocolatey]
        Scoop[scoop]
        GitHub[GitHub API]
        AI[AI Providers]
    end

    UI --> Store
    UI --> Hooks
    Hooks --> Services
    Services --> Commands
    Commands --> Validation
    Commands --> PackageManagers
    PackageManagers --> Winget
    PackageManagers --> Choco
    PackageManagers --> Scoop
    Services --> GitHub
    Services --> AI
```

## Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as React UI
    participant S as Zustand Store
    participant T as Tauri Bridge
    participant R as Rust Backend
    participant W as winget CLI

    U->>UI: Search for package
    UI->>S: setQuery(), setLoading(true)
    UI->>T: executeCliSearch()
    T->>R: search_packages command
    R->>R: validate_search_query()
    R->>W: winget search --query
    W-->>R: JSON output
    R-->>T: Parsed packages
    T-->>UI: Package[]
    UI->>S: setPackages(), setLoading(false)
    S-->>UI: Re-render with results
```

## Directory Structure

```
winget/
├── src/                          # React frontend
│   ├── components/               # UI components
│   │   ├── layout/               # Layout components
│   │   └── settings/             # Settings tab components
│   ├── hooks/                    # Custom React hooks
│   │   ├── usePackageOperations  # Package install/upgrade/uninstall
│   │   ├── useSearchLogic        # Search handling
│   │   └── useKeyboardShortcuts  # Keyboard navigation
│   ├── services/                 # API & business logic
│   │   ├── tauriBridge.ts        # Tauri command wrappers
│   │   ├── wingetService.ts      # Package operations
│   │   ├── githubService.ts      # GitHub API
│   │   └── aiService.ts          # AI providers
│   ├── stores/                   # Zustand state management
│   │   ├── store.ts              # Main store
│   │   └── slices/               # State slices
│   └── utils/                    # Utilities
│       └── logger.ts             # Structured logging
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── main.rs               # Tauri entry point
│       ├── winget_commands.rs    # Package manager operations
│       ├── git_commands.rs       # Git operations
│       ├── validation.rs         # Input validation
│       ├── errors.rs             # Error types
│       └── progress.rs           # Progress tracking
└── .github/workflows/            # CI/CD
    ├── ci.yml                    # Continuous integration
    └── release.yml               # Automated releases
```

## Key Design Patterns

### 1. Command Pattern (Tauri)

All backend operations are exposed as Tauri commands:

```rust
#[tauri::command]
pub async fn search_packages(query: String, manager: String) -> Result<String, String>
```

### 2. Slice Pattern (Zustand)

State is organized into logical slices:

- `settingsSlice` - User preferences
- `cartSlice` - Selected packages
- `chatSlice` - AI chat history
- `uiSlice` - UI state

### 3. Bridge Pattern (tauriBridge.ts)

Frontend services communicate through a unified bridge:

```typescript
export const executeCliSearch = async (query: string, manager: string) => {
  return await invoke<string>('search_packages', { query, manager });
};
```

### 4. Error Boundary Pattern

React error boundaries catch and handle runtime errors gracefully.

## Security Model

1. **Input Validation**: All user inputs validated in Rust before execution
2. **Command Allowlist**: Only specific CLI tools can be executed
3. **Credential Storage**: API keys stored in OS keyring
4. **CSP**: Content Security Policy in Tauri config
