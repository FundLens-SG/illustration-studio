# SII Claude Export

Generated: 2026-07-02T16:24:06.667Z

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
- Method counts: age_shifted_source=1960, extrapolated_sparse=9530, extrapolated_age=240, source_exact=36, interpolated_sparse=1617, interpolated_age=36.

## Model Notes For Claude

- Source-exact term/start/age cases use the matching parsed PI row.
- Matching term/start cases across age anchors use age interpolation or extrapolation.
- Sparse term/start cases use inverse-distance weighting across premium term, income start year, and age.
- Income is aligned to the selected income start year. Source payout curves are shifted so payout year 1 lands on the selected policy year; income before the selected start year is forced to zero.
- User-facing premium input is annualised premium for 2-pay to 10-pay and single premium for SP.
- Charges and bonuses include premium charge, policy fee, admin fee estimate, policy value booster, net fees after booster, surrender/unvested drag, and parsed effect of deductions.
- Early-year SII IRR values outside sane bounds are displayed as `n.m.` in the UI and exported as blank/null where applicable.
