# SII Claude Export

Generated: 2026-07-03T08:34:17.363Z

## Important Caveat

These SII figures are derived from uploaded policy illustrations and extrapolated/interpolated by the Illustration Studio model. They are approximate, are not official Manulife policy illustrations, are not guaranteed to be 100% accurate, and must be validated against an official PI before client use or application.

## Files

- `sii_claude_source_pi_scenarios.csv` - one row per unique parsed source PI scenario.
- `sii_claude_source_pi_annual_values.csv` - annual source values from each parsed PI scenario, including current values, guaranteed values, income rows, and deduction rows where parsed.
- `sii_claude_all_extrapolations_annualised_100k.csv` - full extrapolation grid for all entry ages 0-70, all premium terms SP/2-pay/3-pay/4-pay/5-pay/6-pay/7-pay/8-pay/9-pay/10-pay, and every product-valid income start year.
- `sii_claude_export_summary.json` - machine-readable metadata and counts.

## Export Basis

- Currency: USD.
- Account basis: 100% S&P 500 Index Sub-account.
- Assumed current Index Account illustration rate: 6.35%.
- Fixed Account allocation: 0%.
- Index Account allocation: 100%.
- S&P 500 floor/cap captured in this model: 0% floor / 9% cap.
- Extrapolation grid premium basis: US$100,000 annualised premium.
- For SP, annualised premium basis is treated as the single premium.
- For multi-pay terms, total planned premium = annualised premium x premium term.

## Source Coverage

- Parsed unique source PI scenarios: 36.
- Source annual rows exported: 2704.
- Source ages: 46, 56.
- Source premium terms: 1, 2, 4, 5, 8, 10.
- Source income start years: 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 19, 20.

## Extrapolation Coverage

- Extrapolation rows exported: 13419.
- Method counts: age_shifted_source=2200, interpolated_sparse=5751, extrapolated_sparse=5396, source_exact=36, interpolated_age=36.
- Rows with `projection_truncated=true`: 9194 of 13419.

## Estimation Methods

- `source_exact` - a parsed PI exists for this exact age/term/start-year combination.
- `age_shifted_source` - the exact term/start-year PI from the nearest source-age anchor is used directly (parsed PIs show identical income rates per 100k premium at both anchor ages).
- `interpolated_age` - the exact term/start-year PI exists at both anchor ages and the value is interpolated across age.
- `interpolated_sparse` - no exact term/start-year PI; the value is interpolated along the per-term income-start curve within each anchor-age cohort (age is excluded from the term/start blend), then combined across anchor ages.
- `extrapolated_sparse` - as above, but the requested income start year falls outside the illustrated start-year range for the term; the tail extrapolation is linear and clamped, so far-out start years may be understated.

## Projection Horizon

- Every grid row projects annual values from policy year 1 to `final_policy_year` (attained age `final_age`).
- `total_projected_income`, `final_surrender_value`, `final_death_benefit`, and `total_benefits_at_projection` are measured to `final_policy_year`, NOT to maturity age 125.
- `projection_truncated` is `true` and `projection_end_age` (= the attained age the projection stops at) is below maturity age 125 where the parsed source tables end before maturity (younger entry ages). When `projection_truncated` is `false`, `projection_end_age` equals maturity age. Do not compare `total_*` columns across ages with different `projection_end_age` values without accounting for the horizon difference.

## Model Notes For Claude

- Source-exact term/start/age cases use the matching parsed PI row.
- Estimation is two-stage: term/start-year values are blended within each source-age cohort with age excluded from the blend, then interpolated across the source-age anchors. Entry ages outside the anchor range use the nearest anchor (parsed PIs show the income rate per 100k premium is age-invariant across the anchors).
- Income is aligned to the selected income start year. Source payout curves are shifted so payout year 1 lands on the selected policy year; income before the selected start year is forced to zero.
- User-facing premium input is annualised premium for 2-pay to 10-pay and single premium for SP.
- The full extrapolation grid uses `net_illustrated_yield_pct_pa` as the collapsed annualised representation of charges blended with bonuses, and `blended_drag_vs_index_assumption_pct` as the spread against the 6.35% Index Account illustration assumption.
- Charges and bonuses include premium charge, policy fee, admin fee estimate, policy value booster, net fees after booster, surrender/unvested drag, and parsed effect of deductions.
- `final_net_irr_pct` is the net monthly-cash-flow IRR (premiums out, income in, final surrender value at `final_policy_year`), annualised. SII IRR values outside sane bounds are displayed as `n.m.` in the UI and exported as blank here.
- Rows whose derived monthly income at the US$100,000 basis falls below the product minimum carry a below-minimum note in `notes`; that income level may not be electable on an official PI.
