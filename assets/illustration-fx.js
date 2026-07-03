// Illustration Studio — currency / comparison-total helpers.
//
// Pure functions that decide the client-facing number shown in the comparison
// hero, charts, tooltips, and annual-table compare column. Extracted from
// illustration-studio.html so they can be unit-tested headless. No DOM, no
// global state: the caller injects the live FX rate and the sticky display
// choice. The engine treats currency as a nominal label (a 300k premium
// projects identically whether tagged SGD or USD) — these helpers do the FX.
//
// UMD: window.IRFx in the browser, module.exports in Node.
(function (root) {
  "use strict";

  // Income-inclusive total for comparison surfaces: policy/account value PLUS
  // income/payouts/dividends already received. par-WL Bonus-Realisation carries
  // received cash in brTotalWealth; SI3/SLR expose siTotalReceived; SII/ILP fold
  // it into totalValue. Zero-preserving fallback chain.
  function comparisonTotal(row) {
    if (!row) return 0;
    if (row.brTotalWealth != null) return row.brTotalWealth;
    if (row.siTotalReceived != null) return row.siTotalReceived;
    return row.totalValue || 0;
  }

  // The currency a result's numbers are actually in. Single-currency variants
  // (SLH/SII USD-only; IRG/SLR/SI3/RRP SGD-only) always produce values in their
  // own currency regardless of the inherited settings.currency; dual-currency
  // ILPs honour the selected currency.
  function variantNativeCurrency(result, fallback) {
    if (fallback === undefined) fallback = "SGD";
    const cur = (result && result.settings && result.settings.currency) || fallback;
    const list = result && result.variant && result.variant.currencies;
    if (Array.isArray(list) && list.length) return list.indexOf(cur) >= 0 ? cur : list[0];
    return cur;
  }

  // Convert an amount between USD and SGD. rate = SGD per 1 USD. No-op when the
  // currencies match or the rate is unusable; warns on an unsupported pair
  // (only USD<->SGD exists today — a future EUR/GBP variant must not ship a
  // silently-unconverted figure).
  function fxConvert(amount, from, to, rate) {
    if (from === to || !Number.isFinite(amount)) return amount;
    if (!Number.isFinite(rate) || rate <= 0) return amount;
    if (from === "USD" && to === "SGD") return amount * rate;
    if (from === "SGD" && to === "USD") return amount / rate;
    if (typeof console !== "undefined" && console.warn) {
      console.warn("fxConvert: unsupported currency pair " + from + "->" + to + "; returning amount unconverted");
    }
    return amount;
  }

  // Display currency for a comparison: SGD by default when the two sides differ
  // (a like-for-like basis for a Singapore client), else the shared currency;
  // an explicit user choice (chosen, from the FX toggle) always wins.
  function comparisonDisplayCurrency(currencyA, currencyB, chosen) {
    const base = currencyA === currencyB ? currencyA : "SGD";
    return chosen === "USD" || chosen === "SGD" ? chosen : base;
  }

  const api = { comparisonTotal, variantNativeCurrency, fxConvert, comparisonDisplayCurrency };
  root.IRFx = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
