#!/usr/bin/env node
// Verifies every SHA-pinned GitHub Action in .github/workflows is still the
// current release of its pinned major version, and that each pinned SHA still
// matches the version tag it claims (integrity check).
//
// - Resolves tags/branches live via `git ls-remote` (no API rate limits, no
//   token needed, exact peeled commit SHAs).
// - Writes action-pins-stale.txt only when problems exist, then exits 0.
//   The workflow turns a non-empty report into a sticky issue alert.
// - Special-cases dtolnay/rust-toolchain, which is pinned to the moving
//   `stable` branch: stale when the branch head moves past the pin.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const WORKFLOW_DIR = path.join(process.cwd(), '.github', 'workflows');
const REPORT_PATH = path.join(process.cwd(), 'action-pins-stale.txt');

const usesRe = /uses:\s+([\w.-]+\/[\w.-]+)@([0-9a-f]{40})(?:\s*#\s*(.+))?/g;
const semverRe = /^v?(\d+)\.(\d+)\.(\d+)$/;

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// tagName -> peeled commit sha for the given repo, from `git ls-remote --tags`.
function listTags(owner, repo) {
  const out = runGit(['ls-remote', '--tags', `https://github.com/${owner}/${repo}.git`]);
  const peeled = new Map();
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [sha, ref] = line.trim().split('\t');
    const m = ref.match(/^refs\/tags\/(.+)$/);
    if (!m) continue;
    const name = m[1];
    if (name.endsWith('^{}')) {
      // Annotated tag: peeled line is the commit the tag points to.
      peeled.set(name.slice(0, -3), sha);
    } else if (!peeled.has(name)) {
      // Lightweight tag: the tag ref IS the commit.
      peeled.set(name, sha);
    }
  }
  return peeled;
}

// Head commit sha of a branch, or null when the branch doesn't exist.
function branchHead(owner, repo, branch) {
  const out = runGit(['ls-remote', `https://github.com/${owner}/${repo}.git`, `refs/heads/${branch}`]);
  const line = out.trim().split('\n')[0];
  return line ? line.split('\t')[0] : null;
}

function cmpSemver(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

const problems = [];
const report = (msg) => {
  problems.push(msg);
  console.log(`  ⚠ ${msg}`);
};

const files = readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith('.yml'));

for (const file of files) {
  const text = readFileSync(path.join(WORKFLOW_DIR, file), 'utf8');
  const matches = [...text.matchAll(usesRe)];
  if (matches.length === 0) continue;
  console.log(`\n${file}:`);
  for (const m of matches) {
    const [owner, repo] = m[1].split('/');
    const sha = m[2];
    const comment = (m[3] || '').trim();
    const short = sha.slice(0, 12);

    // Moving-branch pin (dtolnay/rust-toolchain@stable).
    if (comment.includes('stable branch')) {
      let current;
      try {
        current = branchHead(owner, repo, 'stable');
      } catch (e) {
        report(`${file}: ${owner}/${repo} — git ls-remote failed: ${e.message.split('\n')[0]}`);
        continue;
      }
      if (!current) {
        report(`${file}: ${owner}/${repo} — stable branch no longer resolves`);
      } else if (current === sha) {
        console.log(`  ${owner}/${repo} stable branch (${short}) current`);
      } else {
        report(`${owner}/${repo}: stable-branch pin ${short} is stale — branch moved to ${current.slice(0, 12)}`);
      }
      continue;
    }

    const ver = comment.match(semverRe);
    if (!ver) {
      report(`${file}: ${owner}/${repo}@${short} — unparseable version comment "${comment}"`);
      continue;
    }
    const [major, minor, patch] = ver.slice(1).map(Number);

    let tags;
    try {
      tags = listTags(owner, repo);
    } catch (e) {
      report(`${file}: ${owner}/${repo} — git ls-remote failed: ${e.message.split('\n')[0]}`);
      continue;
    }

    // Integrity: the pinned SHA must still be the commit behind the claimed tag.
    const claimedTag = `v${major}.${minor}.${patch}`;
    const claimedSha = tags.get(claimedTag);
    if (!claimedSha) {
      report(`${owner}/${repo}: claimed tag ${claimedTag} no longer exists`);
      continue;
    }
    if (claimedSha !== sha) {
      report(`${owner}/${repo}: SHA ${short} no longer matches ${claimedTag} (now ${claimedSha.slice(0, 12)})`);
      continue;
    }

    // Staleness: newer release within the same major?
    let latest = null;
    for (const [name] of tags) {
      const sv = name.match(semverRe);
      if (!sv) continue;
      const v = sv.slice(1).map(Number);
      if (v[0] === major && (!latest || cmpSemver(v, latest) > 0)) latest = v;
    }
    if (latest && cmpSemver([major, minor, patch], latest) < 0) {
      report(`${owner}/${repo}: pin v${major}.${minor}.${patch} (${short}) is stale — latest in v${major} is v${latest.join('.')}`);
    } else {
      console.log(`  ${owner}/${repo} v${major}.${minor}.${patch} (${short}) current`);
    }
  }
}

const unique = [...new Set(problems)];
if (unique.length > 0) {
  writeFileSync(REPORT_PATH, unique.join('\n') + '\n');
  console.log(`\n${unique.length} issue(s) found — wrote ${REPORT_PATH}`);
  process.exit(0); // alerting is the workflow's job; keep the job green
}
// A previous run may have left a report behind; a clean run must clear it so
// the workflow's hashFiles() gate doesn't alert on stale data.
try {
  unlinkSync(REPORT_PATH);
  console.log(`\nRemoved stale ${REPORT_PATH} from a previous run.`);
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
console.log('\nAll action pins are current.');
