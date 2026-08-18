# Production Readiness Task List

> Generated from comprehensive evaluation (Overall Score: 4.7/10 — Not Production-Ready)
> Priority: 🔴 Critical → 🟠 High → 🟡 Medium
> Status: ⬜ Not Started | 🔵 In Progress | ✅ Done

---

## 🔴 CRITICAL — Security Fixes (S1–S7)

### S1: Move GitHub Token from localStorage to Secure Storage
- **Files**: `src/stores/slices/settingsSlice.ts`, `src/services/githubService.ts`, `src-tauri/src/secure_storage.rs`
- **Problem**: `githubToken` persisted to localStorage via Zustand `persist` middleware — accessible to any XSS
- **Work**:
  1. Remove `githubToken` from `DEFAULT_SETTINGS` and `AppSettings` type in `types.ts`
  2. Add a new Tauri command `save_github_token` / `load_github_token` in `secure_storage.rs` using the existing `keyring` crate
  3. In `githubService.ts`, replace direct token reads with `invoke('load_github_token')` calls
  4. In `settingsSlice.ts`, remove `githubToken` from persisted state; add a non-persisted `githubToken` field that loads from secure storage on app start
  5. Update `store.ts` `partialize` to exclude `githubToken` from persistence
- **Dependencies**: None
- **Outcome**: GitHub token stored in OS credential manager (keyring), not localStorage

### S2: Move AI API Keys from sessionStorage to Secure Storage
- **Files**: `src/services/tauriBridge.ts`, `src-tauri/src/secure_storage.rs`
- **Problem**: AI API keys stored in `sessionStorage` in web mode — XSS accessible
- **Work**:
  1. Add Tauri commands `save_ai_key` / `load_ai_key` / `delete_ai_key` in `secure_storage.rs`
  2. In `tauriBridge.ts`, replace `sessionStorage.setItem/getItem` for API keys with `invoke('save_ai_key')` / `invoke('load_ai_key')`
  3. For web mode fallback, encrypt keys before storing in sessionStorage (use a derived key from app origin)
- **Dependencies**: None
- **Outcome**: AI API keys stored in OS credential manager; web mode uses encrypted storage

### S3: Add Hash/Signature Verification for Downloaded Installers
- **Files**: `src-tauri/src/installer_commands.rs`
- **Problem**: Downloaded installers launched via `explorer.exe` without any integrity verification — supply chain attack vector
- **Work**:
  1. Add `sha256` field to `DownloadRequest` struct (optional, for backward compatibility)
  2. After download completes (before `explorer.exe` launch at ~line 170), compute SHA-256 of downloaded file
  3. If expected hash provided, verify match; return error on mismatch
  4. If no hash provided, log the computed hash and emit it as an event so the frontend can display it
  5. Add `sha2` crate to `Cargo.toml` dependencies
  6. Optionally verify Authenticode signature using `winapi` or `windows` crate (stretch goal)
- **Dependencies**: None
- **Outcome**: Installers verified against expected hash before execution; hash displayed to user when not provided

### S4: Add IPv6 Private Address Blocking (SSRF Prevention)
- **Files**: `src-tauri/src/installer_commands.rs`
- **Problem**: Only IPv4 private addresses blocked; IPv6 loopback (`::1`), link-local (`fe80::`), unique local (`fc00::`/`fd00::`) not blocked
- **Work**:
  1. Extend `is_private_ip()` function to handle IPv6 addresses
  2. Block: `::1` (loopback), `fe80::/10` (link-local), `fc00::/7` (unique local), `ff00::/8` (multicast)
  3. Parse URL host as `IpAddr` (not just `Ipv4Addr`) to handle both families
  4. Add unit tests for IPv6 blocking
- **Dependencies**: None
- **Outcome**: SSRF via IPv6 private addresses prevented

### S5: Sanitize Package IDs in Generated Scripts (Command Injection)
- **Files**: `src/utils/scriptUtils.ts`, `src-tauri/src/validation.rs`
- **Problem**: Package IDs from `activePackages.map(p => p.id)` inserted directly into shell commands without sanitization
- **Work**:
  1. Add `sanitizePackageId()` function in `scriptUtils.ts` that validates against regex `^[@A-Za-z0-9][A-Za-z0-9._\-\\/]{0,255}$` (matching Rust-side `validate_package_id()`)
  2. Apply sanitization to every `p.id` usage in `generateScript()` — wrap in quotes AND validate
  3. For `winget` mode: validate each ID before inserting into PowerShell script
  4. For `chocolatey`/`scoop`/`brew`/`apt`: validate and quote each ID
  5. Add a Tauri command `validate_script_packages` that calls `validation::validate_package_id()` for server-side validation as defense-in-depth
  6. Add unit tests for sanitization function
- **Dependencies**: None
- **Outcome**: Command injection via malicious package IDs prevented; defense-in-depth with both TS and Rust validation

### S6: Clean Up Temp Files After Installation
- **Files**: `src-tauri/src/installer_commands.rs`
- **Problem**: Downloaded installer files left in temp directory after `explorer.exe` launch — disk space leak
- **Work**:
  1. After launching installer via `explorer.exe`, spawn a background task (tokio::spawn) that:
     - Waits for the installer process to exit (monitor via `std::process::Command::status()` instead of detached launch)
     - Deletes the temp directory and its contents
  2. Add a timeout (e.g., 30 minutes) for cleanup — if installer still running, log warning and schedule cleanup on app exit
  3. Register an `on_app_exit` cleanup handler that removes any remaining temp directories
  4. Track temp directories in app state for cleanup
- **Dependencies**: None
- **Outcome**: No orphaned installer files left on disk

### S7: Add User Confirmation for save_script_to_desktop
- **Files**: `src-tauri/src/main.rs`
- **Problem**: `save_script_to_desktop` writes files to Desktop without user confirmation — arbitrary file write
- **Work**:
  1. Add filename validation: reject paths with `..`, `/`, `\` — only allow alphanumeric + `.ps1`/`.bat`/`.sh` extensions
  2. Use Tauri dialog API (`tauri_plugin_dialog`) to show a confirmation dialog before writing
  3. Alternatively, use the Tauri file save dialog (`dialog::save_file`) which lets the user choose the location
  4. Add the validation from `validation.rs` for the filename
- **Dependencies**: None
- **Outcome**: User must confirm before any file is written to Desktop; path traversal prevented

---

## 🟠 HIGH — Architecture Fixes (A1–A10)

### A1: Create Unified PackageManager Trait
- **Files**: `src-tauri/src/package_managers.rs`, `src-tauri/src/main.rs`
- **Problem**: No shared trait for package managers; each has duplicate search/list/install/upgrade/uninstall logic
- **Work**:
  1. Define `trait PackageManager { async fn search(); async fn install(); async fn upgrade(); async fn uninstall(); async fn list_installed(); async fn list_upgradable(); }`
  2. Implement for `WingetManager`, `ChocoManager`, `ScoopManager`, `BrewManager`, `AptManager`
  3. Refactor `main.rs` command handlers to use trait objects (`Box<dyn PackageManager>`)
  4. Reduce code duplication across manager implementations
- **Dependencies**: None
- **Outcome**: Consistent interface; easier to add new package managers; reduced duplication

### A2: Align Rust and TypeScript WingetPackage Types
- **Files**: `src/types.ts`, `src-tauri/src/winget_commands.rs`, `src-tauri/src/package_managers.rs`
- **Problem**: Rust struct fields and TypeScript interface fields diverge; potential runtime errors from mismatched serialization
- **Work**:
  1. Audit all fields in Rust `WingetPackage` struct vs TS `WingetPackage` interface
  2. Make them identical — same names, same types, same optionality
  3. Add `#[serde(rename_all = "camelCase")]` to Rust structs for consistent serialization
  4. Add a shared `types.md` or JSON schema document as contract reference
- **Dependencies**: None
- **Outcome**: Type safety across IPC boundary; no silent data loss

### A3: Consolidate Rate Limiting to Single System
- **Files**: `src/utils/rateLimiter.ts`, `src/hooks/useRateLimit.ts`
- **Problem**: Two competing rate limit implementations — `rateLimiter.ts` (token bucket) and `useRateLimit.ts` (hook-based)
- **Work**:
  1. Evaluate both implementations; keep the token bucket (`rateLimiter.ts`) as the core
  2. Refactor `useRateLimit.ts` to be a thin hook wrapper around `rateLimiter.ts`
  3. Remove duplicate logic from `useRateLimit.ts`
  4. Ensure all consumers use the unified system
- **Dependencies**: None
- **Outcome**: Single source of truth for rate limiting; no conflicting behavior

### A4: Route Ollama Model Listing Through Tauri IPC
- **Files**: `src/services/tauriBridge.ts`
- **Problem**: `listOllamaModels()` makes direct HTTP to `localhost:11434` bypassing Tauri IPC — breaks CSP and security model
- **Work**:
  1. Add a Tauri command `list_ollama_models` in a new or existing Rust module
  2. Use `reqwest` on the Rust side to call `http://localhost:11434/api/tags`
  3. Replace direct fetch in `tauriBridge.ts` with `invoke('list_ollama_models')`
  4. Remove `localhost:11434` from CSP connect-src if no longer needed
- **Dependencies**: None
- **Outcome**: All network requests go through Tauri IPC; CSP tightened

### A5: Implement GitHub Star Toggle via API
- **Files**: `src/hooks/useGitHubData.ts`
- **Problem**: `toggleStar` only updates local state — doesn't call GitHub API `PUT /user/starred/{owner}/{repo}` — broken feature
- **Work**:
  1. Add `starRepo(owner, repo)` and `unstarRepo(owner, repo)` functions using GitHub REST API
  2. Use the secure GitHub token (from S1 fix) for authentication
  3. Update `toggleStar` to call the appropriate API endpoint
  4. Handle errors (rate limit, auth failure) gracefully
- **Dependencies**: S1 (needs secure token access)
- **Outcome**: Star/unstar actually persists to GitHub

### A6: Implement Virtual Scrolling in PackageGrid
- **Files**: `src/components/PackageGrid.tsx`
- **Problem**: `react-window` imported but NOT used; PackageGrid uses manual pagination instead — poor performance with large lists
- **Work**:
  1. Replace manual pagination with `FixedSizeList` from `react-window`
  2. Wrap in `AutoSizer` from `react-virtualized-auto-sizer` for responsive sizing
  3. Create a `PackageRow` component that renders a single `PackageCard`
  4. Remove manual page navigation; use infinite scroll or virtual list
  5. Remove `itemsPerPage` from settings if no longer needed
- **Dependencies**: None
- **Outcome**: Smooth scrolling with 1000+ packages; reduced DOM nodes

### A7: Batch GitHub API Calls (N+1 Problem)
- **Files**: `src/components/GitHubPanel.tsx`
- **Problem**: Each repository makes individual API calls — N+1 query pattern
- **Work**:
  1. Use GitHub GraphQL API to fetch multiple repos in a single query
  2. Or batch REST calls using `Promise.all` with rate limiting
  3. Implement request deduplication/caching
- **Dependencies**: S1 (needs secure token access)
- **Outcome**: Reduced API calls; faster GitHub panel loading

### A8: Replace Regex Markdown Parsing with Proper Parser
- **Files**: `src/components/ChatInterface.tsx`
- **Problem**: Fragile regex-based markdown parsing — breaks on edge cases, hard to maintain
- **Work**:
  1. Install `react-markdown` + `remark-gfm` packages
  2. Replace custom regex rendering with `<ReactMarkdown>` component
  3. Add syntax highlighting with `react-syntax-highlighter` for code blocks
  4. Remove all custom markdown regex logic
- **Dependencies**: None
- **Outcome**: Robust markdown rendering; supports GFM tables, strikethrough, etc.

### A9: Complete or Remove Anthropic AI Support
- **Files**: `src/services/aiService.ts` (or backup), `src/types.ts`, `src/stores/slices/settingsSlice.ts`
- **Problem**: Anthropic provider commented out — incomplete feature adds confusion
- **Work**:
  1. Decision: implement fully or remove
  2. If implementing: add Anthropic API integration with proper streaming
  3. If removing: clean up all commented code, remove `anthropic` from provider options in types/settings
  4. Update UI to reflect available providers only
- **Dependencies**: None
- **Outcome**: No dead/incomplete features; clear provider options

### A10: Enhance CartItem with Quantity and Metadata
- **Files**: `src/types.ts`, `src/stores/slices/cartSlice.ts`
- **Problem**: `CartItem` is just a type alias for `WingetPackage` — no quantity field, no cart-specific metadata
- **Work**:
  1. Define `CartItem` as a proper interface: `{ package: WingetPackage; quantity: number; addedAt: number }`
  2. Update `cartSlice.ts` to handle quantity increments/decrements
  3. Update cart UI to show quantities
  4. Add max cart size limit (e.g., 50 items)
- **Dependencies**: None
- **Outcome**: Proper cart with quantity support; bounded size

---

## 🟡 MEDIUM — Data/State Fixes (D1–D7)

### D1: Add Max Limit to Chat Message Storage
- **Files**: `src/stores/slices/chatSlice.ts`
- **Problem**: Unbounded chat message array — memory growth over time
- **Work**:
  1. Add `MAX_CHAT_MESSAGES = 500` constant
  2. In `addMessage` reducer, trim oldest messages when limit exceeded
  3. Add `clearChatHistory` action
- **Dependencies**: None
- **Outcome**: Bounded memory usage for chat

### D2: Use Set/Map for O(1) Cart/Favorites Lookups
- **Files**: `src/stores/slices/cartSlice.ts`, `src/stores/slices/uiSlice.ts` (or favorites location)
- **Problem**: `find()` and `includes()` on arrays — O(n) per lookup
- **Work**:
  1. Maintain a `Set<string>` of cart item IDs alongside the array
  2. Maintain a `Set<string>` of favorite IDs
  3. Use Set for existence checks; array for rendering order
  4. Keep both in sync in add/remove actions
- **Dependencies**: None
- **Outcome**: O(1) lookups for cart/favorites checks

### D3: Add Max Cart/Favorites Size Limits
- **Files**: `src/stores/slices/cartSlice.ts`, `src/stores/slices/uiSlice.ts`
- **Problem**: No upper bound on cart or favorites size
- **Work**:
  1. Add `MAX_CART_SIZE = 50` and `MAX_FAVORITES_SIZE = 200` constants
  2. Enforce in add-to-cart and add-to-favorites actions
  3. Show user-friendly error when limit reached
- **Dependencies**: None
- **Outcome**: Bounded state growth

### D4: Replace setTimeout in handleImport with Proper Async
- **Files**: `src/components/MaintenanceImport.tsx`
- **Problem**: `setTimeout` used for async flow — race condition risk
- **Work**:
  1. Replace `setTimeout` with proper `async/await` or event-driven flow
  2. Use state machine or status tracking for import progress
  3. Ensure import completion is properly awaited before next steps
- **Dependencies**: None
- **Outcome**: No race conditions in import flow

### D5: Replace window.location.reload() with Proper State Reset
- **Files**: `src/App.tsx`, `src/hooks/useAppController.ts`, `src/components/ErrorBoundary.tsx`
- **Problem**: `window.location.reload()` used for state reset — loses all in-memory state, poor UX
- **Work**:
  1. Add a `resetApp()` action to the store that clears all slices
  2. Replace `window.location.reload()` calls with `resetApp()` + re-initialization
  3. In ErrorBoundary, use React error recovery instead of full page reload
- **Dependencies**: None
- **Outcome**: Graceful state reset without full page reload

### D6: Use crypto.randomUUID() for History IDs
- **Files**: `src/stores/slices/uiSlice.ts` (or wherever history IDs are generated)
- **Problem**: `Date.now()-Math.random()` generates non-unique, predictable IDs
- **Work**:
  1. Replace `Date.now() - Math.random()` with `crypto.randomUUID()`
  2. Add fallback for environments without `crypto.randomUUID()` (unlikely in Tauri/Chromium)
- **Dependencies**: None
- **Outcome**: Cryptographically unique, collision-free IDs

### D7: Fix Stale Closure Risks in ScriptDrawer
- **Files**: `src/components/ScriptDrawer.tsx`
- **Problem**: `isCancelled` and `batchOperations` may capture stale values in closures
- **Work**:
  1. Use `useRef` for `isCancelled` instead of state variable
  2. Use functional updates for `batchOperations` state
  3. Add cleanup in `useEffect` return to cancel ongoing operations
  4. Review all async operations for stale closure patterns
- **Dependencies**: None
- **Outcome**: No stale closure bugs during batch operations

---

## 🟡 MEDIUM — Code Quality Fixes (C1–C10)

### C1: Replace eprintln! with tracing Framework
- **Files**: All Rust files (`validation.rs`, `installer_commands.rs`, `winget_commands.rs`, `main.rs`, etc.)
- **Problem**: `eprintln!` used throughout — no log levels, no structured logging, no file output
- **Work**:
  1. Add `tracing` and `tracing-subscriber` to `Cargo.toml`
  2. Initialize tracing subscriber in `main.rs` with file + stdout output
  3. Replace all `eprintln!` with `tracing::info!`, `warn!`, `error!` as appropriate
  4. Add span instrumentation to key functions
- **Dependencies**: None
- **Outcome**: Structured logging with levels; log file for debugging

### C2: Replace confirm()/alert() with Proper UI Dialogs
- **Files**: All React components using `confirm()` or `alert()`
- **Problem**: Browser native dialogs block the main thread, can't be styled, break Tauri UX
- **Work**:
  1. Create a reusable `ConfirmDialog` component
  2. Create a reusable `AlertDialog` component
  3. Replace all `window.confirm()` and `window.alert()` calls
  4. Use Tauri dialog API for native-feeling dialogs where appropriate
- **Dependencies**: None
- **Outcome**: Consistent, styled dialogs; no thread blocking

### C3: Remove console.log/console.error from Production Code
- **Files**: All TypeScript files
- **Problem**: Debug logging left in production code
- **Work**:
  1. Add `eslint-plugin-no-console` or custom rule
  2. Replace `console.log` with a proper logger that can be disabled in production
  3. Create a simple `logger.ts` utility with `debug/info/warn/error` levels
  4. Strip debug logs in production builds via Vite config
- **Dependencies**: None
- **Outcome**: No debug output in production; proper logging utility

### C4: Add Retry Logic for AI API Calls
- **Files**: `src/services/aiService.ts`, `src/services/tauriBridge.ts`
- **Problem**: No retry on transient AI API failures — user sees error immediately
- **Work**:
  1. Implement exponential backoff retry (max 3 attempts)
  2. Retry on 429 (rate limit), 500, 502, 503, 504 status codes
  3. Respect `Retry-After` header
  4. Show retry status to user
- **Dependencies**: None
- **Outcome**: Resilient AI API calls; better UX on transient failures

### C5: Add Streaming for AI Responses
- **Files**: `src/services/aiService.ts`, `src/components/ChatInterface.tsx`
- **Problem**: AI responses fetched as complete text — long wait before any output shown
- **Work**:
  1. Implement SSE/streaming for supported providers (OpenAI, Google, Ollama)
  2. Update `ChatInterface` to render tokens as they arrive
  3. Add a streaming state indicator
  4. Handle stream interruption (user cancels, network error)
- **Dependencies**: None
- **Outcome**: Real-time AI response display; better perceived performance

### C6: Standardize and Version AI Prompts
- **Files**: `src/services/aiService.ts` (or prompt configuration)
- **Problem**: Prompt inconsistency — JSON vs markdown output; no few-shot examples; no versioning
- **Work**:
  1. Create a `prompts/` directory with versioned prompt templates
  2. Standardize output format (JSON for structured data, markdown for chat)
  3. Add few-shot examples to each prompt
  4. Add prompt version tracking for A/B testing
- **Dependencies**: None
- **Outcome**: Consistent, versioned, testable AI prompts

### C7: Fix AI-Simulated Search Returning Hallucinated Packages
- **Files**: `src/services/wingetService.ts`
- **Problem**: When AI can't find real packages, it returns hallucinated package names — user may try to install non-existent packages
- **Work**:
  1. Add a `hallucinated` or `simulated` flag to AI-returned packages
  2. Display a clear warning in UI for AI-suggested packages
  3. Validate AI-returned package IDs against a known package list before displaying
  4. Prefer "no results found" over hallucinated results
- **Dependencies**: None
- **Outcome**: No misleading package suggestions; user trust maintained

### C8: Implement Error Reporting (Replace Sentry Placeholder)
- **Files**: `src/components/ErrorBoundary.tsx`, new `src/services/errorReporting.ts`
- **Problem**: Error reporting is a placeholder — no actual error tracking in production
- **Work**:
  1. Integrate Sentry SDK or implement a custom error reporting endpoint
  2. Capture unhandled errors, React errors, and Rust panics
  3. Add user opt-in for error reporting (privacy)
  4. Include app version, OS, and correlation context
- **Dependencies**: None
- **Outcome**: Production error visibility; faster bug resolution

### C9: Remove Dead Code
- **Files**: Multiple
- **Problem**: Dead code increases bundle size and maintenance burden
- **Work**:
  1. Remove `detectTaskComplexity` function (unused)
  2. Remove `currentIndex` prop (unused)
  3. Remove `aiService.ts.backup` file
  4. Run tree-shaking audit; remove unused exports
  5. Add `tsconfig.json` `noUnusedLocals` and `noUnusedParameters` flags
- **Dependencies**: None
- **Outcome**: Smaller bundle; cleaner codebase

### C10: Deduplicate DEFAULT_THEMES
- **Files**: `src/constants.ts`, `src/hooks/useThemeSync.ts`
- **Problem**: `DEFAULT_THEMES` defined in both `constants.ts` and `useThemeSync.ts`
- **Work**:
  1. Keep single source in `constants.ts`
  2. Import from `constants.ts` in `useThemeSync.ts`
  3. Remove duplicate definition
- **Dependencies**: None
- **Outcome**: Single source of truth for theme defaults

---

## Execution Order

### Phase 1: Critical Security (Week 1)
| Order | Task | Depends On | Estimated Effort |
|-------|------|------------|-------------------|
| 1 | S5: Sanitize package IDs in scripts | — | 2h |
| 2 | S7: Add confirmation for save_script_to_desktop | — | 1h |
| 3 | S4: Add IPv6 private address blocking | — | 1.5h |
| 4 | S3: Add hash verification for installers | — | 3h |
| 5 | S6: Clean up temp files after installation | — | 2h |
| 6 | S1: Move GitHub token to secure storage | — | 3h |
| 7 | S2: Move AI API keys to secure storage | S1 | 2h |

### Phase 2: Architecture (Week 2)
| Order | Task | Depends On | Estimated Effort |
|-------|------|------------|-------------------|
| 8 | A1: Unified PackageManager trait | — | 4h |
| 9 | A2: Align Rust/TS types | — | 2h |
| 10 | A3: Consolidate rate limiting | — | 1.5h |
| 11 | A4: Route Ollama through Tauri IPC | — | 2h |
| 12 | A5: Implement GitHub star API | S1 | 2h |
| 13 | A6: Virtual scrolling in PackageGrid | — | 3h |
| 14 | A8: Replace regex markdown parser | — | 2h |
| 15 | A9: Complete or remove Anthropic | — | 2h |
| 16 | A10: Enhance CartItem type | — | 1.5h |
| 17 | A7: Batch GitHub API calls | S1, A5 | 2h |

### Phase 3: Data/State + Code Quality (Week 3)
| Order | Task | Depends On | Estimated Effort |
|-------|------|------------|-------------------|
| 18 | D1: Max chat message limit | — | 0.5h |
| 19 | D2: Set/Map for cart/favorites | — | 1h |
| 20 | D3: Max cart/favorites size | D2 | 0.5h |
| 21 | D4: Fix setTimeout in handleImport | — | 1h |
| 22 | D5: Replace window.location.reload() | — | 1.5h |
| 23 | D6: Use crypto.randomUUID() | — | 0.5h |
| 24 | D7: Fix stale closures in ScriptDrawer | — | 1.5h |
| 25 | C1: Replace eprintln! with tracing | — | 2h |
| 26 | C2: Replace confirm/alert with dialogs | — | 2h |
| 27 | C3: Remove console.log from production | — | 1h |
| 28 | C4: Add retry logic for AI API | — | 1.5h |
| 29 | C5: Add streaming for AI responses | — | 3h |
| 30 | C6: Standardize AI prompts | — | 1.5h |
| 31 | C7: Fix AI hallucinated packages | — | 1.5h |
| 32 | C8: Implement error reporting | — | 2h |
| 33 | C9: Remove dead code | — | 1h |
| 34 | C10: Deduplicate DEFAULT_THEMES | — | 0.5h |

**Total Estimated Effort: ~56 hours**

---

## Success Criteria

- [ ] All 7 critical security issues resolved
- [ ] All 10 architecture issues resolved
- [ ] All 7 data/state issues resolved
- [ ] All 10 code quality issues resolved
- [ ] No `eprintln!` in Rust code
- [ ] No `console.log` in production TypeScript
- [ ] No `confirm()`/`alert()` in React components
- [ ] All package IDs sanitized before script generation
- [ ] All sensitive tokens in OS credential storage
- [ ] Virtual scrolling working for 1000+ packages
- [ ] Proper markdown rendering in chat
- [ ] Streaming AI responses functional
- [ ] Error reporting active in production
