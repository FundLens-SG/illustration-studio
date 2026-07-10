// Unit tests for the saved-scenario tamper-evidence helpers
// (assets/illustration-integrity.js): the SHA-256 checksum that lets the app
// flag a hand-edited or corrupted saved illustration on load. Previously
// untested inline in the HTML — a _stableStringify regression would make every
// saved file alarm "integrity FAILED" (or mask a real tamper).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadIntegrity } from "./harness.mjs";

const ig = loadIntegrity();

test("attach then verify a fresh payload -> ok", async () => {
  const payload = { settings: { variantKey: "10F5", currency: "SGD" }, annual: [{ year: 1, totalValue: 12345.67 }] };
  await ig.attachIntegrity(payload);
  assert.ok(payload.integrity && payload.integrity.hash, "no integrity block attached");
  assert.equal(payload.integrity.algo, "SHA-256");
  assert.equal(await ig.verifyScenarioIntegrity(payload), "ok");
});

test("a mutated payload verifies as modified", async () => {
  const payload = { settings: { variantKey: "10F5" }, annual: [{ year: 1, totalValue: 100 }] };
  await ig.attachIntegrity(payload);
  payload.annual[0].totalValue = 999; // tamper with a projected value
  assert.equal(await ig.verifyScenarioIntegrity(payload), "modified");
});

test("a payload with no integrity block is unsigned", async () => {
  assert.equal(await ig.verifyScenarioIntegrity({ settings: {} }), "unsigned");
  assert.equal(await ig.verifyScenarioIntegrity({ integrity: {} }), "unsigned");
  assert.equal(await ig.verifyScenarioIntegrity(null), "unsigned");
});

test("stableStringify is key-order independent and drops undefined", () => {
  const a = ig.stableStringify({ b: 1, a: 2, c: [3, { y: 1, x: 2 }] });
  const b = ig.stableStringify({ c: [3, { x: 2, y: 1 }], a: 2, b: 1 });
  assert.equal(a, b);
  assert.equal(ig.stableStringify({ a: 1, b: undefined }), ig.stableStringify({ a: 1 }));
});

test("same data in different key order hashes identically; integrity metadata is excluded", async () => {
  const p1 = { settings: { currency: "SGD", variantKey: "5F1" }, x: [1, 2] };
  const p2 = { x: [1, 2], settings: { variantKey: "5F1", currency: "SGD" } };
  assert.equal(await ig.scenarioHash(p1), await ig.scenarioHash(p2));
  await ig.attachIntegrity(p1);
  // changing signedAt (inside the integrity block, excluded from the hash) must not trip verify
  p1.integrity.signedAt = "2000-01-01T00:00:00.000Z";
  assert.equal(await ig.verifyScenarioIntegrity(p1), "ok");
});
