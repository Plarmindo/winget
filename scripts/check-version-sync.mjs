#!/usr/bin/env node
// Verifies the app version is consistent across its three manifests, with
// package.json as the single source of truth:
//
//   1. package.json      — the canonical version (npm, Vite `define` for the
//                          About tab badge, and tauri.conf.json's version).
//   2. tauri.conf.json   — must read the version from package.json via the
//                          `"version": "../package.json"` path reference.
//   3. Cargo.toml        — cargo cannot reference JSON, so its literal must
//                          match package.json. (src-tauri/build.rs also guards
//                          this at compile time; this script catches drift in
//                          the frontend job, before the Rust build.)
//
// Exits non-zero with a clear message on any mismatch, so CI fails fast.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
  errors.push(`package.json version "${version}" is not a semver like 1.2.3`);
}

const tauri = JSON.parse(readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));
if (tauri.version !== '../package.json') {
  errors.push(
    `tauri.conf.json version is ${JSON.stringify(tauri.version)} — expected "../package.json" ` +
      'so the app version is read from package.json (the single source of truth)'
  );
}

const cargoToml = readFileSync(path.join(root, 'src-tauri', 'Cargo.toml'), 'utf8');
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
if (cargoVersion !== version) {
  errors.push(
    `version mismatch: Cargo.toml is ${JSON.stringify(cargoVersion)} but package.json is ${JSON.stringify(version)}. ` +
      'Update src-tauri/Cargo.toml to match (or run `npm version <new>` and sync).'
  );
}

if (errors.length > 0) {
  console.error(`Version consistency check failed:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
console.log(`Version consistency OK — all manifests read ${version} from package.json.`);
