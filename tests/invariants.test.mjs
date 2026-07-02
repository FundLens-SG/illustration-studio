// Property/invariant tests — assert things that must hold for EVERY
// scenario regardless of inputs, so a malformed projection can never
// reach the DOM in front of a client.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModel, findNonFinite } from "./harness.mjs";
import { buildScenarios } from "./scenarios.mjs";

const model = loadModel();
const scenarios = buildScenarios();

for (const sc of scenarios) {
  const result = model.simulate(sc.settings, sc.strategy, "custom");
  const annual = result.annual || [];

  test(`no NaN/Infinity reaches outputs — ${sc.name}`, () => {
    const bad = findNonFinite(result);
    assert.deepEqual(bad.slice(0, 8), [], `non-finite values: ${bad.slice(0, 8).join("; ")}`);
  });

  test(`produces projection rows — ${sc.name}`, () => {
    // RRP scenarios may be intentionally blocked; only assert rows when valid.
    if (result.rrpSummary && result.rrpSummary.valid === false) return;
    assert.ok(annual.length > 0, "expected at least one annual row");
  });

  test(`premiums never negative — ${sc.name}`, () => {
    for (const row of annual) {
      for (const k of ["premiums", "rrpPremiumPaid", "totalBasicPaid"]) {
        if (k in row) assert.ok(Number(row[k]) >= -0.005, `${k} negative: ${row[k]}`);
      }
    }
  });

  test(`IRR within sane bounds — ${sc.name}`, () => {
    for (const k of ["irr300", "irr425"]) {
      const v = result.final ? result.final[k] : undefined;
      if (v === undefined || v === null) continue;
      assert.ok(Number.isFinite(v), `${k} not finite: ${v}`);
      assert.ok(v > -1 && v < 1, `${k} out of [-100%,+100%]: ${v}`);
    }
    for (const row of annual) {
      if (!("siiNetIrr" in row) || row.siiNetIrr === null || row.siiNetIrr === undefined) continue;
      assert.ok(Number.isFinite(row.siiNetIrr), `siiNetIrr not finite: ${row.siiNetIrr}`);
      assert.ok(row.siiNetIrr > -1 && row.siiNetIrr < 1, `siiNetIrr out of [-100%,+100%]: ${row.siiNetIrr}`);
    }
  });

  if (sc.kind === "par-wl") {
    test(`surrender value never negative — ${sc.name}`, () => {
      for (const row of annual) {
        assert.ok(Number(row.surrenderValue || 0) >= -0.5, `surrender value negative: ${row.surrenderValue}`);
      }
    });
  }

  if (sc.kind === "rrp" && !(result.rrpSummary && result.rrpSummary.valid === false)) {
    test(`cumulative income is monotonic non-decreasing — ${sc.name}`, () => {
      let prev = -Infinity;
      for (const row of annual) {
        const c = Number(row.rrpCumulativeTotalIncome425 || 0);
        assert.ok(c >= prev - 0.005, `cumulative income dropped: ${prev} -> ${c} at age ${row.age}`);
        prev = c;
      }
    });
  }
}
