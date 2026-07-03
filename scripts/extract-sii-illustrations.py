from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pypdf import PdfReader


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO_ROOT / "source-data" / "signature-indexed-income"
ASSET_PATH = REPO_ROOT / "assets" / "sii-rates.js"

DEFAULT_PI_GLOB = "PI_*.pdf"
DEFAULT_CACHE_GLOB = "PI_*.txt"
DEFAULT_PI_FOLDER = Path(r"C:\Users\user\Downloads")
TECH_DECK = Path(r"C:\Users\user\Downloads\Manulife Signature Indexed Income Training Tech Deck Apr2026 (1).pdf")

PLAN_MARKER = "Signature Indexed Income"
ASSET_PREFIX = "window.SII_RATES = "
ROW_VALUE_RE = re.compile(r"\(?-?\d[\d,]*(?:\.\d+)?\)?|-")
ROW_GROUP_NAMES = ("income_rows", "deduction_rows", "guaranteed_rows", "current_rows", "premium_schedule_rows")


def warn(message: str) -> None:
    print(f"WARNING: {message}", file=sys.stderr)


def parse_money(value: str | None) -> float | None:
    if not value:
        return None
    cleaned = value.replace(",", "").replace("US$", "").replace("$", "").strip()
    if cleaned in {"", "-"}:
        return None
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = "-" + cleaned[1:-1]
    return float(cleaned)


def first_present(*values: Any) -> Any:
    for value in values:
        if value is not None:
            return value
    return None


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


def write_text_atomic(path: Path, text: str) -> None:
    tmp_path = path.with_name(path.name + ".tmp")
    tmp_path.write_text(text, encoding="utf-8")
    os.replace(tmp_path, path)


def extract_pdf_text(pdf_path: Path) -> tuple[str | None, dict[str, Any]]:
    info: dict[str, Any] = {
        "file": str(pdf_path),
        "name": pdf_path.name,
        "encrypted": False,
        "pages": 0,
        "chars": 0,
        "error": None,
        "source_kind": "pdf",
        "page_error_count": 0,
        "parsed": False,
        "skipped_reason": None,
        "scenario_id": None,
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
        info["page_error_count"] = full_text.count("[EXTRACT ERROR")
        return full_text, info
    except Exception as exc:
        info["error"] = f"{type(exc).__name__}: {exc}"
        return None, info


def copy_or_extract_deck(source_dir: Path) -> dict[str, Any]:
    if not TECH_DECK.exists():
        return {"found": False, "path": str(TECH_DECK)}
    deck_out = source_dir / "technical-deck-extracted-text.txt"
    snippets_out = source_dir / "technical-deck-keyword-snippets.json"
    text, info = extract_pdf_text(TECH_DECK)
    if text:
        write_text_atomic(deck_out, text)
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
        write_text_atomic(snippets_out, json.dumps({"snippets": snippets}, indent=2))
    info["found"] = True
    return info


def extract_line_rows(text: str, columns: list[str], width_stats: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    row_re = re.compile(r"^\s*(\d+)\/(\d+)\s+(.+?)\s*$")
    for raw_line in text.splitlines():
        match = row_re.match(raw_line)
        if not match:
            continue
        values = ROW_VALUE_RE.findall(match.group(3))
        if len(values) != len(columns):
            if width_stats is not None:
                kind = "under" if len(values) < len(columns) else "over"
                width_stats[kind] += 1
                if len(width_stats["samples"]) < 20:
                    width_stats["samples"].append(
                        {
                            "expected": len(columns),
                            "got": len(values),
                            "line": raw_line.strip()[:160],
                        }
                    )
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


def page_income_option(body: str) -> str | None:
    match = re.search(r"Monthly Income Option\s*:\s*(.+)", body)
    return match.group(1).strip() if match else None


def merge_rows_checked(rows: list[dict[str, Any]], group_name: str, parse_errors: list[str]) -> list[dict[str, Any]]:
    merged: dict[int, dict[str, Any]] = {}
    for row in rows:
        year = row["policy_year"]
        existing = merged.get(year)
        if existing is None:
            merged[year] = row
        elif existing != row:
            parse_errors.append(f"{group_name}: duplicate policy_year {year} with differing values")
    return sorted(merged.values(), key=lambda row: row["policy_year"])


def parse_scenario(text: str, source_name: str, width_stats: dict[str, Any] | None = None) -> dict[str, Any]:
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
    parse_errors: list[str] = []
    group_options: dict[str, set[str]] = {name: set() for name in ROW_GROUP_NAMES}

    for _, body in blocks:
        option = page_income_option(body)
        if "Income Illustration" in body and "MONTHLY INCOME (ANNUALISED)" in body and option == "Paid Out":
            extracted = extract_line_rows(
                body,
                [
                    "total_basic_premiums_paid_to_date",
                    "monthly_income_annualized_guaranteed",
                    "monthly_income_annualized_current",
                ],
                width_stats,
            )
            if extracted:
                income_rows.extend(extracted)
                group_options["income_rows"].add(option)
        if "Table of Deductions" in body:
            extracted = extract_line_rows(
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
                width_stats,
            )
            if extracted:
                deduction_rows.extend(extracted)
                if option:
                    group_options["deduction_rows"].add(option)
        if "Supplementary Illustration" in body and "Premium" in body and "Death Benefit" in body:
            target = None
            target_name = None
            if "current Fixed Account crediting rate" in body:
                target = current_rows
                target_name = "current_rows"
            elif "guaranteed crediting rate" in body and "maximum charges" in body:
                target = guaranteed_rows
                target_name = "guaranteed_rows"
            if target is not None:
                extracted = extract_line_rows(
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
                    width_stats,
                )
                if extracted:
                    target.extend(extracted)
                    if option:
                        group_options[target_name].add(option)
        if "Premium Schedule Summary" in body:
            schedule_found = False
            for raw_line in body.splitlines():
                match = re.match(r"^\s*(\d+)\s+([\d,]+(?:\.\d+)?|-)\s*$", raw_line)
                if match:
                    schedule_found = True
                    premium_schedule_rows.append(
                        {
                            "policy_year": int(match.group(1)),
                            "planned_premium": parse_money(match.group(2)),
                        }
                    )
            if schedule_found and option:
                group_options["premium_schedule_rows"].add(option)

    deduction_rows = merge_rows_checked(deduction_rows, "deduction_rows", parse_errors)

    table_income_options: dict[str, str | None] = {}
    for name in ROW_GROUP_NAMES:
        options = group_options[name]
        if len(options) > 1:
            parse_errors.append(f"{name}: conflicting Monthly Income Option values {sorted(options)}")
            table_income_options[name] = ";".join(sorted(options))
        else:
            table_income_options[name] = next(iter(options)) if options else None

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
        "table_income_options": table_income_options,
        "income_rows": sorted(income_rows, key=lambda row: row["policy_year"]),
        "deduction_rows": deduction_rows,
        "guaranteed_rows": sorted(guaranteed_rows, key=lambda row: row["policy_year"]),
        "current_rows": sorted(current_rows, key=lambda row: row["policy_year"]),
        "premium_schedule_rows": sorted(premium_schedule_rows, key=lambda row: row["policy_year"]),
        "parse_errors": parse_errors,
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


def scenario_content(scenario: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in scenario.items() if key != "source_pdf"}


def scenario_content_key(scenario: dict[str, Any]) -> str:
    age = scenario.get("life_insured_age")
    term = scenario.get("premium_payment_term_number")
    start = scenario.get("income_start_year")
    total = scenario.get("initial_total_planned_premium")
    age_part = f"a{age}" if age is not None else "aNA"
    term_part = f"t{term}" if term is not None else "tNA"
    start_part = f"s{start:02d}" if start is not None else "sNA"
    total_part = f"p{int(round(total))}" if total is not None else "pNA"
    return f"{age_part}-{term_part}-{start_part}-{total_part}"


def validate_scenario(scenario: dict[str, Any]) -> list[str]:
    errors: list[str] = list(scenario.pop("parse_errors", None) or [])
    required = (
        "life_insured_age",
        "premium_payment_term_number",
        "income_start_year",
        "initial_total_planned_premium",
        "initial_monthly_income_annualized",
    )
    for key in required:
        if scenario.get(key) is None:
            errors.append(f"missing {key}")
    age = scenario.get("life_insured_age")
    if age is not None:
        expected_years = list(range(1, 125 - age + 1))
        for group in ("current_rows", "guaranteed_rows"):
            years = [row["policy_year"] for row in scenario.get(group) or []]
            if years != expected_years:
                errors.append(
                    f"{group}: expected contiguous policy years 1..{125 - age}, got {len(years)} rows"
                )
    if not scenario.get("income_rows"):
        errors.append("income_rows empty")
    total = scenario.get("initial_total_planned_premium")
    if total is not None:
        schedule_sum = sum(
            row["planned_premium"]
            for row in scenario.get("premium_schedule_rows") or []
            if row["planned_premium"] is not None
        )
        if abs(schedule_sum - total) > 1:
            errors.append(
                f"premium_schedule sum {schedule_sum} != initial_total_planned_premium {total}"
            )
    return errors


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    tmp_path = path.with_name(path.name + ".tmp")
    with tmp_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})
    os.replace(tmp_path, path)


def clean_scenario_for_asset(scenario: dict[str, Any]) -> dict[str, Any]:
    keys = [
        "source_pdf",
        "scenario_key",
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
        "table_income_options",
        "income_rows",
        "deduction_rows",
        "guaranteed_rows",
        "current_rows",
        "premium_schedule_rows",
    ]
    return {key: scenario.get(key) for key in keys}


def build(
    input_dir: Path,
    pdf_glob: str,
    cache_dir: Path,
    cache_glob: str,
    output_dir: Path,
    asset_path: Path,
) -> list[dict[str, Any]]:
    source_dir = output_dir
    raw_text_dir = source_dir / "raw-text"
    parsed_dir = source_dir / "parsed"
    source_dir.mkdir(parents=True, exist_ok=True)
    raw_text_dir.mkdir(parents=True, exist_ok=True)
    parsed_dir.mkdir(parents=True, exist_ok=True)
    asset_path.parent.mkdir(parents=True, exist_ok=True)

    deck_info = copy_or_extract_deck(source_dir)
    pdfs = sorted(input_dir.glob(pdf_glob))
    if not pdfs:
        warn(f"PDF glob '{pdf_glob}' matched 0 files in {input_dir}")
    excluded_pdfs = sorted(set(input_dir.glob("PI_*.pdf")) - set(pdfs))
    if excluded_pdfs:
        warn(
            f"{len(excluded_pdfs)} PI_*.pdf file(s) in {input_dir} are excluded by --glob '{pdf_glob}': "
            + ", ".join(item.name for item in excluded_pdfs)
        )
    excluded_cached = sorted(set(cache_dir.glob("PI_*.txt")) - set(cache_dir.glob(cache_glob)))
    if excluded_cached:
        warn(
            f"{len(excluded_cached)} cached PI_*.txt file(s) in {cache_dir} are excluded by --cache-glob '{cache_glob}': "
            + ", ".join(item.name for item in excluded_cached)
        )

    width_stats: dict[str, Any] = {"under": 0, "over": 0, "samples": []}
    extraction_audit: list[dict[str, Any]] = []
    scenarios: list[dict[str, Any]] = []
    parsed_source_names: set[str] = set()
    skipped_non_sii: list[str] = []
    cached_text_count = 0
    cached_text_errors: list[dict[str, str]] = []

    for pdf in pdfs:
        text, info = extract_pdf_text(pdf)
        extraction_audit.append(info)
        if not text:
            continue
        if PLAN_MARKER not in text:
            info["skipped_reason"] = "non_sii"
            skipped_non_sii.append(pdf.name)
            continue
        write_text_atomic(raw_text_dir / f"{pdf.stem}.txt", text)
        scenarios.append(parse_scenario(text, pdf.name, width_stats))
        parsed_source_names.add(pdf.name)
        info["parsed"] = True
    if skipped_non_sii:
        warn(
            f"{len(skipped_non_sii)} PDF(s) matched --glob '{pdf_glob}' but are not {PLAN_MARKER} PIs and were skipped: "
            + ", ".join(skipped_non_sii)
        )

    # Keep prior source anchors available even when the original PDFs are no
    # longer in Downloads. The raw text cache is generated only from uploaded PIs.
    for text_path in sorted(cache_dir.glob(cache_glob)):
        source_name = f"{text_path.stem}.pdf"
        if source_name in parsed_source_names:
            continue
        cached_info: dict[str, Any] = {
            "file": str(text_path),
            "name": text_path.name,
            "encrypted": "",
            "pages": "",
            "chars": 0,
            "error": None,
            "source_kind": "cached-text",
            "page_error_count": 0,
            "parsed": False,
            "skipped_reason": None,
            "scenario_id": None,
        }
        extraction_audit.append(cached_info)
        try:
            text = text_path.read_text(encoding="utf-8")
            cached_info["chars"] = len(text)
            cached_info["page_error_count"] = text.count("[EXTRACT ERROR")
            if PLAN_MARKER not in text:
                cached_info["skipped_reason"] = "non_sii"
                skipped_non_sii.append(text_path.name)
                continue
            scenarios.append(parse_scenario(text, source_name, width_stats))
            cached_text_count += 1
            cached_info["parsed"] = True
        except Exception as exc:  # pragma: no cover - audit path
            cached_info["error"] = f"{type(exc).__name__}: {exc}"
            cached_text_errors.append(
                {
                    "file": str(text_path),
                    "source_pdf": source_name,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

    # Drop exact duplicate source scenarios while retaining duplicate source names.
    # Scenarios with an incomplete key are never deduped; colliding keys with
    # differing content are kept separately and reported as hard errors.
    unique: dict[Any, dict[str, Any]] = {}
    duplicate_groups: dict[tuple[Any, ...], list[str]] = {}
    dedup_conflicts: list[dict[str, Any]] = []
    dedup_skipped_null_key: list[str] = []
    for scenario in scenarios:
        key = (
            scenario.get("life_insured_age"),
            scenario.get("premium_payment_term_number"),
            scenario.get("income_start_year"),
            scenario.get("initial_total_planned_premium"),
            scenario.get("initial_monthly_income_annualized"),
            scenario.get("face_amount"),
            scenario.get("initial_planned_premium"),
        )
        if any(part is None for part in key):
            dedup_skipped_null_key.append(scenario["source_pdf"])
            unique[("no-dedup", scenario["source_pdf"], len(unique))] = scenario
            continue
        duplicate_groups.setdefault(key, []).append(scenario["source_pdf"])
        existing = unique.get(key)
        if existing is None:
            unique[key] = scenario
        elif scenario_content(existing) == scenario_content(scenario):
            existing["source_pdf"] += f";{scenario['source_pdf']}"
        else:
            dedup_conflicts.append(
                {
                    "key": list(key),
                    "kept_both": [existing["source_pdf"], scenario["source_pdf"]],
                }
            )
            unique[key + (scenario["source_pdf"],)] = scenario

    records = sorted(
        unique.values(),
        key=lambda item: (
            item.get("premium_payment_term_number") or 999,
            item.get("income_start_year") or 999,
            item.get("life_insured_age") or 999,
        ),
    )

    seen_keys: dict[str, int] = {}
    for index, scenario in enumerate(records, start=1):
        scenario["scenario_id"] = f"SII-{index:03d}"
        base_key = scenario_content_key(scenario)
        seen_keys[base_key] = seen_keys.get(base_key, 0) + 1
        scenario["scenario_key"] = base_key if seen_keys[base_key] == 1 else f"{base_key}-{seen_keys[base_key]}"

    validation_errors: list[dict[str, Any]] = []
    for scenario in records:
        errors = validate_scenario(scenario)
        if errors:
            validation_errors.append(
                {
                    "scenario_id": scenario["scenario_id"],
                    "scenario_key": scenario["scenario_key"],
                    "source_pdf": scenario["source_pdf"],
                    "errors": errors,
                }
            )
    for conflict in dedup_conflicts:
        validation_errors.append(
            {
                "scenario_id": None,
                "scenario_key": None,
                "source_pdf": ";".join(conflict["kept_both"]),
                "errors": [f"dedup key collision with differing row tables: {conflict['key']}"],
            }
        )

    scenario_id_by_source: dict[str, str] = {}
    for scenario in records:
        for name in scenario["source_pdf"].split(";"):
            scenario_id_by_source[name] = scenario["scenario_id"]
    for item in extraction_audit:
        source_name = item["name"]
        if source_name.endswith(".txt"):
            source_name = f"{source_name[:-4]}.pdf"
        item["scenario_id"] = scenario_id_by_source.get(source_name)

    flat_rows: list[dict[str, Any]] = []
    annual_rows: list[dict[str, Any]] = []
    for scenario in records:
        scenario_id = scenario["scenario_id"]
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
                "scenario_key": scenario.get("scenario_key"),
                "deduction_table_income_option": (scenario.get("table_income_options") or {}).get("deduction_rows"),
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
                    "source_attained_age": first_present(
                        current.get("attained_age_source"),
                        guaranteed.get("attained_age_source"),
                        income.get("attained_age_source"),
                        deductions.get("attained_age_source"),
                    ),
                    "current_premium_schedule": current.get("premium_schedule"),
                    "current_policy_value": current.get("policy_value"),
                    "current_policy_value_less_surrender_charge_and_unvested_booster": current.get(
                        "policy_value_less_surrender_charge_and_unvested_booster"
                    ),
                    "current_surrender_value_floor": current.get("surrender_value_floor"),
                    "current_surrender_value": current.get("surrender_value"),
                    "current_monthly_income_annualized": first_present(
                        current.get("monthly_income_annualized"),
                        income.get("monthly_income_annualized_current"),
                    ),
                    "current_death_benefit": current.get("death_benefit"),
                    "guaranteed_policy_value": guaranteed.get("policy_value"),
                    "guaranteed_surrender_value": guaranteed.get("surrender_value"),
                    "guaranteed_monthly_income_annualized": first_present(
                        guaranteed.get("monthly_income_annualized"),
                        income.get("monthly_income_annualized_guaranteed"),
                    ),
                    "current_effect_of_deductions": deductions.get("current_effect_of_deductions"),
                    "current_value_of_premiums": deductions.get("current_value_of_premiums"),
                    "deduction_current_surrender_value": deductions.get("current_surrender_value"),
                    "scenario_key": scenario.get("scenario_key"),
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
    schema_notes = [
        "deduction_rows (and the annual CSV columns current_effect_of_deductions, current_value_of_premiums, deduction_current_surrender_value) are sourced from the Table of Deductions page, which is illustrated under the Accumulated monthly income option; its surrender values include accumulated monthly income and sit beside Paid-Out values in the same row.",
        "premium_schedule_rows planned_premium is null for '-' placeholder years (no premium due).",
        "scenario_key is a stable content-derived id (age/term/income-start-year/total premium); scenario_id remains positional for display compatibility.",
    ]

    sii_pdf_count = sum(1 for item in extraction_audit if item.get("source_kind") == "pdf" and item.get("parsed"))
    page_extract_error_count = sum(item.get("page_error_count") or 0 for item in extraction_audit)
    extraction_error_count = sum(1 for item in extraction_audit if item.get("error"))

    clean_scenarios = [clean_scenario_for_asset(item) for item in records]
    scenarios_sha256 = hashlib.sha256(
        json.dumps(clean_scenarios, sort_keys=True).encode("utf-8")
    ).hexdigest()

    audit_summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_folder": str(input_dir),
        "pdf_glob": pdf_glob,
        "cache_dir": str(cache_dir),
        "cache_glob": cache_glob,
        "pdf_matched_count": len(pdfs),
        "pdf_count": sii_pdf_count,
        "skipped_non_sii": skipped_non_sii,
        "cached_text_count": cached_text_count,
        "input_source_count": sii_pdf_count + cached_text_count,
        "parsed_count": len(scenarios),
        "unique_scenario_count": len(records),
        "error_count": extraction_error_count,
        "page_extract_error_count": page_extract_error_count,
        "errors": [item for item in extraction_audit if item.get("error")],
        "cached_text_errors": cached_text_errors,
        "row_width_mismatches": width_stats,
        "duplicate_groups": [
            {"key": list(key), "source_pdfs": names}
            for key, names in duplicate_groups.items()
            if len(names) > 1
        ],
        "dedup_conflicts": dedup_conflicts,
        "dedup_skipped_null_key": dedup_skipped_null_key,
        "validation_errors": validation_errors,
        "scenarios_sha256": scenarios_sha256,
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
        "schema_notes": schema_notes,
        "notes": audit_notes,
    }

    write_csv(
        parsed_dir / "sii_scenarios.csv",
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
            "scenario_key",
            "deduction_table_income_option",
        ],
    )
    write_csv(
        parsed_dir / "sii_annual_rows.csv",
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
            "scenario_key",
        ],
    )
    write_text_atomic(parsed_dir / "sii_records.json", json.dumps(records, indent=2))
    write_text_atomic(parsed_dir / "sii_audit_summary.json", json.dumps(audit_summary, indent=2))
    write_csv(
        parsed_dir / "sii_extraction_audit.csv",
        extraction_audit,
        [
            "file",
            "name",
            "encrypted",
            "pages",
            "chars",
            "error",
            "source_kind",
            "page_error_count",
            "parsed",
            "skipped_reason",
            "scenario_id",
        ],
    )

    payload_audit = {key: value for key, value in audit_summary.items() if key != "generated_at"}
    payload = {
        "scenariosSha256": scenarios_sha256,
        "source": {
            "pdfCount": sii_pdf_count,
            "cachedTextCount": cached_text_count,
            "inputSourceCount": audit_summary["input_source_count"],
            "parsedCount": len(scenarios),
            "uniqueScenarioCount": len(records),
            "errorCount": audit_summary["error_count"],
            "pageExtractErrorCount": page_extract_error_count,
            "cachedTextErrorCount": len(cached_text_errors),
            "skippedNonSiiCount": len(skipped_non_sii),
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
        "scenarios": clean_scenarios,
        "audit": payload_audit,
    }
    if validation_errors:
        print(json.dumps(audit_summary, indent=2))
        return validation_errors

    write_text_atomic(asset_path, ASSET_PREFIX + json.dumps(payload, indent=2) + ";\n")

    asset_text = asset_path.read_text(encoding="utf-8")
    if not asset_text.startswith(ASSET_PREFIX):
        raise SystemExit(f"{asset_path} does not start with the expected prefix")
    asset_body = asset_text[len(ASSET_PREFIX):].strip()
    if asset_body.endswith(";"):
        asset_body = asset_body[:-1]
    asset_payload = json.loads(asset_body)
    asset_scenario_count = len(asset_payload.get("scenarios") or [])
    if asset_scenario_count != len(records):
        raise SystemExit(
            f"{asset_path} scenario count {asset_scenario_count} != expected {len(records)}"
        )

    build_runtime_asset(asset_path)

    print(json.dumps(audit_summary, indent=2))
    return validation_errors


def build_runtime_asset(asset_path: Path) -> None:
    runtime_script = REPO_ROOT / "scripts" / "build-sii-runtime-asset.mjs"
    runtime_path = asset_path.with_name(f"{asset_path.stem}-runtime{asset_path.suffix}")
    result = subprocess.run(
        ["node", str(runtime_script), str(asset_path), str(runtime_path)],
        capture_output=True,
        text=True,
    )
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.returncode != 0:
        raise SystemExit(
            f"runtime asset build failed ({runtime_script}): {result.stderr.strip() or result.stdout.strip()}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract Manulife Signature Indexed Income PIs into parsed datasets and assets/sii-rates.js."
    )
    parser.add_argument("--input-dir", default=str(DEFAULT_PI_FOLDER), help="Folder scanned for PI PDFs.")
    parser.add_argument("--glob", default=DEFAULT_PI_GLOB, help="Glob for PI PDFs inside --input-dir.")
    parser.add_argument("--cache-dir", default=None, help="Folder with cached raw-text PIs (default: <output-dir>/raw-text).")
    parser.add_argument("--cache-glob", default=DEFAULT_CACHE_GLOB, help="Glob for cached raw-text PIs inside --cache-dir.")
    parser.add_argument("--output-dir", default=str(SOURCE_DIR), help="Folder receiving raw-text/ and parsed/ outputs.")
    parser.add_argument("--asset-path", default=str(ASSET_PATH), help="Path of the generated sii-rates.js asset.")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    cache_dir = Path(args.cache_dir) if args.cache_dir else output_dir / "raw-text"
    validation_errors = build(
        input_dir=Path(args.input_dir),
        pdf_glob=args.glob,
        cache_dir=cache_dir,
        cache_glob=args.cache_glob,
        output_dir=output_dir,
        asset_path=Path(args.asset_path),
    )
    if validation_errors:
        for entry in validation_errors:
            warn(f"validation failed for {entry['source_pdf']}: {'; '.join(entry['errors'])}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
