from __future__ import annotations

import csv
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pypdf import PdfReader


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO_ROOT / "source-data" / "signature-indexed-income"
RAW_TEXT_DIR = SOURCE_DIR / "raw-text"
PARSED_DIR = SOURCE_DIR / "parsed"
ASSET_PATH = REPO_ROOT / "assets" / "sii-rates.js"

DEFAULT_PI_GLOB = "PI_20260702*.pdf"
DEFAULT_PI_FOLDER = Path(r"C:\Users\user\Downloads")
TECH_DECK = Path(r"C:\Users\user\Downloads\Manulife Signature Indexed Income Training Tech Deck Apr2026 (1).pdf")


def parse_money(value: str | None) -> float | None:
    if not value:
        return None
    cleaned = value.replace(",", "").replace("US$", "").replace("$", "").strip()
    if cleaned in {"", "-"}:
        return 0.0
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = "-" + cleaned[1:-1]
    return float(cleaned)


def parse_term(value: str | None) -> int | str | None:
    if not value:
        return None
    value = value.strip()
    if "single" in value.lower():
        return "single"
    match = re.search(r"(\d+)\s*years?", value, re.I)
    if match:
        return int(match.group(1))
    return value


def term_number(term: int | str | None) -> int | None:
    if term == "single":
        return 1
    try:
        return int(term) if term is not None else None
    except (TypeError, ValueError):
        return None


def extract_pdf_text(pdf_path: Path) -> tuple[str | None, dict[str, Any]]:
    info: dict[str, Any] = {
        "file": str(pdf_path),
        "name": pdf_path.name,
        "encrypted": False,
        "pages": 0,
        "chars": 0,
        "error": None,
    }
    try:
        reader = PdfReader(str(pdf_path), strict=False)
        info["encrypted"] = bool(reader.is_encrypted)
        if reader.is_encrypted:
            # Most Manulife PI PDFs in this set open with an empty password.
            reader.decrypt("")
        pages: list[str] = []
        for index in range(len(reader.pages)):
            try:
                text = reader.pages[index].extract_text() or ""
            except Exception as exc:  # pragma: no cover - audit path
                text = f"[EXTRACT ERROR {type(exc).__name__}: {exc}]"
            pages.append(f"--- PAGE {index + 1} ---\n{text}")
        full_text = "\n\n".join(pages)
        info["pages"] = len(reader.pages)
        info["chars"] = len(full_text)
        return full_text, info
    except Exception as exc:
        info["error"] = f"{type(exc).__name__}: {exc}"
        return None, info


def copy_or_extract_deck() -> dict[str, Any]:
    if not TECH_DECK.exists():
        return {"found": False, "path": str(TECH_DECK)}
    deck_out = SOURCE_DIR / "technical-deck-extracted-text.txt"
    snippets_out = SOURCE_DIR / "technical-deck-keyword-snippets.json"
    text, info = extract_pdf_text(TECH_DECK)
    if text:
        deck_out.write_text(text, encoding="utf-8")
        keywords = [
            "Signature Indexed Income",
            "premium charge",
            "policy fee",
            "administration fee",
            "surrender charge",
            "policy value booster",
            "income start year",
            "monthly income",
            "S&P 500",
            "Index Account",
            "entry age",
            "target monthly income",
            "total planned premium",
            "surrender value floor",
        ]
        snippets = []
        for block in re.split(r"--- PAGE\s+", text):
            page_match = re.match(r"(\d+)\s+---\n(.*)", block, re.S)
            if not page_match:
                continue
            page = int(page_match.group(1))
            body = page_match.group(2).strip()
            hits = [keyword for keyword in keywords if keyword.lower() in body.lower()]
            if hits:
                snippets.append({"page": page, "hits": hits, "text": body[:2500]})
        snippets_out.write_text(json.dumps({"snippets": snippets}, indent=2), encoding="utf-8")
    info["found"] = True
    return info


def extract_line_rows(text: str, columns: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    row_re = re.compile(r"^\s*(\d+)\/(\d+)\s+(.+?)\s*$")
    for raw_line in text.splitlines():
        match = row_re.match(raw_line)
        if not match:
            continue
        values = re.findall(r"-|\(?\d[\d,]*(?:\.\d+)?\)?", match.group(3))
        if len(values) < len(columns):
            continue
        row: dict[str, Any] = {
            "policy_year": int(match.group(1)),
            "attained_age_source": int(match.group(2)),
        }
        for key, value in zip(columns, values):
            row[key] = parse_money(value)
        rows.append(row)
    return rows


def page_blocks(text: str) -> list[tuple[int, str]]:
    blocks: list[tuple[int, str]] = []
    for block in re.split(r"--- PAGE\s+", text):
        match = re.match(r"(\d+)\s+---\n(.*)", block, re.S)
        if match:
            blocks.append((int(match.group(1)), match.group(2)))
    return blocks


def first_match(pattern: str, text: str, flags: int = 0) -> re.Match[str] | None:
    return re.search(pattern, text, flags)


def parse_scenario(text: str, source_name: str) -> dict[str, Any]:
    age_match = first_match(r"Age Last Birthday\s*:\s*(\d+)", text)
    term_match = first_match(r"Planned Premium Term\s+(.+)", text)
    initial_premium_match = first_match(r"Initial Planned Premium\s+US\$([\d,]+(?:\.\d+)?)", text)
    total_premium_match = first_match(r"Initial Total Planned Premium\s+US\$([\d,]+(?:\.\d+)?)", text)
    income_start_match = first_match(r"Income Start Year\s+Policy Year\s+(\d+)", text)
    initial_income_match = first_match(r"Initial Monthly Income \(Annualised\)A?\s+US\$([\d,]+)", text)
    if not initial_income_match:
        initial_income_match = first_match(r"Initial Monthly Income\s*\(Annualised\)\s*US\$([\d,]+)", text, re.S)
    face_amount_match = first_match(r"Face Amount\s+US\$([\d,]+(?:\.\d+)?)", text)
    tdc_match = first_match(r"Total Distribution Cost for this plan is US\$([\d,]+).*?([\d.]+)%", text, re.S)
    current_yield_match = first_match(
        r"current crediting rate.*?surrender at age\s+(\d+)\s+is\s+([-\d.]+)%\s+p\.a\.",
        text,
        re.I | re.S,
    )
    guaranteed_yield_match = first_match(
        r"minimum guaranteed crediting rate.*?surrender at age\s+(\d+)\s+is\s+([-\d.]+)%\s+p\.a\.",
        text,
        re.I | re.S,
    )
    booster_match = first_match(r"Policy Value Booster\s+([\d.]+)%p\.a\.", text)

    blocks = page_blocks(text)
    income_rows: list[dict[str, Any]] = []
    deduction_rows: list[dict[str, Any]] = []
    guaranteed_rows: list[dict[str, Any]] = []
    current_rows: list[dict[str, Any]] = []
    premium_schedule_rows: list[dict[str, Any]] = []

    for _, body in blocks:
        if "Income Illustration" in body and "MONTHLY INCOME (ANNUALISED)" in body and "Paid Out" in body:
            income_rows.extend(
                extract_line_rows(
                    body,
                    [
                        "total_basic_premiums_paid_to_date",
                        "monthly_income_annualized_guaranteed",
                        "monthly_income_annualized_current",
                    ],
                )
            )
        if "Table of Deductions" in body:
            deduction_rows.extend(
                extract_line_rows(
                    body,
                    [
                        "total_basic_premiums_paid_to_date",
                        "guaranteed_value_of_premiums",
                        "guaranteed_effect_of_deductions",
                        "guaranteed_surrender_value",
                        "current_value_of_premiums",
                        "current_effect_of_deductions",
                        "current_surrender_value",
                    ],
                )
            )
        if "Supplementary Illustration" in body and "Premium" in body and "Death Benefit" in body:
            target = None
            if "current Fixed Account crediting rate" in body:
                target = current_rows
            elif "guaranteed crediting rate" in body and "maximum charges" in body:
                target = guaranteed_rows
            if target is not None:
                target.extend(
                    extract_line_rows(
                        body,
                        [
                            "premium_schedule",
                            "policy_value",
                            "policy_value_less_surrender_charge_and_unvested_booster",
                            "surrender_value_floor",
                            "surrender_value",
                            "monthly_income_annualized",
                            "death_benefit",
                        ],
                    )
                )
        if "Premium Schedule Summary" in body:
            for raw_line in body.splitlines():
                match = re.match(r"^\s*(\d+)\s+([\d,]+(?:\.\d+)?|-)\s*$", raw_line)
                if match:
                    premium_schedule_rows.append(
                        {
                            "policy_year": int(match.group(1)),
                            "planned_premium": parse_money(match.group(2)),
                        }
                    )

    scenario = {
        "source_pdf": source_name,
        "life_insured_age": int(age_match.group(1)) if age_match else None,
        "gender": "Male" if "Male, Non-Smoker" in text else None,
        "smoker_status": "Non-Smoker" if "Non-Smoker" in text else None,
        "risk_class": "Standard" if "Non-Smoker Standard" in text else None,
        "premium_payment_term": parse_term(term_match.group(1).strip()) if term_match else None,
        "premium_payment_term_number": None,
        "initial_planned_premium": parse_money(initial_premium_match.group(1)) if initial_premium_match else None,
        "initial_total_planned_premium": parse_money(total_premium_match.group(1)) if total_premium_match else None,
        "income_start_year": int(income_start_match.group(1)) if income_start_match else None,
        "initial_monthly_income_annualized": parse_money(initial_income_match.group(1)) if initial_income_match else None,
        "face_amount": parse_money(face_amount_match.group(1)) if face_amount_match else None,
        "total_distribution_cost": parse_money(tdc_match.group(1)) if tdc_match else None,
        "total_distribution_cost_pct": float(tdc_match.group(2)) if tdc_match else None,
        "current_illustrated_yield_age": int(current_yield_match.group(1)) if current_yield_match else None,
        "current_illustrated_yield_pct_pa": float(current_yield_match.group(2)) if current_yield_match else None,
        "guaranteed_illustrated_yield_age": int(guaranteed_yield_match.group(1)) if guaranteed_yield_match else None,
        "guaranteed_illustrated_yield_pct_pa": float(guaranteed_yield_match.group(2)) if guaranteed_yield_match else None,
        "policy_value_booster_rate_pct_pa": float(booster_match.group(1)) if booster_match else None,
        "income_rows": sorted(income_rows, key=lambda row: row["policy_year"]),
        "deduction_rows": sorted(deduction_rows, key=lambda row: row["policy_year"]),
        "guaranteed_rows": sorted(guaranteed_rows, key=lambda row: row["policy_year"]),
        "current_rows": sorted(current_rows, key=lambda row: row["policy_year"]),
        "premium_schedule_rows": sorted(premium_schedule_rows, key=lambda row: row["policy_year"]),
    }
    scenario["premium_payment_term_number"] = term_number(scenario["premium_payment_term"])
    total = scenario["initial_total_planned_premium"] or 0
    if total > 0:
        scenario["initial_monthly_income_annualized_per_100k_total_premium"] = (
            (scenario["initial_monthly_income_annualized"] or 0) / total * 100000
        )
        scenario["initial_monthly_income_per_100k_total_premium"] = (
            (scenario["initial_monthly_income_annualized"] or 0) / 12 / total * 100000
        )
    return scenario


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def clean_scenario_for_asset(scenario: dict[str, Any]) -> dict[str, Any]:
    keys = [
        "source_pdf",
        "life_insured_age",
        "gender",
        "smoker_status",
        "risk_class",
        "premium_payment_term",
        "premium_payment_term_number",
        "initial_planned_premium",
        "initial_total_planned_premium",
        "income_start_year",
        "initial_monthly_income_annualized",
        "initial_monthly_income_annualized_per_100k_total_premium",
        "initial_monthly_income_per_100k_total_premium",
        "face_amount",
        "total_distribution_cost",
        "total_distribution_cost_pct",
        "current_illustrated_yield_age",
        "current_illustrated_yield_pct_pa",
        "guaranteed_illustrated_yield_age",
        "guaranteed_illustrated_yield_pct_pa",
        "policy_value_booster_rate_pct_pa",
        "income_rows",
        "deduction_rows",
        "guaranteed_rows",
        "current_rows",
        "premium_schedule_rows",
    ]
    return {key: scenario.get(key) for key in keys}


def build() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    RAW_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    PARSED_DIR.mkdir(parents=True, exist_ok=True)

    deck_info = copy_or_extract_deck()
    pdfs = sorted(DEFAULT_PI_FOLDER.glob(DEFAULT_PI_GLOB))
    extraction_audit: list[dict[str, Any]] = []
    scenarios: list[dict[str, Any]] = []
    parsed_source_names: set[str] = set()
    cached_text_count = 0
    cached_text_errors: list[dict[str, str]] = []

    for pdf in pdfs:
        text, info = extract_pdf_text(pdf)
        extraction_audit.append(info)
        if not text:
            continue
        text_path = RAW_TEXT_DIR / f"{pdf.stem}.txt"
        text_path.write_text(text, encoding="utf-8")
        scenarios.append(parse_scenario(text, pdf.name))
        parsed_source_names.add(pdf.name)

    # Keep prior source anchors available even when the original PDFs are no
    # longer in Downloads. The raw text cache is generated only from uploaded PIs.
    for text_path in sorted(RAW_TEXT_DIR.glob("PI_20260702*.txt")):
        source_name = f"{text_path.stem}.pdf"
        if source_name in parsed_source_names:
            continue
        try:
            text = text_path.read_text(encoding="utf-8")
            scenarios.append(parse_scenario(text, source_name))
            cached_text_count += 1
        except Exception as exc:  # pragma: no cover - audit path
            cached_text_errors.append(
                {
                    "file": str(text_path),
                    "source_pdf": source_name,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

    # Drop exact duplicate source scenarios while retaining duplicate source names.
    unique: dict[tuple[Any, ...], dict[str, Any]] = {}
    duplicate_groups: dict[tuple[Any, ...], list[str]] = {}
    for scenario in scenarios:
        key = (
            scenario.get("life_insured_age"),
            scenario.get("premium_payment_term_number"),
            scenario.get("income_start_year"),
            scenario.get("initial_total_planned_premium"),
            scenario.get("initial_monthly_income_annualized"),
        )
        duplicate_groups.setdefault(key, []).append(scenario["source_pdf"])
        if key not in unique:
            unique[key] = scenario
        else:
            unique[key]["source_pdf"] += f";{scenario['source_pdf']}"

    records = sorted(
        unique.values(),
        key=lambda item: (
            item.get("premium_payment_term_number") or 999,
            item.get("income_start_year") or 999,
            item.get("life_insured_age") or 999,
        ),
    )

    flat_rows: list[dict[str, Any]] = []
    annual_rows: list[dict[str, Any]] = []
    for index, scenario in enumerate(records, start=1):
        scenario_id = f"SII-{index:03d}"
        scenario["scenario_id"] = scenario_id
        flat_rows.append(
            {
                "scenario_id": scenario_id,
                "source_pdf": scenario["source_pdf"],
                "life_insured_age": scenario.get("life_insured_age"),
                "premium_payment_term": scenario.get("premium_payment_term"),
                "premium_payment_term_number": scenario.get("premium_payment_term_number"),
                "income_start_year": scenario.get("income_start_year"),
                "initial_planned_premium": scenario.get("initial_planned_premium"),
                "initial_total_planned_premium": scenario.get("initial_total_planned_premium"),
                "initial_monthly_income_annualized": scenario.get("initial_monthly_income_annualized"),
                "initial_monthly_income_annualized_per_100k_total_premium": scenario.get(
                    "initial_monthly_income_annualized_per_100k_total_premium"
                ),
                "initial_monthly_income_per_100k_total_premium": scenario.get(
                    "initial_monthly_income_per_100k_total_premium"
                ),
                "current_illustrated_yield_pct_pa": scenario.get("current_illustrated_yield_pct_pa"),
                "guaranteed_illustrated_yield_pct_pa": scenario.get("guaranteed_illustrated_yield_pct_pa"),
                "current_row_count": len(scenario.get("current_rows") or []),
                "guaranteed_row_count": len(scenario.get("guaranteed_rows") or []),
                "income_row_count": len(scenario.get("income_rows") or []),
                "deduction_row_count": len(scenario.get("deduction_rows") or []),
            }
        )
        current_by_year = {row["policy_year"]: row for row in scenario.get("current_rows") or []}
        guaranteed_by_year = {row["policy_year"]: row for row in scenario.get("guaranteed_rows") or []}
        income_by_year = {row["policy_year"]: row for row in scenario.get("income_rows") or []}
        deductions_by_year = {row["policy_year"]: row for row in scenario.get("deduction_rows") or []}
        all_years = sorted(set(current_by_year) | set(guaranteed_by_year) | set(income_by_year) | set(deductions_by_year))
        for year in all_years:
            current = current_by_year.get(year, {})
            guaranteed = guaranteed_by_year.get(year, {})
            income = income_by_year.get(year, {})
            deductions = deductions_by_year.get(year, {})
            annual_rows.append(
                {
                    "scenario_id": scenario_id,
                    "policy_year": year,
                    "source_attained_age": current.get("attained_age_source")
                    or guaranteed.get("attained_age_source")
                    or income.get("attained_age_source")
                    or deductions.get("attained_age_source"),
                    "current_premium_schedule": current.get("premium_schedule"),
                    "current_policy_value": current.get("policy_value"),
                    "current_policy_value_less_surrender_charge_and_unvested_booster": current.get(
                        "policy_value_less_surrender_charge_and_unvested_booster"
                    ),
                    "current_surrender_value_floor": current.get("surrender_value_floor"),
                    "current_surrender_value": current.get("surrender_value"),
                    "current_monthly_income_annualized": current.get("monthly_income_annualized")
                    or income.get("monthly_income_annualized_current"),
                    "current_death_benefit": current.get("death_benefit"),
                    "guaranteed_policy_value": guaranteed.get("policy_value"),
                    "guaranteed_surrender_value": guaranteed.get("surrender_value"),
                    "guaranteed_monthly_income_annualized": guaranteed.get("monthly_income_annualized")
                    or income.get("monthly_income_annualized_guaranteed"),
                    "current_effect_of_deductions": deductions.get("current_effect_of_deductions"),
                    "current_value_of_premiums": deductions.get("current_value_of_premiums"),
                    "deduction_current_surrender_value": deductions.get("current_surrender_value"),
                }
            )

    source_terms = sorted({item.get("premium_payment_term_number") for item in records if item.get("premium_payment_term_number")})
    source_start_years = sorted({item.get("income_start_year") for item in records if item.get("income_start_year")})
    source_ages = sorted({item.get("life_insured_age") for item in records if item.get("life_insured_age") is not None})
    source_age_text = ", ".join(str(age) for age in source_ages) if source_ages else "none"
    audit_notes = [
        f"Source age anchors available: {source_age_text}. Ages outside the source-age range are extrapolated estimates.",
        "Cached raw text is included so prior uploaded PIs remain part of the estimator even if the PDFs are no longer in Downloads.",
    ]
    if extraction_audit and any(item.get("error") for item in extraction_audit):
        audit_notes.append("One or more uploaded PDFs did not parse and are excluded from this estimate.")
    if cached_text_errors:
        audit_notes.append("One or more cached raw-text sources did not parse and are excluded from this estimate.")

    audit_summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_folder": str(DEFAULT_PI_FOLDER),
        "pdf_glob": DEFAULT_PI_GLOB,
        "pdf_count": len(pdfs),
        "cached_text_count": cached_text_count,
        "input_source_count": len(pdfs) + cached_text_count,
        "parsed_count": len(scenarios),
        "unique_scenario_count": len(records),
        "error_count": sum(1 for item in extraction_audit if item.get("error")),
        "errors": [item for item in extraction_audit if item.get("error")],
        "cached_text_errors": cached_text_errors,
        "duplicate_groups": [
            {"key": list(key), "source_pdfs": names}
            for key, names in duplicate_groups.items()
            if len(names) > 1
        ],
        "source_distribution": {
            "ages": {str(age): sum(1 for item in records if item.get("life_insured_age") == age) for age in source_ages},
            "premium_terms": {
                str(term): sum(1 for item in records if item.get("premium_payment_term_number") == term)
                for term in source_terms
            },
            "income_start_years": {
                str(year): sum(1 for item in records if item.get("income_start_year") == year)
                for year in source_start_years
            },
        },
        "deck": deck_info,
        "notes": audit_notes,
    }

    write_csv(
        PARSED_DIR / "sii_scenarios.csv",
        flat_rows,
        [
            "scenario_id",
            "source_pdf",
            "life_insured_age",
            "premium_payment_term",
            "premium_payment_term_number",
            "income_start_year",
            "initial_planned_premium",
            "initial_total_planned_premium",
            "initial_monthly_income_annualized",
            "initial_monthly_income_annualized_per_100k_total_premium",
            "initial_monthly_income_per_100k_total_premium",
            "current_illustrated_yield_pct_pa",
            "guaranteed_illustrated_yield_pct_pa",
            "current_row_count",
            "guaranteed_row_count",
            "income_row_count",
            "deduction_row_count",
        ],
    )
    write_csv(
        PARSED_DIR / "sii_annual_rows.csv",
        annual_rows,
        [
            "scenario_id",
            "policy_year",
            "source_attained_age",
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
        ],
    )
    (PARSED_DIR / "sii_records.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    (PARSED_DIR / "sii_audit_summary.json").write_text(json.dumps(audit_summary, indent=2), encoding="utf-8")
    write_csv(
        PARSED_DIR / "sii_extraction_audit.csv",
        extraction_audit,
        ["file", "name", "encrypted", "pages", "chars", "error"],
    )

    payload = {
        "generatedAt": audit_summary["generated_at"],
        "source": {
            "pdfCount": len(pdfs),
            "cachedTextCount": cached_text_count,
            "inputSourceCount": audit_summary["input_source_count"],
            "parsedCount": len(scenarios),
            "uniqueScenarioCount": len(records),
            "errorCount": audit_summary["error_count"],
            "cachedTextErrorCount": len(cached_text_errors),
            "sourceAges": source_ages,
            "sourcePremiumTerms": source_terms,
            "sourceIncomeStartYears": source_start_years,
        },
        "productConstants": {
            "currency": "USD",
            "entryAgeMin": 0,
            "entryAgeMax": 70,
            "premiumTerms": ["single", 2, 3, 4, 5, 6, 7, 8, 9, 10],
            "incomeStartYearMax": 21,
            "minTotalPlannedPremium": 100000,
            "maxTotalPlannedPremium": 166000000,
            "minMonthlyIncomeEarly": 60,
            "minMonthlyIncomeStandard": 300,
            "maxMonthlyIncomeEarly": 100000,
            "maxMonthlyIncomeStandard": 500000,
            "fixedAccountAllocationPct": 0,
            "indexAccountAllocationPct": 100,
            "fixedCreditingRateCurrentPct": 4.20,
            "fixedCreditingRateGuaranteedPct": 2.00,
            "indexAssumedCreditingRateCurrentPct": 6.35,
            "indexFloorRatePct": 0.00,
            "sp500CapRatePct": 9.00,
            "policyValueBoosterRatePctPa": 1.46,
            "policyValueBoosterFromYear": 2,
            "policyValueBoosterToYear": 25,
            "policyFeePer1000FaceAmountMonthly": 2.108333,
            "policyFeeToYear": 25,
            "adminFeeMonthlyPctPolicyValue": 0.03,
            "premiumChargePctByPolicyYear": {
                "1": 8.0,
                "2": 7.5,
                "3": 7.0,
                "4": 6.5,
                "5": 6.0,
                "6": 5.5,
                "7": 5.0,
                "8": 4.5,
                "9": 4.0,
                "10": 4.0,
            },
            "incomeStartRules": [
                {"premiumTermMin": 1, "premiumTermMax": 3, "incomeStartYearMin": 2, "incomeStartYearMax": 21},
                {"premiumTermMin": 4, "premiumTermMax": 6, "incomeStartYearMin": 3, "incomeStartYearMax": 21},
                {"premiumTermMin": 7, "premiumTermMax": 10, "incomeStartYearMin": 4, "incomeStartYearMax": 21},
            ],
        },
        "scenarios": [clean_scenario_for_asset(item) for item in records],
        "audit": audit_summary,
    }
    ASSET_PATH.write_text("window.SII_RATES = " + json.dumps(payload, indent=2) + ";\n", encoding="utf-8")
    print(json.dumps(audit_summary, indent=2))


if __name__ == "__main__":
    build()
