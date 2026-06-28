// Golden-master regression: freezes the current output fingerprint of
// every engine across a representative scenario matrix. A change to any
// projected value fails the test — so a sync can't silently ship a
// number-changing regression. Intentional model changes are re-baselined
// with: UPDATE_SNAPSHOTS=1 node --test
//
// This is the CI safety net. It is NOT a claim that the numbers are
// independently correct — that's the validation layer (validation.test.mjs)
// and data provenance (out of scope here).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadModel } from "./harness.mjs";
import { buildScenarios, fingerprint } from "./scenarios.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const snapDir = resolve(here, "snapshots");
const snapFile = resolve(snapDir, "engines.json");
const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";

const model = loadModel();
const scenarios = buildScenarios();

const current = {};
for (const sc of scenarios) {
  current[sc.name] = fingerprint(model.simulate(sc.settings, sc.strategy, "custom"));
}

if (UPDATE || !existsSync(snapFile)) {
  if (!existsSync(snapDir)) mkdirSync(snapDir, { recursive: true });
  writeFileSync(snapFile, JSON.stringify(current, null, 2) + "\n", "utf8");
  console.log(`[regression] wrote baseline for ${Object.keys(current).length} scenarios -> snapshots/engines.json`);
}

const baseline = JSON.parse(readFileSync(snapFile, "utf8"));

// Compare canonical JSON, not object identity: the fingerprint is already
// rounded + deterministic (proven across repeated runs), and serialized
// form is the right granularity for a financial golden master — it
// ignores in-memory-only distinctions like +0 vs -0 that JSON collapses
// anyway, while still failing on any real change to a projected value.
const canon = (v) => JSON.stringify(v);

test("every scenario has a frozen baseline", () => {
  const missing = Object.keys(current).filter((k) => !(k in baseline));
  assert.deepEqual(missing, [], `scenarios without a baseline (run UPDATE_SNAPSHOTS=1): ${missing.join(", ")}`);
});

for (const sc of scenarios) {
  test(`regression — ${sc.name}`, () => {
    assert.equal(
      canon(current[sc.name]),
      canon(baseline[sc.name]),
      `${sc.name} output changed vs baseline. If intentional, re-baseline with UPDATE_SNAPSHOTS=1.`
    );
  });
}
