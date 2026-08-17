#!/usr/bin/env node
// Fails CI when Playwright reports any test as flaky (i.e. it passed only after
// a retry), so flakiness is surfaced instead of silently self-healed by retries.
// Reads the JSON report emitted by `playwright test --reporter=json:...`.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const reportPath = path.join(process.cwd(), 'test-results', 'e2e-results.json');

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
console.error('[flake-check] Flakiness is surfaced on purpose: fix the root cause, do not rely on retries.');
process.exit(1);
