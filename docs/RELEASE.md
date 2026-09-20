# Release Process

This project ships through an automated release train (`.github/workflows/release.yml`). A single manual dispatch bumps the version everywhere, generates the changelog from commits, opens a reviewable PR, and — once merged — tags the commit and publishes the Windows installers to a GitHub Release.

> **Prerequisite:** the release workflow depends on the single-source-of-version refactor (`tauri.conf.json` reads `../package.json`, `npm run version:check` exists) and the Keep-a-Changelog conventions. Those must be merged to `main` before dispatching.

---

## The three-stage flow

```
  You dispatch:  version: 1.6.0
        │
        ▼
┌─────────────────────────┐
│ Stage 1 — Prepare       │  workflow_dispatch
│   bump-version.mjs      │  ubuntu-latest
│   generate-changelog    │
│   version:check         │
│   commit → release/… PR │
└─────────────────────────┘
        │  human review + merge
        ▼
┌─────────────────────────┐
│ Stage 2 — Tag           │  pull_request (closed, merged)
│   tag merge commit      │  ubuntu-latest
│   vX.Y.Z → git push     │
└─────────────────────────┘
        │  tag push
        ▼
┌─────────────────────────┐
│ Stage 3 — Publish       │  push (tag v*)
│   npm run tauri build   │  windows-latest
│   extract-release-notes │
│   gh release create     │
└─────────────────────────┘
        │
        ▼
  GitHub Release: v1.6.0 + NSIS/MSI installers
```

### Stage 1 — Prepare (`workflow_dispatch`)

Triggered manually with one input: `version` (bare semver, e.g. `1.6.0` — no `v` prefix). The job:

1. **Validates the version** — must match `X.Y.Z` and must not already exist as a `vX.Y.Z` tag (a version can never be released twice).
2. **Bumps all manifests** — `node scripts/bump-version.mjs <ver>`:
   - `package.json` — the canonical version
   - `package-lock.json` — top-level `version` **and** the root `packages[""].version` entry, so `npm ci` stays consistent
   - `src-tauri/Cargo.toml` — the one literal copy cargo requires (guarded elsewhere by `build.rs` and `version:check`)
   - `tauri.conf.json` is deliberately **not** touched — it already reads the version from `../package.json`.
3. **Generates the changelog** — `node scripts/generate-changelog.mjs <ver>` builds a Keep-a-Changelog section from conventional commits since the last `v*` tag (`feat → Added`, `fix → Fixed`, `security → Security`, everything else → `Changed`; merge and `chore(release)` commits skipped). If a curated `[Unreleased]` section exists at the top of `CHANGELOG.md`, it becomes the release section verbatim — the human-written summary wins over the raw commit dump.
4. **Verifies consistency** — `npm run version:check` fails the job if any manifest drifted.
5. **Opens the release PR** — commits the four files (`package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `CHANGELOG.md`) to a fresh `release/<version>` branch and opens a PR against `main`.

The job cannot push to `main` directly: branch protection requires a review and green checks, so the release always passes through a human gate.

### Stage 2 — Tag (`pull_request` closed + merged)

When a PR whose head branch is `release/*` is **merged** to `main`, the workflow tags the merge commit with an annotated `vX.Y.Z` tag and pushes it. The guard `merged == true` means closing a release PR *without* merging does nothing.

### Stage 3 — Publish (`push` of a `v*` tag)

On a Windows runner:

1. `npm ci` + `npm run tauri build` (rust-cached) produce the NSIS (`.exe`) and WiX MSI (`.msi`) installers under `src-tauri/target/release/bundle/`.
2. The job fails loudly if no installer artifacts are found.
3. The frontend bundle is packaged into `winget-system-manager-web-<version>.zip` (a `dist/` copy for web-mode deployments).
4. A `SHA256SUMS-<version>.txt` file is generated, listing a clean relative hash for every installer artifact **and** the web bundle.
5. The checksums file is **GPG-signed** with the release key, producing `SHA256SUMS-<version>.txt.asc` (see [Release signing key](#release-signing-key)). The job refuses to publish an unsigned release if the signing secret is missing.
6. `node scripts/extract-release-notes.mjs <ver> release-notes.md` pulls the matching `## [<ver>] - <date>` section out of `CHANGELOG.md` — the job fails if that section is missing — and appends the hashes to the release notes.
7. `gh release create vX.Y.Z` publishes the release with the installers, the web bundle, the `SHA256SUMS-<version>.txt` file, **and** its `.asc` signature.

---

## How to dispatch a release

### From the GitHub UI

1. Make sure `main` is green and that the changelog conventions + `version:check` (single-source-of-version) are on `main`.
2. **Actions → Release → Run workflow**.
3. Enter the new version (e.g. `1.6.0`) and click **Run workflow**.
4. Watch the **Prepare release** job. When it finishes it opens a PR titled `chore(release): v1.6.0`.
5. Review the PR (see checklist below), then merge it.
6. Stage 2 tags the merge commit automatically; Stage 3 builds and publishes. Watch the **Publish installer** job on the tag push.
7. Verify the release under **Releases** — title `v1.6.0`, notes from the changelog, the `.exe`/`.msi` artifacts, the `winget-system-manager-web-1.6.0.zip` bundle, and the `SHA256SUMS-1.6.0.txt` file with its `.asc` signature attached.

**Verifying a downloaded artifact:** download the artifact and its `SHA256SUMS-<version>.txt` into the same folder, then run `sha256sum -c SHA256SUMS-<version>.txt` (or `Get-FileHash <artifact> -Algorithm SHA256` on PowerShell and compare against the listed hash).

**Verifying the signature:** import the release key from the repo and check the detached signature against the checksums file:

```bash
gpg --import release-key.asc
gpg --verify SHA256SUMS-<version>.txt.asc SHA256SUMS-<version>.txt
```

A `Good signature` line (matching the fingerprint below) means the checksums file is genuinely from this project — you can then trust `sha256sum -c` on the artifacts it lists.

### From the CLI

```bash
gh workflow run release.yml -f version=1.6.0
gh run watch            # follow the prepare job
gh pr list --head release/1.6.0
```

### Manual fallback

If GitHub Actions is unavailable, the same steps run by hand:

```bash
node scripts/bump-version.mjs 1.6.0
node scripts/generate-changelog.mjs 1.6.0
npm run version:check
git diff                # review exactly the four files
# commit, push branch, open PR, get review, merge
git tag -a v1.6.0 -m "Release v1.6.0" <merge-commit-sha>
git push origin v1.6.0  # or build locally and publish manually:
# npm run tauri build
# node scripts/extract-release-notes.mjs 1.6.0 release-notes.md
# Compress-Archive -Path dist -DestinationPath winget-system-manager-web-1.6.0.zip
# ( cd src-tauri/target/release/bundle/nsis && sha256sum *.exe ) > SHA256SUMS-1.6.0.txt
# ( cd src-tauri/target/release/bundle/msi && sha256sum *.msi ) >> SHA256SUMS-1.6.0.txt
# sha256sum winget-system-manager-web-1.6.0.zip >> SHA256SUMS-1.6.0.txt
# gpg --batch --detach-sign --armor -o SHA256SUMS-1.6.0.txt.asc SHA256SUMS-1.6.0.txt
# gh release create v1.6.0 --notes-file release-notes.md src-tauri/target/release/bundle/nsis/*.exe src-tauri/target/release/bundle/msi/*.msi winget-system-manager-web-1.6.0.zip SHA256SUMS-1.6.0.txt SHA256SUMS-1.6.0.txt.asc
```

---

## Release signing key

Every release's `SHA256SUMS-<version>.txt` is signed with the **WinGet System Manager Releases** key, so users can verify that the checksums came from this project — not just that they match the download.

- **Public key:** `release-key.asc` at the repository root
- **Fingerprint:** `7264 1CDD A8A5 E56B D0A3 B145 9F18 448D 65F4 3555`
- **Signature:** `SHA256SUMS-<version>.txt.asc` — an ASCII-armored detached signature attached to every release

**How it works in the pipeline:** the publish job imports the private key from the `RELEASE_GPG_PRIVATE_KEY` repository secret into a throwaway keyring, detach-signs the checksums file, and attaches both files to the release. If the secret is missing, the job **fails** — unsigned releases are never published.

**Operators:** the private key lives only in GitHub secrets (encrypted at rest), never in the repo. To rotate the key, generate a new pair, commit the public half as `release-key.asc`, and store the private half as the `RELEASE_GPG_PRIVATE_KEY` secret (plus `RELEASE_GPG_PASSPHRASE` if the key is passphrase-protected).

---

## Reviewer checklist for a release PR

A release PR is small and mechanical; verify these before approving:

- [ ] **Exactly four files changed**: `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `CHANGELOG.md`. `tauri.conf.json` must **not** appear (it reads `../package.json`).
- [ ] **Version consistency**: the same `X.Y.Z` in `package.json`, both `package-lock.json` version fields (top-level and `packages[""]`), and `Cargo.toml` `[package]`.
- [ ] **Semver correctness**: the bumped version matches the dispatch input and the change magnitude — breaking → major, new feature → minor, bug fix → patch (project is on 1.x, so a breaking change means `2.0.0`).
- [ ] **Changelog section**: heading is `## [X.Y.Z] - YYYY-MM-DD` with today's date; grouped under `### Added / Fixed / Security / Changed`; entries are user-meaningful sentences, not raw commit subjects; nothing fabricated (the changelog must match git history). If a curated `[Unreleased]` section was folded in, review those human-written lines; otherwise sanity-check the generated list.
- [ ] **Lockfile noise**: `package-lock.json` shows only the two version-field bumps — no dependency churn.
- [ ] **Checks green**: the prepare job's `version:check` step passed, and the standard CI gates (frontend, backend, e2e) pass on the PR. Do not merge with a failed check.
- [ ] **Diff review**: `git diff main...release/X.Y.Z` shows exactly the bump — no stray commits.

**After merge** (Stage 2/3 run automatically):

- [ ] A `vX.Y.Z` tag exists on the merge commit (`git ls-remote --tags origin vX.Y.Z`).
- [ ] The **Publish installer** job succeeded and the GitHub Release `vX.Y.Z` shows the changelog notes, the `.exe`/`.msi` artifacts, the `winget-system-manager-web-<version>.zip` bundle, and the `SHA256SUMS-<version>.txt` file **with its `.asc` signature** (hashes and signing fingerprint are also printed in the job log).

---

## Scripts reference

| Script | Purpose |
|---|---|
| `scripts/bump-version.mjs <ver>` | Bumps `package.json`, `package-lock.json`, `src-tauri/Cargo.toml` from the single source of truth |
| `scripts/generate-changelog.mjs <ver>` | Builds a Keep-a-Changelog section from conventional commits since the last `v*` tag; folds a curated `[Unreleased]` section if present |
| `scripts/extract-release-notes.mjs <ver> [out]` | Extracts the version's changelog section for GitHub Release notes; fails if the section is missing |
| `npm run version:check` | Fails on any drift between the three version manifests (runs `scripts/check-version-sync.mjs`) |

## Gotchas

- **A version can only be released once.** The prepare job rejects a version whose `vX.Y.Z` tag already exists — hotfixes bump the patch, never re-release.
- **Stage 2 only fires on merged `release/*` PRs.** Closing without merging (or merging a non-release branch) does nothing.
- **Installers are Windows-only.** The publish job runs on `windows-latest`; the installers are NSIS (`.exe`) and WiX (`.msi`).
- **Release notes come from `CHANGELOG.md`.** If the publish job fails with "no CHANGELOG.md section found", the release section is missing or mis-titled — fix the changelog and re-run the job (the tag already exists, so re-run the **publish** job, not the whole workflow).
- **Every release ships a `SHA256SUMS-<version>.txt` file.** The publish job generates it from the same artifact list it uploads, so the hashes always match what's attached — installers *and* the `winget-system-manager-web-<version>.zip` web bundle. Verify downloaded binaries with `sha256sum -c` — the SUMS file uses clean relative filenames, so keep the artifact and the SUMS file in the same folder.
- **Releases are signed or they don't ship.** The publish job requires the `RELEASE_GPG_PRIVATE_KEY` secret and fails if it's missing — an unsigned checksums file would defeat the point of verification. Set the secret (and `RELEASE_GPG_PASSPHRASE` if the key has one) before your first release.
- **Keep `CHANGELOG.md` truthful.** The changelog is the release's public record; entries must correspond to real commits. If you need to tweak an entry, do it in the release PR *before* merging.
