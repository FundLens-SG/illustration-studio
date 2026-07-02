// Illustration Studio — model engine (extracted from
// illustration-studio.html for testability; loaded by the app via
// <script src> and by the Node test harness via vm).
//
// UMD: attaches window.IRModel in the browser, sets module.exports in
// Node. Pure computation — no DOM. Reads window.RRP3_RATES (loaded by
// assets/rrp3-rates.js before this file). Do not add DOM dependencies
// here; UI lives in illustration-studio.html.

(function (root) {
  "use strict";

  const FREQUENCIES = {
    Annual: { label: "Annual", paymentsPerYear: 1, dueMonths: [1] },
    SemiAnnual: { label: "Semi-Annual", paymentsPerYear: 2, dueMonths: [1, 7] },
    Quarterly: { label: "Quarterly", paymentsPerYear: 4, dueMonths: [1, 4, 7, 10] },
    Monthly: { label: "Monthly", paymentsPerYear: 12, dueMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  };

  const SURRENDER_COMMON_10 = {
    1: 1, 2: 1, 3: 0.79, 4: 0.6, 5: 0.5, 6: 0.47, 7: 0.44, 8: 0.21, 9: 0.16, 10: 0.08,
  };
  const PARTIAL_COMMON_10 = {
    1: 1, 2: 1, 3: 0.79, 4: 0.6, 5: 0.5, 6: 0.08, 7: 0.08, 8: 0.08, 9: 0.08, 10: 0.08,
  };

  const VARIANTS = {
    "5F1": {
      key: "5F1",
      label: "5 Years Flexi 1",
      currencies: ["SGD", "USD"],
      mipYears: 5,
      flexiStartYear: 2,
      shortfallYears: 1,
      adminDuring: 0.025,
      adminAfter: 0.01,
      loyaltyRate: 0,
      annualPremiumBonusRate: 0,
      minPremiums: {
        SGD: { Annual: 25000 },
        USD: { Annual: 25000 },
      },
      welcomeBands: [{ min: 25000, max: Infinity, rate: 0.058 }],
      surrenderCharge: { 1: 0.15, 2: 0.12, 3: 0.09, 4: 0.06, 5: 0.03 },
      partialCharge: { 1: 0.15, 2: 0.12, 3: 0.09, 4: 0.06, 5: 0.03 },
      shortfallCharge: {},
    },
    "6F2": {
      key: "6F2",
      label: "6 Years Flexi 2",
      currencies: ["SGD", "USD"],
      mipYears: 6,
      flexiStartYear: 3,
      shortfallYears: 2,
      adminDuring: 0.025,
      adminAfter: 0.01,
      loyaltyRate: 0,
      annualPremiumBonusRate: 0,
      minPremiums: {
        SGD: { Annual: 10000 },
        USD: { Annual: 10000 },
      },
      welcomeBands: [{ min: 10000, max: Infinity, rate: 0.116 }],
      surrenderCharge: { 1: 1, 2: 1, 3: 0.77, 4: 0.4, 5: 0.2, 6: 0.1 },
      partialCharge: { 1: 1, 2: 1, 3: 0.77, 4: 0.4, 5: 0.2, 6: 0.1 },
      shortfallCharge: { 2: 1 },
    },
    "7F5": {
      key: "7F5",
      label: "7 Years Flexi 5",
      currencies: ["SGD", "USD"],
      mipYears: 7,
      flexiStartYear: 6,
      shortfallYears: 5,
      adminDuring: 0.025,
      adminAfter: 0.01,
      loyaltyRate: 0.003,
      annualPremiumBonusRate: 0,
      minPremiums: {
        SGD: { Annual: 12000, SemiAnnual: 6000, Quarterly: 3000, Monthly: 1000 },
        USD: { Annual: 12000 },
      },
      welcomeBands: [
        { min: 12000, max: 48000, rate: 0.07 },
        { min: 48000, max: Infinity, rate: 0.12 },
      ],
      surrenderCharge: { 1: 1, 2: 1, 3: 0.77, 4: 0.4, 5: 0.2, 6: 0.1, 7: 0.05 },
      partialCharge: { 1: 1, 2: 1, 3: 0.77, 4: 0.4, 5: 0.2, 6: 0.1, 7: 0.05 },
      shortfallCharge: { 1: 1, 2: 1, 3: 0.77, 4: 0.4, 5: 0.2 },
    },
    "10F3": {
      key: "10F3",
      label: "10 Years Flexi 3",
      currencies: ["SGD", "USD"],
      mipYears: 10,
      flexiStartYear: 4,
      shortfallYears: 3,
      partialLimitStartYear: 6,
      adminDuring: 0.025,
      adminAfter: 0.007,
      loyaltyRate: 0.003,
      annualPremiumBonusRate: 0.02,
      minPremiums: {
        SGD: { Annual: 6000, SemiAnnual: 3000, Quarterly: 1500, Monthly: 500 },
        USD: { Annual: 6000 },
      },
      welcomeBands: [
        { min: 6000, max: 9600, rate: 0.08 },
        { min: 9600, max: Infinity, rate: 0.15 },
      ],
      policyFeeBand: { min: 6000, max: 9600, monthlyFee: 5 },
      surrenderCharge: SURRENDER_COMMON_10,
      partialCharge: PARTIAL_COMMON_10,
      shortfallCharge: { 1: 1, 2: 1, 3: 0.79 },
    },
    "10F5": {
      key: "10F5",
      label: "10 Years Flexi 5",
      currencies: ["SGD", "USD"],
      mipYears: 10,
      flexiStartYear: 6,
      shortfallYears: 5,
      partialLimitStartYear: 6,
      adminDuring: 0.025,
      adminAfter: 0.007,
      loyaltyRate: 0.003,
      annualPremiumBonusRate: 0.05,
      minPremiums: {
        SGD: { Annual: 6000, SemiAnnual: 3000, Quarterly: 1500, Monthly: 500 },
        USD: { Annual: 6000 },
      },
      welcomeBands: [
        { min: 6000, max: 9600, rate: 0.1 },
        { min: 9600, max: Infinity, rate: 0.25 },
      ],
      policyFeeBand: { min: 6000, max: 9600, monthlyFee: 5 },
      surrenderCharge: SURRENDER_COMMON_10,
      partialCharge: PARTIAL_COMMON_10,
      shortfallCharge: { 1: 1, 2: 1, 3: 0.79, 4: 0.6, 5: 0.5 },
    },
    "10F8": {
      key: "10F8",
      label: "10 Years Flexi 8",
      currencies: ["SGD", "USD"],
      mipYears: 10,
      flexiStartYear: 9,
      shortfallYears: 8,
      partialLimitStartYear: 6,
      adminDuring: 0.025,
      adminAfter: 0.007,
      loyaltyRate: 0.003,
      annualPremiumBonusRate: 0.05,
      minPremiums: {
        SGD: { Annual: 6000, SemiAnnual: 3000, Quarterly: 1500, Monthly: 500 },
        USD: { Annual: 6000 },
      },
      welcomeBands: [
        { min: 6000, max: 9600, rate: 0.13 },
        { min: 9600, max: Infinity, rate: 0.3 },
      ],
      policyFeeBand: { min: 6000, max: 9600, monthlyFee: 5 },
      surrenderCharge: SURRENDER_COMMON_10,
      partialCharge: PARTIAL_COMMON_10,
      shortfallCharge: { 1: 1, 2: 1, 3: 0.79, 4: 0.6, 5: 0.5, 6: 0.47, 7: 0.44, 8: 0.21 },
    },
    "13F10": {
      key: "13F10",
      label: "13 Years Flexi 10",
      currencies: ["SGD"],
      mipYears: 13,
      flexiStartYear: 11,
      shortfallYears: 10,
      partialLimitStartYear: 6,
      adminDuring: 0.025,
      adminAfter: 0.007,
      loyaltyRate: 0.003,
      annualPremiumBonusRate: 0.05,
      minPremiums: {
        SGD: { Annual: 3600, SemiAnnual: 1800, Quarterly: 900, Monthly: 300 },
      },
      welcomeBands: [
        { min: 3600, max: 9600, rate: 0.15 },
        { min: 9600, max: Infinity, rate: 0.45 },
      ],
      policyFeeBand: { min: 3600, max: 9600, monthlyFee: 5 },
      surrenderCharge: { 1: 1, 2: 1, 3: 0.81, 4: 0.63, 5: 0.53, 6: 0.49, 7: 0.46, 8: 0.27, 9: 0.22, 10: 0.14, 11: 0.08, 12: 0.08, 13: 0.08 },
      partialCharge: { 1: 1, 2: 1, 3: 0.81, 4: 0.63, 5: 0.53, 6: 0.08, 7: 0.08, 8: 0.08, 9: 0.08, 10: 0.08, 11: 0.08, 12: 0.08, 13: 0.08 },
      shortfallCharge: { 1: 1, 2: 1, 3: 0.81, 4: 0.63, 5: 0.53, 6: 0.49, 7: 0.46, 8: 0.27, 9: 0.22, 10: 0.14 },
    },
    "IRG15F10": {
      key: "IRG15F10",
      label: "IRG 15 Years Flexi 10",
      family: "ILP Growth",
      currencies: ["SGD"],
      mipYears: 15,
      flexiStartYear: 11,
      shortfallYears: 10,
      partialLimitStartYear: 6,
      mipPartialCap: 0.2,           // 20% of NAV-funded account value during MIP
      adminMode: "vmpp",            // admin charge based on Value of Minimum Premium Payable
      adminDuring: 0.0218,
      adminAfter: 0.0095,
      loyaltyRate: 0.003,
      annualPremiumBonusRate: 0.03,
      premiumBonusRate: 0.02,        // 2% per regular basic premium from flexi start date
      boosterBonusRate: 0.35,        // 35% × first-year premium one-time at end of MIP if conditions met
      topUpChargeRate: 0.05,
      minPremiums: {
        SGD: { Annual: 3600, SemiAnnual: 1800, Quarterly: 900, Monthly: 300 },
      },
      welcomeBands: [
        { min: 3600, max: 9600, rate: 0.15 },
        { min: 9600, max: Infinity, rate: 0.45 },
      ],
      surrenderCharge: { 1: 1, 2: 1, 3: 0.9, 4: 0.8, 5: 0.62, 6: 0.49, 7: 0.46, 8: 0.32, 9: 0.26, 10: 0.21, 11: 0.18, 12: 0.15, 13: 0.12, 14: 0.08, 15: 0.08 },
      partialCharge: { 1: 1, 2: 1, 3: 0.9, 4: 0.8, 5: 0.62, 6: 0.08, 7: 0.08, 8: 0.08, 9: 0.08, 10: 0.08, 11: 0.08, 12: 0.08, 13: 0.08, 14: 0.08, 15: 0.08 },
      shortfallCharge: { 1: 1, 2: 1, 3: 0.9, 4: 0.8, 5: 0.62, 6: 0.49, 7: 0.46, 8: 0.32, 9: 0.26, 10: 0.21 },
    },
    "IRG20F10": {
      key: "IRG20F10",
      label: "IRG 20 Years Flexi 10",
      family: "ILP Growth",
      currencies: ["SGD"],
      mipYears: 20,
      flexiStartYear: 11,
      shortfallYears: 10,
      partialLimitStartYear: 6,
      mipPartialCap: 0.2,
      adminMode: "vmpp",
      adminDuring: 0.018,
      adminAfter: 0.0092,
      loyaltyRate: 0.003,
      annualPremiumBonusRate: 0.03,
      premiumBonusRate: 0.02,
      boosterBonusRate: 0.35,
      topUpChargeRate: 0.05,
      minPremiums: {
        SGD: { Annual: 2400, SemiAnnual: 1200, Quarterly: 600, Monthly: 200 },
      },
      welcomeBands: [
        { min: 2400, max: 9600, rate: 0.30 },
        { min: 9600, max: Infinity, rate: 0.60 },
      ],
      surrenderCharge: { 1: 1, 2: 1, 3: 0.9, 4: 0.85, 5: 0.8, 6: 0.75, 7: 0.62, 8: 0.52, 9: 0.45, 10: 0.4, 11: 0.36, 12: 0.33, 13: 0.3, 14: 0.27, 15: 0.24, 16: 0.21, 17: 0.17, 18: 0.13, 19: 0.08, 20: 0.08 },
      partialCharge: { 1: 1, 2: 1, 3: 0.9, 4: 0.85, 5: 0.8, 6: 0.08, 7: 0.08, 8: 0.08, 9: 0.08, 10: 0.08, 11: 0.08, 12: 0.08, 13: 0.08, 14: 0.08, 15: 0.08, 16: 0.08, 17: 0.08, 18: 0.08, 19: 0.08, 20: 0.08 },
      shortfallCharge: { 1: 1, 2: 1, 3: 0.9, 4: 0.85, 5: 0.8, 6: 0.75, 7: 0.62, 8: 0.52, 9: 0.45, 10: 0.4 },
    },

    // ──────────────────────────────────────────────────────────────────
    // Signature Legacy Harvest (SLH) — Manulife participating whole-life.
    // Different math from the InvestReady ILPs above: the simulator uses
    // a precomputed factor table per policy year (TotalSurrenderValue /
    // base premium at the illustration's 7.50% bonus realisation rate).
    // Tables transcribed from the customer's SLH Simulation workbook.
    // Values in early years are deliberately below cumulative premium
    // paid — typical of par WL early surrender penalty; the factors
    // grow exponentially in later years as terminal bonus accumulates.
    // ──────────────────────────────────────────────────────────────────
    // Signature Legacy Harvest — Manulife participating whole-life.
    // Each variant carries:
    //   slhFactorTable      → total surrender value factor by policy
    //                          year (Reinvested mode at 7.50% p.a.
    //                          illustrated bonus rate). Multiplied by
    //                          the basis below to produce dollar
    //                          values.
    //   slhGuaranteedTable  → guaranteed-only surrender factor (same
    //                          basis as slhFactorTable).
    //   slhFactorBasis      → "annual" or "cumulative". The workbook
    //                          uses different normalisations across
    //                          variants: SP and 5-Pay express factors
    //                          relative to a single annual premium
    //                          (annual basis), while 3-Pay's columns
    //                          express factors relative to cumulative
    //                          premium paid up to that year (cumulative
    //                          basis). Defaults to "annual".
    // Sanity-check anchors per variant — the row where total factor
    // first crosses "breakeven on paid premiums":
    //   SP    : year 14, factor ≈ 1.0  × $100K = $100K = paid
    //   3-Pay : year 6,  factor ≈ 1.0  × cumulative $100,200 = paid
    //   5-Pay : year 8,  factor ≈ 5.0  × $33,400 (annual) = 5×ann = paid
    // The Non-Guaranteed Bonus column the workbook displays is just
    // (slhFactorTable - slhGuaranteedTable). Adhoc 10%/50% drawdowns
    // are computed from the NG bonus per year. There is no recurring
    // drawdown unless the user opts in (separate feature).

    "SLH_SP": {
      key: "SLH_SP",
      label: "SLH · Single Premium",
      family: "SLH",
      kind: "par-wl",
      currencies: ["USD"],
      premiumTermYears: 1,
      mipYears: 1,                 // for chart milestone heuristics
      flexiStartYear: 2,
      shortfallYears: 1,
      adminDuring: 0,
      adminAfter: 0,
      loyaltyRate: 0,
      annualPremiumBonusRate: 0,
      minPremiums: { USD: { Annual: 100000 } },
      welcomeBands: [],
      surrenderCharge: {},
      partialCharge: {},
      shortfallCharge: {},
      slhFactorBasis: "annual",   // factor × annual premium = $ value
      // Total Surrender Value factor (Reinvested mode, 7.50% BR).
      // Source: Percent_of_Premium (Reinvested) sheet, column G
      // (= Guaranteed col D + Non-Guaranteed Terminal Bonus col F).
      // Late-policy factors (110, 120) bumped to 5-decimal precision so
      // the workbook's exact dollar values reproduce — at year 120 the
      // difference between factor 3877 and 3876.76892 is $23K on a $100K
      // single premium.
      slhFactorTable: [
        [1, 0.85], [2, 0.942], [3, 0.986], [4, 1.04636], [5, 1.11625],
        [6, 1.17486], [7, 1.23890], [8, 1.30890], [9, 1.42541], [10, 1.55002],
        [11, 1.65366], [12, 1.76574], [13, 1.88638], [14, 2.04560], [15, 2.17460],
        [16, 2.31385], [17, 2.46451], [18, 2.62670], [19, 2.80205], [20, 2.99138],
        [21, 3.18792], [22, 3.40001], [23, 3.62974], [24, 3.87738], [25, 4.14653],
        [26, 4.43801], [27, 4.75346], [28, 5.09299], [29, 5.46033], [30, 5.85423],
        [31, 6.24268], [32, 6.66230], [33, 7.11438], [34, 7.60145], [35, 8.12625],
        [36, 8.68886], [37, 9.29483], [38, 9.94755], [39, 10.65059], [40, 11.40788],
        [45, 16.15642], [50, 23.01804], [55, 32.95649], [60, 47.35330], [65, 68.17926],
        [70, 98.15801], [75, 141.49313], [80, 204.13707], [90, 425.60806], [100, 888.44727],
        [110, 1855.55771], [120, 3876.76892],
      ],
      // SP guaranteed surrender value factor — Manulife PI PDF exact
      // values (SP.pdf, page 13–14 BR mode at 7.50% IIR, column [A]).
      // Since the guaranteed values are independent of mode (Reinvested
      // vs BR), this is also the guaranteed factor for Reinvested mode.
      slhGuaranteedTable: [
        [1, 0.85], [2, 0.85], [3, 0.85], [4, 0.85], [5, 0.85],
        [6, 0.85], [7, 0.85], [8, 0.85], [9, 0.89], [10, 0.931],
        [11, 0.94], [12, 0.95], [13, 0.96], [14, 1], [15, 1.00016],
        [16, 1.00033], [17, 1.00049], [18, 1.00066], [19, 1.00082], [20, 1.00099],
        [21, 1.00115], [22, 1.00131], [23, 1.00148], [24, 1.00164], [25, 1.00269],
        [26, 1.005], [27, 1.0073], [28, 1.0096], [29, 1.01191], [30, 1.01294],
        [31, 1.01423], [32, 1.01656], [33, 1.01889], [34, 1.02123], [35, 1.02357],
        [36, 1.02593], [37, 1.02828], [38, 1.03065], [39, 1.03302], [40, 1.0354],
        [45, 1.04738], [50, 1.05954], [55, 1.07187], [60, 1.08437], [65, 1.09704],
        [70, 1.10989], [75, 1.12292], [80, 1.13614], [90, 1.16311], [100, 1.18547],
        [110, 1.20593], [120, 1.22676],
      ],
      // Bonus Realisation mode factors — 7% of accrued non-guaranteed
      // bonus is realised as cash income each year from policy year 10
      // onwards. The remaining 93% continues to compound in the policy.
      // Source: workbook screenshot (Terminal Bonus + Bonus Realisation
      // sheet for SP at age 56 / $100K). Years before 10 mirror the
      // Reinvested factors (no realisation occurs yet).
      //
      //   slhBRTotalFactor       → Total Surrender Value [A]+[B] factor
      //                            (×$ premium = remaining policy value)
      //   slhBRCumulativeRealised → Cumulative Bonus Realised [C] factor
      //                            (×$ premium = total income paid out)
      //   Total Wealth [A]+[B]+[C] = (slhBRTotalFactor + slhBRCumulativeRealised) × premium
      slhBRTotalFactor: [
        [1, 0.85], [2, 0.942], [3, 0.986], [4, 1.04636], [5, 1.11625],
        [6, 1.17486], [7, 1.2389], [8, 1.3089], [9, 1.42541], [10, 1.50668],
        [11, 1.55966], [12, 1.61327], [13, 1.66696], [14, 1.75026], [15, 1.79364],
        [16, 1.83686], [17, 1.88014], [18, 1.92306], [19, 1.96602], [20, 2.00892],
        [21, 2.04414], [22, 2.07924], [23, 2.11451], [24, 2.14954], [25, 2.18571],
        [26, 2.22297], [27, 2.26046], [28, 2.29763], [29, 2.33503], [30, 2.37077],
        [31, 2.38503], [32, 2.40036], [33, 2.41572], [34, 2.43113], [35, 2.44656],
        [36, 2.46151], [37, 2.47648], [38, 2.4915], [39, 2.50654], [40, 2.52161],
        [45, 2.59712], [50, 2.67381], [55, 2.75201], [60, 2.83172], [65, 2.91219],
        [70, 2.99081], [75, 3.07091], [80, 3.15251], [90, 3.32022], [100, 3.4883],
        [110, 3.53527], [120, 3.5829],
      ],
      slhBRCumulativeRealised: [
        [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
        [6, 0], [7, 0], [8, 0], [9, 0], [10, 0.04333],
        [11, 0.08997], [12, 0.13989], [13, 0.1931], [14, 0.24957], [15, 0.30929],
        [16, 0.37225], [17, 0.43846], [18, 0.50789], [19, 0.58054], [20, 0.65641],
        [21, 0.73491], [22, 0.81604], [23, 0.89982], [24, 0.98622], [25, 1.07526],
        [26, 1.16694], [27, 1.26126], [28, 1.35821], [29, 1.4578], [30, 1.56],
        [31, 1.66318], [32, 1.76734], [33, 1.87248], [34, 1.9786], [35, 2.08571],
        [36, 2.19376], [37, 2.30276], [38, 2.41272], [39, 2.52363], [40, 2.6355],
        [45, 2.75215], [50, 2.87365], [55, 3.00011], [60, 3.13163], [65, 3.26825],
        [70, 3.40982], [75, 3.55644], [80, 3.70821], [90, 3.87057], [100, 4.0439],
        [110, 4.21923], [120, 4.39657],
      ],
    },

    "SLH_3PAY": {
      key: "SLH_3PAY",
      label: "SLH · 3-Pay",
      family: "SLH",
      kind: "par-wl",
      currencies: ["USD"],
      premiumTermYears: 3,
      mipYears: 3,
      flexiStartYear: 4,
      shortfallYears: 3,
      adminDuring: 0,
      adminAfter: 0,
      loyaltyRate: 0,
      annualPremiumBonusRate: 0,
      minPremiums: { USD: { Annual: 33400 } },
      welcomeBands: [],
      surrenderCharge: {},
      partialCharge: {},
      shortfallCharge: {},
      // Workbook column E in the 3-Pay tab is normalised against the
      // cumulative premium paid (not against a single annual premium
      // like SP or 5-Pay). At year 6 the total factor is 1.000709 →
      // 1.0 × cumulative paid = breakeven, which matches the user's
      // reference value. So 3-Pay uses the cumulative basis.
      slhFactorBasis: "cumulative",
      // 3-Pay Reinvested-mode total factor — Manulife PI PDF exact
      // values from the standard surrender value table (3 pay.pdf
      // page 7, "Illustrated at 7.50% investment return — Total")
      // calibrated against the code's basis ($100,200 = $33,400 × 3)
      // so factor × basis = PI dollars exactly.
      // Earlier values were workbook-derived and had systematic drift
      // at Y20+ (Y20 was off by $412, Y120 was off by $3,374).
      slhFactorTable: [
        [1, 0.2], [2, 0.291991], [3, 0.302495], [4, 0.5501996], [5, 0.8158283],
        [6, 1.0006986], [7, 1.0894711], [8, 1.1837126], [9, 1.2839321], [10, 1.3906886],
        [11, 1.5025749], [12, 1.6212475], [13, 1.747016], [14, 1.8803393], [15, 2.0220359],
        [16, 2.1428443], [17, 2.2731637], [18, 2.4140619], [19, 2.5663473], [20, 2.7309681],
        [25, 3.7376946], [30, 5.2296607], [35, 7.2074351], [40, 10.0654391], [45, 14.2008283],
        [50, 20.1708383], [55, 28.8173553], [60, 41.3421357], [65, 59.4866966], [70, 85.5768862],
        [75, 123.2911178], [80, 177.8098703], [90, 370.5558483], [100, 773.367485],
        [110, 1615.0641218], [120, 3374.1657385],
      ],
      // 3-Pay guaranteed surrender value factor — Manulife PI PDF exact
      // values (3 pay.pdf, page 13–14, column [A]). Factors calibrated
      // against the code's basis ($100,200) so factor × basis = PI dollars
      // (the PDF rounds cumulative paid to $100,199; my code uses the
      // exact $33,400 × 3 = $100,200 from the user's input).
      slhGuaranteedTable: [
        [1, 0.2], [2, 0.2], [3, 0.2], [4, 0.4], [5, 0.6],
        [6, 0.730998], [7, 0.7608982], [8, 0.7907984], [9, 0.8206986], [10, 0.8505988],
        [11, 0.880499], [12, 0.9103992], [13, 0.9402994], [14, 0.9701996], [15, 1.0000798],
        [16, 1.0002395], [17, 1.0004092], [18, 1.0005689], [19, 1.0007385], [20, 1.0008982],
        [21, 1.0010679], [22, 1.0012275], [23, 1.0013872], [24, 1.0015569], [25, 1.0021557],
        [26, 1.0038423], [27, 1.0061477], [28, 1.0084531], [29, 1.0107485], [30, 1.012495],
        [31, 1.0137525], [32, 1.0151597], [33, 1.0175749], [34, 1.01998], [35, 1.0223852],
        [36, 1.0248104], [37, 1.0272156], [38, 1.0296507], [39, 1.0320659], [40, 1.034481],
        [45, 1.0458982], [50, 1.0573653], [55, 1.0689321], [60, 1.0805689], [65, 1.0922954],
        [70, 1.1028244], [75, 1.1134531], [80, 1.1242116], [90, 1.1460978], [100, 1.1657984],
        [110, 1.1846906], [120, 1.2038922],
      ],
      // 3-Pay Bonus Realisation factor table — workbook-exact values.
      // Source: 3 Pay Factor table sheet (Bonus Realisation 7% payout
      // from Policy Year 10 onwards, 7.50% illustration). Multiplied by
      // cumulative premium paid (per slhFactorBasis="cumulative"):
      //   value = factor × min(year, 3) × annual_premium
      // Years 1–9 mirror the Reinvested total factor since BR drawdown
      // hasn't started; year 10 is when BR diverges (factor 1.352898 vs
      // Reinvested 1.390703).
      slhBRTotalFactor: [
        [1, 0.2], [2, 0.291991], [3, 0.302495], [4, 0.5501996], [5, 0.8158283],
        [6, 1.0006986], [7, 1.0894711], [8, 1.1837126], [9, 1.2839321], [10, 1.3528842],
        [11, 1.4205888], [12, 1.4882236], [13, 1.5556387], [14, 1.6227844], [15, 1.6898503],
        [16, 1.726996], [17, 1.7639521], [18, 1.8009182], [19, 1.8378942], [20, 1.8748802],
        [21, 1.9057884], [22, 1.9365369], [23, 1.9671058], [24, 1.9979242], [25, 2.0289621],
        [26, 2.0612974], [27, 2.0941018], [28, 2.1271158], [29, 2.1598204], [30, 2.1921756],
        [31, 2.204501], [32, 2.2164671], [33, 2.2294511], [34, 2.2424551], [35, 2.255489],
        [36, 2.2685629], [37, 2.2811876], [38, 2.2938523], [39, 2.306517], [40, 2.3192016],
        [45, 2.3824551], [50, 2.4459581], [55, 2.5106287], [60, 2.5764571], [65, 2.643513],
        [70, 2.7068263], [75, 2.7712874], [80, 2.8369162], [90, 2.9717066], [100, 3.1082735],
        [110, 3.149521], [120, 3.1913373],
      ],
      // Cumulative realised values from workbook display (3-Pay BR sheet,
      // column [C] Total Bonus Realised). These ARE cumulative — they
      // accrue from year 10 onwards. Note: the workbook's display rows
      // are dense (Y1–Y40) then sparse (Y45, Y50, Y55, ...) — for sparse
      // years the workbook's displayed cumulative reflects what's
      // shown, which only sums the years actually displayed (a workbook
      // display quirk). My factor lookup interpolates linearly between
      // these anchors so intermediate years (e.g. Y43) get a sensible
      // value, which is close to but not exactly the "true" cumulative
      // through Y43 — close enough for advisor-tool purposes.
      slhBRCumulativeRealised: [
        [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
        [6, 0], [7, 0], [8, 0], [9, 0], [10, 0.0378044],
        [11, 0.0784531], [12, 0.1219461], [13, 0.1682635], [14, 0.2173852], [15, 0.2693014],
        [16, 0.324002], [17, 0.381477], [18, 0.4417166], [19, 0.5047305], [20, 0.570519],
        [21, 0.6386128], [22, 0.709012], [23, 0.7816966], [24, 0.8566966], [25, 0.933982],
        [26, 1.0135729], [27, 1.0954591], [28, 1.1796607], [29, 1.2661477], [30, 1.3549401],
        [31, 1.4445709], [32, 1.53499], [33, 1.6262076], [34, 1.7182236], [35, 1.8110379],
        [36, 1.9046507], [37, 1.9990319], [38, 2.0941916], [39, 2.1901198], [40, 2.2868164],
        [45, 2.3874152], [50, 2.4919361], [55, 2.6004491], [60, 2.7130439], [65, 2.8298004],
        [70, 2.9505289], [75, 3.0753094], [80, 3.2042216], [90, 3.3416367], [100, 3.4878443],
        [110, 3.6357385], [120, 3.7853293],
      ],
    },

    "SLH_5PAY": {
      key: "SLH_5PAY",
      label: "SLH · 5-Pay",
      family: "SLH",
      kind: "par-wl",
      currencies: ["USD"],
      premiumTermYears: 5,
      mipYears: 5,
      flexiStartYear: 6,
      shortfallYears: 5,
      adminDuring: 0,
      adminAfter: 0,
      loyaltyRate: 0,
      annualPremiumBonusRate: 0,
      minPremiums: { USD: { Annual: 20000 } },
      welcomeBands: [],
      surrenderCharge: {},
      partialCharge: {},
      shortfallCharge: {},
      slhFactorBasis: "annual",   // factor 5.0 = 5×annual = paid → year 8 breakeven
      // Source: 5-pay Factor_Table sheet, column D
      // (Total_AplusBplusC_factor — Reinvested mode at 7.50% BR).
      slhFactorTable: [
        [1, 0.2], [2, 0.584], [3, 0.9075], [4, 1.32705], [5, 1.8345],
        [6, 2.6995], [7, 3.83735], [8, 5.00025], [9, 5.5197], [10, 6.0678],
        [11, 6.69335], [12, 7.3526], [13, 8.04575], [14, 8.77435], [15, 9.5406],
        [16, 10.0996], [17, 10.70275], [18, 11.35325], [19, 12.0567], [20, 12.8169],
        [21, 13.60465], [22, 14.45485], [23, 15.372], [24, 16.36095], [25, 17.43225],
        [26, 18.5923], [27, 19.8545], [28, 21.213], [29, 22.68265], [30, 24.26465],
        [31, 25.81615], [32, 27.48485], [33, 29.2829], [34, 31.2198], [35, 33.3065],
        [36, 35.5545], [37, 37.9765], [38, 40.5728], [39, 43.3691], [40, 46.3808],
        [45, 65.29855], [50, 92.5865], [55, 132.1075], [60, 189.35465], [65, 272.28785],
        [70, 391.71005], [75, 564.16305], [80, 813.46025], [85, 1173.84905], [90, 1694.83965],
        [100, 3536.8277], [110, 7385.7089], [120, 15429.6676],
      ],
      slhGuaranteedTable: [
        [1, 0.2], [2, 0.4], [3, 0.6], [4, 0.8], [5, 1.0],
        [6, 1.61835], [7, 2.48665], [8, 3.355], [9, 3.5525], [10, 3.74875],
        [11, 4.0], [12, 4.25], [13, 4.5], [14, 4.75], [15, 5.0],
        [16, 5.0008], [17, 5.00165], [18, 5.00245], [19, 5.0033], [20, 5.0041],
        [21, 5.00495], [22, 5.00575], [23, 5.00655], [24, 5.0074], [25, 5.0082],
        [26, 5.01345], [27, 5.025], [28, 5.0365], [29, 5.048], [30, 5.06035],
        [31, 5.0665], [32, 5.06885], [33, 5.08125], [34, 5.09365], [35, 5.10605],
        [36, 5.11845], [37, 5.13085], [38, 5.14325], [39, 5.15565], [40, 5.168],
        [45, 5.2221], [50, 5.27605], [55, 5.32995], [60, 5.3839], [65, 5.43785],
        [70, 5.47875], [75, 5.51995], [80, 5.56145], [90, 5.64545], [100, 5.7307],
        [110, 5.81725], [120, 5.9051],
      ],
      // 5-Pay Bonus Realisation factor table — Manulife PI PDF exact
      // values (5 pay.pdf, page 13–14, "Supplementary Illustration -
      // Bonus Realisation" 7%/yr from PY10, illustrated at 7.50% IIR).
      // Multiplied by annual premium (per slhFactorBasis="annual"):
      //   value = factor × annual_premium
      // Years 1–9 mirror the Reinvested total factor since BR drawdown
      // hasn't started; year 10 is when BR diverges (factor 5.90545 vs
      // Reinvested 6.0678). Y75 (factor 13.3781) added from PDF
      // explicitly because the workbook screenshot skipped that row,
      // and linear interp Y70→Y80 gave $267,617 vs PDF $267,562.
      slhBRTotalFactor: [
        [1, 0.2], [2, 0.584], [3, 0.9075], [4, 1.32705], [5, 1.8345],
        [6, 2.6995], [7, 3.83735], [8, 5.00025], [9, 5.5197],
        [10, 5.90545], [11, 6.33975], [12, 6.77585], [13, 7.21185], [14, 7.6469], [15, 8.08085],
        [16, 8.26535], [17, 8.44905], [18, 8.6319], [19, 8.81495], [20, 8.998],
        [21, 9.14955], [22, 9.3005], [23, 9.4507], [24, 9.6001], [25, 9.7506],
        [26, 9.9049], [27, 10.06655], [28, 10.2269], [29, 10.38825], [30, 10.549],
        [31, 10.60935], [32, 10.66605], [33, 10.73035], [34, 10.7948], [35, 10.85935],
        [36, 10.92405], [37, 10.98885], [38, 11.0516], [39, 11.11445], [40, 11.1773],
        [45, 11.4889], [50, 11.79965], [55, 12.11575], [60, 12.4372], [65, 12.76435],
        [70, 13.0702], [75, 13.3781], [80, 13.6915], [90, 14.335], [100, 14.9995],
        [110, 15.19275], [120, 15.3885],
      ],
      // Cumulative Bonus Realised factor — PDF-summed cumulative (sums
      // each year displayed in the PDF: every year 10–40, then Y45,
      // 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120). At anchor rows
      // this matches what an advisor reads off the PDF; in-between
      // years are linearly interpolated.
      slhBRCumulativeRealised: [
        [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
        [6, 0], [7, 0], [8, 0], [9, 0],
        [10, 0.16235], [11, 0.33845], [12, 0.52855], [13, 0.73265], [14, 0.9507], [15, 1.1826],
        [16, 1.4283], [17, 1.6878], [18, 1.961], [19, 2.2479], [20, 2.5485],
        [21, 2.86045], [22, 3.1837], [23, 3.5182], [24, 3.8639], [25, 4.22085],
        [26, 4.589], [27, 4.96845], [28, 5.35915], [29, 5.7611], [30, 6.1742],
        [31, 6.5914], [32, 7.0127], [33, 7.4379], [34, 7.867], [35, 8.30005],
        [36, 8.73705], [37, 9.17795], [38, 9.62265], [39, 10.07115], [40, 10.52345],
        [45, 10.99515], [50, 11.48615], [55, 11.9969], [60, 12.5278], [65, 13.07925],
        [70, 13.65065], [75, 14.2421], [80, 14.85405], [90, 15.5081], [100, 16.20575],
        [110, 16.91145], [120, 17.62525],
      ],
    },

    // ──────────────────────────────────────────────────────────────────
    // SI SGD — participating endowment with single-premium funding and
    // a fixed monthly coupon paid from policy month 37 (year 4) onwards
    // through to maturity at age 120. Optional premium financing:
    // customer puts down a portion, bank lends the rest, customer pays
    // interest-only for the policy term. Loan principal is repaid from
    // policy proceeds on surrender or claim.
    //
    // Factor tables transcribed from a baseline PI (Age 40, SGD 700K
    // single premium, Monthly Income = Paid Out, 4.25% IRR scenario).
    // Cross-checked against the user's working spreadsheet ("SI Financing
    // with Property Rental Breakdown") K/L columns — both match to the
    // dollar at PI anchor rows. Sparse anchor years (25, 30, 35, 40, then
    // Age 55–120 in 5-yr steps) are linearly interpolated by
    // lookupSlhFactor() to fill the in-between policy years.
    //
    // The baseline PI is age 40 — surrender value and death benefit
    // factors are intrinsic to attained age and policy duration. Changing
    // the displayed entry age in the UI only shifts the Age column; the
    // SV/DB curves are calibrated to the age-40 baseline. Re-cut the PI
    // and regenerate the tables for materially different entry ages.
    "SI3_SP": {
      key: "SI3_SP",
      label: "SI Single Premium",
      family: "SI3",
      kind: "par-income-fin",
      currencies: ["SGD"],
      premiumTermYears: 1,           // single-pay
      policyMaturityAge: 120,
      baselineEntryAge: 40,          // PI source age
      // Tiered coupon schedule — list of {fromYear, toYear, rate} where
      // rate is annualised % of single premium. For SI the schedule is
      // trivially flat (single tier from year 4 to maturity). Engine
      // resolves the rate for each policy year via getCouponRateForYear().
      siCouponSchedule: [
        { fromYear: 4, toYear: 80, rate: 0.036 },
      ],
      // Legacy / headline single rate — used by summary copy. Picks the
      // last (long-term) tier of the schedule for products with tiers.
      siCouponRate: 0.036,
      // Coupon rate component breakdown (informational). 1.24% guaranteed
      // + 2.36% non-guaranteed at 4.25% illustrated IRR = 3.60% total.
      // Source PI: guaranteed monthly $8,686/yr ÷ $700K = 1.241%,
      // non-guaranteed @ 4.25% IRR $16,531/yr ÷ $700K = 2.362%.
      siGuaranteedCouponRate:    0.012408,
      siNonGuaranteedCouponRate: 0.023615,
      siCouponRateLow:           0.023268,     // total @ 3.00% IRR fallback ($16,288 ÷ $700K)
      illustratedIRR:            0.0425,
      minPremiums: { SGD: { Annual: 200000 } },
      // Premium-financing defaults (used to seed the financing card).
      // The user's reference spreadsheet defaults to 28% downpayment /
      // 72% financed with 2.00% interest-only for 3 years.
      defaultFinancing: {
        enabled: true,
        financingPct: 0.72,
        interestRate: 0.02,
        interestTermYears: 3,
      },
      // Surrender value (cash value) factor per $1M single premium.
      // 4.25% illustrated IRR, Monthly Income = Paid Out scenario. Annual
      // rows yrs 1–20, sparse anchors at yrs 25/30/35/40 then Age-indexed
      // 55–120 (= policy years 15–80 for an age-40 baseline). Maturity
      // value at year 80 (age 120) = $1,067,789 per $1M.
      siSurrenderFactor: [
        [1, 800000],   [2, 800000],   [3, 800000],   [4, 804544],   [5, 816000],
        [6, 822727],   [7, 828000],   [8, 833000],   [9, 841500],   [10, 848703],
        [11, 859147],  [12, 870836],  [13, 882889],  [14, 894037],  [15, 904134],
        [16, 908149],  [17, 910646],  [18, 917227],  [19, 924846],  [20, 930456],
        [25, 970731],  [30, 1012690], [35, 1032486], [40, 1043487],
        [45, 1045442], [50, 1048533], [55, 1050799], [60, 1053179], [65, 1055690],
        [70, 1059111], [75, 1062029], [80, 1067789],
      ],
      // Death benefit factor per $1M single premium. 4.25% IRR Paid Out.
      // Same row indexing as siSurrenderFactor. Grows much slower than
      // SV (this is a participating endowment, not whole-life), reaching
      // ~$1.061M per $1M at maturity.
      siDeathBenefitFactor: [
        [1, 1051571],  [2, 1051763],  [3, 1052151],  [4, 1052243],  [5, 1052347],
        [6, 1052443],  [7, 1052529],  [8, 1052606],  [9, 1052699],  [10, 1052801],
        [11, 1052829], [12, 1052976], [13, 1053039], [14, 1053174], [15, 1053283],
        [16, 1053401], [17, 1053546], [18, 1053624], [19, 1053779], [20, 1053961],
        [25, 1054870], [30, 1055869], [35, 1056750], [40, 1057137],
        [45, 1057537], [50, 1058169], [55, 1058630], [60, 1059116], [65, 1059629],
        [70, 1060327], [75, 1060923], [80, 1061557],
      ],
    },

    // ──────────────────────────────────────────────────────────────────
    // SLR — participating whole-life endowment with single-premium
    // funding and a TIERED monthly coupon: years 2-5 pay 3.00% p.a.
    // (months 13-60), years 6 onwards step up to 3.45% p.a. (month 61
    // through maturity at age 120). Same financing layer as SI.
    //
    // Factor tables transcribed from the baseline PI (Age 40, SGD 1M
    // single premium, Monthly Income = Paid Out, 4.25% IRR scenario,
    // 20-May-2026 Policy Illustration). Base is $1M so values are
    // directly per-million (no scaling needed).
    //
    // Notable difference vs SI: death benefit DECREASES as monthly
    // income is paid out (sum insured 105% at year 1 → ~83% by year
    // 20) then resets to ~100% from age 80 onwards. Surrender value
    // is anchored at 80% of premium ($800K floor) by the Surrender
    // Value Booster Benefit, with non-guaranteed bonus layered on top
    // from year 5 onwards.
    "SLR_SP": {
      key: "SLR_SP",
      label: "SLR Single Premium",
      family: "SLR",
      kind: "par-income-fin",
      currencies: ["SGD"],
      premiumTermYears: 1,           // single-pay
      policyMaturityAge: 120,
      baselineEntryAge: 40,          // PI source age
      // Tiered coupon: 3.00% p.a. for years 2-5 (months 13-60),
      // 3.45% p.a. from year 6 onwards (month 61 to maturity). Year 1
      // has no payout (12-month waiting period before income starts).
      // Source PI: $2,500/mo × 12 ÷ $1M = 3.00%; $2,875/mo × 12 ÷ $1M
      // = 3.45%, both at 4.25% illustrated IRR.
      siCouponSchedule: [
        { fromYear: 2, toYear: 5,  rate: 0.030  },
        { fromYear: 6, toYear: 80, rate: 0.0345 },
      ],
      siCouponRate: 0.0345,                    // headline = long-term tier
      // Component breakdown (informational). Years 2-5: $834/mo
      // guaranteed = 1.0008%, $1,666/mo non-guaranteed = 2.0%; total
      // 3.0%. Years 6+: $1,000/mo guaranteed = 1.2%, $1,875/mo
      // non-guaranteed = 2.25%; total 3.45%.
      siGuaranteedCouponRateEarly:    0.010008,
      siNonGuaranteedCouponRateEarly: 0.020,
      siGuaranteedCouponRateLate:     0.012,
      siNonGuaranteedCouponRateLate:  0.0225,
      siCouponRateLow:                0.025056, // total @ 3.00% IRR long-term ($25,056 ÷ $1M)
      illustratedIRR:                 0.0425,
      minPremiums: { SGD: { Annual: 200000 } },
      defaultFinancing: {
        enabled: true,
        financingPct: 0.72,
        interestRate: 0.02,
        interestTermYears: 3,
      },
      // Surrender value factor per $1M single premium (= PI dollars
      // directly since the source PI used $1M premium). 4.25% IRR
      // Paid Out. Year 1-4 flat at the $800K SV Booster floor; year
      // 5 onwards layers in non-guaranteed bonus. Maturity at year 80
      // = $1,002,001.
      siSurrenderFactor: [
        [1, 800000],   [2, 800000],   [3, 800000],   [4, 800000],   [5, 800207],
        [6, 802272],   [7, 803560],   [8, 805337],   [9, 805579],   [10, 806959],
        [11, 814190],  [12, 823095],  [13, 823112],  [14, 823126],  [15, 823141],
        [16, 823153],  [17, 823169],  [18, 823185],  [19, 823206],  [20, 823233],
        [25, 823971],  [30, 824713],  [35, 827644],  [40, 1000001],
        [45, 1000001], [50, 1000001], [55, 1000001], [60, 1000001], [65, 1000001],
        [70, 1000001], [75, 1000001], [80, 1002001],
      ],
      // Death benefit factor per $1M single premium. Decreases as
      // monthly income is paid out — typical of "guaranteed income"
      // whole-life products where the DB is reduced dollar-for-dollar
      // against the cumulative payout. Resets to ~100% from age 80
      // (year 40) once the income stream catches up to the sum
      // insured. Pattern unique to SLR vs SI's slowly-rising curve.
      siDeathBenefitFactor: [
        [1, 1050079],  [2, 1040121],  [3, 1030129],  [4, 1020199],  [5, 1010209],
        [6, 998214],   [7, 986244],   [8, 974270],   [9, 962293],   [10, 950360],
        [11, 938386],  [12, 926420],  [13, 914451],  [14, 902483],  [15, 890517],
        [16, 878518],  [17, 866523],  [18, 854546],  [19, 842570],  [20, 830619],
        [25, 823971],  [30, 824713],  [35, 827644],  [40, 1000001],
        [45, 1000001], [50, 1000001], [55, 1000001], [60, 1000001], [65, 1000001],
        [70, 1000001], [75, 1000001], [80, 1002001],
      ],
    },

    "RRP_SP": {
      key: "RRP_SP",
      label: "RRP SP",
      family: "RRP",
      kind: "rrp",
      currencies: ["SGD"],
      rrpPremiumTerm: "single",
      premiumTermYears: 1,
      minPremiums: { SGD: { Annual: 1 } },
    },
    "RRP_5": {
      key: "RRP_5",
      label: "RRP 5",
      family: "RRP",
      kind: "rrp",
      currencies: ["SGD"],
      rrpPremiumTerm: 5,
      premiumTermYears: 5,
      minPremiums: { SGD: { Annual: 1 } },
    },
    "RRP_10": {
      key: "RRP_10",
      label: "RRP 10",
      family: "RRP",
      kind: "rrp",
      currencies: ["SGD"],
      rrpPremiumTerm: 10,
      premiumTermYears: 10,
      minPremiums: { SGD: { Annual: 1 } },
    },
    "RRP_15": {
      key: "RRP_15",
      label: "RRP 15",
      family: "RRP",
      kind: "rrp",
      currencies: ["SGD"],
      rrpPremiumTerm: 15,
      premiumTermYears: 15,
      minPremiums: { SGD: { Annual: 1 } },
    },
    "RRP_20": {
      key: "RRP_20",
      label: "RRP 20",
      family: "RRP",
      kind: "rrp",
      currencies: ["SGD"],
      rrpPremiumTerm: 20,
      premiumTermYears: 20,
      minPremiums: { SGD: { Annual: 1 } },
    },
    "SII": {
      key: "SII",
      label: "SII",
      family: "SII",
      kind: "sii",
      currencies: ["USD"],
      premiumTermYears: 1,
      minPremiums: { USD: { Annual: 100000 } },
    },
  };

  const VARIANT_ORDER = ["5F1", "6F2", "7F5", "10F3", "10F5", "10F8", "13F10", "IRG15F10", "IRG20F10", "SLH_SP", "SLH_3PAY", "SLH_5PAY", "SI3_SP", "SLR_SP", "RRP_SP", "RRP_5", "RRP_10", "RRP_15", "RRP_20", "SII"];
  const PARTIAL_WITHDRAWAL_VARIANTS = new Set(["10F3", "10F5", "10F8", "13F10", "IRG15F10", "IRG20F10"]);
  const PAR_WL_VARIANTS = new Set(["SLH_SP", "SLH_3PAY", "SLH_5PAY"]);
  const PAR_INCOME_VARIANTS = new Set(["SI3_SP", "SLR_SP"]);
  const RRP_VARIANTS = new Set(["RRP_SP", "RRP_5", "RRP_10", "RRP_15", "RRP_20"]);
  const RRP3_DATA = root.RRP3_RATES || {};
  const RRP_CONSTANTS = RRP3_DATA.productConstants || {};
  const RRP_GRID = Array.isArray(RRP3_DATA.estimatedAgeGrid) ? RRP3_DATA.estimatedAgeGrid : [];
  const RRP_RETIREMENT_AGES = Array.isArray(RRP_CONSTANTS.retirementAges) && RRP_CONSTANTS.retirementAges.length
    ? RRP_CONSTANTS.retirementAges
    : [50, 55, 60, 65, 70];
  const RRP_PAYOUT_PERIODS = Array.isArray(RRP_CONSTANTS.payoutPeriods) && RRP_CONSTANTS.payoutPeriods.length
    ? RRP_CONSTANTS.payoutPeriods
    : [5, 10, 15, 20, "lifetime"];
  const SII_DATA = root.SII_RATES || {};
  const SII_CONSTANTS = SII_DATA.productConstants || {};
  const SII_SCENARIOS = Array.isArray(SII_DATA.scenarios) ? SII_DATA.scenarios : [];

  // Resolve the annual coupon rate for a given policy year against
  // a variant's siCouponSchedule. Returns 0 if the year falls outside
  // all tiers (pre-payout years). Used by the par-income-fin engine.
  function getCouponRateForYear(schedule, year) {
    if (!Array.isArray(schedule)) return 0;
    for (const tier of schedule) {
      if (year >= tier.fromYear && year <= tier.toYear) return tier.rate;
    }
    return 0;
  }

  function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function pct(value) {
    return num(value) / 100;
  }

  function currencySymbol(currency) {
    return currency === "USD" ? "US$" : "S$";
  }

  function annualToMonthly(rate) {
    const floor = Math.max(rate, -0.999);
    return Math.pow(1 + floor, 1 / 12) - 1;
  }

  function rateForYear(table, year) {
    return table && table[year] ? table[year] : 0;
  }

  function welcomeRate(variant, annualizedPremium) {
    const band = variant.welcomeBands.find((item) => annualizedPremium >= item.min && annualizedPremium < item.max);
    return band ? band.rate : 0;
  }

  function annualizedMinimum(variant, currency, frequency) {
    const premium = variant.minPremiums[currency] && variant.minPremiums[currency][frequency];
    const freq = FREQUENCIES[frequency] || FREQUENCIES.Annual;
    return premium ? premium * freq.paymentsPerYear : null;
  }

  function policyFeeMonthly(variant, annualizedPremium, override) {
    if (Number.isFinite(override) && override >= 0) return override;
    const band = variant.policyFeeBand;
    if (!band) return 0;
    return annualizedPremium >= band.min && annualizedPremium < band.max ? band.monthlyFee : 0;
  }

  function cloneStrategy(strategy, years) {
    const out = [];
    for (let year = 1; year <= years; year += 1) {
      const row = strategy[year - 1] || {};
      out.push({
        year,
        basicPremium: num(row.basicPremium),
        topUp: num(row.topUp),
        navReturn: num(row.navReturn),
        dividendYield: num(row.dividendYield),
        dividendMode: row.dividendMode || "reinvest",
        optionalDeduction: num(row.optionalDeduction, num(row.otherOutflow)),
        dividendWithdrawal: num(row.dividendWithdrawal),
        partialWithdrawal: num(row.partialWithdrawal, num(row.withdrawal)),
      });
    }
    return out;
  }

  function premiumForYear(settings, year) {
    const variant = VARIANTS[settings.variantKey || "10F3"];
    return year <= variant.shortfallYears ? num(settings.annualizedPremium, 0) : 0;
  }

  function partialWithdrawalAllowed(variant, year) {
    return PARTIAL_WITHDRAWAL_VARIANTS.has(variant.key) && year >= (variant.partialLimitStartYear || 6);
  }

  function partialWithdrawalLimit(variant, year, accountValue, priorLimitUsage, dividendBasis = 0) {
    if (!partialWithdrawalAllowed(variant, year)) return 0;
    const residualFloor = 1000;
    const navAccountValue = Math.max(0, accountValue - Math.max(0, dividendBasis));
    const residualLimited = Math.min(navAccountValue, Math.max(0, accountValue - residualFloor));
    if (year <= variant.mipYears) {
      const cap = Number.isFinite(variant.mipPartialCap) ? variant.mipPartialCap : 0.5;
      return Math.max(0, Math.min(residualLimited, navAccountValue * cap - priorLimitUsage));
    }
    return residualLimited;
  }

  function defaultStrategy(settings, preset = "excelBase") {
    const variant = VARIANTS[settings.variantKey || "10F3"];
    const years = Math.max(1, Math.min(99, num(settings.projectionYears, 37)));
    const annualizedPremium = num(settings.annualizedPremium, 100000);
    const rows = [];
    for (let year = 1; year <= years; year += 1) {
      const row = {
        year,
        basicPremium: 0,
        topUp: 0,
        navReturn: 0,
        dividendYield: 0.06,
        dividendMode: "reinvest",
        optionalDeduction: 0,
        dividendWithdrawal: 0,
        partialWithdrawal: 0,
      };
      if (preset === "piMain") {
        row.basicPremium = annualizedPremium;
        row.navReturn = 0.08;
        row.dividendYield = 0;
      } else if (preset === "dividendLater") {
        row.basicPremium = premiumForYear(settings, year);
        row.navReturn = year <= variant.mipYears ? 0.065 : 0.015;
        row.dividendYield = year <= variant.mipYears ? 0 : 0.055;
        row.dividendMode = year <= variant.mipYears ? "none" : "payout";
      } else if (preset === "singlife") {
        row.basicPremium = year <= variant.shortfallYears ? 50000 : 0;
        row.dividendYield = 0.063;
        row.optionalDeduction = year <= 23 ? 5629 + 3055.26 : 3055.26;
      } else if (preset === "backdated") {
        row.basicPremium = year <= variant.shortfallYears ? 100000 : 0;
        row.dividendYield = 0.07;
        row.optionalDeduction = year === 1 ? 7598.63 + 3055.26 : year <= 23 ? 5065.75 + 3055.26 : 3055.26;
      } else if (preset === "blank") {
        row.dividendYield = 0;
        row.dividendMode = "none";
      } else {
        row.basicPremium = premiumForYear(settings, year);
        row.dividendYield = 0.06;
      }
      rows.push(row);
    }
    return rows;
  }

  function irrMonthly(cashFlows) {
    const hasPositive = cashFlows.some((x) => x > 0);
    const hasNegative = cashFlows.some((x) => x < 0);
    if (!hasPositive || !hasNegative) return null;
    let rate = 0.005;
    for (let i = 0; i < 60; i += 1) {
      let npv = 0;
      let derivative = 0;
      for (let t = 0; t < cashFlows.length; t += 1) {
        const cashFlow = cashFlows[t] || 0;
        const denom = Math.pow(1 + rate, t);
        npv += cashFlow / denom;
        if (t > 0) derivative -= (t * cashFlow) / Math.pow(1 + rate, t + 1);
      }
      if (Math.abs(npv) < 0.0001) break;
      if (Math.abs(derivative) < 1e-10) break;
      const next = rate - npv / derivative;
      if (!Number.isFinite(next) || next <= -0.99) break;
      if (Math.abs(next - rate) < 1e-10) {
        rate = next;
        break;
      }
      rate = next;
    }
    return Number.isFinite(rate) ? Math.pow(1 + rate, 12) - 1 : null;
  }

  // Linear-interpolate a factor table {year, factor} for any policy year.
  // The SLH workbook gives factors at every year up to 40, then sparse
  // (45, 50, 55, ..., 120) — interpolation keeps the chart smooth.
  function lookupSlhFactor(table, year) {
    if (!table || !table.length) return 0;
    if (year <= table[0][0]) return table[0][1];
    if (year >= table[table.length - 1][0]) return table[table.length - 1][1];
    for (let i = 0; i < table.length - 1; i += 1) {
      const [y1, f1] = table[i];
      const [y2, f2] = table[i + 1];
      if (year >= y1 && year <= y2) {
        const t = (year - y1) / (y2 - y1);
        return f1 + t * (f2 - f1);
      }
    }
    return table[table.length - 1][1];
  }

  // Participating whole-life simulator (SLH SP / 3-Pay / 5-Pay).
  // Different math from the ILP variants: instead of a monthly account-
  // value engine, we apply pre-computed factor tables (TotalSurrender /
  // base premium at the illustration's 7.50% bonus realisation rate).
  // We still produce an ILP-shaped result so all the existing
  // renderers — strategy table, hero, composition, chart, annual
  // projection — keep working without modification.
  function simulateParWL(settings, strategy, mode = "custom") {
    const variant = VARIANTS[settings.variantKey];
    // Par-WL projects to policy year 120 (whole-life horizon, matching the
    // insurer's PI document and the SLH workbook). Not age-capped — at
    // start-age 40, year 120 is "age 160", which is beyond mortality but
    // is the full length of the factor schedule. Caller's projectionYears
    // is ignored for par-WL.
    const years = 120;
    const annualPremium = num(settings.annualizedPremium, 100000);
    const startAge = num(settings.startAge, 36);
    const premiumTerm = variant.premiumTermYears || 1;

    const annual = [];
    const monthly = [];
    const cashFlows = new Array(years * 12 + 1).fill(0);

    let totalBasicPaid = 0;
    let cumulativeBonus = 0;

    for (let year = 1; year <= years; year += 1) {
      // Premium paid this year — single lump for SP at year 1, or one
      // annual premium per year for the first `premiumTerm` years.
      const premiumThisYear = year <= premiumTerm ? annualPremium : 0;
      totalBasicPaid += premiumThisYear;
      if (premiumThisYear > 0) {
        // Charge premium at the start of the policy year (month index)
        const monthIndex = (year - 1) * 12;
        cashFlows[monthIndex] -= premiumThisYear;
      }

      // Lookup factors. The basis depends on the variant's workbook
      // column convention:
      //   • "annual"     — factor × annualPremium gives $ value.
      //                    SP and 5-Pay use this (factor 1.0 means
      //                    "1 annual premium worth of value").
      //   • "cumulative" — factor × cumulative premium paid up to year.
      //                    3-Pay uses this (factor 1.0 means "value =
      //                    total premiums paid to date" = breakeven).
      // The workbook's Reinvested mode keeps everything inside the
      // policy: there's no recurring cash drawdown unless the user
      // opts in (separate feature). Each row gives the policyholder
      // the option to surrender or take an adhoc drawdown at that
      // point — both computed from the NG bonus.
      const surrenderFactor = lookupSlhFactor(variant.slhFactorTable, year);
      const guaranteedFactor = lookupSlhFactor(variant.slhGuaranteedTable, year);
      const factorBasis = variant.slhFactorBasis === "cumulative"
        ? totalBasicPaid                 // includes the premium just paid this year
        : annualPremium;
      const surrenderValue = surrenderFactor * factorBasis;
      const guaranteedValue = guaranteedFactor * factorBasis;
      const nonGuaranteedBonus = Math.max(0, surrenderValue - guaranteedValue);
      const totalValue = surrenderValue;        // Reinvested → everything stays in the policy
      cumulativeBonus = nonGuaranteedBonus;

      // Map par-WL concepts onto the ILP shape used by renderers:
      //   accountValue    = total surrender value (incl. NG bonus)
      //   surrenderValue  = guaranteed surrender value (no NG)
      //   totalValue      = total surrender value (Reinvested mode)
      //   deathBenefit    = max(101% × premium paid, totalValue) proxy
      const deathBenefit = Math.max(1.01 * totalBasicPaid, totalValue);
      const drawdownThisYear = 0;               // no recurring drawdown
      const cumulativeDrawdown = 0;
      // Par-WL has a single non-guaranteed component (terminal bonus
      // accumulated to date). The composition chart breaks "non-
      // guaranteed value" into bonuses + dividends + investment growth;
      // for par-WL we attribute the entire non-guaranteed portion to
      // Investment growth (`growth = total - paid - bonuses - dividends`),
      // so set bonuses + dividends to 0. This avoids double-counting
      // (where the same terminal bonus would show twice).
      annual.push({
        year,
        age: startAge + year,
        premiums: premiumThisYear,
        topUps: 0,
        bonuses: 0,
        grossDividends: 0,
        cashDividends: 0,
        reinvestedDividends: 0,
        totalReinvestedDividends: 0,
        adminCharges: 0,
        policyFees: 0,
        shortfallCharges: 0,
        coiCharges: 0,
        optionalDeductions: 0,
        dividendWithdrawals: 0,
        partialWithdrawals: drawdownThisYear,    // surface drawdown as "partial withdrawal" for the access-legend renderer
        withdrawalCharges: 0,
        dividendWithdrawalLimit: 0,
        partialWithdrawalLimit: 0,
        partialWithdrawalChargeRate: 0,
        adminRate: 0,
        accountValue: surrenderValue,            // current cash surrender value
        surrenderValue: guaranteedValue,         // guaranteed-only baseline
        deathBenefit,
        cashWithdrawals: cumulativeDrawdown,     // cumulative cash drawn since PY10
        totalValue,                              // surrender + cumulative drawdown
        totalBasicPaid,
        totalTopUps: 0,
        surrenderChargeRate: 0,
        surrenderCharge: 0,
        reinvestedDividendBasis: 0,
        lapsed: false,
        // Surface the par-WL specific non-guaranteed component for any
        // future renderer that wants to show it explicitly.
        slhTerminalBonus: nonGuaranteedBonus,
        slhNonGuaranteedBonus: nonGuaranteedBonus,
        // Adhoc 50% drawdown — informational one-off cash the policyholder
        // could pull out at this year (without losing the surrender value
        // baseline). Computed as 50% of the accrued non-guaranteed bonus.
        // Per the SLH workbook, the adhoc drawdown facility opens only
        // from policy year 11 onwards — the option doesn't exist before
        // that. Show 0 (rendered as "—") for years 1–10.
        slhAdhocDrawdown50: year >= 11 ? nonGuaranteedBonus * 0.50 : 0,
        slhYieldFactor: totalValue > 0 && totalBasicPaid > 0
          ? Math.pow(totalValue / totalBasicPaid, 1 / year) - 1
          : 0,
        // Placeholders filled in below if BR income mode is on.
        brIncomeThisYear: 0,
        brCumulativeIncome: 0,
      });

      // Monthly stub — par-WL doesn't have month-granular behaviour but
      // some downstream renderers (chart hover at year boundaries) walk
      // monthly[]; producing one synthetic record per year keeps them
      // happy without lying about intra-year movement.
      monthly.push({
        month: year * 12,
        year,
        age: startAge + year,
        accountValue: surrenderValue,
        surrenderValue: guaranteedValue,
        deathBenefit,
        cashDividends: 0,
        cashWithdrawals: cumulativeDrawdown,
        totalValue,
        totalBasicPaid,
        totalTopUps: 0,
        totalReinvestedDividends: 0,
        reinvestedDividendBasis: 0,
        lapsed: false,
      });
    }

    // Bonus Realisation income mode: 7% of accrued non-guaranteed
    // bonus is realised as cash each year from policy year 10 onwards.
    // The remaining 93% continues to compound in the policy.
    //
    // Two execution paths:
    //
    //   • EXACT: variant has slhBRTotalFactor + slhBRCumulativeRealised
    //     hardcoded from the workbook (currently SP only). Use those
    //     factors directly — reproduces the workbook to the dollar.
    //
    //   • APPROXIMATE: variant doesn't have BR factors yet (3-Pay,
    //     5-Pay). Fall back to a year-on-year approximation:
    //         brNG_y = brNG_{y-1} × reinvested_growth_y × (1 - 0.07)
    //     This matches the SP workbook to within ~1% for early years
    //     and gets less accurate over time. Plug in the workbook BR
    //     factor tables for 3-Pay / 5-Pay when available for exact
    //     reproduction.
    //
    // In both paths the row's "total surrender value" [A]+[B] reflects
    // the CURRENT POLICY VALUE (not including realised cash income).
    // The workbook's "Total Value [A]+[B]+[C]" = policy + cumulative
    // realised. We surface BOTH so the renderer can show "Total Wealth"
    // = policy value + realised income clearly.
    if (settings.enableBRIncome) {
      const brStartYear = 10;
      const brRate = 0.07;
      const brTotalTable = variant.slhBRTotalFactor;
      const brCumTable = variant.slhBRCumulativeRealised;
      const hasExact = Array.isArray(brTotalTable) && Array.isArray(brCumTable);
      const cumYears = (year) => Math.min(year, variant.premiumTermYears || 1);
      const basisAtYear = (year, paidAtYear) => variant.slhFactorBasis === "cumulative"
        ? paidAtYear
        : annualPremium;

      if (hasExact) {
        // Exact reproduction from workbook factor tables.
        //
        // Note on the "Current Year Realised Bonus" column: per the
        // workbook formula, it equals 7% × NG_BR_PRE_drawdown, which
        // is equivalent to NG_BR_post × 0.07 / 0.93. Computing as
        // (cum_this_year − cum_prev_year) would give the wrong number
        // for sparsely-tabulated years (45, 50, 55, ...) where we
        // interpolate between explicit rows.
        for (let i = 0; i < annual.length; i += 1) {
          const row = annual[i];
          const basis = basisAtYear(row.year, row.totalBasicPaid);
          const brTotalSV = lookupSlhFactor(brTotalTable, row.year) * basis;
          const brCumRealised = lookupSlhFactor(brCumTable, row.year) * basis;
          const brNG = Math.max(0, brTotalSV - (row.surrenderValue || 0));
          // Current realised = 7% of NG pre-drawdown = NG_post * (7/93).
          // Zero before the brStartYear since no realisation occurs.
          const currentRealised = row.year >= brStartYear
            ? brNG * (brRate / (1 - brRate))
            : 0;
          row.slhNonGuaranteedBonus = brNG;
          row.slhTerminalBonus = brNG;
          row.totalValue = brTotalSV;                  // [A]+[B] policy value
          row.accountValue = brTotalSV;
          row.brIncomeThisYear = currentRealised;
          row.brCumulativeIncome = brCumRealised;
          row.brTotalWealth = brTotalSV + brCumRealised; // [A]+[B]+[C]
          row.slhAdhocDrawdown50 = row.year >= 11 ? brNG * 0.50 : 0;
          // Yield is set in a separate IRR pass after all rows are
          // populated — see "Compute BR-mode yield as IRR per year"
          // section below. Reason: yield = IRR of cashflow stream up
          // to that year (premiums out, realised cash + final
          // surrender in), which gives a monotonic curve matching
          // the workbook's "Effective Annual Yield (With Bonus
          // Payouts)" column. The simple compound formula
          // (totalWealth/paid)^(1/year)-1 was wrong because realised
          // cash isn't compounding inside the policy.
        }
      } else {
        // Approximation for variants without BR factor tables yet.
        const reinvNG = annual.map((r) => r.slhNonGuaranteedBonus || 0);
        let brNG = 0;
        let brCumulative = 0;
        for (let i = 0; i < annual.length; i += 1) {
          const row = annual[i];
          if (row.year < brStartYear) {
            brNG = reinvNG[i];
            row.brIncomeThisYear = 0;
            row.brCumulativeIncome = 0;
            row.brTotalWealth = row.totalValue;
            continue;
          }
          const prevReinv = reinvNG[i - 1] || 0;
          const growthFactor = prevReinv > 0 ? reinvNG[i] / prevReinv : 1;
          brNG *= growthFactor;
          const drawThisYear = brNG * brRate;
          brNG -= drawThisYear;
          brCumulative += drawThisYear;
          row.brIncomeThisYear = drawThisYear;
          row.brCumulativeIncome = brCumulative;
          row.slhNonGuaranteedBonus = brNG;
          row.slhTerminalBonus = brNG;
          row.totalValue = (row.surrenderValue || 0) + brNG;   // [A]+[B]
          row.accountValue = row.totalValue;
          row.brTotalWealth = row.totalValue + brCumulative;   // [A]+[B]+[C]
          row.slhAdhocDrawdown50 = row.year >= 11 ? brNG * 0.50 : 0;
          // Yield set in IRR pass below.
        }
      }

      // Adjust cash flows: each year's realised income is a positive
      // cash event so IRR sees the income as a return.
      annual.forEach((row, i) => {
        if (row.year >= brStartYear && (row.brIncomeThisYear || 0) > 0) {
          cashFlows[(i + 1) * 12] = (cashFlows[(i + 1) * 12] || 0) + row.brIncomeThisYear;
        }
      });

      // Compute BR-mode yield as IRR per year. The workbook's
      // "Effective Annual Yield (With Bonus Payouts)" column shows the
      // rate at which premium grown forward equals (final surrender +
      // realised cash with same-rate accumulation) — i.e. the IRR of
      // the cashflow stream if surrendered at year Y. This gives a
      // monotonic increasing yield that matches the workbook (~0.1%
      // off due to month-vs-year compounding conventions).
      //
      // Implementation: for each row Y, snapshot cashflows up to that
      // year, overlay the row's totalValue as a final +inflow at Y,
      // run irrMonthly. Convert monthly rate → annual.
      annual.forEach((row, idx) => {
        if (row.year < 9 || (row.totalValue || 0) <= 0) {
          row.slhYieldFactor = 0;
          return;
        }
        const cf = cashFlows.slice(0, row.year * 12 + 1);
        // Add this year's surrender as a final inflow (overlay; the
        // realised at that month is already in cashFlows from the
        // pass above).
        cf[cf.length - 1] = (cf[cf.length - 1] || 0) + (row.totalValue || 0);
        // irrMonthly returns the annualised IRR directly (it internally
        // converts the monthly rate to (1+r_m)^12 - 1 before returning).
        const annualised = irrMonthly(cf);
        row.slhYieldFactor = annualised !== null && Number.isFinite(annualised) ? annualised : 0;
      });
      // Update monthly stubs so chart hover stays consistent
      monthly.forEach((m, i) => {
        const row = annual[i];
        if (!row) return;
        m.totalValue = row.totalValue;
        m.accountValue = row.totalValue;
        m.cashWithdrawals = row.brCumulativeIncome || 0;
      });
    }

    // Final cash flow: the residual SURRENDER value at end of horizon
    // (drawdowns are already booked in their respective years above, so
    // we don't double-count them here). IRR sees: -premiums in early
    // years, +drawdowns annually from PY10, +residual surrender at end.
    cashFlows[years * 12] += annual[annual.length - 1].accountValue;

    const final = annual[annual.length - 1] || {};
    const irr = irrMonthly(cashFlows);
    return {
      mode,
      variant,
      settings: { ...settings, adminAfter: 0, policyFee: 0 },
      annual,
      monthly,
      final: {
        ...final,
        irr,
        bonusTotal: 0,                    // par-WL non-guaranteed value sits in `growth`, not bonuses
        netCapital: totalBasicPaid,
        brTotalIncome: final.brCumulativeIncome || 0,
      },
      cashFlows,
      warnings: validateParWL(settings, variant),
    };
  }

  function validateParWL(settings, variant) {
    const warnings = [];
    if (!variant.currencies.includes(settings.currency)) {
      warnings.push(`${variant.label} is not available in ${settings.currency}.`);
    }
    const minimum = annualizedMinimum(variant, settings.currency, settings.paymentFrequency);
    if (minimum !== null && num(settings.annualizedPremium) < minimum) {
      warnings.push(`Annualised premium is below the ${currencySymbol(settings.currency)}${minimum.toLocaleString()} minimum for this plan.`);
    }
    return warnings;
  }

  // ──────────────────────────────────────────────────────────────────
  // SI simulator with optional premium financing.
  //
  // Math (per the reference spreadsheet, calibrated against the SI PI
  // baseline at age 40, $700K single premium, Paid Out mode, 4.25% IRR):
  //
  //   premium              = single premium ($)
  //   financingPct         = portion of premium financed by the bank
  //   financedAmount       = premium × financingPct       (loan principal)
  //   downpayment          = premium × (1 − financingPct) (customer cash)
  //   annualInterest       = financedAmount × interestRate
  //   totalInterestPaid    = annualInterest × interestTermYears
  //   couponRate           = variant.siCouponRate (3.6% default at 4.25% IRR)
  //   grossPayoutYr        = year >= 4 ? premium × couponRate : 0
  //   netPayoutYr (during financing window) = grossPayoutYr − annualInterest
  //   netPayoutYr (after  financing window) = grossPayoutYr
  //
  // SV(y) / DB(y) factors are looked up from siSurrenderFactor /
  // siDeathBenefitFactor (per $1M) and scaled by (premium / 1e6).
  //
  // "Cash Value (Minus Financing)" subtracts the outstanding loan
  // principal — since financing is interest-only, the principal stays
  // constant at financedAmount throughout the policy term.
  //
  // "Total Outflow" mirrors the spreadsheet's column F: a running cash
  // position track equal to (−downpayment + cumulative net payouts).
  // Negative early years = still in the hole; turns positive once
  // payouts have repaid the downpayment.
  //
  // "Total Received" = cumulative net payouts + cash-value-minus-financing.
  // Represents the customer's total economic position if surrendered at
  // that year.
  function simulateParIncome(settings, strategy, mode = "custom") {
    const variant = VARIANTS[settings.variantKey];
    const premium = num(settings.annualizedPremium, 200000);
    const baselineAge = variant.baselineEntryAge || 40;
    const startAge = num(settings.startAge, baselineAge);
    const maturityAge = variant.policyMaturityAge || 120;
    // Project to policy maturity, NOT a fixed 80-year window. Cap the
    // horizon at (maturityAge − startAge) so the final row sits at the
    // policy's actual maturity age regardless of the entry age the
    // advisor picked. Previously hardcoded to (maturityAge − baselineAge),
    // which over-ran past age 120 whenever startAge > baselineAge.
    const years = Math.max(1, maturityAge - startAge);

    // Financing inputs. Hard cap at 72% — the maximum bank co-share
    // available in the Singapore market for SI premium financing.
    // Interest is paid every year of the policy (no fixed "interest
    // term" — loan stays outstanding until policy surrender / maturity).
    const finEnabled = !!settings.siFinancingEnabled;
    const financingPct = finEnabled ? Math.max(0, Math.min(0.72, num(settings.siFinancingPct, 0))) : 0;
    const interestRate = finEnabled ? Math.max(0, num(settings.siInterestRate, 0)) : 0;
    const financedAmount = premium * financingPct;
    const downpayment = premium - financedAmount;
    const annualInterest = financedAmount * interestRate;

    // Coupon resolution. Variants supply a tiered siCouponSchedule
    // (list of {fromYear, toYear, rate}); the year-1 rate of the
    // first tier doubles as the payoutStartYear (= first paying year).
    // The headline siCouponRate (last tier, long-term) is what the
    // summary tile uses for the "Net Annual Payout" figure.
    const couponSchedule = Array.isArray(variant.siCouponSchedule) && variant.siCouponSchedule.length
      ? variant.siCouponSchedule
      : [{ fromYear: variant.payoutStartYear || 4, toYear: years, rate: num(variant.siCouponRate, 0.036) }];
    const payoutStartYear = couponSchedule[0].fromYear;
    const headlineCouponRate = couponSchedule[couponSchedule.length - 1].rate;
    const grossAnnualPayout = premium * headlineCouponRate;       // long-term steady-state (Year 6+ for SLR, Year 4+ for SI)

    // Reference window for headline payout-rate calculation: the
    // number of YEARS the customer pays interest out-of-pocket before
    // the coupon starts (i.e. policy years prior to the first paying
    // tier). For SI this is 3 (interest yrs 1-3, payouts start yr 4);
    // for SLR this is 1 (interest yr 1 only, payouts start yr 2). The
    // "Total Capital Out" metric uses this for the customer's actual
    // initial commitment, instead of a hardcoded 3-year assumption.
    const referenceInterestTermYears = Math.max(0, payoutStartYear - 1);
    const referenceTotalInterest = annualInterest * referenceInterestTermYears;
    // Lifetime interest over the full policy term (informational only).
    const totalInterestPaid = annualInterest * years;

    const annual = [];
    const monthly = [];
    const cashFlows = new Array(years * 12 + 1).fill(0);

    // Year 1, month 0: customer pays the downpayment as a cash outflow.
    // Financed amount is paid by the bank — it never leaves the customer's
    // pocket, so we don't book it here. Bank repayment happens at the
    // policy event (surrender, claim, or maturity) and is reflected in
    // the final cashflow inflow (cashValue minus loan).
    cashFlows[0] -= downpayment;

    let cumulativeNetPayout = 0;
    let cumulativeInterestPaid = 0;
    let cumulativeGrossPayout = 0;

    for (let year = 1; year <= years; year += 1) {
      const sFactor = lookupSlhFactor(variant.siSurrenderFactor, year);
      const dbFactor = lookupSlhFactor(variant.siDeathBenefitFactor, year);
      const cashValue = sFactor * (premium / 1_000_000);
      const deathBenefit = dbFactor * (premium / 1_000_000);

      // Resolve this year's coupon rate from the variant schedule.
      // SI is flat (3.6% from year 4 to maturity). SLR steps up:
      // 3.0% years 2-5, 3.45% year 6 to maturity. Pre-tier years
      // return 0 (no payout).
      const couponRateThisYear = getCouponRateForYear(couponSchedule, year);
      const grossPayout = premium * couponRateThisYear;
      // Interest applies for every year while financing is enabled — the
      // reference spreadsheet's "Net Payout" formula assumes the loan
      // rolls at the same rate indefinitely (steady-state view). The
      // "Interest Term" input drives the summary metric ("3 Years
      // Interest" in the summary card) — it's a labeling concept, not a
      // hard cutoff on when interest stops.
      const interestThisYear = financingPct > 0 ? annualInterest : 0;
      // Net payout = gross payout − annual interest cost.
      // Pre-payout years: gross is 0, so net would be negative (you're
      // paying interest out of pocket). Floor at zero in the table —
      // the actual interest outflow is captured in the summary tiles
      // and in the cumulative interest tracker.
      const netPayout = couponRateThisYear > 0
        ? grossPayout - interestThisYear
        : 0;

      cumulativeGrossPayout += grossPayout;
      cumulativeNetPayout += netPayout;
      // Interest is paid every year of the policy — accumulates over
      // the full horizon. The summary surfaces annualInterest (the
      // recurring cost) as the headline; this cumulative is available
      // for break-even and total-cost reporting.
      cumulativeInterestPaid += interestThisYear;

      const cashValueMinusFinancing = cashValue - financedAmount;
      const totalReceived = cumulativeNetPayout + cashValueMinusFinancing;
      // Total Outflow = customer's running net cash position vs the
      // initial downpayment. Smooth monotonic progression: flat at
      // −downpayment through the pre-payout years, then improves by
      // the Net Payout each year from policy year 4. Reaches break-
      // even when cumulative net payouts equal the downpayment.
      //
      // Originally we mirrored the spreadsheet's formula (−downpayment
      // + year × current_gross_payout) but that produced a spurious
      // year-3 to year-4 jump (e.g. −$56K → −$27K in one step) because
      // it treated the gross coupon as if it had been received from
      // policy year 1. Switched to actual cumulative net payouts so
      // the column reads as a clean running total.
      const totalOutflow = -downpayment + cumulativeNetPayout;

      // Cashflow stream for IRR / chart hover. Net payout posts at the
      // end of the policy year (month index = year * 12).
      if (netPayout !== 0) {
        cashFlows[year * 12] += netPayout;
      }

      annual.push({
        year,
        age: startAge + year,        // end-of-year age per PI convention (year 1 → age startAge+1)
        premiums: year === 1 ? downpayment : 0,         // customer's actual out-of-pocket this year
        topUps: 0,
        bonuses: 0,
        grossDividends: 0,
        cashDividends: netPayout,                       // surface net coupon as "cash dividend"-shaped field
        reinvestedDividends: 0,
        totalReinvestedDividends: 0,
        adminCharges: 0,
        policyFees: 0,
        shortfallCharges: 0,
        coiCharges: 0,
        optionalDeductions: 0,
        dividendWithdrawals: netPayout,
        partialWithdrawals: 0,
        withdrawalCharges: 0,
        dividendWithdrawalLimit: 0,
        partialWithdrawalLimit: 0,
        partialWithdrawalChargeRate: 0,
        adminRate: 0,
        accountValue: cashValue,
        surrenderValue: cashValue,
        deathBenefit,
        cashWithdrawals: cumulativeNetPayout,
        totalValue: cashValueMinusFinancing,
        totalBasicPaid: year >= 1 ? downpayment + cumulativeInterestPaid : 0,
        totalTopUps: 0,
        surrenderChargeRate: 0,
        surrenderCharge: 0,
        reinvestedDividendBasis: 0,
        lapsed: false,
        // SI-specific surfaced fields used by the dedicated renderer.
        siGrossPayout: grossPayout,
        siNetPayout: netPayout,
        siInterestThisYear: interestThisYear,
        siCumulativeGrossPayout: cumulativeGrossPayout,
        siCumulativeNetPayout: cumulativeNetPayout,
        siCashValue: cashValue,
        siCashValueMinusFinancing: cashValueMinusFinancing,
        siDeathBenefit: deathBenefit,
        siTotalOutflow: totalOutflow,
        siTotalReceived: totalReceived,
      });

      monthly.push({
        month: year * 12,
        year,
        age: startAge + year,        // end-of-year age per PI convention (year 1 → age startAge+1)
        accountValue: cashValue,
        surrenderValue: cashValue,
        deathBenefit,
        cashDividends: netPayout,
        cashWithdrawals: cumulativeNetPayout,
        totalValue: cashValueMinusFinancing,
        totalBasicPaid: downpayment + cumulativeInterestPaid,
        totalTopUps: 0,
        totalReinvestedDividends: 0,
        reinvestedDividendBasis: 0,
        lapsed: false,
      });
    }

    // Final cashflow: residual cash-value-minus-financing at horizon.
    const finalRow = annual[annual.length - 1] || {};
    cashFlows[years * 12] += finalRow.siCashValueMinusFinancing || 0;

    const irr = irrMonthly(cashFlows);

    // Summary metrics for the 5-card panel — matches the reference
    // spreadsheet's headline figures:
    //   1. Initial Payment      = downpayment
    //   2. 3 Years Interest     = 3 × annualInterest (initial commitment)
    //   3. Total Capital Out    = downpayment + 3-year interest
    //   4. Net Annual Payout    = gross coupon − annual interest
    //   5. Payout Rate          = net annual ÷ total capital out
    // Interest still applies every year of the projection — the
    // 3-year window is the spreadsheet's quoted basis for the headline
    // yield calc, not a literal "stops after 3 years" assumption.
    const totalCapitalOut = downpayment + referenceTotalInterest;
    const netAnnualPayout = grossAnnualPayout - annualInterest;
    // Per-tier metrics so the summary card can show "S$15,600 yrs 2-5,
    // S$20,100 yrs 6+" for tiered products like SLR. Single-tier
    // products (SI) reduce trivially to a single row.
    const tieredMetrics = couponSchedule.map((tier) => {
      const grossAnnual = premium * tier.rate;
      const netAnnual = grossAnnual - annualInterest;
      return {
        fromYear: tier.fromYear,
        toYear: tier.toYear,
        rate: tier.rate,
        grossAnnual,
        netAnnual,
        payoutRate: totalCapitalOut > 0 ? netAnnual / totalCapitalOut : 0,
      };
    });
    const summary = {
      premium,
      financingPct,
      financedAmount,
      downpayment,
      interestRate,
      annualInterest,
      referenceInterestTermYears,
      referenceTotalInterest,                 // N × annualInterest (N derived from first tier)
      totalInterestPaid,                      // cumulative over full term — informational
      grossAnnualPayout,
      netAnnualPayoutDuringFinancing: netAnnualPayout,
      totalCapitalOut,
      payoutRate: totalCapitalOut > 0
        ? netAnnualPayout / totalCapitalOut
        : 0,
      couponRate: headlineCouponRate,
      couponSchedule,
      payoutStartYear,
      tieredMetrics,
    };

    return {
      mode,
      variant,
      settings: { ...settings, adminAfter: 0, policyFee: 0 },
      annual,
      monthly,
      final: {
        ...finalRow,
        irr,
        bonusTotal: 0,
        netCapital: downpayment + totalInterestPaid,
        siSummary: summary,
      },
      cashFlows,
      siSummary: summary,
      warnings: validateParIncome(settings, variant),
    };
  }

  function validateParIncome(settings, variant) {
    const warnings = [];
    if (!variant.currencies.includes(settings.currency)) {
      warnings.push(`${variant.label} is not available in ${settings.currency}.`);
    }
    const minimum = annualizedMinimum(variant, settings.currency, settings.paymentFrequency);
    if (minimum !== null && num(settings.annualizedPremium) < minimum) {
      warnings.push(`Single premium is below the ${currencySymbol(settings.currency)}${minimum.toLocaleString()} minimum for this plan.`);
    }
    // Entry-age calibration warning removed per advisor request — the
    // baseline-PI nuance is documented in the SI disclaimers section
    // rather than nagging via the warnings box on every age change.
    if (settings.siFinancingEnabled) {
      const annualInterest = num(settings.annualizedPremium, 0) * num(settings.siFinancingPct, 0) * num(settings.siInterestRate, 0);
      const grossPayout = num(settings.annualizedPremium, 0) * num(variant.siCouponRate, 0.036);
      if (annualInterest > grossPayout) {
        warnings.push(`Annual loan interest (${currencySymbol(settings.currency)}${Math.round(annualInterest).toLocaleString()}) exceeds annual coupon (${currencySymbol(settings.currency)}${Math.round(grossPayout).toLocaleString()}). Net payout will be negative every year — consider lowering financing % or interest rate.`);
      }
    }
    return warnings;
  }

  function normalizeRrpTerm(value) {
    if (value === "single" || value === "SP" || value === "sp") return "single";
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }

  function rrpTermKey(value) {
    const term = normalizeRrpTerm(value);
    return term === "single" ? "single" : String(term);
  }

  function normalizeRrpPayout(value) {
    const raw = String(value ?? "").toLowerCase();
    if (raw.includes("life")) return "lifetime";
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }

  function rrpPayoutKey(value) {
    const payout = normalizeRrpPayout(value);
    return payout === "lifetime" ? "lifetime" : String(payout);
  }

  function rrpVariantTerm(variant) {
    if (!variant) return "single";
    return normalizeRrpTerm(variant.rrpPremiumTerm ?? variant.premiumPaymentTerm ?? variant.premiumTermYears);
  }

  function rrpIsSinglePremium(term) {
    return normalizeRrpTerm(term) === "single";
  }

  function rrpPayoutYears(payout, retirementAge) {
    const value = normalizeRrpPayout(payout);
    if (value === "lifetime") return Math.max(1, 120 - retirementAge);
    return Math.max(1, Number(value) || 1);
  }

  function rrpPayoutLabel(payout) {
    const value = normalizeRrpPayout(payout);
    return value === "lifetime" ? "Lifetime" : `${value} Years`;
  }

  function rrpTermLabel(term) {
    const value = normalizeRrpTerm(term);
    return value === "single" ? "Single Premium" : `${value} Years`;
  }

  function rrpGridRowsForTerm(term) {
    const key = rrpTermKey(term);
    return RRP_GRID.filter((row) => rrpTermKey(row.premium_payment_term) === key);
  }

  function rrpAvailablePayoutsForTerm(term) {
    const seen = new Map();
    rrpGridRowsForTerm(term).forEach((row) => {
      const payout = normalizeRrpPayout(row.income_payout_period);
      seen.set(rrpPayoutKey(payout), payout);
    });
    const order = new Map(RRP_PAYOUT_PERIODS.map((p, index) => [rrpPayoutKey(p), index]));
    return Array.from(seen.values()).sort((a, b) => {
      const ia = order.has(rrpPayoutKey(a)) ? order.get(rrpPayoutKey(a)) : 99;
      const ib = order.has(rrpPayoutKey(b)) ? order.get(rrpPayoutKey(b)) : 99;
      return ia - ib;
    });
  }

  function rrpRowsForScenario({ retirementAge, premiumTerm, payoutPeriod }) {
    const retireNum = Math.round(Number(retirementAge));
    const termKey = rrpTermKey(premiumTerm);
    const payoutKey = rrpPayoutKey(payoutPeriod);
    return RRP_GRID
      .filter((row) =>
        Math.round(Number(row.target_retirement_age)) === retireNum
        && rrpTermKey(row.premium_payment_term) === termKey
        && rrpPayoutKey(row.income_payout_period) === payoutKey
      )
      .sort((a, b) => Math.round(Number(a.life_insured_age)) - Math.round(Number(b.life_insured_age)));
  }

  function rrpFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function rrpEstimateNumeric(left, right, targetAge, key) {
    const leftValue = rrpFiniteNumber(left?.[key]);
    const rightValue = rrpFiniteNumber(right?.[key]);
    if (leftValue === null && rightValue === null) return null;
    if (leftValue === null) return rightValue;
    if (rightValue === null) return leftValue;
    const leftAge = Math.round(Number(left.life_insured_age));
    const rightAge = Math.round(Number(right.life_insured_age));
    if (leftAge === rightAge) return leftValue;
    return leftValue + ((rightValue - leftValue) * ((targetAge - leftAge) / (rightAge - leftAge)));
  }

  function rrpFinalizeEstimatedRow(row, term, payoutPeriod, retirementAge) {
    const gmi = num(row.guaranteed_monthly_income_basis, 1000);
    const payoutYears = rrpPayoutYears(payoutPeriod, retirementAge);
    ["300", "425"].forEach((basis) => {
      const rateKey = `cash_bonus_rate_iirr_${basis}`;
      const ngKey = `estimated_non_guaranteed_monthly_income_iirr_${basis}_for_gmi_1000`;
      const totalKey = `estimated_total_monthly_income_iirr_${basis}_for_gmi_1000`;
      const benefitKey = `estimated_total_benefits_iirr_${basis}_for_gmi_1000`;
      if (row[rateKey] !== null && row[rateKey] !== undefined) row[rateKey] = Math.max(0, num(row[rateKey], 0));
      row[ngKey] = Math.max(0, num(row[ngKey], 0));
      row[totalKey] = gmi + row[ngKey];
      row[benefitKey] = row[totalKey] * 12 * payoutYears;
    });
    [
      "premium_rate_per_10_gmi",
      "estimated_annual_premium_for_gmi_1000",
      "estimated_single_premium_for_gmi_1000",
      "estimated_total_premiums_paid_for_gmi_1000",
      "estimated_total_illustrated_yield_maturity_iirr_300_pct_pa",
      "estimated_total_illustrated_yield_maturity_iirr_425_pct_pa",
    ].forEach((key) => {
      if (row[key] !== null && row[key] !== undefined) row[key] = Math.max(0, num(row[key], 0));
    });
    if (rrpIsSinglePremium(term)) {
      row.estimated_annual_premium_for_gmi_1000 = null;
    } else {
      row.estimated_single_premium_for_gmi_1000 = null;
    }
    return row;
  }

  function rrpEstimateGridRow({ age, retirementAge, premiumTerm, payoutPeriod }) {
    const ageNum = Math.round(Number(age));
    const retireNum = Math.round(Number(retirementAge));
    const limits = rrpEntryAgeLimits(premiumTerm, retireNum);
    if (limits && (ageNum < limits[0] || ageNum > limits[1])) return null;

    const rows = rrpRowsForScenario({ retirementAge: retireNum, premiumTerm, payoutPeriod });
    if (!rows.length) return null;

    if (rows.length === 1) {
      const only = rows[0];
      return rrpFinalizeEstimatedRow({
        ...only,
        life_insured_age: ageNum,
        estimation_method: "extrapolated_flat",
        anchor_ages: String(only.life_insured_age),
        proxy_slope_keys: "single nearest age",
        source_pdf_count: Number(only.source_pdf_count || 0),
      }, premiumTerm, payoutPeriod, retireNum);
    }

    let left = null;
    let right = null;
    for (let index = 0; index < rows.length; index += 1) {
      const rowAge = Math.round(Number(rows[index].life_insured_age));
      if (rowAge < ageNum) left = rows[index];
      if (rowAge > ageNum && !right) right = rows[index];
    }
    if (!left || !right) {
      if (ageNum < Math.round(Number(rows[0].life_insured_age))) {
        [left, right] = [rows[0], rows[1]];
      } else {
        [left, right] = [rows[rows.length - 2], rows[rows.length - 1]];
      }
    }
    if (!left || !right) return null;

    const estimated = { ...left };
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    keys.forEach((key) => {
      const value = rrpEstimateNumeric(left, right, ageNum, key);
      if (value !== null) estimated[key] = value;
    });
    const leftAge = Math.round(Number(left.life_insured_age));
    const rightAge = Math.round(Number(right.life_insured_age));
    const minAge = Math.round(Number(rows[0].life_insured_age));
    const maxAge = Math.round(Number(rows[rows.length - 1].life_insured_age));
    estimated.life_insured_age = ageNum;
    estimated.target_retirement_age = retireNum;
    estimated.premium_payment_term = rrpTermKey(premiumTerm);
    estimated.income_payout_period = normalizeRrpPayout(payoutPeriod);
    estimated.guaranteed_monthly_income_basis = 1000;
    estimated.estimation_method = ageNum >= minAge && ageNum <= maxAge ? "interpolated_runtime" : "extrapolated_runtime";
    estimated.anchor_ages = `${leftAge};${rightAge}`;
    estimated.proxy_slope_keys = `runtime age slope ${leftAge}-${rightAge}`;
    estimated.source_pdf_count = Math.max(Number(left.source_pdf_count || 0), Number(right.source_pdf_count || 0));
    estimated.source_pdfs = [left.source_pdfs, right.source_pdfs]
      .filter(Boolean)
      .join(";");
    return rrpFinalizeEstimatedRow(estimated, premiumTerm, payoutPeriod, retireNum);
  }

  function rrpFindGridRow({ age, retirementAge, premiumTerm, payoutPeriod }) {
    const ageNum = Math.round(Number(age));
    const retireNum = Math.round(Number(retirementAge));
    const termKey = rrpTermKey(premiumTerm);
    const payoutKey = rrpPayoutKey(payoutPeriod);
    return RRP_GRID.find((row) =>
      Math.round(Number(row.life_insured_age)) === ageNum
      && Math.round(Number(row.target_retirement_age)) === retireNum
      && rrpTermKey(row.premium_payment_term) === termKey
      && rrpPayoutKey(row.income_payout_period) === payoutKey
    ) || rrpEstimateGridRow({ age: ageNum, retirementAge: retireNum, premiumTerm, payoutPeriod });
  }

  function rrpEntryAgeLimits(term, retirementAge) {
    const limits = RRP_CONSTANTS.entryAgeLimits || {};
    const termLimits = limits[rrpTermKey(term)] || {};
    const pair = termLimits[String(retirementAge)];
    return Array.isArray(pair) && pair.length >= 2 ? pair : null;
  }

  function rrpSpecialSinglePayException(age, retirementAge, term) {
    return rrpIsSinglePremium(term) && Math.round(age) === 45 && Math.round(retirementAge) === 50;
  }

  function rrpIncomeBasis(settings) {
    return "425";
  }

  function rrpBasisTotalMonthly(row, basis) {
    return basis === "300"
      ? num(row?.estimated_total_monthly_income_iirr_300_for_gmi_1000, 0)
      : num(row?.estimated_total_monthly_income_iirr_425_for_gmi_1000, 0);
  }

  function rrpBasisPremium(row, term) {
    return rrpIsSinglePremium(term)
      ? num(row?.estimated_single_premium_for_gmi_1000, 0)
      : num(row?.estimated_annual_premium_for_gmi_1000, 0);
  }

  function rrpSolveInputs(settings, row, term) {
    const inputMode = settings.rrpInputMode === "premium" ? "premium" : "income";
    const inputBasis = rrpIncomeBasis(settings);
    const totalMonthlyBasis = rrpBasisTotalMonthly(row, inputBasis);
    const premiumBasis = rrpBasisPremium(row, term);
    let scale = 0;
    let targetTotalIncome = num(settings.rrpTargetIncome, 0);
    let premiumPayable = num(settings.rrpPremium, 0);

    if (inputMode === "premium") {
      scale = premiumBasis > 0 ? premiumPayable / premiumBasis : 0;
      targetTotalIncome = totalMonthlyBasis * scale;
    } else {
      scale = totalMonthlyBasis > 0 ? targetTotalIncome / totalMonthlyBasis : 0;
      premiumPayable = premiumBasis * scale;
    }

    const gmi = num(row?.guaranteed_monthly_income_basis, 1000) * scale;
    return {
      inputMode,
      inputBasis,
      scale,
      targetTotalIncome,
      premiumPayable,
      gmi,
      totalMonthlyBasis,
      premiumBasis,
    };
  }

  function validateRRP(settings, variant, row, solved) {
    const blockers = [];
    const notes = [];
    let ageBlocker = "";
    const addAgeBlocker = (message) => {
      blockers.push(message);
      if (!ageBlocker) ageBlocker = message;
    };
    const term = rrpVariantTerm(variant);
    const termKey = rrpTermKey(term);
    const age = Math.round(num(settings.rrpAge ?? settings.startAge, 40));
    const retirementAge = Math.round(num(settings.rrpRetirementAge, 65));
    const payoutPeriod = normalizeRrpPayout(settings.rrpPayoutPeriod || 10);
    const gmi = num(solved?.gmi ?? settings.rrpGmi, 1000);
    const gmiMin = num(RRP_CONSTANTS.gmiMin, 250);
    const gmiMax = num(RRP_CONSTANTS.gmiMax, 190000);
    const gmiIncrement = num(RRP_CONSTANTS.gmiIncrement, 10);

    if (!RRP_GRID.length) {
      blockers.push("RRP rate table is not loaded. Check that assets/rrp3-rates.js is available.");
    }
    if (!variant?.currencies?.includes(settings.currency)) {
      blockers.push(`${variant?.label || "RRP"} is only available in SGD in this tool.`);
    }
    if (!RRP_RETIREMENT_AGES.includes(retirementAge)) {
      blockers.push("Target retirement age must be 50, 55, 60, 65, or 70.");
    }
    const availablePayouts = rrpAvailablePayoutsForTerm(term);
    if (availablePayouts.length && !availablePayouts.some((p) => rrpPayoutKey(p) === rrpPayoutKey(payoutPeriod))) {
      blockers.push(`${rrpPayoutLabel(payoutPeriod)} payout is not product-valid for ${rrpTermLabel(term)}.`);
    }
    const limits = rrpEntryAgeLimits(term, retirementAge);
    if (limits && (age < limits[0] || age > limits[1])) {
      addAgeBlocker(`Entry age must be ${limits[0]}-${limits[1]} for ${rrpTermLabel(term)} with retirement age ${retirementAge}.`);
    }
    if (retirementAge <= age) {
      addAgeBlocker("Target retirement age must be above current age.");
    }

    const accumulationGap = retirementAge - age;
    if (rrpIsSinglePremium(term)) {
      if (accumulationGap < 5 && !rrpSpecialSinglePayException(age, retirementAge, term)) {
        addAgeBlocker("Single-premium RRP needs at least 5 years from current age to target retirement age.");
      }
    } else {
      const premiumYears = Number(termKey);
      if (retirementAge < age + premiumYears) {
        addAgeBlocker("Target retirement age falls before the selected premium payment term is completed.");
      }
      if (premiumYears + accumulationGap < 7) {
        addAgeBlocker("Premium payment term plus years to target retirement age must be at least 7 years.");
      }
    }

    if (solved?.inputMode === "premium") {
      if (!Number.isFinite(solved.premiumPayable) || solved.premiumPayable <= 0) {
        blockers.push("Premium must be greater than S$0.");
      }
    } else if (!Number.isFinite(solved?.targetTotalIncome) || (solved?.targetTotalIncome ?? 0) <= 0) {
      blockers.push("Total income must be greater than S$0.");
    }

    if (row && (!Number.isFinite(gmi) || gmi < gmiMin || gmi > gmiMax)) {
      blockers.push(`The selected input implies guaranteed monthly income of S$${Math.round(gmi || 0).toLocaleString()}, outside the product range of S$${gmiMin.toLocaleString()} to S$${gmiMax.toLocaleString()}.`);
    } else if (row && gmiIncrement > 0) {
      const remainder = Math.abs((gmi - gmiMin) % gmiIncrement);
      if (remainder > 0.01 && Math.abs(remainder - gmiIncrement) > 0.01) {
        notes.push(`The selected input implies guaranteed monthly income of about S$${Math.round(gmi).toLocaleString()}; official illustrations may round to eligible GMI increments.`);
      }
    }
    if (!row && RRP_GRID.length && !ageBlocker) {
      blockers.push("No parsed or estimated RRP source row exists for this age, retirement age, premium term, and payout period.");
    }

    const method = row?.estimation_method || "not_available";

    return {
      valid: blockers.length === 0,
      blockers,
      notes,
      method,
      ageBlocker,
    };
  }

  function simulateRRP(settings, strategy, mode = "custom") {
    const variant = VARIANTS[settings.variantKey];
    const term = rrpVariantTerm(variant);
    const age = Math.round(num(settings.rrpAge ?? settings.startAge, 40));
    const retirementAge = Math.round(num(settings.rrpRetirementAge, 65));
    const payoutPeriod = normalizeRrpPayout(settings.rrpPayoutPeriod || 10);
    const row = rrpFindGridRow({ age, retirementAge, premiumTerm: term, payoutPeriod });
    const solved = rrpSolveInputs(settings, row, term);
    const gmi = solved.gmi;
    const validation = validateRRP(settings, variant, row, solved);
    const commonSettings = {
      ...settings,
      startAge: age,
      rrpAge: age,
      rrpRetirementAge: retirementAge,
      rrpPayoutPeriod: payoutPeriod,
      rrpGmi: gmi,
    };

    if (!validation.valid || !row) {
      return {
        mode,
        variant,
        settings: commonSettings,
        annual: [],
        monthly: [],
        final: {
          year: 0,
          age,
          totalValue: 0,
          totalBasicPaid: 0,
          rrpSummary: {
            valid: false,
            blockers: validation.blockers,
            notes: validation.notes,
            method: validation.method,
            ageBlocker: validation.ageBlocker,
            premiumTerm: term,
            payoutPeriod,
            retirementAge,
            gmi,
            targetTotalIncome: solved.targetTotalIncome,
            premiumPayable: solved.premiumPayable,
            inputMode: solved.inputMode,
            inputBasis: solved.inputBasis,
          },
        },
        cashFlows: [],
        rrpSummary: {
          valid: false,
          blockers: validation.blockers,
          notes: validation.notes,
          method: validation.method,
          ageBlocker: validation.ageBlocker,
          premiumTerm: term,
          payoutPeriod,
          retirementAge,
          gmi,
          targetTotalIncome: solved.targetTotalIncome,
          premiumPayable: solved.premiumPayable,
          inputMode: solved.inputMode,
          inputBasis: solved.inputBasis,
        },
        warnings: [...validation.blockers, ...validation.notes],
      };
    }

    const scale = solved.scale;
    const isSingle = rrpIsSinglePremium(term);
    const premiumTermYears = isSingle ? 1 : Number(term);
    const annualPremium = isSingle ? 0 : solved.premiumPayable;
    const singlePremium = isSingle ? solved.premiumPayable : 0;
    const premiumPayable = solved.premiumPayable;
    const totalPremiumsPaid = num(row.estimated_total_premiums_paid_for_gmi_1000, 0) * scale;
    const ngMonthly300 = num(row.estimated_non_guaranteed_monthly_income_iirr_300_for_gmi_1000, 0) * scale;
    const ngMonthly425 = num(row.estimated_non_guaranteed_monthly_income_iirr_425_for_gmi_1000, 0) * scale;
    const totalMonthly300 = gmi + ngMonthly300;
    const totalMonthly425 = gmi + ngMonthly425;
    const payoutYears = rrpPayoutYears(payoutPeriod, retirementAge);
    const payoutStartAge = retirementAge + 1;
    const payoutEndAge = normalizeRrpPayout(payoutPeriod) === "lifetime"
      ? 120
      : retirementAge + payoutYears;
    const projectionYears = Math.max(1, payoutEndAge - age);
    const annual = [];
    const monthly = [];
    const cf300 = new Array(projectionYears * 12 + 1).fill(0);
    const cf425 = new Array(projectionYears * 12 + 1).fill(0);

    let cumulativePremiums = 0;
    let cumulativeGuaranteedIncome = 0;
    let cumulativeTotalIncome300 = 0;
    let cumulativeTotalIncome425 = 0;

    for (let year = 1; year <= projectionYears; year += 1) {
      const rowAge = age + year;
      const premiumPaid = isSingle
        ? (year === 1 ? singlePremium : 0)
        : (year <= premiumTermYears ? annualPremium : 0);
      if (premiumPaid > 0) {
        const monthIndex = isSingle ? 0 : (year - 1) * 12;
        cf300[monthIndex] -= premiumPaid;
        cf425[monthIndex] -= premiumPaid;
      }
      cumulativePremiums += premiumPaid;

      const isIncomeYear = rowAge >= payoutStartAge && rowAge <= payoutEndAge;
      const guaranteedAnnualIncome = isIncomeYear ? gmi * 12 : 0;
      const ngAnnual300 = isIncomeYear ? ngMonthly300 * 12 : 0;
      const ngAnnual425 = isIncomeYear ? ngMonthly425 * 12 : 0;
      const totalAnnual300 = guaranteedAnnualIncome + ngAnnual300;
      const totalAnnual425 = guaranteedAnnualIncome + ngAnnual425;
      if (isIncomeYear) {
        cf300[year * 12] += totalAnnual300;
        cf425[year * 12] += totalAnnual425;
      }
      cumulativeGuaranteedIncome += guaranteedAnnualIncome;
      cumulativeTotalIncome300 += totalAnnual300;
      cumulativeTotalIncome425 += totalAnnual425;

      const annualRow = {
        year,
        age: rowAge,
        premiums: premiumPaid,
        topUps: 0,
        bonuses: 0,
        grossDividends: 0,
        cashDividends: totalAnnual425,
        reinvestedDividends: 0,
        totalReinvestedDividends: 0,
        adminCharges: 0,
        policyFees: 0,
        shortfallCharges: 0,
        coiCharges: 0,
        optionalDeductions: 0,
        dividendWithdrawals: totalAnnual425,
        partialWithdrawals: 0,
        withdrawalCharges: 0,
        accountValue: 0,
        surrenderValue: 0,
        deathBenefit: 0,
        cashWithdrawals: cumulativeTotalIncome425,
        totalValue: cumulativeTotalIncome425 - cumulativePremiums,
        totalBasicPaid: cumulativePremiums,
        totalTopUps: 0,
        lapsed: false,
        rrpPremiumPaid: premiumPaid,
        rrpGuaranteedAnnualIncome: guaranteedAnnualIncome,
        rrpNgAnnual300: ngAnnual300,
        rrpNgAnnual425: ngAnnual425,
        rrpTotalAnnual300: totalAnnual300,
        rrpTotalAnnual425: totalAnnual425,
        rrpCumulativeGuaranteedIncome: cumulativeGuaranteedIncome,
        rrpCumulativeTotalIncome300: cumulativeTotalIncome300,
        rrpCumulativeTotalIncome425: cumulativeTotalIncome425,
        rrpIncomeYear: isIncomeYear,
      };
      annual.push(annualRow);
      monthly.push({
        month: year * 12,
        year,
        age: rowAge,
        accountValue: 0,
        surrenderValue: 0,
        deathBenefit: 0,
        cashDividends: totalAnnual425,
        cashWithdrawals: cumulativeTotalIncome425,
        totalValue: cumulativeTotalIncome425 - cumulativePremiums,
        totalBasicPaid: cumulativePremiums,
        totalTopUps: 0,
        lapsed: false,
      });
    }

    const finalRow = annual[annual.length - 1] || {};
    const summary = {
      valid: true,
      blockers: validation.blockers,
      notes: validation.notes,
      method: row.estimation_method || "estimated",
      ageBlocker: validation.ageBlocker,
      anchorAges: row.anchor_ages || "",
      proxySlopeKeys: row.proxy_slope_keys || "",
      sourcePdfs: row.source_pdfs || "",
      sourcePdfCount: Number(row.source_pdf_count || 0),
      premiumTerm: term,
      premiumTermLabel: rrpTermLabel(term),
      premiumTermYears,
      isSinglePremium: isSingle,
      retirementAge,
      payoutPeriod,
      payoutPeriodLabel: rrpPayoutLabel(payoutPeriod),
      payoutYears,
      payoutStartAge,
      payoutEndAge,
      gmi,
      inputMode: solved.inputMode,
      inputBasis: solved.inputBasis,
      targetTotalIncome: solved.targetTotalIncome,
      annualPremium,
      singlePremium,
      premiumPayable,
      totalPremiumsPaid,
      guaranteedMonthlyIncome: gmi,
      ngMonthly300,
      ngMonthly425,
      totalMonthly300,
      totalMonthly425,
      totalGuaranteedBenefits: gmi * 12 * payoutYears,
      totalBenefits300: cumulativeTotalIncome300,
      totalBenefits425: cumulativeTotalIncome425,
      illustratedYield300: num(row.estimated_total_illustrated_yield_maturity_iirr_300_pct_pa, null),
      illustratedYield425: num(row.estimated_total_illustrated_yield_maturity_iirr_425_pct_pa, null),
      cashBonusRate300: num(row.cash_bonus_rate_iirr_300, 0),
      cashBonusRate425: num(row.cash_bonus_rate_iirr_425, 0),
      row,
    };

    return {
      mode,
      variant,
      settings: commonSettings,
      annual,
      monthly,
      final: {
        ...finalRow,
        irr300: irrMonthly(cf300),
        irr425: irrMonthly(cf425),
        bonusTotal: summary.totalBenefits425 - summary.totalGuaranteedBenefits,
        netCapital: totalPremiumsPaid,
        rrpSummary: summary,
      },
      cashFlows: cf425,
      rrpSummary: summary,
      warnings: validation.notes,
    };
  }

  function siiTermNumber(value) {
    if (value === "single" || value === "SP" || value === "sp" || value === 1 || value === "1") return 1;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : 1;
  }

  function siiTermKey(value) {
    const n = siiTermNumber(value);
    return n === 1 ? "single" : String(n);
  }

  function siiTermLabel(value) {
    const n = siiTermNumber(value);
    return n === 1 ? "Single Premium" : `${n} Years`;
  }

  function siiIncomeStartMin(term) {
    const n = siiTermNumber(term);
    if (n <= 3) return 2;
    if (n <= 6) return 3;
    return 4;
  }

  function siiAvailableIncomeStartYears(term) {
    const min = siiIncomeStartMin(term);
    const max = Math.round(num(SII_CONSTANTS.incomeStartYearMax, 21));
    const out = [];
    for (let y = min; y <= max; y += 1) out.push(y);
    return out;
  }

  function siiIncomeBounds(incomeStartYear) {
    const start = Math.round(num(incomeStartYear, 4));
    const early = start <= 3;
    return {
      minMonthlyIncome: early ? num(SII_CONSTANTS.minMonthlyIncomeEarly, 60) : num(SII_CONSTANTS.minMonthlyIncomeStandard, 300),
      maxMonthlyIncome: early ? num(SII_CONSTANTS.maxMonthlyIncomeEarly, 100000) : num(SII_CONSTANTS.maxMonthlyIncomeStandard, 500000),
      minTotalPlannedPremium: num(SII_CONSTANTS.minTotalPlannedPremium, 100000),
      maxTotalPlannedPremium: num(SII_CONSTANTS.maxTotalPlannedPremium, 166000000),
    };
  }

  function siiSourceRows() {
    return SII_SCENARIOS.filter((row) =>
      Number.isFinite(Number(row.premium_payment_term_number))
      && Number.isFinite(Number(row.income_start_year))
      && Number(row.initial_total_planned_premium) > 0
      && Number(row.initial_monthly_income_annualized) > 0
    );
  }

  function siiSourceDistance(row, termNum, startYear, age) {
    const termDistance = Math.abs(num(row.premium_payment_term_number, 1) - termNum);
    const startDistance = Math.abs(num(row.income_start_year, 4) - startYear) / 3;
    const ageDistance = Math.abs(Math.round(num(row.life_insured_age, age)) - age) / 10;
    return Math.sqrt(termDistance * termDistance + startDistance * startDistance + ageDistance * ageDistance);
  }

  function siiAgeGroupedSources(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const age = Math.round(num(row.life_insured_age, 46));
      if (!groups.has(age)) groups.set(age, []);
      groups.get(age).push(row);
    });
    return Array.from(groups.entries())
      .map(([age, ageRows]) => ({ age, rows: ageRows }))
      .sort((a, b) => a.age - b.age);
  }

  function siiPickByAge(rows, age) {
    const groups = siiAgeGroupedSources(rows);
    if (!groups.length) return { picked: [], method: "not_available", ageMode: "none" };
    const exact = groups.find((group) => group.age === age);
    if (exact) {
      return {
        picked: exact.rows.map((row) => ({ row, distance: 0, weight: 1 / exact.rows.length })),
        method: "source_exact",
        ageMode: "exact",
      };
    }
    if (groups.length === 1) {
      const [only] = groups;
      return {
        picked: only.rows.map((row) => ({ row, distance: Math.abs(only.age - age), weight: 1 / only.rows.length })),
        method: "age_shifted_source",
        ageMode: "single_age_shift",
      };
    }

    let left = null;
    let right = null;
    if (age < groups[0].age) {
      left = groups[0];
      right = groups[1];
    } else if (age > groups[groups.length - 1].age) {
      left = groups[groups.length - 2];
      right = groups[groups.length - 1];
    } else {
      groups.forEach((group) => {
        if (group.age < age && (!left || group.age > left.age)) left = group;
        if (group.age > age && (!right || group.age < right.age)) right = group;
      });
    }
    if (!left || !right || left.age === right.age) {
      const nearest = groups
        .map((group) => ({ group, distance: Math.abs(group.age - age) }))
        .sort((a, b) => a.distance - b.distance)[0].group;
      return {
        picked: nearest.rows.map((row) => ({ row, distance: Math.abs(nearest.age - age), weight: 1 / nearest.rows.length })),
        method: "age_shifted_source",
        ageMode: "nearest_age_shift",
      };
    }

    const ratio = (age - left.age) / (right.age - left.age);
    const leftWeight = 1 - ratio;
    const rightWeight = ratio;
    const picked = [
      ...left.rows.map((row) => ({ row, distance: Math.abs(left.age - age), weight: leftWeight / left.rows.length })),
      ...right.rows.map((row) => ({ row, distance: Math.abs(right.age - age), weight: rightWeight / right.rows.length })),
    ];
    return {
      picked,
      method: age >= groups[0].age && age <= groups[groups.length - 1].age ? "interpolated_age" : "extrapolated_age",
      ageMode: age >= groups[0].age && age <= groups[groups.length - 1].age ? "interpolated" : "extrapolated",
    };
  }

  function siiBlendSources(term, incomeStartYear, age) {
    const termNum = siiTermNumber(term);
    const startYear = Math.round(num(incomeStartYear, 4));
    const ageNum = Math.round(num(age, 46));
    const rows = siiSourceRows();
    if (!rows.length) return null;

    const exactRows = rows.filter((row) =>
      Math.round(num(row.premium_payment_term_number, 0)) === termNum
      && Math.round(num(row.income_start_year, 0)) === startYear
    );
    const agePick = exactRows.length ? siiPickByAge(exactRows, ageNum) : null;
    const picked = exactRows.length
      ? agePick.picked
      : rows
        .map((row) => ({ row, distance: siiSourceDistance(row, termNum, startYear, ageNum) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 8);

    if (!picked.length) return null;
    if (!exactRows.length) {
      const weightSum = picked.reduce((sum, item) => sum + (1 / Math.pow(item.distance + 0.001, 2)), 0);
      picked.forEach((item) => {
        item.weight = (1 / Math.pow(item.distance + 0.001, 2)) / (weightSum || 1);
      });
    }

    const terms = rows.map((row) => num(row.premium_payment_term_number, 1));
    const starts = rows.map((row) => num(row.income_start_year, 4));
    const ages = rows.map((row) => Math.round(num(row.life_insured_age, ageNum)));
    const sourceMinTerm = Math.min(...terms);
    const sourceMaxTerm = Math.max(...terms);
    const sourceMinStart = Math.min(...starts);
    const sourceMaxStart = Math.max(...starts);
    const sourceMinAge = Math.min(...ages);
    const sourceMaxAge = Math.max(...ages);
    const inSourceBox = termNum >= sourceMinTerm
      && termNum <= sourceMaxTerm
      && startYear >= sourceMinStart
      && startYear <= sourceMaxStart
      && ageNum >= sourceMinAge
      && ageNum <= sourceMaxAge;
    const method = exactRows.length ? agePick.method : (inSourceBox ? "interpolated_sparse" : "extrapolated_sparse");
    const sourceAges = Array.from(new Set(picked.map((item) => Math.round(num(item.row.life_insured_age, ageNum))))).sort((a, b) => a - b);
    return {
      method,
      termNum,
      incomeStartYear: startYear,
      targetAge: ageNum,
      sources: picked,
      sourceCount: picked.length,
      sourcePdfs: picked.map((item) => item.row.source_pdf).filter(Boolean).join(";"),
      sourceLabels: picked
        .map((item) => `A${Math.round(num(item.row.life_insured_age, ageNum))} ${siiTermLabel(item.row.premium_payment_term_number)} / PY${item.row.income_start_year}`)
        .join("; "),
      sourceAges,
      sourceAgeMin: sourceMinAge,
      sourceAgeMax: sourceMaxAge,
      sourceExactForAge: sourceAges.includes(ageNum),
      ageMode: agePick?.ageMode || (ageNum >= sourceMinAge && ageNum <= sourceMaxAge ? "sparse_interpolated" : "sparse_extrapolated"),
    };
  }

  function siiBlendScalar(blend, key, fallback = 0) {
    if (!blend || !blend.sources.length) return fallback;
    let value = 0;
    let weight = 0;
    blend.sources.forEach((item) => {
      const parsed = Number(item.row[key]);
      if (!Number.isFinite(parsed)) return;
      value += parsed * item.weight;
      weight += item.weight;
    });
    return weight > 0 ? value / weight : fallback;
  }

  function siiRowAt(source, rowKey, year) {
    const rows = Array.isArray(source?.[rowKey]) ? source[rowKey] : [];
    if (!rows.length) return null;
    const exact = rows.find((row) => Math.round(num(row.policy_year, 0)) === year);
    if (exact) return exact;
    let left = null;
    let right = null;
    rows.forEach((row) => {
      const y = Math.round(num(row.policy_year, 0));
      if (y < year && (!left || y > num(left.policy_year, 0))) left = row;
      if (y > year && (!right || y < num(right.policy_year, 0))) right = row;
    });
    if (!left) return right;
    if (!right) return left;
    const leftYear = num(left.policy_year, year);
    const rightYear = num(right.policy_year, year);
    const ratio = rightYear === leftYear ? 0 : (year - leftYear) / (rightYear - leftYear);
    const out = { policy_year: year };
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    keys.forEach((key) => {
      const l = Number(left[key]);
      const r = Number(right[key]);
      if (Number.isFinite(l) && Number.isFinite(r)) out[key] = l + (r - l) * ratio;
    });
    return out;
  }

  function siiBlendRow(blend, rowKey, year, totalPremium) {
    const out = { policy_year: year };
    if (!blend || !blend.sources.length || !(totalPremium > 0)) return out;
    const keys = new Set();
    blend.sources.forEach((item) => {
      const row = siiRowAt(item.row, rowKey, year);
      if (row) Object.keys(row).forEach((key) => keys.add(key));
    });
    keys.forEach((key) => {
      if (key === "policy_year" || key === "attained_age_source") return;
      let value = 0;
      let weight = 0;
      blend.sources.forEach((item) => {
        const row = siiRowAt(item.row, rowKey, year);
        const sourceTotal = num(item.row.initial_total_planned_premium, 0);
        const parsed = Number(row?.[key]);
        if (!(sourceTotal > 0) || !Number.isFinite(parsed)) return;
        value += (parsed / sourceTotal) * totalPremium * item.weight;
        weight += item.weight;
      });
      if (weight > 0) out[key] = value / weight;
    });
    return out;
  }

  function siiMaxSourcePolicyYear(blend) {
    if (!blend || !blend.sources.length) return 0;
    return blend.sources.reduce((max, item) => {
      const rows = Array.isArray(item.row.current_rows) ? item.row.current_rows : [];
      const sourceMax = rows.reduce((m, row) => Math.max(m, Math.round(num(row.policy_year, 0))), 0);
      return Math.max(max, sourceMax);
    }, 0);
  }

  function siiSolveInputs(settings, blend) {
    const inputMode = settings.siiInputMode === "income" ? "income" : "premium";
    const incomeAnnualRate = blend
      ? blend.sources.reduce((sum, item) => {
        const sourceTotal = num(item.row.initial_total_planned_premium, 0);
        const annualIncome = num(item.row.initial_monthly_income_annualized, 0);
        return sum + (sourceTotal > 0 ? (annualIncome / sourceTotal) * item.weight : 0);
      }, 0)
      : 0;
    let totalPlannedPremium = num(settings.siiTotalPlannedPremium, 0);
    let targetMonthlyIncome = num(settings.siiTargetMonthlyIncome, 0);
    if (inputMode === "income") {
      totalPlannedPremium = incomeAnnualRate > 0 ? (targetMonthlyIncome * 12) / incomeAnnualRate : 0;
    } else {
      targetMonthlyIncome = totalPlannedPremium * incomeAnnualRate / 12;
    }
    const termNum = siiTermNumber(settings.siiPremiumTerm);
    return {
      inputMode,
      incomeAnnualRate,
      totalPlannedPremium,
      targetMonthlyIncome,
      annualPlannedPremium: termNum > 1 ? totalPlannedPremium / termNum : 0,
      singlePremium: termNum === 1 ? totalPlannedPremium : 0,
    };
  }

  function validateSII(settings, variant, blend, solved) {
    const blockers = [];
    const notes = [];
    let ageBlocker = "";
    const addAgeBlocker = (message) => {
      blockers.push(message);
      if (!ageBlocker) ageBlocker = message;
    };
    const age = Math.round(num(settings.siiAge ?? settings.startAge, 46));
    const termNum = siiTermNumber(settings.siiPremiumTerm);
    const incomeStartYear = Math.round(num(settings.siiIncomeStartYear, 4));
    const entryMin = Math.round(num(SII_CONSTANTS.entryAgeMin, 0));
    const entryMax = Math.round(num(SII_CONSTANTS.entryAgeMax, 70));
    const minStart = siiIncomeStartMin(termNum);
    const bounds = siiIncomeBounds(incomeStartYear);

    if (!SII_SCENARIOS.length) {
      blockers.push("Signature Indexed Income rate table is not loaded. Check that assets/sii-rates.js is available.");
    }
    if (!variant?.currencies?.includes(settings.currency)) {
      blockers.push(`${variant?.label || "Signature Indexed Income"} is only available in USD in this tool.`);
    }
    if (age < entryMin || age > entryMax) {
      addAgeBlocker(`Entry age must be ${entryMin}-${entryMax} for Signature Indexed Income.`);
    }
    if (termNum < 1 || termNum > 10) {
      blockers.push("Premium term must be Single Premium or 2 to 10 years.");
    }
    if (incomeStartYear < minStart || incomeStartYear > num(SII_CONSTANTS.incomeStartYearMax, 21)) {
      blockers.push(`${siiTermLabel(termNum)} can only start monthly income from policy year ${minStart} to 21.`);
    }
    if (!blend) {
      blockers.push("No parsed SII source illustrations are available for estimation.");
    }
    if (!(solved.incomeAnnualRate > 0)) {
      blockers.push("No income rate could be derived from the parsed source illustrations.");
    }
    if (!(solved.totalPlannedPremium > 0)) {
      blockers.push("Total planned premium must be greater than US$0.");
    }
    if (solved.totalPlannedPremium < bounds.minTotalPlannedPremium || solved.totalPlannedPremium > bounds.maxTotalPlannedPremium) {
      blockers.push(`Total planned premium must be between US$${bounds.minTotalPlannedPremium.toLocaleString()} and US$${bounds.maxTotalPlannedPremium.toLocaleString()}.`);
    }
    if (solved.targetMonthlyIncome < bounds.minMonthlyIncome || solved.targetMonthlyIncome > bounds.maxMonthlyIncome) {
      blockers.push(`Target monthly income must be between US$${bounds.minMonthlyIncome.toLocaleString()} and US$${bounds.maxMonthlyIncome.toLocaleString()} for income start year ${incomeStartYear}.`);
    }
    const allSourceAges = Array.isArray(SII_DATA?.source?.sourceAges)
      ? SII_DATA.source.sourceAges.map((value) => Math.round(num(value, 0))).filter((value) => Number.isFinite(value))
      : [];
    const sourceMinAge = allSourceAges.length ? Math.min(...allSourceAges) : null;
    const sourceMaxAge = allSourceAges.length ? Math.max(...allSourceAges) : null;
    if (blend?.method === "age_shifted_source") {
      notes.push(`Selected age is estimated from source age ${blend.sourceAges.join(", ")} for this term/start-year combination; validate against an official PI.`);
    } else if (blend?.method === "interpolated_age") {
      notes.push(`Age projection is interpolated between source-age anchors ${blend.sourceAges.join(" and ")}; validate against an official PI for the selected age.`);
    } else if (blend?.method === "extrapolated_age" || (sourceMinAge !== null && (age < sourceMinAge || age > sourceMaxAge))) {
      notes.push(`Age projection is extrapolated from source-age anchors ${allSourceAges.join(", ")}; values further from these ages are less reliable.`);
    }
    if (blend && ["interpolated_sparse", "extrapolated_sparse"].includes(blend.method)) {
      notes.push("Premium term and income start values are interpolated or extrapolated from uploaded source PIs and are approximate.");
    }
    if (SII_DATA?.source?.errorCount) {
      notes.push(`${SII_DATA.source.errorCount} uploaded SII PDF did not parse and is excluded from this estimate.`);
    }

    return {
      valid: blockers.length === 0,
      blockers,
      notes,
      ageBlocker,
      method: blend?.method || "not_available",
    };
  }

  function simulateSII(settings, strategy, mode = "custom") {
    const variant = VARIANTS[settings.variantKey];
    const age = Math.round(num(settings.siiAge ?? settings.startAge, 46));
    const termNum = siiTermNumber(settings.siiPremiumTerm || 1);
    const incomeStartYear = Math.round(num(settings.siiIncomeStartYear, siiIncomeStartMin(termNum)));
    const blend = siiBlendSources(termNum, incomeStartYear, age);
    const solved = siiSolveInputs({ ...settings, siiPremiumTerm: termNum, siiIncomeStartYear: incomeStartYear }, blend);
    const validation = validateSII({ ...settings, siiPremiumTerm: termNum, siiIncomeStartYear: incomeStartYear }, variant, blend, solved);
    const bounds = siiIncomeBounds(incomeStartYear);
    const commonSettings = {
      ...settings,
      currency: "USD",
      paymentFrequency: "Annual",
      startAge: age,
      siiAge: age,
      siiPremiumTerm: termNum === 1 ? "single" : termNum,
      siiIncomeStartYear: incomeStartYear,
      siiInputMode: solved.inputMode,
      siiTargetMonthlyIncome: solved.targetMonthlyIncome,
      siiTotalPlannedPremium: solved.totalPlannedPremium,
    };

    const baseSummary = {
      valid: false,
      blockers: validation.blockers,
      notes: validation.notes,
      ageBlocker: validation.ageBlocker,
      method: validation.method,
      premiumTerm: termNum === 1 ? "single" : termNum,
      premiumTermNumber: termNum,
      premiumTermLabel: siiTermLabel(termNum),
      incomeStartYear,
      incomeStartAge: age + incomeStartYear,
      inputMode: solved.inputMode,
      targetMonthlyIncome: solved.targetMonthlyIncome,
      annualizedIncome: solved.targetMonthlyIncome * 12,
      totalPlannedPremium: solved.totalPlannedPremium,
      annualPlannedPremium: solved.annualPlannedPremium,
      singlePremium: solved.singlePremium,
      minMonthlyIncome: bounds.minMonthlyIncome,
      maxMonthlyIncome: bounds.maxMonthlyIncome,
      minTotalPlannedPremium: bounds.minTotalPlannedPremium,
      maxTotalPlannedPremium: bounds.maxTotalPlannedPremium,
      incomeAnnualRate: solved.incomeAnnualRate,
      sourceLabels: blend?.sourceLabels || "",
      sourceAges: blend?.sourceAges || [],
      sourceAgeMin: blend?.sourceAgeMin || null,
      sourceAgeMax: blend?.sourceAgeMax || null,
      sourceExactForAge: blend?.sourceExactForAge || false,
      sourcePdfs: blend?.sourcePdfs || "",
      sourcePdfCount: blend?.sourceCount || 0,
    };

    if (!validation.valid || !blend) {
      return {
        mode,
        variant,
        settings: commonSettings,
        annual: [],
        monthly: [],
        final: {
          year: 0,
          age,
          totalValue: 0,
          totalBasicPaid: 0,
          siiSummary: baseSummary,
        },
        cashFlows: [],
        siiSummary: baseSummary,
        warnings: [...validation.blockers, ...validation.notes],
      };
    }

    const maxSourceYear = siiMaxSourcePolicyYear(blend) || 79;
    const maturityAge = Math.round(num(SII_CONSTANTS.maturityAge, 125));
    const projectionYears = Math.max(1, Math.min(maxSourceYear, maturityAge - age));
    const totalPremium = solved.totalPlannedPremium;
    const annualPremium = termNum > 1 ? totalPremium / termNum : 0;
    const singlePremium = termNum === 1 ? totalPremium : 0;
    const cashFlows = new Array(projectionYears * 12 + 1).fill(0);
    const annual = [];
    const monthly = [];
    let cumulativePremiums = 0;
    let cumulativeIncome = 0;
    let priorPolicyValue = 0;
    let cumulativePremiumCharges = 0;
    let cumulativePolicyFees = 0;
    let cumulativeAdminFees = 0;
    let cumulativeBooster = 0;
    let cumulativeDeductions = 0;

    for (let year = 1; year <= projectionYears; year += 1) {
      const currentRow = siiBlendRow(blend, "current_rows", year, totalPremium);
      const deductionRow = siiBlendRow(blend, "deduction_rows", year, totalPremium);
      const attainedAge = age + year;
      const premiumPaid = termNum === 1
        ? (year === 1 ? singlePremium : 0)
        : (year <= termNum ? annualPremium : 0);
      const premiumMonth = (year - 1) * 12;
      if (premiumPaid > 0) cashFlows[premiumMonth] = (cashFlows[premiumMonth] || 0) - premiumPaid;
      cumulativePremiums += premiumPaid;

      const annualIncome = Math.max(0, num(currentRow.monthly_income_annualized, 0));
      const monthlyIncome = annualIncome / 12;
      if (annualIncome > 0) {
        for (let m = 1; m <= 12; m += 1) {
          const index = (year - 1) * 12 + m;
          cashFlows[index] = (cashFlows[index] || 0) + monthlyIncome;
        }
      }
      cumulativeIncome += annualIncome;

      const policyValue = Math.max(0, num(currentRow.policy_value, 0));
      const policyValueLessCharges = Math.max(0, num(currentRow.policy_value_less_surrender_charge_and_unvested_booster, 0));
      const surrenderValueFloor = Math.max(0, num(currentRow.surrender_value_floor, 0));
      const surrenderValue = Math.max(0, num(currentRow.surrender_value, 0));
      const deathBenefit = Math.max(0, num(currentRow.death_benefit, 0));
      const premiumChargePct = num(SII_CONSTANTS.premiumChargePctByPolicyYear?.[String(Math.min(year, 10))], 4);
      const premiumCharge = premiumPaid * premiumChargePct / 100;
      const policyFee = year <= num(SII_CONSTANTS.policyFeeToYear, 25)
        ? (totalPremium / 1000) * num(SII_CONSTANTS.policyFeePer1000FaceAmountMonthly, 2.108333) * 12
        : 0;
      const adminFee = priorPolicyValue * (num(SII_CONSTANTS.adminFeeMonthlyPctPolicyValue, 0.03) / 100) * 12;
      const policyValueBooster = year >= num(SII_CONSTANTS.policyValueBoosterFromYear, 2) && year <= num(SII_CONSTANTS.policyValueBoosterToYear, 25)
        ? totalPremium * num(SII_CONSTANTS.policyValueBoosterRatePctPa, 1.46) / 100
        : 0;
      const surrenderUnvestedDrag = Math.max(0, policyValue - policyValueLessCharges);
      const effectOfDeductions = Math.max(0, num(deductionRow.current_effect_of_deductions, 0));
      cumulativePremiumCharges += premiumCharge;
      cumulativePolicyFees += policyFee;
      cumulativeAdminFees += adminFee;
      cumulativeBooster += policyValueBooster;
      cumulativeDeductions = Math.max(cumulativeDeductions, effectOfDeductions);

      const row = {
        year,
        age: attainedAge,
        premiums: premiumPaid,
        topUps: 0,
        bonuses: policyValueBooster,
        grossDividends: 0,
        cashDividends: annualIncome,
        reinvestedDividends: 0,
        adminCharges: adminFee,
        policyFees: policyFee,
        shortfallCharges: 0,
        coiCharges: 0,
        optionalDeductions: 0,
        dividendWithdrawals: annualIncome,
        partialWithdrawals: 0,
        withdrawalCharges: 0,
        accountValue: policyValue,
        surrenderValue,
        deathBenefit,
        cashWithdrawals: cumulativeIncome,
        totalValue: surrenderValue + cumulativeIncome,
        totalBasicPaid: cumulativePremiums,
        totalTopUps: 0,
        lapsed: false,
        siiPremiumPaid: premiumPaid,
        siiAnnualIncome: annualIncome,
        siiMonthlyIncome: monthlyIncome,
        siiCumulativeIncome: cumulativeIncome,
        siiPolicyValue: policyValue,
        siiPolicyValueLessCharges: policyValueLessCharges,
        siiSurrenderValueFloor: surrenderValueFloor,
        siiSurrenderValue: surrenderValue,
        siiDeathBenefit: deathBenefit,
        siiPremiumChargePct: premiumChargePct,
        siiPremiumCharge: premiumCharge,
        siiPolicyFee: policyFee,
        siiAdminFeeEstimate: adminFee,
        siiPolicyValueBooster: policyValueBooster,
        siiSurrenderUnvestedDrag: surrenderUnvestedDrag,
        siiEffectOfDeductions: effectOfDeductions,
        siiCumulativeChargesEstimate: cumulativePremiumCharges + cumulativePolicyFees + cumulativeAdminFees,
        siiCumulativeBooster: cumulativeBooster,
        siiCumulativeDeductions: cumulativeDeductions,
        siiIncomeYear: year >= incomeStartYear,
      };
      annual.push(row);
      for (let m = 1; m <= 12; m += 1) {
        monthly.push({
          month: (year - 1) * 12 + m,
          year,
          age: attainedAge,
          accountValue: policyValue,
          surrenderValue,
          deathBenefit,
          cashDividends: annualIncome,
          cashWithdrawals: cumulativeIncome,
          totalValue: surrenderValue + cumulativeIncome,
          totalBasicPaid: cumulativePremiums,
          totalTopUps: 0,
          lapsed: false,
        });
      }
      priorPolicyValue = policyValue;
    }

    annual.forEach((row) => {
      const horizon = row.year * 12;
      const cf = cashFlows.slice(0, horizon + 1);
      cf[horizon] = (cf[horizon] || 0) + row.siiSurrenderValue;
      row.siiNetIrr = irrMonthly(cf);
      row.siiNetSpreadVsIndex = (num(SII_CONSTANTS.indexAssumedCreditingRateCurrentPct, 6.35) / 100) - row.siiNetIrr;
    });

    const finalCashFlows = cashFlows.slice();
    const finalRow = annual[annual.length - 1] || {};
    finalCashFlows[projectionYears * 12] = (finalCashFlows[projectionYears * 12] || 0) + (finalRow.siiSurrenderValue || 0);
    const referenceRow = annual.find((row) => row.year === 40) || annual[annual.length - 1] || {};
    const weightedCurrentYieldPct = siiBlendScalar(blend, "current_illustrated_yield_pct_pa", null);
    const weightedGuaranteedYieldPct = siiBlendScalar(blend, "guaranteed_illustrated_yield_pct_pa", null);
    const weightedTdcPct = siiBlendScalar(blend, "total_distribution_cost_pct", null);
    const sourceExactForAge = blend.method === "source_exact" && blend.sourceExactForAge;
    const summary = {
      ...baseSummary,
      valid: true,
      blockers: validation.blockers,
      notes: [
        ...validation.notes,
        projectionYears < maxSourceYear ? `Projection is capped at policy year ${projectionYears} to keep attained age within ${maturityAge}.` : "",
      ].filter(Boolean),
      method: blend.method,
      sourceExactForAge,
      sourcePdfCount: blend.sourceCount,
      sourcePdfs: blend.sourcePdfs,
      sourceLabels: blend.sourceLabels,
      sourceAges: blend.sourceAges,
      projectionYears,
      maturityAge,
      totalProjectedIncome: cumulativeIncome,
      totalBenefitsAtProjection: finalRow.siiSurrenderValue + cumulativeIncome,
      finalSurrenderValue: finalRow.siiSurrenderValue || 0,
      finalDeathBenefit: finalRow.siiDeathBenefit || 0,
      referenceYear: referenceRow.year || projectionYears,
      referenceAge: referenceRow.age || age + projectionYears,
      referenceSurrenderValue: referenceRow.siiSurrenderValue || 0,
      referencePolicyValue: referenceRow.siiPolicyValue || 0,
      referenceTotalBenefits: (referenceRow.siiSurrenderValue || 0) + (referenceRow.siiCumulativeIncome || 0),
      referenceCumulativeIncome: referenceRow.siiCumulativeIncome || 0,
      referenceNetIrr: referenceRow.siiNetIrr,
      finalNetIrr: irrMonthly(finalCashFlows),
      currentIllustratedYield: Number.isFinite(weightedCurrentYieldPct) ? weightedCurrentYieldPct / 100 : null,
      guaranteedIllustratedYield: Number.isFinite(weightedGuaranteedYieldPct) ? weightedGuaranteedYieldPct / 100 : null,
      totalDistributionCostPct: Number.isFinite(weightedTdcPct) ? weightedTdcPct / 100 : null,
      assumedIndexRate: num(SII_CONSTANTS.indexAssumedCreditingRateCurrentPct, 6.35) / 100,
      assumedFixedRate: num(SII_CONSTANTS.fixedCreditingRateCurrentPct, 4.2) / 100,
      fixedAccountAllocationPct: num(SII_CONSTANTS.fixedAccountAllocationPct, 0),
      indexAccountAllocationPct: num(SII_CONSTANTS.indexAccountAllocationPct, 100),
      indexFloorRate: num(SII_CONSTANTS.indexFloorRatePct, 0) / 100,
      sp500CapRate: num(SII_CONSTANTS.sp500CapRatePct, 9) / 100,
      policyValueBoosterRate: num(SII_CONSTANTS.policyValueBoosterRatePctPa, 1.46) / 100,
      cumulativeChargesEstimate: finalRow.siiCumulativeChargesEstimate || 0,
      cumulativeBoosterEstimate: finalRow.siiCumulativeBooster || 0,
      cumulativeEffectOfDeductions: finalRow.siiCumulativeDeductions || 0,
      chargesBonusNetSpread: Number.isFinite(referenceRow.siiNetSpreadVsIndex) ? referenceRow.siiNetSpreadVsIndex : null,
      chargesRows: annual,
      blend,
    };

    return {
      mode,
      variant,
      settings: commonSettings,
      annual,
      monthly,
      final: {
        ...finalRow,
        irr: summary.finalNetIrr,
        bonusTotal: summary.cumulativeBoosterEstimate,
        netCapital: cumulativePremiums,
        siiSummary: summary,
      },
      cashFlows: finalCashFlows,
      siiSummary: summary,
      warnings: summary.notes,
    };
  }

  function simulate(settings, strategy, mode = "custom") {
    const variant = VARIANTS[settings.variantKey] || VARIANTS["10F3"];
    if (variant.kind === "rrp") {
      return simulateRRP(settings, strategy, mode);
    }
    if (variant.kind === "sii") {
      return simulateSII(settings, strategy, mode);
    }
    // Dispatch to the SI financing engine for SI variants. Coupon-
    // paying participating endowment with optional premium financing —
    // no fund NAV, no strategy table.
    if (variant.kind === "par-income-fin") {
      return simulateParIncome(settings, strategy, mode);
    }
    // Dispatch to the participating-whole-life engine for SLH variants.
    // The factor-table model produces values directly from policy year
    // and premium, with no per-year NAV / dividend inputs.
    if (variant.kind === "par-wl") {
      return simulateParWL(settings, strategy, mode);
    }
    const frequency = FREQUENCIES[settings.paymentFrequency] || FREQUENCIES.Annual;
    const years = Math.max(1, Math.min(99, num(settings.projectionYears, 37)));
    const rows = cloneStrategy(strategy, years);
    const annualizedPremium = num(settings.annualizedPremium, 100000);
    const adminAfterOverride = Number.isFinite(settings.adminAfterOverride) ? settings.adminAfterOverride : null;
    const adminAfter = adminAfterOverride === null ? variant.adminAfter : adminAfterOverride;
    const policyFee = policyFeeMonthly(variant, annualizedPremium, settings.policyFeeOverride);
    const piMgmtDeduction = settings.deductPiFundMgmt ? num(settings.piFundMgmtRate, 0.0125) : 0;
    const topUpChargeRate = Number.isFinite(settings.topUpChargeRate)
      ? settings.topUpChargeRate
      : (Number.isFinite(variant.topUpChargeRate) ? variant.topUpChargeRate : 0);
    const adminMode = variant.adminMode || "account";

    // Pre-compute VMPP series for variants where admin charge tracks
    // a notional accumulation of premiums up to flexi start date at 6% p.a. over the MIP.
    const vmppByYear = new Array(years + 1).fill(0);
    if (adminMode === "vmpp") {
      let prev = 0;
      for (let y = 1; y <= years; y += 1) {
        if (y === 1) {
          prev = annualizedPremium;
        } else if (y > variant.mipYears) {
          // Frozen after MIP
          prev = vmppByYear[y - 1];
        } else {
          const extra = y <= variant.shortfallYears ? annualizedPremium : 0;
          prev = extra + vmppByYear[y - 1] * 1.06;
        }
        vmppByYear[y] = prev;
      }
    }

    const cashFlows = [0];
    const monthly = [];
    const annual = [];

    let account = 0;
    let totalBasicPaid = 0;
    let totalTopUps = 0;
    let totalGrossWithdrawals = 0;
    let cashDividends = 0;
    let cashWithdrawals = 0;
    let reinvestedDividendBasis = 0;
    let totalReinvestedDividends = 0;
    let totalCoiCharges = 0;
    let lapsed = false;
    let bonusTotal = 0;
    let priorPartialWithdrawalUsage = 0;
    let yearPremiumBonusPaid = 0;
    let lastPremiumBonusYear = 0;
    let boosterPaid = false;
    let boosterEligible = true; // tracks "regular basic premiums paid on time before flexi start date"
    const rollingWithdrawals = [];
    const annualBuckets = new Map();

    for (let month = 1; month <= years * 12; month += 1) {
      const year = Math.ceil(month / 12);
      const monthInYear = ((month - 1) % 12) + 1;
      const row = rows[year - 1];
      const bucket = annualBuckets.get(year) || {
        year,
        premiums: 0,
        topUps: 0,
        bonuses: 0,
        grossDividends: 0,
        cashDividends: 0,
        reinvestedDividends: 0,
        adminCharges: 0,
        policyFees: 0,
        shortfallCharges: 0,
        coiCharges: 0,
        optionalDeductions: 0,
        dividendWithdrawals: 0,
        partialWithdrawals: 0,
        withdrawalCharges: 0,
        dividendWithdrawalLimit: 0,
        partialWithdrawalLimit: 0,
        partialWithdrawalChargeRate: 0,
        adminRate: 0,
      };

      const dueIndex = frequency.dueMonths.indexOf(monthInYear);
      const basicPremium = dueIndex >= 0 ? row.basicPremium / frequency.dueMonths.length : 0;
      const topUp = monthInYear === 1 ? row.topUp : 0;
      let bonus = 0;

      // Reset per-year premium-bonus accumulator
      if (monthInYear === 1 && year !== lastPremiumBonusYear) {
        yearPremiumBonusPaid = 0;
        lastPremiumBonusYear = year;
      }

      // Booster bonus eligibility: regular basic premiums must be paid on time before flexi start date.
      // Treat any year before flexi start where basic premium falls short of annualised as a missed payment.
      if (year < variant.flexiStartYear && monthInYear === 12) {
        const paidThisYear = (rows[year - 1].basicPremium || 0);
        if (paidThisYear + 0.01 < annualizedPremium) boosterEligible = false;
      }

      if (basicPremium > 0) {
        account += basicPremium;
        totalBasicPaid += basicPremium;
        bucket.premiums += basicPremium;
        cashFlows[month] = (cashFlows[month] || 0) - basicPremium;

        if (settings.includeWelcome && year === 1) {
          bonus += basicPremium * welcomeRate(variant, annualizedPremium);
        }
        if (settings.includeAnnualBonus && settings.paymentFrequency === "Annual" && year === 1 && monthInYear === 1) {
          bonus += basicPremium * variant.annualPremiumBonusRate;
        }
        // Premium Bonus (IRG only): from flexi start date onwards, 2% per regular basic premium paid,
        // capped at 2% × first-year annualised premium per policy year.
        const premiumBonusRate = variant.premiumBonusRate || 0;
        if (premiumBonusRate > 0 && year >= variant.flexiStartYear) {
          const yearCap = annualizedPremium * premiumBonusRate;
          const headroom = Math.max(0, yearCap - yearPremiumBonusPaid);
          const candidate = Math.min(basicPremium * premiumBonusRate, headroom);
          if (candidate > 0) {
            bonus += candidate;
            yearPremiumBonusPaid += candidate;
          }
        }
      }

      if (topUp > 0) {
        const investedTopUp = topUp * (1 - num(topUpChargeRate));
        account += investedTopUp;
        totalTopUps += topUp;
        bucket.topUps += topUp;
        cashFlows[month] = (cashFlows[month] || 0) - topUp;
      }

      // Booster Bonus (IRG only): paid one business day after end of MIP if conditions are met.
      // Approximated as paid in month 1 of policy year (mipYears + 1).
      const boosterRate = variant.boosterBonusRate || 0;
      if (boosterRate > 0 && !boosterPaid && year === variant.mipYears + 1 && monthInYear === 1) {
        // Condition (i): account value at end of MIP, less withdrawals/payouts/COI taken out, ≤ premiums + topups.
        // Equivalently: account ≤ premiums + topups + cumulative withdrawals + cash divs + COI.
        const adjustedAccount = account
          - (totalGrossWithdrawals + cashDividends + cashWithdrawals + totalCoiCharges) * 0; // included on rhs instead
        const threshold = totalBasicPaid + totalTopUps + totalGrossWithdrawals + cashDividends + cashWithdrawals + totalCoiCharges;
        if (boosterEligible && adjustedAccount <= threshold) {
          const boosterAmount = annualizedPremium * boosterRate;
          bonus += boosterAmount;
        }
        boosterPaid = true;
      }

      const recentWithdrawal = rollingWithdrawals.some((entry) => month - entry.month <= 12);
      if (settings.includeLoyalty && monthInYear === 1 && year > variant.mipYears && variant.loyaltyRate > 0 && !recentWithdrawal) {
        bonus += account * variant.loyaltyRate;
      }

      if (bonus > 0) {
        account += bonus;
        bonusTotal += bonus;
        bucket.bonuses += bonus;
      }

      let navAnnual = row.navReturn - piMgmtDeduction;
      let dividendAnnual = row.dividendYield;
      let dividendMode = row.dividendMode;
      if (mode === "navOnly") {
        navAnnual = (1 + navAnnual) * (1 + dividendAnnual) - 1;
        dividendAnnual = 0;
        dividendMode = "none";
      }
      if (mode === "dividendPayout" && dividendAnnual > 0) {
        dividendMode = "payout";
      }

      account *= 1 + annualToMonthly(navAnnual);

      const dividend = dividendAnnual > 0 ? account * annualToMonthly(dividendAnnual) : 0;
      if (dividend > 0) {
        bucket.grossDividends += dividend;
        if (dividendMode === "payout" && dividend >= num(settings.dividendMinimum, 40)) {
          cashDividends += dividend;
          bucket.cashDividends += dividend;
          cashFlows[month] = (cashFlows[month] || 0) + dividend;
        } else if (dividendMode !== "none") {
          account += dividend;
          reinvestedDividendBasis += dividend;
          totalReinvestedDividends += dividend;
          bucket.reinvestedDividends += dividend;
        }
      }

      const adminRate = year <= variant.mipYears ? variant.adminDuring : adminAfter;
      const adminBase = adminMode === "vmpp" ? vmppByYear[year] : account;
      const adminCharge = Math.max(0, adminBase) * adminRate / 12;
      account -= adminCharge;
      bucket.adminCharges += adminCharge;
      bucket.adminRate = adminRate;

      if (policyFee > 0) {
        const fee = Math.min(policyFee, Math.max(0, account));
        account -= fee;
        bucket.policyFees += fee;
      }

      if (settings.usePremiumShortfall) {
        const gap = Math.max(0, annualizedPremium - row.basicPremium);
        const shortfallRate = rateForYear(variant.shortfallCharge, year);
        if (gap > 0 && shortfallRate > 0 && year < variant.flexiStartYear) {
          const shortfallCharge = shortfallRate * gap / 12;
          account -= shortfallCharge;
          bucket.shortfallCharges += shortfallCharge;
        }
      }

      const deathBase = 1.01 * Math.max(0, totalBasicPaid + totalTopUps - totalGrossWithdrawals);
      const naar = Math.max(0, deathBase - account);
      const coiCharge = naar * num(settings.coiAnnualRate) / 12;
      if (coiCharge > 0) {
        account -= coiCharge;
        bucket.coiCharges += coiCharge;
        totalCoiCharges += coiCharge;
      }

      const optionalDeduction = row.optionalDeduction / 12;
      if (optionalDeduction > 0) {
        account -= optionalDeduction;
        bucket.optionalDeductions += optionalDeduction;
      }

      if (monthInYear === 12) {
        const dividendWithdrawalLimit = Math.min(Math.max(0, account), reinvestedDividendBasis);
        bucket.dividendWithdrawalLimit = dividendWithdrawalLimit;
        const dividendWithdrawal = Math.min(row.dividendWithdrawal, dividendWithdrawalLimit);
        if (dividendWithdrawal > 0) {
          account -= dividendWithdrawal;
          reinvestedDividendBasis = Math.max(0, reinvestedDividendBasis - dividendWithdrawal);
          totalGrossWithdrawals += dividendWithdrawal;
          cashWithdrawals += dividendWithdrawal;
          bucket.dividendWithdrawals += dividendWithdrawal;
          cashFlows[month] = (cashFlows[month] || 0) + dividendWithdrawal;
          rollingWithdrawals.push({ month, amount: dividendWithdrawal, type: "dividend" });
        }

        const availablePartialLimit = partialWithdrawalLimit(variant, year, Math.max(0, account), priorPartialWithdrawalUsage, reinvestedDividendBasis);
        bucket.partialWithdrawalLimit = availablePartialLimit;
        const grossWithdrawal = Math.min(row.partialWithdrawal, availablePartialLimit);
        const chargeRate = year <= variant.mipYears ? rateForYear(variant.partialCharge, year) : 0;
        const chargeableWithdrawal = grossWithdrawal;
        const withdrawalCharge = chargeableWithdrawal * chargeRate;
        const netWithdrawal = grossWithdrawal - withdrawalCharge;
        bucket.partialWithdrawalChargeRate = chargeRate;
        if (grossWithdrawal > 0) {
          account -= grossWithdrawal;
          totalGrossWithdrawals += grossWithdrawal;
          cashWithdrawals += netWithdrawal;
          bucket.partialWithdrawals += grossWithdrawal;
          bucket.withdrawalCharges += withdrawalCharge;
          cashFlows[month] = (cashFlows[month] || 0) + netWithdrawal;
          rollingWithdrawals.push({ month, amount: grossWithdrawal, type: "partial" });
          priorPartialWithdrawalUsage += grossWithdrawal;
        }
      }

      if (account <= 0) {
        account = 0;
        lapsed = true;
      }

      annualBuckets.set(year, bucket);
      const surrenderChargeRate = year <= variant.mipYears ? rateForYear(variant.surrenderCharge, year) : 0;
      const surrenderCharge = surrenderChargeRate * Math.max(0, account - reinvestedDividendBasis);
      const surrenderValue = Math.max(0, account - surrenderCharge);
      const deathBenefit = Math.max(1.01 * Math.max(0, totalBasicPaid + totalTopUps - totalGrossWithdrawals), account);
      monthly.push({
        month,
        year,
        age: num(settings.startAge, 62) + year,
        accountValue: account,
        surrenderValue,
        deathBenefit,
        cashDividends,
        cashWithdrawals,
        totalValue: account + cashDividends + cashWithdrawals,
        totalBasicPaid,
        totalTopUps,
        totalReinvestedDividends,
        reinvestedDividendBasis,
        lapsed,
      });

      if (monthInYear === 12) {
        const endBucket = annualBuckets.get(year);
        annual.push({
          ...endBucket,
          age: num(settings.startAge, 62) + year,
          accountValue: account,
          surrenderValue,
          deathBenefit,
          cashDividends,
          cashWithdrawals,
          totalValue: account + cashDividends + cashWithdrawals,
          totalBasicPaid,
          totalTopUps,
          totalReinvestedDividends,
          surrenderChargeRate,
          surrenderCharge,
          reinvestedDividendBasis,
          lapsed,
        });
      }
    }

    if (cashFlows.length <= years * 12) {
      cashFlows.length = years * 12 + 1;
    }
    cashFlows[years * 12] = (cashFlows[years * 12] || 0) + account;
    const final = annual[annual.length - 1] || {};
    const irr = irrMonthly(cashFlows);
    return {
      mode,
      variant,
      settings: { ...settings, adminAfter, policyFee },
      annual,
      monthly,
      final: {
        ...final,
        irr,
        bonusTotal,
        netCapital: totalBasicPaid + totalTopUps,
      },
      cashFlows,
      warnings: validate(settings, rows),
    };
  }

  function validate(settings, strategy) {
    const warnings = [];
    const variant = VARIANTS[settings.variantKey] || VARIANTS["10F3"];
    const annualizedPremium = num(settings.annualizedPremium);
    const minimum = annualizedMinimum(variant, settings.currency, settings.paymentFrequency);
    if (!variant.currencies.includes(settings.currency)) {
      warnings.push(`${variant.label} is not available in ${settings.currency}.`);
    }
    if (minimum === null) {
      warnings.push(`${settings.paymentFrequency} mode is not available for ${variant.label} in ${settings.currency}.`);
    } else if (annualizedPremium < minimum) {
      warnings.push(`Annualised basic premium is below the ${currencySymbol(settings.currency)}${minimum.toLocaleString()} minimum for this mode.`);
    }
    const missingBeforeFlexi = strategy.some((row) => row.year <= variant.shortfallYears && row.basicPremium < annualizedPremium);
    if (missingBeforeFlexi && settings.usePremiumShortfall) {
      warnings.push("Required premium funding gap detected during the premium term.");
    }
    if (settings.deductPiFundMgmt) {
      warnings.push("PI mode deducts 1.25% p.a.; keep it off for factsheet returns that are already net of fund management charges.");
    }
    return warnings;
  }

  // S&P 500 calendar-year returns (price-only, year-end close to year-end close).
  // Source: ^SPX daily close, full years 1951–2025.
  const SP500_ANNUAL_RETURNS = {1951:0.164625,1952:0.117796,1953:-0.06624,1954:0.450222,1955:0.264036,1956:0.026165,1957:-0.143133,1958:0.380595,1959:0.084767,1960:-0.029721,1961:0.231285,1962:-0.118099,1963:0.188906,1964:0.129699,1965:0.090619,1966:-0.13091,1967:0.200921,1968:0.076604,1969:-0.113614,1970:0.000978,1971:0.107868,1972:0.156333,1973:-0.173655,1974:-0.297181,1975:0.31549,1976:0.191485,1977:-0.11502,1978:0.01062,1979:0.123088,1980:0.257736,1981:-0.097304,1982:0.147613,1983:0.17271,1984:0.014006,1985:0.263334,1986:0.146204,1987:0.020275,1988:0.124008,1989:0.272505,1990:-0.065591,1991:0.263067,1992:0.044643,1993:0.070552,1994:-0.015393,1995:0.341107,1996:0.202637,1997:0.310082,1998:0.266686,1999:0.19526,2000:-0.101392,2001:-0.130427,2002:-0.23366,2003:0.263804,2004:0.089935,2005:0.03001,2006:0.136194,2007:0.035296,2008:-0.384858,2009:0.234542,2010:0.127827,2011:-3.2e-05,2012:0.134057,2013:0.296012,2014:0.113906,2015:-0.007266,2016:0.09535,2017:0.1942,2018:-0.062373,2019:0.288781,2020:0.162589,2021:0.268927,2022:-0.194428,2023:0.242305,2024:0.23309,2025:0.163878};

  // ===== GOAL-SEEK =====
  // Back-solve the annual basic premium needed to reach a target value
  // at a given policy year, holding the variant + currency + strategy
  // constant. Two regimes:
  //
  //   • Par-WL (SLH SP / 3-Pay / 5-Pay): closed-form. The factor table
  //     determines value deterministically:
  //         targetValue = factor(year) × basis(annualPremium, year, variant)
  //     where basis = annualPremium for "annual" basis variants (SP, 5-Pay)
  //     or cumulative-paid (= annualPremium × min(year, premiumTermYears))
  //     for "cumulative" basis variants (3-Pay).
  //
  //   • ILP (5F1 / 6F2 / ... / IRG20F10): the simulator runs monthly
  //     cashflows with year-by-year NAV growth + dividend yields taken
  //     from the strategy editor. The yield is therefore an INPUT (the
  //     advisor's editable strategy table), not something the solver
  //     invents. Given a fixed yield path, account value at year T is
  //     approximately linear in annualPremium — sum of premiums × growth
  //     factors, where growth factors don't depend on the premium amount.
  //     The only non-linearity is the small banded policy fee for
  //     premiums < ~$9,600 p.a.; for HNW illustrations (premium >= $50K)
  //     that's effectively zero.
  //
  //     Algorithm:
  //       1. Probe simulation at the current annualPremium (or $100K
  //          fallback). Read the value V₀ at the target year.
  //       2. Linear estimate: P₁ = P₀ × (target / V₀).
  //       3. Verify with one more simulation. If |V₁ − target|/target ≤ 0.5%,
  //          accept. Otherwise fall back to a 40-iteration binary search
  //          on premium ∈ [1, 10¹⁰]. Bisection always converges because
  //          value-at-year is monotone in premium.
  //
  //     The "yield assumption" is whatever's in `strategy[]` when the
  //     solver runs. If the advisor wants a different yield, they edit
  //     the strategy first then re-run goal-seek.
  function solvePremiumForTarget({ variantKey, targetValue, atYear, settings, strategy }) {
    const variant = VARIANTS[variantKey];
    if (!variant) return { success: false, error: "Unknown variant" };
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      return { success: false, error: "Target must be a positive number" };
    }
    const safeYear = Math.max(1, Math.min(num(atYear, 99), variant.kind === "par-wl" ? 120 : 99));

    if (variant.kind === "par-wl") {
      const factor = lookupSlhFactor(variant.slhFactorTable, safeYear);
      if (!factor || factor <= 0) {
        return { success: false, error: `No factor table entry for year ${safeYear}` };
      }
      let annualPremium;
      if (variant.slhFactorBasis === "cumulative") {
        // Cumulative basis (3-Pay): factor × (annualPremium × min(year, PT)) = target
        const cumYears = Math.min(safeYear, variant.premiumTermYears || 1);
        annualPremium = targetValue / (factor * cumYears);
      } else {
        // Annual basis (SP, 5-Pay): factor × annualPremium = target
        annualPremium = targetValue / factor;
      }
      return {
        success: true,
        annualPremium,
        method: "closed-form",
        atYear: safeYear,
        verifiedValue: targetValue,
        relativeError: 0,
      };
    }

    // ILP: linear-scale + verify, fall back to binary search if non-linear.
    const probePremium = num(settings && settings.annualizedPremium, 100000) || 100000;
    const baseSettings = {
      ...(settings || {}),
      annualizedPremium: probePremium,
      projectionYears: Math.max(safeYear, num((settings || {}).projectionYears, 37)),
    };

    // Helper to scale the strategy table's basicPremium + topUp rows in
    // sync with settings.annualizedPremium. The simulator reads per-year
    // premiums from the strategy table (so the advisor can model varying
    // funding patterns), not from settings.annualizedPremium directly.
    // Without scaling the strategy, changing settings.annualizedPremium
    // alone would only affect bonus rates, not the actual cashflow.
    const scaleStrategy = (rows, factor) => rows.map((row) => ({
      ...row,
      basicPremium: (row.basicPremium || 0) * factor,
      topUp: (row.topUp || 0) * factor,
    }));

    const probeResult = simulate(baseSettings, strategy, "custom");
    const probeRow = probeResult.annual[safeYear - 1];
    const probeValue = probeRow ? probeRow.totalValue : 0;
    if (probeValue <= 0) {
      return { success: false, error: `Probe simulation produced zero value at year ${safeYear} (account may have lapsed)` };
    }

    const linearFactor = targetValue / probeValue;
    const linearPremium = probePremium * linearFactor;
    const linearStrategy = scaleStrategy(strategy, linearFactor);
    const verifyResult = simulate(
      { ...baseSettings, annualizedPremium: linearPremium },
      linearStrategy,
      "custom"
    );
    const verifyRow = verifyResult.annual[safeYear - 1];
    const verifyValue = verifyRow ? verifyRow.totalValue : 0;
    const linearError = Math.abs(verifyValue - targetValue) / targetValue;
    if (linearError <= 0.005) {
      return {
        success: true,
        annualPremium: linearPremium,
        method: "linear-scaling",
        atYear: safeYear,
        verifiedValue: verifyValue,
        relativeError: linearError,
      };
    }

    // Fallback: binary search. Bisection on [1, 10¹⁰]; ~40 iterations is
    // enough to converge to within 1¢ for any reasonable target. Scale
    // the strategy table at every probe so basicPremium rows match the
    // current candidate premium.
    let lo = 1;
    let hi = 1e10;
    let best = { premium: linearPremium, value: verifyValue };
    for (let iter = 0; iter < 40; iter += 1) {
      const mid = (lo + hi) / 2;
      const factor = mid / probePremium;
      const r = simulate(
        { ...baseSettings, annualizedPremium: mid },
        scaleStrategy(strategy, factor),
        "custom"
      );
      const row = r.annual[safeYear - 1];
      const v = row ? row.totalValue : 0;
      if (v < targetValue) lo = mid; else hi = mid;
      best = { premium: mid, value: v };
      if (Math.abs(v - targetValue) / targetValue < 0.0005) break;
    }
    return {
      success: true,
      annualPremium: best.premium,
      method: "binary-search",
      atYear: safeYear,
      verifiedValue: best.value,
      relativeError: Math.abs(best.value - targetValue) / targetValue,
    };
  }

  const api = {
    FREQUENCIES,
    SP500_ANNUAL_RETURNS,
    VARIANTS,
    VARIANT_ORDER,
    PAR_WL_VARIANTS,
    PAR_INCOME_VARIANTS,
    RRP_VARIANTS,
    RRP3_DATA,
    RRP_CONSTANTS,
    RRP_GRID,
    SII_DATA,
    SII_CONSTANTS,
    SII_SCENARIOS,
    annualizedMinimum,
    currencySymbol,
    defaultStrategy,
    lookupSlhFactor,
    partialWithdrawalAllowed,
    partialWithdrawalLimit,
    policyFeeMonthly,
    premiumForYear,
    simulate,
    simulateParIncome,
    simulateRRP,
    simulateSII,
    rrpAvailablePayoutsForTerm,
    rrpIsSinglePremium,
    rrpVariantTerm,
    siiAvailableIncomeStartYears,
    siiIncomeBounds,
    siiIncomeStartMin,
    siiTermLabel,
    siiTermNumber,
    solvePremiumForTarget,
    validate,
    welcomeRate,
  };

  root.IRModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
