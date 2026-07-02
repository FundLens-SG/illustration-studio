# SII Illustrator Build Spec

## Source Inputs

- Product deck: `C:\Users\user\Downloads\Manulife Signature Indexed Income Training Tech Deck Apr2026 (1).pdf`
- Uploaded PIs: `C:\Users\user\Downloads\PI_20260702*.pdf`
- Cached PI text library: `source-data/signature-indexed-income/raw-text/PI_20260702*.txt`
- Parsed browser data: `assets/sii-rates.js`
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
- Target monthly income:
  - Income start PY2/PY3: US$60 to US$100,000.
  - Income start PY4-PY21: US$300 to US$500,000.
- Income start rules:
  - Single premium to 3-pay: PY2-PY21.
  - 4-pay to 6-pay: PY3-PY21.
  - 7-pay to 10-pay: PY4-PY21.

## Model Method

- Source-exact term/start-year cases use the matching parsed PI row.
- Same term/start-year cases across age 46 and 56 use linear age interpolation. If the selected age is outside 46-56, the model extrapolates from the nearest age anchors and flags the estimate.
- Missing term/start-year cases use inverse-distance weighted interpolation/extrapolation across nearest source PIs by:
  - premium payment term
  - income start year
  - life insured age
- User can generate from either:
  - total planned premium, deriving target monthly income, or
  - target monthly income, deriving total planned premium.
- Annual projection rows scale PI policy values, surrender values, income, death benefit and deduction rows by total planned premium.
- Premium schedule is generated from the selected premium term rather than copied from source rows.

## Charges And Bonuses

Collapsed UI:

- Shows annualised net illustrated yield after current charges and bonuses.
- Shows spread versus the 6.35% assumed Index Account illustration rate.

Expanded UI:

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
