# SII Illustrator Build Spec

## Source Inputs

- Product deck: `C:\Users\user\Downloads\Manulife Signature Indexed Income Training Tech Deck Apr2026 (1).pdf`
- Uploaded PIs: `C:\Users\user\Downloads\PI_20260702*.pdf`
- Cached PI text library: `source-data/signature-indexed-income/raw-text/PI_20260702*.txt`
- Parsed data (full archive, used by tests): `assets/sii-rates.js`
- Browser runtime asset (slim; loaded by the page): `assets/sii-rates-runtime.js`
- Parsed CSVs:
  - `source-data/signature-indexed-income/parsed/sii_scenarios.csv`
  - `source-data/signature-indexed-income/parsed/sii_annual_rows.csv`
  - `source-data/signature-indexed-income/parsed/sii_extraction_audit.csv`

## Extraction Result

- 15 current PDFs found in Downloads.
- 23 prior PI text extracts retained from the earlier age-46 upload.
- 38 input sources parsed.
- 36 unique source scenarios after two duplicate scenarios were merged.
- Source ages: 46 and 56, male, non-smoker, standard risk.
- Current run had no PDF parse errors.

Important caveat: age values between 46 and 56 can be age-interpolated where matching term/start anchors exist. Ages below 46 or above 56 are extrapolated and become less reliable the farther they move from those anchors. They are not official age-specific policy illustrations.

## Source Coverage

Age 46 source scenarios:

- Single Premium: income start PY2, PY4, PY5, PY6, PY7, PY8, PY9.
- 2-pay: income start PY4, PY5, PY6, PY7, PY8, PY9, PY10.
- 5-pay: income start PY3, PY4, PY6, PY13, PY19.
- 10-pay: income start PY4, PY9, PY15.

Age 56 source scenarios:

- Single Premium: income start PY4, PY9, PY14.
- 4-pay: income start PY3, PY9, PY14.
- 8-pay: income start PY6, PY10, PY15.
- 10-pay: income start PY4, PY9, PY10, PY14, PY20.

Coverage assessment:

- The new age-56 batch is enough to improve the age curve materially, especially for SP and 10-pay where there is overlap with age 46.
- It is acceptable for directional, approximate estimates across ages such as 55, 63 and 70 if the disclaimer remains prominent.
- It is still not ideal for enterprise-grade precision at age 70 or very young entry ages because the highest anchor is 56. Add age 65 or 70 PIs for the most common premium terms/start years if client-facing accuracy becomes critical.

## Product Rules Implemented

- Currency: USD.
- Entry age: 0-70.
- Account allocation in this tool: 100% Index Account, 0% Fixed Account.
- Index Account basis: S&P 500 Index Sub-account, 6.35% assumed current illustration rate.
- S&P 500 terms captured from the deck: 0% floor, 9% cap.
- Total planned premium range: US$100,000 to US$166,000,000.
- User-facing premium input:
  - Single Premium for SP.
  - Annualised Premium for 2-pay to 10-pay.
  - Total planned premium is derived as annualised premium x premium term.
  - Annualised minimum is term-specific, based on the US$100,000 minimum total planned premium.
- Target monthly income:
  - Income start PY2/PY3: US$60 to US$100,000.
  - Income start PY4-PY21: US$300 to US$500,000.
- Income start rules:
  - Single premium to 3-pay: PY2-PY21.
  - 4-pay to 6-pay: PY3-PY21.
  - 7-pay to 10-pay: PY4-PY21.

## Model Method

- Estimation is two-stage, with entry age fully decoupled from term/start-year estimation:
  - Stage 1 (term and income start year, per anchor-age cohort): each cohort resolves the selected term/start-year to weights over parsed source rows using monotone piecewise-linear curves of income start year, one curve per premium term. Curves are the node-level union of both cohorts' scenarios for that term (own rows take precedence at duplicate starts), which keeps the income rate age-invariant, matching the parsed data. Terms a cohort lacks are borrowed whole from the other cohort; terms in no cohort are bracketed between the nearest union terms.
  - Interior start years interpolate linearly between adjacent source start-year nodes. Start years beyond the parsed curve ends use whole-curve secant continuation with the position ratio clamped to +/-0.5 of the curve span, then held flat; clamped estimates are flagged with an explicit note. Estimated income is monotone non-decreasing in income start year by construction.
  - Stage 2 (age): clamped piecewise-linear combine across the anchor-age cohorts - convex interpolation inside the anchor band (46-56), nearest anchor with weight 1 outside it. Negative age weights cannot occur; out-of-band ages reuse the nearest anchor's estimate verbatim (parsed PIs show identical income rates at both anchors) and are flagged with a clamped-age note.
- Source-exact term/start-year cases at an anchor age still use the matching parsed PI rows verbatim (`source_exact`).
- Estimation labels: `source_exact`, `interpolated_age` (age convex-blended between anchors on an exact combo), `age_shifted_source` (exact combo taken from an anchor age other than the selected age, values used verbatim), `interpolated_sparse` (interior start-year interpolation), `extrapolated_sparse` (clamped start-year tail or one-sided term bracket), `not_available`.
- Projection truncation: projections run to `min(source table length, maturity age 125 - entry age)`. When the source tables end before maturity, the summary carries `projectionTruncated: true` plus `projectionEndAge`, and a note states that the projection stops at the attained age of the final parsed policy year and that total projected income and final values are to the final projected year, not to maturity.
- Premium mode discloses (as a non-blocking note) when the derived monthly income falls below the electable product minimum for the selected income start year.
- Per-scenario annual row lookups are served from a per-source `byYear` map cache, so interactive recalculation and batch export share the same fast path.
- User can generate from either:
  - annualised premium, deriving target monthly income, or
  - target monthly income, deriving annualised premium and total planned premium.
- Annual projection rows scale PI policy values, surrender values, death benefit and deduction rows by total planned premium.
- Income is aligned to the selected income start year. For sparse estimates, each source PI's payout curve is shifted so payout year 1 lands on the selected policy year; income before the selected start year is forced to zero.
- Premium schedule is generated from the selected premium term rather than copied from source rows.
- Out-of-range early-year SII IRR is displayed as `n.m.` instead of a misleading extreme percentage.

## Charges And Bonuses

Collapsed UI:

- Shows annualised net illustrated yield after current charges and bonuses.
- Shows spread versus the 6.35% assumed Index Account illustration rate.
- Shows headline total estimated charges and policy booster.

Expanded UI:

- Shows total premium charges, policy fees, admin fees, total fees, policy value booster, and fees less booster.
- Premium charge by policy year:
  - Y1 8.0%, Y2 7.5%, Y3 7.0%, Y4 6.5%, Y5 6.0%, Y6 5.5%, Y7 5.0%, Y8 4.5%, Y9 4.0%, Y10+ 4.0%.
- Monthly policy fee estimate: US$2.108333 per US$1,000 face amount, annualised, first 25 policy years.
- Monthly administration fee estimate: 0.03% of policy value, annualised.
- Policy Value Booster estimate: 1.46% p.a. of face amount from PY2 to PY25.
- Surrender / unvested drag from parsed current-value tables.
- Current effect of deductions from parsed PI deduction tables.

## UI Notes

- Product dropdown has one SII option: `SII`.
- Premium term is selected inside the SII card.
- The first render defaults to age 46 / single premium / PY4 / US$100,000 because that is a source-exact, easy-to-read case.
- Invalid age displays a red inline error.
- The table color-codes premium, annual income, cumulative income, policy values and net yield.

## Client-Facing Disclaimer

SII figures generated here are extrapolated from uploaded policy illustrations and are approximate only. They are not official Manulife policy illustrations, are not guaranteed to be 100% accurate, and must be validated against an official policy illustration before client use or application.

The 6.35% S&P 500 Index Sub-account assumed illustration rate, policy values, monthly income, charges and bonuses are non-guaranteed and are used purely for illustration. Actual policy performance may be lower or higher.
