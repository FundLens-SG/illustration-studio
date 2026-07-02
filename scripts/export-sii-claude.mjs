import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadModel } from "../tests/harness.mjs";

const model = loadModel();
const outDir = resolve("exports", "claude", "sii");
mkdirSync(outDir, { recursive: true });

const ANNUALISED_PREMIUM_BASIS = 100000;
const now = new Date().toISOString();

function n(value, decimals = 2) {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return Number(parsed.toFixed(decimals));
}

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pct(value, decimals = 6) {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return Number((parsed * 100).toFixed(decimals));
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) value = value.join("; ");
  if (typeof value === "object") value = JSON.stringify(value);
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(path, rows, fields) {
  const csv = [
    fields.join(","),
    ...rows.map((row) => fields.map((field) => csvEscape(row[field])).join(",")),
  ].join("\n");
  writeFileSync(path, `${csv}\n`, "utf8");
}

function termKey(term) {
  return model.siiTermNumber(term) === 1 ? "SP" : `${model.siiTermNumber(term)}PAY`;
}

function rowAt(rows, year) {
  return (rows || []).find((row) => Math.round(Number(row.year || row.policy_year || 0)) === year) || null;
}

function sourceRowAt(source, key, year) {
  return (source?.[key] || []).find((row) => Math.round(Number(row.policy_year || 0)) === year) || null;
}

function sourcePdfCount(sourcePdf = "") {
  return String(sourcePdf || "").split(";").filter(Boolean).length;
}

const sourceScenarios = model.SII_SCENARIOS || [];
const sourceIds = new Map(sourceScenarios.map((row, index) => [
  row,
  row.scenario_id || `SRC_A${row.life_insured_age}_${termKey(row.premium_payment_term_number)}_PY${row.income_start_year}_${index + 1}`,
]));

const sourceScenarioRows = sourceScenarios.map((row) => ({
  scenario_id: sourceIds.get(row),
  source_pdf: row.source_pdf,
  source_pdf_count: sourcePdfCount(row.source_pdf),
  life_insured_age: row.life_insured_age,
  premium_payment_term: row.premium_payment_term,
  premium_payment_term_number: row.premium_payment_term_number,
  premium_payment_term_label: model.siiTermLabel(row.premium_payment_term_number),
  income_start_year: row.income_start_year,
  income_start_age: Number(row.life_insured_age) + Number(row.income_start_year),
  initial_annualised_premium: row.initial_planned_premium,
  initial_total_planned_premium: row.initial_total_planned_premium,
  initial_target_monthly_income: n(Number(row.initial_monthly_income_annualized) / 12, 6),
  initial_annualised_income: row.initial_monthly_income_annualized,
  annualised_income_per_100k_total_premium: row.initial_monthly_income_annualized_per_100k_total_premium,
  monthly_income_per_100k_total_premium: row.initial_monthly_income_per_100k_total_premium,
  face_amount: row.face_amount,
  current_illustrated_yield_pct_pa: row.current_illustrated_yield_pct_pa,
  guaranteed_illustrated_yield_pct_pa: row.guaranteed_illustrated_yield_pct_pa,
  total_distribution_cost: row.total_distribution_cost,
  total_distribution_cost_pct: row.total_distribution_cost_pct,
  current_row_count: (row.current_rows || []).length,
  guaranteed_row_count: (row.guaranteed_rows || []).length,
  income_row_count: (row.income_rows || []).length,
  deduction_row_count: (row.deduction_rows || []).length,
}));

writeCsv(resolve(outDir, "sii_claude_source_pi_scenarios.csv"), sourceScenarioRows, [
  "scenario_id",
  "source_pdf",
  "source_pdf_count",
  "life_insured_age",
  "premium_payment_term",
  "premium_payment_term_number",
  "premium_payment_term_label",
  "income_start_year",
  "income_start_age",
  "initial_annualised_premium",
  "initial_total_planned_premium",
  "initial_target_monthly_income",
  "initial_annualised_income",
  "annualised_income_per_100k_total_premium",
  "monthly_income_per_100k_total_premium",
  "face_amount",
  "current_illustrated_yield_pct_pa",
  "guaranteed_illustrated_yield_pct_pa",
  "total_distribution_cost",
  "total_distribution_cost_pct",
  "current_row_count",
  "guaranteed_row_count",
  "income_row_count",
  "deduction_row_count",
]);

const sourceAnnualRows = [];
for (const source of sourceScenarios) {
  const currentYears = (source.current_rows || []).map((row) => Number(row.policy_year));
  const guaranteedYears = (source.guaranteed_rows || []).map((row) => Number(row.policy_year));
  const incomeYears = (source.income_rows || []).map((row) => Number(row.policy_year));
  const deductionYears = (source.deduction_rows || []).map((row) => Number(row.policy_year));
  const years = Array.from(new Set([...currentYears, ...guaranteedYears, ...incomeYears, ...deductionYears]))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);
  for (const year of years) {
    const current = sourceRowAt(source, "current_rows", year) || {};
    const guaranteed = sourceRowAt(source, "guaranteed_rows", year) || {};
    const income = sourceRowAt(source, "income_rows", year) || {};
    const deduction = sourceRowAt(source, "deduction_rows", year) || {};
    sourceAnnualRows.push({
      scenario_id: sourceIds.get(source),
      source_pdf: source.source_pdf,
      life_insured_age: source.life_insured_age,
      premium_payment_term_number: source.premium_payment_term_number,
      premium_payment_term_label: model.siiTermLabel(source.premium_payment_term_number),
      income_start_year: source.income_start_year,
      source_initial_total_planned_premium: source.initial_total_planned_premium,
      source_initial_annualised_income: source.initial_monthly_income_annualized,
      policy_year: year,
      attained_age_source: current.attained_age_source || guaranteed.attained_age_source || income.attained_age_source || deduction.attained_age_source,
      current_premium_schedule: current.premium_schedule,
      current_policy_value: current.policy_value,
      current_policy_value_less_surrender_charge_and_unvested_booster: current.policy_value_less_surrender_charge_and_unvested_booster,
      current_surrender_value_floor: current.surrender_value_floor,
      current_surrender_value: current.surrender_value,
      current_monthly_income_annualized: current.monthly_income_annualized || income.monthly_income_annualized_current,
      current_death_benefit: current.death_benefit,
      guaranteed_policy_value: guaranteed.policy_value,
      guaranteed_surrender_value: guaranteed.surrender_value,
      guaranteed_monthly_income_annualized: guaranteed.monthly_income_annualized || income.monthly_income_annualized_guaranteed,
      current_effect_of_deductions: deduction.current_effect_of_deductions,
      current_value_of_premiums: deduction.current_value_of_premiums,
      deduction_current_surrender_value: deduction.current_surrender_value,
    });
  }
}

writeCsv(resolve(outDir, "sii_claude_source_pi_annual_values.csv"), sourceAnnualRows, [
  "scenario_id",
  "source_pdf",
  "life_insured_age",
  "premium_payment_term_number",
  "premium_payment_term_label",
  "income_start_year",
  "source_initial_total_planned_premium",
  "source_initial_annualised_income",
  "policy_year",
  "attained_age_source",
  "current_premium_schedule",
  "current_policy_value",
  "current_policy_value_less_surrender_charge_and_unvested_booster",
  "current_surrender_value_floor",
  "current_surrender_value",
  "current_monthly_income_annualized",
  "current_death_benefit",
  "guaranteed_policy_value",
  "guaranteed_surrender_value",
  "guaranteed_monthly_income_annualized",
  "current_effect_of_deductions",
  "current_value_of_premiums",
  "deduction_current_surrender_value",
]);

const exportSourceRows = sourceScenarios.filter((row) =>
  Number.isFinite(Number(row.premium_payment_term_number))
  && Number.isFinite(Number(row.income_start_year))
  && Number(row.initial_total_planned_premium) > 0
  && Number(row.initial_monthly_income_annualized) > 0
);

function prepareSourceRowCache(source) {
  const make = (rows = []) => {
    const sorted = [...rows]
      .filter((row) => Number.isFinite(Number(row.policy_year)))
      .sort((a, b) => Number(a.policy_year) - Number(b.policy_year));
    return {
      sorted,
      byYear: new Map(sorted.map((row) => [Math.round(Number(row.policy_year)), row])),
    };
  };
  source.__exportCache = {
    current_rows: make(source.current_rows),
    deduction_rows: make(source.deduction_rows),
  };
}

exportSourceRows.forEach(prepareSourceRowCache);

const sourceTerms = exportSourceRows.map((row) => toNum(row.premium_payment_term_number, 1));
const sourceStarts = exportSourceRows.map((row) => toNum(row.income_start_year, 4));
const sourceAges = exportSourceRows.map((row) => Math.round(toNum(row.life_insured_age, 46)));
const sourceRange = {
  minTerm: Math.min(...sourceTerms),
  maxTerm: Math.max(...sourceTerms),
  minStart: Math.min(...sourceStarts),
  maxStart: Math.max(...sourceStarts),
  minAge: Math.min(...sourceAges),
  maxAge: Math.max(...sourceAges),
};

function sourceDistance(row, termNum, startYear, age) {
  const termDistance = Math.abs(toNum(row.premium_payment_term_number, 1) - termNum);
  const startDistance = Math.abs(toNum(row.income_start_year, 4) - startYear) / 3;
  const ageDistance = Math.abs(Math.round(toNum(row.life_insured_age, age)) - age) / 10;
  return Math.sqrt(termDistance * termDistance + startDistance * startDistance + ageDistance * ageDistance);
}

function ageGroupedSources(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const age = Math.round(toNum(row.life_insured_age, 46));
    if (!groups.has(age)) groups.set(age, []);
    groups.get(age).push(row);
  });
  return Array.from(groups.entries())
    .map(([age, ageRows]) => ({ age, rows: ageRows }))
    .sort((a, b) => a.age - b.age);
}

function pickByAge(rows, age) {
  const groups = ageGroupedSources(rows);
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

function blendSourcesFast(term, incomeStartYear, age) {
  const termNum = model.siiTermNumber(term);
  const startYear = Math.round(toNum(incomeStartYear, 4));
  const ageNum = Math.round(toNum(age, 46));
  if (!exportSourceRows.length) return null;

  const exactRows = exportSourceRows.filter((row) =>
    Math.round(toNum(row.premium_payment_term_number, 0)) === termNum
    && Math.round(toNum(row.income_start_year, 0)) === startYear
  );
  const agePick = exactRows.length ? pickByAge(exactRows, ageNum) : null;
  const picked = exactRows.length
    ? agePick.picked
    : exportSourceRows
      .map((row) => ({ row, distance: sourceDistance(row, termNum, startYear, ageNum) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);

  if (!picked.length) return null;
  if (!exactRows.length) {
    const weightSum = picked.reduce((sum, item) => sum + (1 / Math.pow(item.distance + 0.001, 2)), 0);
    picked.forEach((item) => {
      item.weight = (1 / Math.pow(item.distance + 0.001, 2)) / (weightSum || 1);
    });
  }

  const inSourceBox = termNum >= sourceRange.minTerm
    && termNum <= sourceRange.maxTerm
    && startYear >= sourceRange.minStart
    && startYear <= sourceRange.maxStart
    && ageNum >= sourceRange.minAge
    && ageNum <= sourceRange.maxAge;
  const method = exactRows.length ? agePick.method : (inSourceBox ? "interpolated_sparse" : "extrapolated_sparse");
  const pickedAges = Array.from(new Set(picked.map((item) => Math.round(toNum(item.row.life_insured_age, ageNum))))).sort((a, b) => a - b);
  return {
    method,
    termNum,
    incomeStartYear: startYear,
    targetAge: ageNum,
    sources: picked,
    sourceCount: picked.length,
    sourcePdfs: picked.map((item) => item.row.source_pdf).filter(Boolean).join(";"),
    sourceLabels: picked
      .map((item) => `A${Math.round(toNum(item.row.life_insured_age, ageNum))} ${model.siiTermLabel(item.row.premium_payment_term_number)} / PY${item.row.income_start_year}`)
      .join("; "),
    sourceAges: pickedAges,
    sourceAgeMin: sourceRange.minAge,
    sourceAgeMax: sourceRange.maxAge,
    sourceExactForAge: pickedAges.includes(ageNum),
  };
}

function sourceRowFast(source, rowKey, year) {
  const cache = source.__exportCache?.[rowKey];
  if (!cache?.sorted?.length) return null;
  const exact = cache.byYear.get(year);
  if (exact) return exact;
  let left = null;
  let right = null;
  for (const row of cache.sorted) {
    const rowYear = Math.round(toNum(row.policy_year, 0));
    if (rowYear < year) left = row;
    if (rowYear > year) {
      right = row;
      break;
    }
  }
  if (!left) return right;
  if (!right) return left;
  const leftYear = toNum(left.policy_year, year);
  const rightYear = toNum(right.policy_year, year);
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

function blendAmountByTotalFast(blend, key, totalPremium, fallback = 0) {
  if (!blend?.sources?.length || !(totalPremium > 0)) return fallback;
  let value = 0;
  let weight = 0;
  blend.sources.forEach((item) => {
    const parsed = Number(item.row[key]);
    const sourceTotal = toNum(item.row.initial_total_planned_premium, 0);
    if (!Number.isFinite(parsed) || !(sourceTotal > 0)) return;
    value += (parsed / sourceTotal) * totalPremium * item.weight;
    weight += item.weight;
  });
  return weight > 0 ? value / weight : fallback;
}

function blendScalarFast(blend, key, fallback = 0) {
  if (!blend?.sources?.length) return fallback;
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

const currentValueKeys = [
  "policy_value",
  "policy_value_less_surrender_charge_and_unvested_booster",
  "surrender_value_floor",
  "surrender_value",
  "death_benefit",
];

function blendCurrentFast(blend, year, totalPremium) {
  const out = {};
  for (const key of currentValueKeys) {
    let value = 0;
    let weight = 0;
    blend.sources.forEach((item) => {
      const row = sourceRowFast(item.row, "current_rows", year);
      const sourceTotal = toNum(item.row.initial_total_planned_premium, 0);
      const parsed = Number(row?.[key]);
      if (!(sourceTotal > 0) || !Number.isFinite(parsed)) return;
      value += (parsed / sourceTotal) * totalPremium * item.weight;
      weight += item.weight;
    });
    out[key] = weight > 0 ? value / weight : 0;
  }
  return out;
}

function blendDeductionFast(blend, year, totalPremium) {
  let value = 0;
  let weight = 0;
  blend.sources.forEach((item) => {
    const row = sourceRowFast(item.row, "deduction_rows", year);
    const sourceTotal = toNum(item.row.initial_total_planned_premium, 0);
    const parsed = Number(row?.current_effect_of_deductions);
    if (!(sourceTotal > 0) || !Number.isFinite(parsed)) return;
    value += (parsed / sourceTotal) * totalPremium * item.weight;
    weight += item.weight;
  });
  return weight > 0 ? value / weight : 0;
}

function blendIncomeRawFast(blend, year, totalPremium, targetIncomeStartYear) {
  if (!blend?.sources?.length || !(totalPremium > 0) || year < targetIncomeStartYear) return 0;
  let value = 0;
  let weight = 0;
  blend.sources.forEach((item) => {
    const sourceTotal = toNum(item.row.initial_total_planned_premium, 0);
    const sourceStart = Math.round(toNum(item.row.income_start_year, targetIncomeStartYear));
    const sourceYear = sourceStart + (year - targetIncomeStartYear);
    const row = sourceRowFast(item.row, "current_rows", sourceYear);
    const parsed = Number(row?.monthly_income_annualized);
    if (!(sourceTotal > 0) || !Number.isFinite(parsed)) return;
    value += (parsed / sourceTotal) * totalPremium * item.weight;
    weight += item.weight;
  });
  return weight > 0 ? value / weight : 0;
}

function maxSourcePolicyYearFast(blend) {
  return blend.sources.reduce((max, item) => {
    const rows = item.row.__exportCache?.current_rows?.sorted || [];
    const last = rows[rows.length - 1];
    return Math.max(max, Math.round(toNum(last?.policy_year, 0)));
  }, 0);
}

function incomeBoundsFast(incomeStartYear) {
  const early = Math.round(toNum(incomeStartYear, 4)) <= 3;
  return {
    minMonthlyIncome: early ? toNum(model.SII_CONSTANTS.minMonthlyIncomeEarly, 60) : toNum(model.SII_CONSTANTS.minMonthlyIncomeStandard, 300),
    maxMonthlyIncome: early ? toNum(model.SII_CONSTANTS.maxMonthlyIncomeEarly, 100000) : toNum(model.SII_CONSTANTS.maxMonthlyIncomeStandard, 500000),
  };
}

function simulateSiiExportFast({ age, term, incomeStartYear, annualisedPremium }) {
  const constants = model.SII_CONSTANTS || {};
  const termNum = model.siiTermNumber(term);
  const blend = blendSourcesFast(termNum, incomeStartYear, age);
  const premiumBounds = model.siiPremiumBounds(termNum);
  const bounds = incomeBoundsFast(incomeStartYear);
  const blockers = [];
  const notes = [];

  const incomeAnnualRate = blend
    ? blend.sources.reduce((sum, item) => {
      const sourceTotal = toNum(item.row.initial_total_planned_premium, 0);
      const annualIncome = toNum(item.row.initial_monthly_income_annualized, 0);
      return sum + (sourceTotal > 0 ? (annualIncome / sourceTotal) * item.weight : 0);
    }, 0)
    : 0;
  const totalPlannedPremium = termNum > 1 ? annualisedPremium * termNum : annualisedPremium;
  const targetMonthlyIncome = totalPlannedPremium * incomeAnnualRate / 12;

  if (!blend) blockers.push("No parsed SII source illustrations are available for estimation.");
  if (!(incomeAnnualRate > 0)) blockers.push("No income rate could be derived from the parsed source illustrations.");
  if (annualisedPremium < premiumBounds.minAnnualPlannedPremium || annualisedPremium > premiumBounds.maxAnnualPlannedPremium) {
    blockers.push(`Annualised premium must be between US$${premiumBounds.minAnnualPlannedPremium.toLocaleString()} and US$${premiumBounds.maxAnnualPlannedPremium.toLocaleString()} for ${model.siiTermLabel(termNum)}.`);
  }
  if (targetMonthlyIncome < bounds.minMonthlyIncome || targetMonthlyIncome > bounds.maxMonthlyIncome) {
    blockers.push(`Target monthly income must be between US$${bounds.minMonthlyIncome.toLocaleString()} and US$${bounds.maxMonthlyIncome.toLocaleString()} for income start year ${incomeStartYear}.`);
  }
  if (blend?.method === "age_shifted_source") {
    notes.push(`Selected age is estimated from source age ${blend.sourceAges.join(", ")} for this term/start-year combination; validate against an official PI.`);
  } else if (blend?.method === "interpolated_age") {
    notes.push(`Age projection is interpolated between source-age anchors ${blend.sourceAges.join(" and ")}; validate against an official PI for the selected age.`);
  } else if (blend?.method === "extrapolated_age" || age < sourceRange.minAge || age > sourceRange.maxAge) {
    notes.push(`Age projection is extrapolated from source-age anchors ${Array.from(new Set(sourceAges)).sort((a, b) => a - b).join(", ")}; values further from these ages are less reliable.`);
  }
  if (blend && ["interpolated_sparse", "extrapolated_sparse"].includes(blend.method)) {
    notes.push("Premium term and income start values are interpolated or extrapolated from uploaded source PIs and are approximate.");
  }
  if (model.SII_DATA?.source?.errorCount) {
    notes.push(`${model.SII_DATA.source.errorCount} uploaded SII PDF did not parse and is excluded from this estimate.`);
  }

  const baseSummary = {
    valid: blockers.length === 0,
    blockers,
    notes,
    method: blend?.method || "not_available",
    premiumTermNumber: termNum,
    premiumTermLabel: model.siiTermLabel(termNum),
    incomeStartYear,
    incomeStartAge: age + incomeStartYear,
    targetMonthlyIncome,
    annualizedIncome: targetMonthlyIncome * 12,
    totalPlannedPremium,
    annualPlannedPremium: termNum > 1 ? annualisedPremium : 0,
    inputPremium: annualisedPremium,
    singlePremium: termNum === 1 ? totalPlannedPremium : 0,
    minAnnualPlannedPremium: premiumBounds.minAnnualPlannedPremium,
    maxAnnualPlannedPremium: premiumBounds.maxAnnualPlannedPremium,
    incomeAnnualRate,
    sourceLabels: blend?.sourceLabels || "",
    sourceAges: blend?.sourceAges || [],
    sourcePdfs: blend?.sourcePdfs || "",
    sourcePdfCount: blend?.sourceCount || 0,
  };

  if (blockers.length || !blend) {
    return { summary: baseSummary, milestones: {} };
  }

  const maxSourceYear = maxSourcePolicyYearFast(blend) || 79;
  const maturityAge = Math.round(toNum(constants.maturityAge, 125));
  const projectionYears = Math.max(1, Math.min(maxSourceYear, maturityAge - age));
  const annualPremium = termNum > 1 ? totalPlannedPremium / termNum : 0;
  const singlePremium = termNum === 1 ? totalPlannedPremium : 0;
  const faceAmount = blendAmountByTotalFast(blend, "face_amount", totalPlannedPremium, totalPlannedPremium);
  const targetAnnualIncome = targetMonthlyIncome * 12;
  const rawIncomeAtStart = blendIncomeRawFast(blend, incomeStartYear, totalPlannedPremium, incomeStartYear);
  const incomeScale = rawIncomeAtStart > 0 ? targetAnnualIncome / rawIncomeAtStart : 1;

  let cumulativePremiums = 0;
  let cumulativeIncome = 0;
  let priorPolicyValue = 0;
  let cumulativePremiumCharges = 0;
  let cumulativePolicyFees = 0;
  let cumulativeAdminFees = 0;
  let cumulativeBooster = 0;
  let cumulativeDeductions = 0;
  const milestones = {};
  let referenceRow = null;
  let finalRow = null;

  for (let year = 1; year <= projectionYears; year += 1) {
    const currentRow = blendCurrentFast(blend, year, totalPlannedPremium);
    const effectOfDeductions = Math.max(0, blendDeductionFast(blend, year, totalPlannedPremium));
    const premiumPaid = termNum === 1
      ? (year === 1 ? singlePremium : 0)
      : (year <= termNum ? annualPremium : 0);
    cumulativePremiums += premiumPaid;

    const annualIncome = year >= incomeStartYear
      ? Math.max(0, blendIncomeRawFast(blend, year, totalPlannedPremium, incomeStartYear) * incomeScale)
      : 0;
    cumulativeIncome += annualIncome;

    const policyValue = Math.max(0, toNum(currentRow.policy_value, 0));
    const policyValueLessCharges = Math.max(0, toNum(currentRow.policy_value_less_surrender_charge_and_unvested_booster, 0));
    const surrenderValue = Math.max(0, toNum(currentRow.surrender_value, 0));
    const deathBenefit = Math.max(0, toNum(currentRow.death_benefit, 0));
    const premiumChargePct = toNum(constants.premiumChargePctByPolicyYear?.[String(Math.min(year, 10))], 4);
    const premiumCharge = premiumPaid * premiumChargePct / 100;
    const policyFee = year <= toNum(constants.policyFeeToYear, 25)
      ? (faceAmount / 1000) * toNum(constants.policyFeePer1000FaceAmountMonthly, 2.108333) * 12
      : 0;
    const adminFee = priorPolicyValue * (toNum(constants.adminFeeMonthlyPctPolicyValue, 0.03) / 100) * 12;
    const policyValueBooster = year >= toNum(constants.policyValueBoosterFromYear, 2) && year <= toNum(constants.policyValueBoosterToYear, 25)
      ? faceAmount * toNum(constants.policyValueBoosterRatePctPa, 1.46) / 100
      : 0;
    cumulativePremiumCharges += premiumCharge;
    cumulativePolicyFees += policyFee;
    cumulativeAdminFees += adminFee;
    cumulativeBooster += policyValueBooster;
    cumulativeDeductions = Math.max(cumulativeDeductions, effectOfDeductions);

    const row = {
      year,
      age: age + year,
      siiPolicyValue: policyValue,
      siiPolicyValueLessCharges: policyValueLessCharges,
      siiSurrenderValue: surrenderValue,
      siiDeathBenefit: deathBenefit,
      siiAnnualIncome: annualIncome,
      siiCumulativeIncome: cumulativeIncome,
      siiPremiumPaid: premiumPaid,
      siiCumulativePremiums: cumulativePremiums,
      siiCumulativePremiumCharges: cumulativePremiumCharges,
      siiCumulativePolicyFees: cumulativePolicyFees,
      siiCumulativeAdminFees: cumulativeAdminFees,
      siiCumulativeChargesEstimate: cumulativePremiumCharges + cumulativePolicyFees + cumulativeAdminFees,
      siiCumulativeBooster: cumulativeBooster,
      siiCumulativeNetChargesAfterBooster: cumulativePremiumCharges + cumulativePolicyFees + cumulativeAdminFees - cumulativeBooster,
      siiCumulativeDeductions: cumulativeDeductions,
    };
    if (year === 1) milestones.y1 = row;
    if (year === incomeStartYear) milestones.start = row;
    if (year === 10) milestones.y10 = row;
    if (year === 20) milestones.y20 = row;
    if (year === 40) milestones.y40 = row;
    if (year === 40) referenceRow = row;
    finalRow = row;
    priorPolicyValue = policyValue;
  }

  referenceRow ||= finalRow || {};
  milestones.final = finalRow || {};
  const weightedCurrentYieldPct = blendScalarFast(blend, "current_illustrated_yield_pct_pa", null);
  const weightedGuaranteedYieldPct = blendScalarFast(blend, "guaranteed_illustrated_yield_pct_pa", null);
  const weightedTdcPct = blendScalarFast(blend, "total_distribution_cost_pct", null);

  return {
    summary: {
      ...baseSummary,
      valid: true,
      projectionYears,
      maturityAge,
      totalProjectedIncome: cumulativeIncome,
      totalBenefitsAtProjection: (finalRow?.siiSurrenderValue || 0) + cumulativeIncome,
      finalSurrenderValue: finalRow?.siiSurrenderValue || 0,
      finalDeathBenefit: finalRow?.siiDeathBenefit || 0,
      referenceYear: referenceRow.year || projectionYears,
      referenceAge: referenceRow.age || age + projectionYears,
      referenceSurrenderValue: referenceRow.siiSurrenderValue || 0,
      referencePolicyValue: referenceRow.siiPolicyValue || 0,
      referenceTotalBenefits: (referenceRow.siiSurrenderValue || 0) + (referenceRow.siiCumulativeIncome || 0),
      referenceCumulativeIncome: referenceRow.siiCumulativeIncome || 0,
      finalNetIrr: null,
      currentIllustratedYield: Number.isFinite(weightedCurrentYieldPct) ? weightedCurrentYieldPct / 100 : null,
      guaranteedIllustratedYield: Number.isFinite(weightedGuaranteedYieldPct) ? weightedGuaranteedYieldPct / 100 : null,
      totalDistributionCostPct: Number.isFinite(weightedTdcPct) ? weightedTdcPct / 100 : null,
      faceAmount,
      rawIncomeAtStart,
      incomeScale,
      totalPremiumChargeEstimate: finalRow?.siiCumulativePremiumCharges || 0,
      totalPolicyFeeEstimate: finalRow?.siiCumulativePolicyFees || 0,
      totalAdminFeeEstimate: finalRow?.siiCumulativeAdminFees || 0,
      cumulativeChargesEstimate: finalRow?.siiCumulativeChargesEstimate || 0,
      cumulativeBoosterEstimate: finalRow?.siiCumulativeBooster || 0,
      cumulativeNetChargesAfterBooster: finalRow?.siiCumulativeNetChargesAfterBooster || 0,
      cumulativeEffectOfDeductions: finalRow?.siiCumulativeDeductions || 0,
    },
    milestones,
  };
}

const constants = model.SII_CONSTANTS || {};
const terms = ["single", 2, 3, 4, 5, 6, 7, 8, 9, 10];
const extrapolationRows = [];

for (let age = constants.entryAgeMin ?? 0; age <= (constants.entryAgeMax ?? 70); age += 1) {
  for (const term of terms) {
    const termNum = model.siiTermNumber(term);
    const termLabel = model.siiTermLabel(term);
    const premiumBounds = model.siiPremiumBounds(term);
    const annualisedPremium = ANNUALISED_PREMIUM_BASIS;
    const starts = model.siiAvailableIncomeStartYears(term);
    for (const startYear of starts) {
      const result = simulateSiiExportFast({ age, term, incomeStartYear: startYear, annualisedPremium });
      const summary = result.summary || {};
      const y1 = result.milestones?.y1 || {};
      const start = result.milestones?.start || {};
      const y10 = result.milestones?.y10 || {};
      const y20 = result.milestones?.y20 || {};
      const y40 = result.milestones?.y40 || {};
      const final = result.milestones?.final || {};
      extrapolationRows.push({
        scenario_key: `AGE${age}_${termKey(term)}_PY${startYear}`,
        age,
        premium_term_number: termNum,
        premium_term_label: termLabel,
        income_start_year: startYear,
        income_start_age: summary.incomeStartAge,
        valid: summary.valid,
        blockers: (summary.blockers || []).join("; "),
        notes: (summary.notes || []).join("; "),
        estimation_method: summary.method,
        source_pdf_count: summary.sourcePdfCount,
        source_ages: summary.sourceAges,
        source_labels: summary.sourceLabels,
        annualised_premium_basis: annualisedPremium,
        min_annualised_premium: n(premiumBounds.minAnnualPlannedPremium, 2),
        max_annualised_premium: n(premiumBounds.maxAnnualPlannedPremium, 2),
        total_planned_premium: n(summary.totalPlannedPremium, 2),
        target_monthly_income: n(summary.targetMonthlyIncome, 6),
        annualised_income: n(summary.annualizedIncome, 6),
        monthly_income_per_100k_annualised_premium: n(summary.targetMonthlyIncome, 6),
        annualised_income_per_100k_annualised_premium: n(summary.annualizedIncome, 6),
        annual_income_rate_per_total_premium_pct: pct(summary.incomeAnnualRate, 6),
        projection_years: summary.projectionYears,
        maturity_age: summary.maturityAge,
        current_illustrated_yield_pct_pa: pct(summary.currentIllustratedYield, 6),
        guaranteed_illustrated_yield_pct_pa: pct(summary.guaranteedIllustratedYield, 6),
        total_distribution_cost_pct: pct(summary.totalDistributionCostPct, 6),
        final_net_irr_pct: pct(summary.finalNetIrr, 6),
        reference_year: summary.referenceYear,
        reference_age: summary.referenceAge,
        reference_surrender_value: n(summary.referenceSurrenderValue, 2),
        reference_policy_value: n(summary.referencePolicyValue, 2),
        reference_cumulative_income: n(summary.referenceCumulativeIncome, 2),
        reference_total_benefits: n(summary.referenceTotalBenefits, 2),
        total_projected_income: n(summary.totalProjectedIncome, 2),
        final_surrender_value: n(summary.finalSurrenderValue, 2),
        final_death_benefit: n(summary.finalDeathBenefit, 2),
        total_benefits_at_projection: n(summary.totalBenefitsAtProjection, 2),
        net_illustrated_yield_pct_pa: pct(summary.currentIllustratedYield, 6),
        index_account_assumption_pct_pa: n(constants.indexAssumedCreditingRateCurrentPct, 2),
        blended_drag_vs_index_assumption_pct: pct(Number.isFinite(summary.currentIllustratedYield)
          ? (toNum(constants.indexAssumedCreditingRateCurrentPct, 6.35) / 100) - summary.currentIllustratedYield
          : null, 6),
        face_amount_estimate: n(summary.faceAmount, 2),
        total_premium_charge_estimate: n(summary.totalPremiumChargeEstimate, 2),
        total_policy_fee_estimate: n(summary.totalPolicyFeeEstimate, 2),
        total_admin_fee_estimate: n(summary.totalAdminFeeEstimate, 2),
        total_fee_estimate: n(summary.cumulativeChargesEstimate, 2),
        policy_value_booster_estimate: n(summary.cumulativeBoosterEstimate, 2),
        net_fees_after_booster: n(summary.cumulativeNetChargesAfterBooster, 2),
        effect_of_deductions: n(summary.cumulativeEffectOfDeductions, 2),
        y1_policy_value: n(y1.siiPolicyValue, 2),
        y1_surrender_value: n(y1.siiSurrenderValue, 2),
        y1_death_benefit: n(y1.siiDeathBenefit, 2),
        income_start_annual_income: n(start.siiAnnualIncome, 2),
        income_start_cumulative_income: n(start.siiCumulativeIncome, 2),
        income_start_surrender_value: n(start.siiSurrenderValue, 2),
        y10_annual_income: n(y10.siiAnnualIncome, 2),
        y10_cumulative_income: n(y10.siiCumulativeIncome, 2),
        y10_surrender_value: n(y10.siiSurrenderValue, 2),
        y20_annual_income: n(y20.siiAnnualIncome, 2),
        y20_cumulative_income: n(y20.siiCumulativeIncome, 2),
        y20_surrender_value: n(y20.siiSurrenderValue, 2),
        y40_annual_income: n(y40.siiAnnualIncome, 2),
        y40_cumulative_income: n(y40.siiCumulativeIncome, 2),
        y40_surrender_value: n(y40.siiSurrenderValue, 2),
        final_policy_year: final.year,
        final_age: final.age,
      });
    }
  }
}

writeCsv(resolve(outDir, "sii_claude_all_extrapolations_annualised_100k.csv"), extrapolationRows, [
  "scenario_key",
  "age",
  "premium_term_number",
  "premium_term_label",
  "income_start_year",
  "income_start_age",
  "valid",
  "blockers",
  "notes",
  "estimation_method",
  "source_pdf_count",
  "source_ages",
  "source_labels",
  "annualised_premium_basis",
  "min_annualised_premium",
  "max_annualised_premium",
  "total_planned_premium",
  "target_monthly_income",
  "annualised_income",
  "monthly_income_per_100k_annualised_premium",
  "annualised_income_per_100k_annualised_premium",
  "annual_income_rate_per_total_premium_pct",
  "projection_years",
  "maturity_age",
  "current_illustrated_yield_pct_pa",
  "guaranteed_illustrated_yield_pct_pa",
  "total_distribution_cost_pct",
  "final_net_irr_pct",
  "reference_year",
  "reference_age",
  "reference_surrender_value",
  "reference_policy_value",
  "reference_cumulative_income",
  "reference_total_benefits",
  "total_projected_income",
  "final_surrender_value",
  "final_death_benefit",
  "total_benefits_at_projection",
  "net_illustrated_yield_pct_pa",
  "index_account_assumption_pct_pa",
  "blended_drag_vs_index_assumption_pct",
  "face_amount_estimate",
  "total_premium_charge_estimate",
  "total_policy_fee_estimate",
  "total_admin_fee_estimate",
  "total_fee_estimate",
  "policy_value_booster_estimate",
  "net_fees_after_booster",
  "effect_of_deductions",
  "y1_policy_value",
  "y1_surrender_value",
  "y1_death_benefit",
  "income_start_annual_income",
  "income_start_cumulative_income",
  "income_start_surrender_value",
  "y10_annual_income",
  "y10_cumulative_income",
  "y10_surrender_value",
  "y20_annual_income",
  "y20_cumulative_income",
  "y20_surrender_value",
  "y40_annual_income",
  "y40_cumulative_income",
  "y40_surrender_value",
  "final_policy_year",
  "final_age",
]);

const methodCounts = extrapolationRows.reduce((acc, row) => {
  acc[row.estimation_method] = (acc[row.estimation_method] || 0) + 1;
  return acc;
}, {});

const summary = {
  generatedAt: now,
  product: "SII / Signature Indexed Income",
  source: model.SII_DATA?.source,
  productConstants: model.SII_CONSTANTS,
  exportBasis: {
    annualisedPremiumBasisUsd: ANNUALISED_PREMIUM_BASIS,
    ageRange: `${constants.entryAgeMin ?? 0}-${constants.entryAgeMax ?? 70}`,
    premiumTerms: terms.map((term) => model.siiTermLabel(term)),
    incomeStartRules: constants.incomeStartRules,
  },
  counts: {
    sourceScenarioRows: sourceScenarioRows.length,
    sourceAnnualRows: sourceAnnualRows.length,
    extrapolationRows: extrapolationRows.length,
    estimationMethodCounts: methodCounts,
  },
  files: {
    sourceScenarios: "sii_claude_source_pi_scenarios.csv",
    sourceAnnualValues: "sii_claude_source_pi_annual_values.csv",
    allExtrapolations: "sii_claude_all_extrapolations_annualised_100k.csv",
    machineSummary: "sii_claude_export_summary.json",
    handoffMarkdown: "SII_CLAUDE_EXPORT.md",
  },
};

writeFileSync(resolve(outDir, "sii_claude_export_summary.json"), JSON.stringify(summary, null, 2), "utf8");

const md = `# SII Claude Export

Generated: ${now}

## Important Caveat

These SII figures are derived from uploaded policy illustrations and extrapolated/interpolated by the Illustration Studio model. They are approximate, are not official Manulife policy illustrations, are not guaranteed to be 100% accurate, and must be validated against an official PI before client use or application.

## Files

- \`sii_claude_source_pi_scenarios.csv\` - one row per unique parsed source PI scenario.
- \`sii_claude_source_pi_annual_values.csv\` - annual source values from each parsed PI scenario, including current values, guaranteed values, income rows, and deduction rows where parsed.
- \`sii_claude_all_extrapolations_annualised_100k.csv\` - full extrapolation grid for all entry ages ${constants.entryAgeMin ?? 0}-${constants.entryAgeMax ?? 70}, all premium terms SP/2-pay/3-pay/4-pay/5-pay/6-pay/7-pay/8-pay/9-pay/10-pay, and every product-valid income start year.
- \`sii_claude_export_summary.json\` - machine-readable metadata and counts.

## Export Basis

- Currency: USD.
- Account basis: 100% S&P 500 Index Sub-account.
- Assumed current Index Account illustration rate: ${model.SII_CONSTANTS.indexAssumedCreditingRateCurrentPct}%.
- Fixed Account allocation: ${model.SII_CONSTANTS.fixedAccountAllocationPct}%.
- Index Account allocation: ${model.SII_CONSTANTS.indexAccountAllocationPct}%.
- S&P 500 floor/cap captured in this model: ${model.SII_CONSTANTS.indexFloorRatePct}% floor / ${model.SII_CONSTANTS.sp500CapRatePct}% cap.
- Extrapolation grid premium basis: US$${ANNUALISED_PREMIUM_BASIS.toLocaleString()} annualised premium.
- For SP, annualised premium basis is treated as the single premium.
- For multi-pay terms, total planned premium = annualised premium x premium term.

## Source Coverage

- Parsed unique source PI scenarios: ${sourceScenarioRows.length}.
- Source annual rows exported: ${sourceAnnualRows.length}.
- Source ages: ${(model.SII_DATA?.source?.sourceAges || []).join(", ")}.
- Source premium terms: ${(model.SII_DATA?.source?.sourcePremiumTerms || []).join(", ")}.
- Source income start years: ${(model.SII_DATA?.source?.sourceIncomeStartYears || []).join(", ")}.

## Extrapolation Coverage

- Extrapolation rows exported: ${extrapolationRows.length}.
- Method counts: ${Object.entries(methodCounts).map(([key, value]) => `${key}=${value}`).join(", ")}.

## Model Notes For Claude

- Source-exact term/start/age cases use the matching parsed PI row.
- Matching term/start cases across age anchors use age interpolation or extrapolation.
- Sparse term/start cases use inverse-distance weighting across premium term, income start year, and age.
- Income is aligned to the selected income start year. Source payout curves are shifted so payout year 1 lands on the selected policy year; income before the selected start year is forced to zero.
- User-facing premium input is annualised premium for 2-pay to 10-pay and single premium for SP.
- The full extrapolation grid uses \`net_illustrated_yield_pct_pa\` as the collapsed annualised representation of charges blended with bonuses, and \`blended_drag_vs_index_assumption_pct\` as the spread against the 6.35% Index Account illustration assumption.
- Charges and bonuses include premium charge, policy fee, admin fee estimate, policy value booster, net fees after booster, surrender/unvested drag, and parsed effect of deductions.
- Early-year SII IRR values outside sane bounds are displayed as \`n.m.\` in the UI and exported as blank/null where applicable.
`;

writeFileSync(resolve(outDir, "SII_CLAUDE_EXPORT.md"), md, "utf8");

console.log(JSON.stringify(summary, null, 2));
