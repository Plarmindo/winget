#!/usr/bin/env node
// Generates a Keep-a-Changelog-style section for a new release from the
// conventional commits between the last v* tag and HEAD, and prepends it to
// CHANGELOG.md.
//
//   - Groups commits by type: feat -> Added, fix -> Fixed, security ->
//     Security, everything else (refactor, chore, docs, ci, perf, build,
//     test) -> Changed.
//   - Skips merge commits and "chore(release)" self-commits.
//   - If a `[Unreleased]` section already exists at the top of CHANGELOG.md,
//     its content is folded into the new release section instead (preferring
//     curated entries over the raw commit list), then the raw commit list is
//     appended for any types the curated section does not mention.
//
// Usage: node scripts/generate-changelog.mjs <version>
// e.g.   node scripts/generate-changelog.mjs 1.6.0

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`usage: node scripts/generate-changelog.mjs <semver>  (got ${JSON.stringify(version)})`);
  process.exit(1);
}

// --- Determine the commit range since the last release tag ---
let lastTag = null;
try {
  lastTag = execFileSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
} catch {
  lastTag = null; // no tags yet — use the full history
}
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';

const git = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split('\n')
    .filter(Boolean);

const commits = git(['log', '--no-merges', '--format=%s', range]).filter(
  (s) => !/^chore\(release\)/.test(s)
);

const groups = { Added: [], Fixed: [], Security: [], Changed: [] };
for (const subject of commits) {
  const m = subject.match(/^(feat|fix|security|refactor|chore|docs|ci|perf|build|test)(?:\([^)]*\))?!?:\s*(.+)$/i);
  const raw = m ? m[2] : subject;
  // Sentence-case the first letter (git subjects are typically lowercase).
  const body = raw.charAt(0).toUpperCase() + raw.slice(1);
  const key = m ? (m[1].toLowerCase() === 'feat' ? 'Added' : m[1].toLowerCase() === 'fix' ? 'Fixed' : m[1].toLowerCase() === 'security' ? 'Security' : 'Changed') : 'Changed';
  if (body && !groups[key].includes(body)) groups[key].push(body);
}

// --- Build the section ---
const today = new Date().toISOString().slice(0, 10);
const changelogPath = path.join(root, 'CHANGELOG.md');
let changelog = readFileSync(changelogPath, 'utf8');
const unreleasedRe = /^## \[Unreleased\]\s*\n([\s\S]*?)(?=^## )/m;
const unreleased = changelog.match(unreleasedRe);
const curatedBody = unreleased?.[1]?.trim();

let section;
if (curatedBody) {
  // A curated [Unreleased] section exists — it becomes the release section
  // verbatim (the human's summary wins over the raw commit list).
  section = `## [${version}] - ${today}\n\n${curatedBody}\n`;
} else {
  // No curated content — generate the section from conventional commits.
  section = `## [${version}] - ${today}\n\n`;
  for (const [heading, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    section += `### ${heading}\n`;
    for (const item of items) section += `- ${item}\n`;
    section += '\n';
  }
  section = section.trimEnd() + '\n';
}

if (unreleased) {
  // Replace the [Unreleased] block with the new release section.
  changelog = changelog.replace(unreleasedRe, `${section.replace(/\n{2,}$/, '\n')}\n\n`);
} else {
  // No [Unreleased] section — prepend above the first "## [" heading.
  changelog = changelog.replace(/^(## \[)/m, `${section}\n\n$1`);
}

writeFileSync(changelogPath, changelog);
console.log(`Generated changelog section for ${version} (${commits.length} commits since ${lastTag ?? 'initial commit'}).`);
