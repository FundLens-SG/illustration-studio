# Engine tests

Automated coverage for the five calculation engines in
`assets/illustration-model.js` (`simulateRRP`, the ILP monthly engine,
`simulateParWL`, `simulateParIncome`, and the `irrMonthly` solver). Run:

```bash
npm test
```

Zero runtime dependencies — uses only Node's built-in test runner
(`node:test`) and `node:vm`. CI runs this on every push/PR via
`.github/workflows/notify-ckgtools.yml`, and the ckgtools deploy notify
is **gated on it passing**, so a number-changing regression cannot sync
to production.

## How the model loads without a browser

`harness.mjs` runs `assets/rrp3-rates.js` + `assets/illustration-model.js`
in a `node:vm` sandbox with a fake `window`. The model is pure
computation (no DOM), so it executes unchanged. This is why the engine
was extracted out of `illustration-studio.html` — so it can be tested in
isolation.

## The three layers

### `validation.test.mjs` — correctness against known-good anchors
- **RRP reproduces all source-exact BI rows to the cent.** 181 of the
  1,099 grid rows were lifted *directly* from real Manulife Benefit
  Illustrations (`estimation_method === "source_exact"`). Driving the
  engine in premium mode at each row's own premium must reproduce that
  row's projected monthly income exactly. This validates the lookup +
  scaling + income-composition path against real BI figures.
- **SI death-benefit floor ≈ 105% of single premium on day 1** (a stated
  product guarantee).
- **SLH par-WL breaks even on premiums** within the projection, and
  surrender value is non-decreasing across the back half of the hold.

> Scope boundary: these tests prove the **engine faithfully uses the
> rate data**. Whether each PDF was *parsed* correctly into the rate
> table is a separate data-provenance concern (the >900 interpolated /
> extrapolated rows are not independently validated here).

### `regression.test.mjs` — golden master
Freezes a deterministic, rounded fingerprint of every engine's output
across a representative scenario matrix (`scenarios.mjs`) into
`snapshots/engines.json`. Any change to a projected value fails the test.
This is the CI safety net against accidental drift.

**Re-baseline after an intentional model change:**
```bash
# bash / CI
UPDATE_SNAPSHOTS=1 npm test
# PowerShell
$env:UPDATE_SNAPSHOTS=1; npm test; Remove-Item Env:\UPDATE_SNAPSHOTS
```
Review the `snapshots/engines.json` diff before committing — it is the
record of exactly which numbers moved.

### `invariants.test.mjs` — properties that must always hold
Across the whole matrix: no `NaN`/`Infinity` reaches outputs, premiums
never negative, IRR within ±100%, par-WL surrender value never negative,
and RRP cumulative income is monotonic non-decreasing.

### `view.test.mjs` — the view layer's derived numbers
The client-facing values DERIVED from a result in the UI —
`computeRrpStats` (RRP payback age / income multiple / % of premiums
returned) and `parWlMilestones` (par-WL breakeven + capital-multiple
years), both in `assets/illustration-view.js`. These used to be computed
inline in the render layer and slipped the model-only gate.

## Files
- `harness.mjs` — vm loaders (`loadModel`, `loadView`) + per-engine settings builders + `findNonFinite`
- `scenarios.mjs` — shared scenario matrix + fingerprint helpers
- `*.test.mjs` — the four layers above
- `snapshots/engines.json` — golden-master baseline (committed)
