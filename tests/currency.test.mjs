// Unit tests for the cross-currency / comparison-total helpers
// (assets/illustration-fx.js) that decide the client-facing number shown in
// the comparison hero, charts, tooltips and annual-table compare column when a
// USD-native product (SLH/SII) is compared against an SGD-native one
// (IRG/SLR/SI3/RRP). These are pure and were previously untested inline in the
// HTML.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFx } from "./harness.mjs";

const fx = loadFx();
const RATE = 1.36; // SGD per 1 USD

test("fxConvert: USD->SGD multiplies, SGD->USD divides, round-trips", () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
  near(fx.fxConvert(100, "USD", "SGD", RATE), 136);
  near(fx.fxConvert(136, "SGD", "USD", RATE), 100);
  const round = fx.fxConvert(fx.fxConvert(250000, "USD", "SGD", RATE), "SGD", "USD", RATE);
  near(round, 250000);
});

test("fxConvert: no-op when currencies match or amount/rate is unusable", () => {
  assert.equal(fx.fxConvert(500, "SGD", "SGD", RATE), 500);
  assert.equal(fx.fxConvert(500, "USD", "SGD", 0), 500);
  assert.equal(fx.fxConvert(500, "USD", "SGD", NaN), 500);
  assert.equal(fx.fxConvert(500, "USD", "SGD", -1), 500);
  assert.ok(Number.isNaN(fx.fxConvert(NaN, "USD", "SGD", RATE)));
});

test("fxConvert: unsupported currency pair warns and returns unconverted", () => {
  const orig = console.warn;
  let warned = "";
  console.warn = (msg) => { warned = String(msg); };
  try {
    assert.equal(fx.fxConvert(100, "EUR", "SGD", RATE), 100);
  } finally {
    console.warn = orig;
  }
  assert.match(warned, /unsupported currency pair EUR->SGD/);
});

test("comparisonDisplayCurrency: SGD default cross-currency, shared otherwise, toggle wins", () => {
  assert.equal(fx.comparisonDisplayCurrency("USD", "SGD"), "SGD");   // cross -> SGD
  assert.equal(fx.comparisonDisplayCurrency("SGD", "USD"), "SGD");
  assert.equal(fx.comparisonDisplayCurrency("USD", "USD"), "USD");   // shared kept
  assert.equal(fx.comparisonDisplayCurrency("SGD", "SGD"), "SGD");
  assert.equal(fx.comparisonDisplayCurrency("USD", "SGD", "USD"), "USD"); // toggle wins
  assert.equal(fx.comparisonDisplayCurrency("USD", "USD", "SGD"), "SGD");
  assert.equal(fx.comparisonDisplayCurrency("USD", "SGD", "bogus"), "SGD"); // invalid choice ignored
});

test("variantNativeCurrency: single-currency variant ignores the inherited currency", () => {
  // SGD-only variant computed with an inherited USD settings.currency -> SGD
  const sgdOnly = { variant: { currencies: ["SGD"] }, settings: { currency: "USD" } };
  assert.equal(fx.variantNativeCurrency(sgdOnly), "SGD");
  // USD-only variant -> USD regardless
  const usdOnly = { variant: { currencies: ["USD"] }, settings: { currency: "SGD" } };
  assert.equal(fx.variantNativeCurrency(usdOnly), "USD");
  // dual-currency honours the selected currency
  const dual = { variant: { currencies: ["SGD", "USD"] }, settings: { currency: "USD" } };
  assert.equal(fx.variantNativeCurrency(dual), "USD");
  // falls back to variant.currencies[0] then the provided fallback
  assert.equal(fx.variantNativeCurrency({ variant: { currencies: ["SGD"] } }, "USD"), "SGD");
  assert.equal(fx.variantNativeCurrency({}, "USD"), "USD");
  assert.equal(fx.variantNativeCurrency(null), "SGD");
});

test("comparisonTotal: brTotalWealth > siTotalReceived > totalValue, 0-preserving", () => {
  assert.equal(fx.comparisonTotal({ brTotalWealth: 800000, siTotalReceived: 5, totalValue: 9 }), 800000);
  assert.equal(fx.comparisonTotal({ siTotalReceived: 402000, totalValue: 70000 }), 402000);
  assert.equal(fx.comparisonTotal({ totalValue: 246836 }), 246836);
  assert.equal(fx.comparisonTotal({}), 0);
  assert.equal(fx.comparisonTotal(null), 0);
  // an explicit 0 in a higher-precedence field is honoured (not skipped)
  assert.equal(fx.comparisonTotal({ brTotalWealth: 0, totalValue: 500 }), 0);
});
