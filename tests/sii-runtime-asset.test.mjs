// Gates the slim asset the browser actually loads (assets/sii-rates-runtime.js)
// against the full archive (assets/sii-rates.js). The rest of the suite loads
// the full asset via harness.mjs, so without this the shipped page could run on
// a stale or divergent runtime asset while every other test stays green.
//
// Freshness: the committed runtime asset must deep-equal a fresh slim of the
// current full asset. Parity: the model must run on the runtime asset alone,
// proving the keep-list covers every field the engine reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import {
  repoRoot, loadRates, buildRuntimePayload, loadModelWith, MAX_RUNTIME_BYTES,
} from "../scripts/build-sii-runtime-asset.mjs";

const fullPath = resolve(repoRoot, "assets", "sii-rates.js");
const runtimePath = resolve(repoRoot, "assets", "sii-rates-runtime.js");

const fullRates = loadRates(fullPath);
const runtimeRates = loadRates(runtimePath);

// loadRates parses each asset inside its own vm realm, so the objects carry
// per-context prototypes; compare data, not realm identity.
const norm = (o) => JSON.parse(JSON.stringify(o));

test("runtime asset is fresh — equals a slim of the current full archive", () => {
  assert.deepEqual(norm(runtimeRates), norm(buildRuntimePayload(fullRates)),
    "assets/sii-rates-runtime.js is stale; rerun scripts/build-sii-runtime-asset.mjs");
});

test("runtime asset scenariosSha256 matches the full archive", () => {
  assert.equal(runtimeRates.scenariosSha256, fullRates.scenariosSha256);
});

test("runtime asset stays within the browser byte budget", () => {
  const bytes = statSync(runtimePath).size;
  assert.ok(bytes <= MAX_RUNTIME_BYTES, `runtime asset is ${bytes} bytes (> ${MAX_RUNTIME_BYTES})`);
});

test("model runs on the runtime asset alone — keep-list is sufficient", () => {
  const model = loadModelWith(runtimePath);
  const s = model.simulate({
    variantKey: "SII", currency: "USD", paymentFrequency: "Annual",
    startAge: 46, siiAge: 46, siiPremiumTerm: "single", siiIncomeStartYear: 4,
    siiInputMode: "premium", siiAnnualPlannedPremium: 100000, siiTotalPlannedPremium: 100000,
  }, "none", "custom").siiSummary || {};
  assert.equal(s.valid, true, (s.blockers || []).join("; "));
  assert.equal(s.method, "source_exact");
});
