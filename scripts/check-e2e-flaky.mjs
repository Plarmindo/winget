#!/usr/bin/env node
// Fails CI when Playwright reports any test as flaky (i.e. it passed only after
// a retry), so flakiness is surfaced instead of silently self-healed by retries.
// Reads the JSON report emitted by `playwright test --reporter=json:...`.
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const reportPath = path.join(process.cwd(), 'test-results', 'e2e-results.json');
// Stable artifact read by the CI PR-comment step. Written when flakiness is
// detected (before exiting 1); removed on a clean run so it never goes stale.
const flakyReportPath = path.join(process.cwd(), 'test-results', 'flaky-tests.txt');

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (error) {
  console.error(`[flake-check] Cannot read Playwright JSON report at ${reportPath}: ${error.message}`);
  console.error('[flake-check] Run the e2e suite with --reporter=json:test-results/e2e-results.json first.');
  process.exit(2);
}

const flakyCount = report?.stats?.flaky ?? 0;
if (flakyCount === 0) {
  // Remove any stale report from an earlier flaky run so the artifact stays honest.
  try {
    unlinkSync(flakyReportPath);
  } catch {
    // No stale report; nothing to clean up.
  }
  console.log('[flake-check] OK: no flaky tests.');
  process.exit(0);
}

// Collect the names of the flaky tests for the failure message.
const flaky = [];
const collectFlaky = (suites) => {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status === 'flaky') {
          flaky.push(`${test.projectName} › ${suite.title} › ${spec.title}`);
        }
      }
    }
    collectFlaky(suite.suites);
  }
};
collectFlaky(report.suites);

console.error(`[flake-check] FAIL: ${flakyCount} test(s) passed only after a retry (flaky):`);
for (const name of flaky) console.error(`  - ${name}`);
if (flaky.length < flakyCount) {
  console.error(`[flake-check] (listed ${flaky.length} of ${flakyCount} — report structure may have changed)`);
}

// Persist the list so the CI PR-comment step can read it (see ci.yml).
writeFileSync(flakyReportPath, flaky.join('\n') + '\n');
console.error(`[flake-check] Wrote ${flakyReportPath} for the PR comment.`);
console.error('[flake-check] Flakiness is surfaced on purpose: fix the root cause, do not rely on retries.');
process.exit(1);
