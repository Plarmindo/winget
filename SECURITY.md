# Security Policy

## Reporting a Vulnerability

Please report suspected security vulnerabilities privately so they can be
assessed and fixed before public disclosure.

**Preferred channel:** open a private vulnerability report via the GitHub
Security tab — [Report a vulnerability](https://github.com/Plarmindo/winget/security/advisories/new).
This works on private repositories and gives maintainers a confidential
thread to coordinate a fix.

**Fallback:** if private vulnerability reporting is disabled, open a GitHub
issue with a `security` label, or contact the maintainers directly.

When reporting, please include:

- The affected component (frontend / Rust backend / AI service layer) and
  approximate version (see `package.json` / `src-tauri/tauri.conf.json`).
- A minimal reproduction: steps, inputs, and expected vs. actual behavior.
- If known, the impact (e.g. command injection, secret exposure, RCE) and any
  suggested fix.

Do **not** file public issues, open PRs, or post details to public channels
before a fix is released.

## Supported Versions

Security fixes are backported only to the **latest stable release line**.
Older releases are not supported; users are strongly encouraged to stay on the
newest release.

| Version | Supported |
|---------|-----------|
| 1.5.x (latest) | ✅ Receives security fixes |
| < 1.5 | ❌ No longer supported |

## Disclosure Policy

- **Acknowledgment:** reports are acknowledged within 3 business days.
- **Assessment:** a triage assessment is provided within 7 business days.
- **Fix window:** for high/critical issues, we aim for a fix within 30 days of
  confirmation; moderate/low issues are fixed on the normal release cadence.
- **Coordinated disclosure:** we practice responsible disclosure — a
  vulnerability is publicly disclosed only after a fixed release is available,
  or after 90 days from confirmation if a fix is not yet possible. Reporters
  are credited (if they wish) in the release notes.

## Security Notes for This Project

- This application can execute package-manager commands (`winget`, etc.) and
  generate install scripts. Treat it as a privileged system tool: run it only
  with manifests, sources, and AI providers you trust.
- AI API keys are stored via the OS secure store in desktop mode and never in
  source control.
- When extending the backend, keep the rules from `AGENTS.md` in mind:
  validate all user input in Rust, sanitize package IDs before passing them to
  package managers, and never expose API keys in frontend code.
