#!/usr/bin/env node
// Extracts the CHANGELOG.md section for a given version (the body under
// `## [<version>] - <date>`, up to the next `## ` heading) and writes it to a
// file for use as GitHub Release notes.
//
// Usage: node scripts/extract-release-notes.mjs <version> [out-file]
//        (default out-file: release-notes.md)

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const version = process.argv[2];
const outFile = process.argv[3] ?? 'release-notes.md';

if (!version) {
  console.error('usage: node scripts/extract-release-notes.mjs <version> [out-file]');
  process.exit(1);
}

const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
const re = new RegExp(`^## \\[${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\] - [^\\n]*\\n([\\s\\S]*?)(?=^## |\\Z)`, 'm');
const m = changelog.match(re);
if (!m) {
  console.error(`no CHANGELOG.md section found for version ${version}`);
  process.exit(1);
}
const notes = `## ${version}\n\n${m[1].trim()}\n`;
writeFileSync(path.isAbsolute(outFile) ? outFile : path.join(root, outFile), notes);
console.log(`Wrote release notes for ${version} to ${outFile}.`);
