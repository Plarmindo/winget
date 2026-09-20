#!/usr/bin/env node
// Bumps the app version across all manifests, keeping package.json as the
// single source of truth:
//
//   - package.json          (npm; the canonical version)
//   - package-lock.json     (top-level version + root packages[""].version,
//                            so `npm ci` stays consistent)
//   - src-tauri/Cargo.toml   ([package] version; cargo cannot read JSON, so
//                            this is the one literal that must be kept in sync —
//                            guarded by build.rs and scripts/check-version-sync.mjs)
//
// tauri.conf.json is deliberately NOT touched: it reads the version from
// package.json via `"version": "../package.json"`.
//
// Usage: node scripts/bump-version.mjs <new-version>
// Exits non-zero on invalid/missing semver or when the version does not change.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const newVersion = process.argv[2];

if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(`usage: node scripts/bump-version.mjs <semver>  (got ${JSON.stringify(newVersion)})`);
  process.exit(1);
}

// --- package.json ---
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (pkg.version === newVersion) {
  console.error(`version is already ${newVersion} — nothing to bump.`);
  process.exit(1);
}
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// --- package-lock.json ---
const lockPath = path.join(root, 'package-lock.json');
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
if (lock.version) lock.version = newVersion;
if (lock.packages?.['']?.version) lock.packages[''].version = newVersion;
writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');

// --- src-tauri/Cargo.toml ([package] version only) ---
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
const cargo = readFileSync(cargoPath, 'utf8');
if (!cargo.includes('[package]')) {
  console.error('src-tauri/Cargo.toml has no [package] section');
  process.exit(1);
}
const updatedCargo = cargo.replace(
  /^(version\s*=\s*")[^"]+(")/m,
  `$1${newVersion}$2`
);
if (updatedCargo === cargo) {
  console.error('could not locate the [package] version line in src-tauri/Cargo.toml');
  process.exit(1);
}
writeFileSync(cargoPath, updatedCargo);

console.log(`Bumped version to ${newVersion} in package.json, package-lock.json, and src-tauri/Cargo.toml.`);
console.log('tauri.conf.json reads ../package.json — no change needed there.');
