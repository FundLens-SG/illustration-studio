import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import fitz


RETIREMENT_AGES = [50, 55, 60, 65, 70]
PREMIUM_TERMS = ["single", 5, 10, 15, 20]
PAYOUT_PERIODS = [5, 10, 15, 20, "lifetime"]

ENTRY_AGE_LIMITS = {
    "single": {50: [18, 45], 55: [18, 50], 60: [18, 55], 65: [18, 60], 70: [18, 65]},
    5: {50: [18, 43], 55: [18, 48], 60: [18, 53], 65: [18, 58], 70: [18, 63]},
    10: {50: [18, 40], 55: [18, 45], 60: [18, 50], 65: [18, 55], 70: [18, 60]},
    15: {50: [18, 35], 55: [18, 40], 60: [18, 45], 65: [18, 50], 70: [18, 55]},
    20: {50: [18, 30], 55: [18, 35], 60: [18, 40], 65: [18, 45], 70: [18, 50]},
}


def compact(text):
    return re.sub(r"\s+", " ", text).strip()


def first_match(pattern, text, flags=0):
    match = re.search(pattern, text, flags)
    return match.group(1).strip() if match else None


def money(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    value = value.strip()
    if value in {"", "-"}:
        return None
    return float(value.replace(",", ""))


def pct(value):
    if value is None:
        return None
    return float(value.replace("%", "").replace("p.a.", "").strip())


def parse_payout(value):
    if value is None:
        return None
    if "life" in value.lower():
        return "lifetime"
    match = re.search(r"(\d+)", value)
    return int(match.group(1)) if match else None


def parse_option_table(text_pages):
    rows = []
    for page_index, text in enumerate(text_pages, start=1):
        if "Option to change Income Payout Period" not in text:
            continue
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        try:
            start = lines.index("Option to change Income Payout Period")
        except ValueError:
            continue

        labels = ["5", "10", "15", "20", "Lifetime"]
        cursor = start
        for label in labels:
            try:
                idx = lines.index(label, cursor)
            except ValueError:
                continue
            cells = lines[idx + 1 : idx + 6]
            if len(cells) < 5:
                continue
            rows.append(
                {
                    "source_page": page_index,
                    "income_payout_period": "lifetime" if label == "Lifetime" else int(label),
                    "guaranteed_monthly_income": money(cells[0]),
                    "non_guaranteed_monthly_income_iirr_300": money(cells[1]),
                    "non_guaranteed_monthly_income_iirr_425": money(cells[2]),
                    "total_monthly_income_iirr_300": money(cells[3]),
                    "total_monthly_income_iirr_425": money(cells[4]),
                }
            )
            cursor = idx + 6
        break
    return rows


def parse_pdf(path, source_label=None):
    doc = fitz.open(path)
    if doc.needs_pass and not doc.authenticate(""):
        raise ValueError("PDF is encrypted and could not be opened with an empty password")

    text_pages = [page.get_text("text") for page in doc]
    first_pages = compact("\n".join(text_pages[:4]))
    all_text = compact("\n".join(text_pages))

    premium_frequency = first_match(
        r"Premium Frequency\s*:\s*([A-Za-z -]+?)(?:\s+Retirement Age|\s+Currency)",
        first_pages,
    )
    product_type = first_match(
        r"RetireReady Plus \(III\)\s+Product Type\s+(.+?)\s+Premium Term",
        first_pages,
    )
    cover_premium_term = first_match(
        r"Product Type\s+.+?\s+Premium Term\s+(.+?)\s+Policy Term",
        first_pages,
    )
    cover_policy_term = first_match(
        r"Premium Term\s+.+?\s+Policy Term\s+(.+?)\s+Name of Insurer",
        first_pages,
    )
    plan_name = first_match(
        r"(RetireReady Plus \(III\)[^\n]*?\([^)]+\))\s+(?:Whole Life|\d+)\s+\d+\s+[\d,]+(?:\.\d+)?\s+[\d,]+(?:\.\d+)?",
        first_pages,
    )
    plan_code = first_match(r"\((RC[^)]+)\)", plan_name or "")

    table_match = re.search(
        r"RetireReady Plus \(III\).*?\)\s+((?:Whole Life)|\d+)\s+(\d+)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)",
        first_pages,
        re.I,
    )
    if not table_match:
        raise ValueError("Could not parse premium summary row")

    premium_term_raw = int(table_match.group(2))
    premium_term = (
        "single"
        if (premium_frequency and premium_frequency.lower().startswith("single"))
        or (cover_premium_term and "single" in cover_premium_term.lower())
        else premium_term_raw
    )

    payout_raw = first_match(
        r"Income Payout Period\s*:\s*(.+?)(?:\s+Premium Summary|\s+Summary of|\s+Basic Premium|\s+Retirement Income Option|\s+Page|$)",
        first_pages,
    )
    payout_period = parse_payout(payout_raw)

    premium_amount = money(table_match.group(4))
    modal_match = re.search(
        r"Total Premium\s+Monthly \(\$\)\s+Quarterly \(\$\)\s+Semi-Annually \(\$\)\s+Annually \(\$\)\s+"
        r"([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)",
        first_pages,
    )

    monthly_income_match = re.search(
        r"Illustrated investment rate of return\s+Guaranteed Monthly Income \(GMI\).*?"
        r"4\.25%\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+"
        r"3\.00%\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)",
        all_text,
        re.I,
    )
    if not monthly_income_match:
        raise ValueError("Could not parse monthly retirement income table")

    summary_match = re.search(
        r"(?:Total premiums paid for the basic plan|Single premium paid for the basic plan) \[A\]\s+\$\s+([\d,]+).*?"
        r"Total guaranteed benefits \[B\]\s+\$\s+([\d,]+).*?"
        r"Total guaranteed benefits over (?:total premiums|single premium) paid \[B\]/\[A\]\s+([\d.]+%).*?"
        r"Guaranteed yield at maturity\s+([\d.]+% p\.a\.).*?"
        r"Illustrated non-guaranteed total Cash Bonus \[C\]\s+\$\s+([\d,]+)\s+\$\s+([\d,]+).*?"
        r"Illustrated total benefits \[D\] = \[B\] \+ \[C\]\s+\$\s+([\d,]+)\s+\$\s+([\d,]+).*?"
        r"Illustrated total benefits over (?:total premiums|single premium) paid \[D\]/\[A\]\s+([\d.]+%)\s+([\d.]+%).*?"
        r"Total Illustrated Yield at maturity\s+([\d.]+% p\.a\.)\s+([\d.]+% p\.a\.)",
        first_pages,
        re.I,
    )

    gmi = money(first_match(r"Guaranteed Monthly Income \(GMI\)\s*:\s*\$([\d,]+(?:\.\d+)?)", first_pages))
    age = int(first_match(r"Age Last Birthday\s*:\s*(\d+)", first_pages))
    retirement_age = int(first_match(r"Retirement Age\s*:\s*(\d+)", first_pages))
    gender = first_match(r"\b(Male|Female),\s*(?:Non-Smoker|Smoker)", first_pages)
    smoker_status = first_match(r"\b(?:Male|Female),\s*(Non-Smoker|Smoker)", first_pages)

    record = {
        "source_pdf": source_label or path.name,
        "page_count": len(doc),
        "date_generated": first_match(r"Date Generated\s*:\s*(\d{1,2} [A-Za-z]{3} \d{4})", first_pages),
        "product_name": "RetireReady Plus (III)",
        "product_type": product_type,
        "plan_name": plan_name,
        "plan_code": plan_code,
        "policy_term_raw": table_match.group(1),
        "policy_term_cover": cover_policy_term,
        "premium_term_raw": premium_term_raw,
        "premium_payment_term": premium_term,
        "premium_frequency": premium_frequency,
        "currency": first_match(r"Currency\s*:\s*([A-Z]+)", first_pages),
        "life_insured_age": age,
        "age_basis": "ALB",
        "gender": gender,
        "smoker_status": smoker_status,
        "target_retirement_age": retirement_age,
        "income_payout_period": payout_period,
        "income_payout_period_raw": payout_raw,
        "guaranteed_monthly_income": gmi,
        "annual_premium": None if premium_term == "single" else premium_amount,
        "single_premium": premium_amount if premium_term == "single" else None,
        "modal_premium_monthly": money(modal_match.group(1)) if modal_match else None,
        "modal_premium_quarterly": money(modal_match.group(2)) if modal_match else None,
        "modal_premium_semi_annual": money(modal_match.group(3)) if modal_match else None,
        "modal_premium_annual": money(modal_match.group(4)) if modal_match else None,
        "wop_tpd_premium_annual": money(first_match(r"Waiver of Premium on TPD Benefit of \$([\d,]+(?:\.\d+)?)", first_pages)),
        "retrenchment_payout_premium": money(first_match(r"Retrenchment Payout Benefit of \$([\d,]+(?:\.\d+)?)", first_pages)),
        "retrenchment_payout_amount": money(first_match(r"Retrenchment Payout Benefit amount applicable to this policy is\s+\$([\d,]+(?:\.\d+)?)", first_pages)),
        "non_guaranteed_monthly_income_iirr_425": money(monthly_income_match.group(2)),
        "total_monthly_income_iirr_425": money(monthly_income_match.group(3)),
        "non_guaranteed_monthly_income_iirr_300": money(monthly_income_match.group(5)),
        "total_monthly_income_iirr_300": money(monthly_income_match.group(6)),
        "option_to_change_payout_periods": parse_option_table(text_pages),
    }

    if summary_match:
        record.update(
            {
                "total_premiums_paid": money(summary_match.group(1)),
                "total_guaranteed_benefits": money(summary_match.group(2)),
                "guaranteed_benefits_over_premiums_pct": pct(summary_match.group(3)),
                "guaranteed_yield_maturity_pct_pa": pct(summary_match.group(4)),
                "total_cash_bonus_iirr_300": money(summary_match.group(5)),
                "total_cash_bonus_iirr_425": money(summary_match.group(6)),
                "total_benefits_iirr_300": money(summary_match.group(7)),
                "total_benefits_iirr_425": money(summary_match.group(8)),
                "total_benefits_over_premiums_iirr_300_pct": pct(summary_match.group(9)),
                "total_benefits_over_premiums_iirr_425_pct": pct(summary_match.group(10)),
                "total_illustrated_yield_maturity_iirr_300_pct_pa": pct(summary_match.group(11)),
                "total_illustrated_yield_maturity_iirr_425_pct_pa": pct(summary_match.group(12)),
            }
        )
    else:
        term_years = 1 if premium_term == "single" else premium_term
        record["total_premiums_paid"] = round(premium_amount * term_years, 2)

    base_premium = record["single_premium"] if premium_term == "single" else record["annual_premium"]
    gmi_units = gmi / 10 if gmi else None
    record["premium_rate_per_10_gmi"] = round(base_premium / gmi_units, 6) if base_premium and gmi_units else None
    record["cash_bonus_rate_iirr_425"] = round(record["non_guaranteed_monthly_income_iirr_425"] / gmi, 8)
    record["cash_bonus_rate_iirr_300"] = round(record["non_guaranteed_monthly_income_iirr_300"] / gmi, 8)
    record["years_to_retirement"] = retirement_age - age
    record["extraction_confidence"] = 0.99

    return record


def record_key(record):
    return (
        record["life_insured_age"],
        record["gender"],
        record["smoker_status"],
        record["target_retirement_age"],
        str(record["premium_payment_term"]),
        str(record["income_payout_period"]),
        record["guaranteed_monthly_income"],
    )


def product_expected_keys(ages):
    keys = []
    for age in ages:
        for retirement_age in RETIREMENT_AGES:
            for premium_term in PREMIUM_TERMS:
                min_age, max_age = ENTRY_AGE_LIMITS[premium_term][retirement_age]
                if not (min_age <= age <= max_age):
                    continue
                for payout_period in PAYOUT_PERIODS:
                    if premium_term in {"single", 5} and payout_period == 5:
                        continue
                    keys.append((age, retirement_age, str(premium_term), str(payout_period)))
    return keys


def is_single_premium_minimum_7_exception(age, retirement_age, premium_term):
    return premium_term == "single" and age == 45 and retirement_age == 50


def user_rule_blocked(age, retirement_age, premium_term):
    term_years = 0 if premium_term == "single" else int(premium_term)
    years_to_retirement = retirement_age - age
    if retirement_age <= age:
        return True
    if (
        term_years + years_to_retirement < 7
        and not is_single_premium_minimum_7_exception(age, retirement_age, premium_term)
    ):
        return True
    if premium_term != "single" and retirement_age < age + term_years:
        return True
    return False


def product_valid(age, retirement_age, premium_term, payout_period):
    if retirement_age not in RETIREMENT_AGES:
        return False
    if premium_term not in PREMIUM_TERMS:
        return False
    if payout_period not in PAYOUT_PERIODS:
        return False
    if premium_term in {"single", 5} and payout_period == 5:
        return False
    min_age, max_age = ENTRY_AGE_LIMITS[premium_term][retirement_age]
    return min_age <= age <= max_age


def estimate_from_anchors(age, key, anchors_by_combo, field):
    anchors = anchors_by_combo.get(key, {})
    if age in anchors:
        return anchors[age].get(field), "source_exact", sorted(anchors), None

    if 40 in anchors and 45 in anchors:
        lower = anchors[40].get(field)
        upper = anchors[45].get(field)
        if lower is None or upper is None:
            return None, "missing_source_field", sorted(anchors), None
        estimate = lower + ((age - 40) / 5) * (upper - lower)
        method = "interpolated" if 40 < age < 45 else "extrapolated"
        return estimate, method, [40, 45], None

    if anchors:
        anchor_age = min(anchors, key=lambda item: abs(item - age))
        anchor_value = anchors[anchor_age].get(field)
        if anchor_value is None:
            return None, "missing_source_field", sorted(anchors), None

        gender, smoker_status, retirement_age, premium_term, payout_period = key
        proxy_candidates = []
        for proxy_key, proxy_anchors in anchors_by_combo.items():
            proxy_gender, proxy_smoker, proxy_retirement_age, proxy_premium_term, proxy_payout_period = proxy_key
            if (
                proxy_gender == gender
                and proxy_smoker == smoker_status
                and proxy_premium_term == premium_term
                and proxy_payout_period == payout_period
                and 40 in proxy_anchors
                and 45 in proxy_anchors
            ):
                lower = proxy_anchors[40].get(field)
                upper = proxy_anchors[45].get(field)
                if lower is None or upper is None:
                    continue
                proxy_candidates.append(
                    (
                        abs(proxy_retirement_age - retirement_age),
                        proxy_key,
                        (upper - lower) / 5,
                    )
                )

        if proxy_candidates:
            _, proxy_key, slope = sorted(proxy_candidates, key=lambda item: item[0])[0]
            estimate = anchor_value + (age - anchor_age) * slope
            return estimate, "extrapolated_proxy_slope", [anchor_age], {
                "gender": proxy_key[0],
                "smoker_status": proxy_key[1],
                "target_retirement_age": proxy_key[2],
                "premium_payment_term": proxy_key[3],
                "income_payout_period": proxy_key[4],
            }

        return anchor_value, "estimated_single_anchor_flat", [anchor_age], None

    return None, "missing_anchor", [], None


def build_estimated_age_grid(normalized_records, min_age=40):
    anchors_by_combo = defaultdict(dict)
    for record in normalized_records:
        combo_key = (
            record["gender"],
            record["smoker_status"],
            record["target_retirement_age"],
            record["premium_payment_term"],
            record["income_payout_period"],
        )
        anchors_by_combo[combo_key][record["life_insured_age"]] = record

    core_value_fields = [
        "premium_rate_per_10_gmi",
        "cash_bonus_rate_iirr_300",
        "cash_bonus_rate_iirr_425",
        "non_guaranteed_monthly_income_iirr_300",
        "non_guaranteed_monthly_income_iirr_425",
        "total_monthly_income_iirr_300",
        "total_monthly_income_iirr_425",
    ]
    optional_value_fields = [
        "total_benefits_iirr_300",
        "total_benefits_iirr_425",
        "total_illustrated_yield_maturity_iirr_300_pct_pa",
        "total_illustrated_yield_maturity_iirr_425_pct_pa",
    ]

    rows = []
    for age in range(min_age, 71):
        for retirement_age in RETIREMENT_AGES:
            for premium_term in PREMIUM_TERMS:
                for payout_period in PAYOUT_PERIODS:
                    if not product_valid(age, retirement_age, premium_term, payout_period):
                        continue
                    if user_rule_blocked(age, retirement_age, premium_term):
                        continue

                    combo_key = ("Male", "Non-Smoker", retirement_age, premium_term, payout_period)
                    estimates = {}
                    methods = Counter()
                    anchor_ages = set()
                    proxy_keys = []
                    missing_fields = []

                    for field in core_value_fields:
                        value, method, anchors, proxy_key = estimate_from_anchors(
                            age, combo_key, anchors_by_combo, field
                        )
                        if value is None:
                            missing_fields.append(field)
                            continue
                        estimates[field] = value
                        methods[method] += 1
                        anchor_ages.update(anchors)
                        if proxy_key:
                            proxy_keys.append(proxy_key)

                    if missing_fields:
                        continue

                    for field in optional_value_fields:
                        value, _, _, _ = estimate_from_anchors(age, combo_key, anchors_by_combo, field)
                        estimates[field] = value

                    gmi_basis = 1000
                    premium_rate = estimates["premium_rate_per_10_gmi"]
                    premium_for_gmi = premium_rate * (gmi_basis / 10)
                    term_years = 1 if premium_term == "single" else premium_term

                    if "source_exact" in methods and len(methods) == 1:
                        method = "source_exact"
                    elif "interpolated" in methods and not any(k.startswith("extrapolated") for k in methods):
                        method = "interpolated"
                    elif "extrapolated_proxy_slope" in methods:
                        method = "extrapolated_proxy_slope"
                    else:
                        method = "extrapolated"

                    source_pdfs = []
                    for anchor_age in sorted(anchor_ages):
                        anchor = anchors_by_combo.get(combo_key, {}).get(anchor_age)
                        if anchor:
                            source_pdfs.extend(anchor.get("source_pdfs") or [anchor.get("source_pdf")])

                    row = {
                        "life_insured_age": age,
                        "gender": "Male",
                        "smoker_status": "Non-Smoker",
                        "target_retirement_age": retirement_age,
                        "premium_payment_term": premium_term,
                        "income_payout_period": payout_period,
                        "guaranteed_monthly_income_basis": gmi_basis,
                        "estimation_method": method,
                        "anchor_ages": ";".join(str(item) for item in sorted(anchor_ages)),
                        "proxy_slope_keys": json.dumps(proxy_keys, ensure_ascii=False) if proxy_keys else "",
                        "premium_rate_per_10_gmi": round(premium_rate, 6),
                        "estimated_annual_premium_for_gmi_1000": round(premium_for_gmi, 2)
                        if premium_term != "single"
                        else None,
                        "estimated_single_premium_for_gmi_1000": round(premium_for_gmi, 2)
                        if premium_term == "single"
                        else None,
                        "estimated_total_premiums_paid_for_gmi_1000": round(premium_for_gmi * term_years, 2),
                        "cash_bonus_rate_iirr_300": round(estimates["cash_bonus_rate_iirr_300"], 8),
                        "cash_bonus_rate_iirr_425": round(estimates["cash_bonus_rate_iirr_425"], 8),
                        "estimated_non_guaranteed_monthly_income_iirr_300_for_gmi_1000": round(
                            estimates["non_guaranteed_monthly_income_iirr_300"], 2
                        ),
                        "estimated_non_guaranteed_monthly_income_iirr_425_for_gmi_1000": round(
                            estimates["non_guaranteed_monthly_income_iirr_425"], 2
                        ),
                        "estimated_total_monthly_income_iirr_300_for_gmi_1000": round(
                            estimates["total_monthly_income_iirr_300"], 2
                        ),
                        "estimated_total_monthly_income_iirr_425_for_gmi_1000": round(
                            estimates["total_monthly_income_iirr_425"], 2
                        ),
                        "estimated_total_benefits_iirr_300_for_gmi_1000": round(
                            estimates["total_benefits_iirr_300"], 2
                        )
                        if estimates["total_benefits_iirr_300"] is not None
                        else None,
                        "estimated_total_benefits_iirr_425_for_gmi_1000": round(
                            estimates["total_benefits_iirr_425"], 2
                        )
                        if estimates["total_benefits_iirr_425"] is not None
                        else None,
                        "estimated_total_illustrated_yield_maturity_iirr_300_pct_pa": round(
                            estimates["total_illustrated_yield_maturity_iirr_300_pct_pa"], 4
                        )
                        if estimates["total_illustrated_yield_maturity_iirr_300_pct_pa"] is not None
                        else None,
                        "estimated_total_illustrated_yield_maturity_iirr_425_pct_pa": round(
                            estimates["total_illustrated_yield_maturity_iirr_425_pct_pa"], 4
                        )
                        if estimates["total_illustrated_yield_maturity_iirr_425_pct_pa"] is not None
                        else None,
                        "source_pdfs": ";".join(dict.fromkeys(source_pdfs)),
                    }
                    rows.append(row)

    return rows


def write_csv(path, rows, fieldnames):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main():
    parser = argparse.ArgumentParser(description="Extract RetireReady Plus (III) illustration data.")
    parser.add_argument("--input", required=True, help="Folder containing RRP3 policy illustration PDFs")
    parser.add_argument("--out", required=True, help="Output folder for parsed CSV/JSON files")
    parser.add_argument("--app-data", required=True, help="Output JS file for browser/app consumption")
    args = parser.parse_args()

    input_folder = Path(args.input)
    output_folder = Path(args.out)
    app_data_path = Path(args.app_data)
    pdfs = sorted(input_folder.rglob("*.pdf"))

    raw_records = []
    audit_rows = []
    errors = []
    for pdf in pdfs:
        source_label = pdf.relative_to(input_folder).as_posix()
        try:
            record = parse_pdf(pdf, source_label=source_label)
            raw_records.append(record)
            audit_rows.append(
                {
                    "source_pdf": source_label,
                    "status": "parsed",
                    "message": "",
                    "field_count": len([v for v in record.values() if v is not None]),
                }
            )
        except Exception as exc:
            errors.append({"source_pdf": source_label, "error": str(exc)})
            audit_rows.append(
                {
                    "source_pdf": source_label,
                    "status": "error",
                    "message": str(exc),
                    "field_count": 0,
                }
            )

    groups = defaultdict(list)
    for record in raw_records:
        groups[record_key(record)].append(record)

    normalized_records = []
    duplicate_groups = []
    for key in sorted(groups):
        records = sorted(groups[key], key=lambda item: item["source_pdf"])
        keeper = dict(records[0])
        keeper["source_pdfs"] = [item["source_pdf"] for item in records]
        keeper["duplicate_count"] = len(records)
        normalized_records.append(keeper)
        if len(records) > 1:
            duplicate_groups.append(
                {
                    "key": {
                        "life_insured_age": key[0],
                        "gender": key[1],
                        "smoker_status": key[2],
                        "target_retirement_age": key[3],
                        "premium_payment_term": key[4],
                        "income_payout_period": key[5],
                        "guaranteed_monthly_income": key[6],
                    },
                    "source_pdfs": [item["source_pdf"] for item in records],
                }
            )

    actual_counter = Counter(
        (
            record["life_insured_age"],
            record["target_retirement_age"],
            str(record["premium_payment_term"]),
            str(record["income_payout_period"]),
        )
        for record in raw_records
    )
    actual_files = defaultdict(list)
    for record in raw_records:
        key = (
            record["life_insured_age"],
            record["target_retirement_age"],
            str(record["premium_payment_term"]),
            str(record["income_payout_period"]),
        )
        actual_files[key].append(record["source_pdf"])

    ages = sorted({record["life_insured_age"] for record in raw_records})
    expected_keys = product_expected_keys(ages)
    coverage_rows = []
    for key in expected_keys:
        count = actual_counter[key]
        age, retirement_age, premium_term, payout_period = key
        status = "present"
        if count == 0:
            status = "missing"
        elif count > 1:
            status = "duplicate"
        coverage_rows.append(
            {
                "status": status,
                "source_count": count,
                "life_insured_age": age,
                "target_retirement_age": retirement_age,
                "premium_payment_term": premium_term,
                "income_payout_period": payout_period,
                "blocked_by_user_rule": user_rule_blocked(age, retirement_age, premium_term),
                "source_pdfs": ";".join(actual_files.get(key, [])),
            }
        )

    raw_fieldnames = [
        "source_pdf",
        "page_count",
        "date_generated",
        "product_name",
        "product_type",
        "plan_name",
        "plan_code",
        "policy_term_raw",
        "premium_payment_term",
        "premium_frequency",
        "currency",
        "life_insured_age",
        "age_basis",
        "gender",
        "smoker_status",
        "target_retirement_age",
        "income_payout_period",
        "guaranteed_monthly_income",
        "annual_premium",
        "single_premium",
        "modal_premium_monthly",
        "modal_premium_quarterly",
        "modal_premium_semi_annual",
        "modal_premium_annual",
        "total_premiums_paid",
        "non_guaranteed_monthly_income_iirr_300",
        "non_guaranteed_monthly_income_iirr_425",
        "total_monthly_income_iirr_300",
        "total_monthly_income_iirr_425",
        "cash_bonus_rate_iirr_300",
        "cash_bonus_rate_iirr_425",
        "premium_rate_per_10_gmi",
        "years_to_retirement",
        "total_guaranteed_benefits",
        "total_cash_bonus_iirr_300",
        "total_cash_bonus_iirr_425",
        "total_benefits_iirr_300",
        "total_benefits_iirr_425",
        "total_illustrated_yield_maturity_iirr_300_pct_pa",
        "total_illustrated_yield_maturity_iirr_425_pct_pa",
        "wop_tpd_premium_annual",
        "retrenchment_payout_premium",
        "retrenchment_payout_amount",
        "duplicate_count",
        "source_pdfs",
    ]

    output_folder.mkdir(parents=True, exist_ok=True)
    write_csv(output_folder / "rrp3_extracted_raw.csv", raw_records, raw_fieldnames)
    write_csv(output_folder / "rrp3_normalized.csv", normalized_records, raw_fieldnames)
    write_csv(output_folder / "rrp3_extraction_audit.csv", audit_rows, ["source_pdf", "status", "message", "field_count"])
    write_csv(
        output_folder / "rrp3_coverage_audit.csv",
        coverage_rows,
        [
            "status",
            "source_count",
            "life_insured_age",
            "target_retirement_age",
            "premium_payment_term",
            "income_payout_period",
            "blocked_by_user_rule",
            "source_pdfs",
        ],
    )

    records_json_path = output_folder / "rrp3_records.json"
    records_json_path.write_text(json.dumps(normalized_records, indent=2, ensure_ascii=False), encoding="utf-8")

    estimated_age_grid = build_estimated_age_grid(normalized_records)
    estimated_fieldnames = [
        "life_insured_age",
        "gender",
        "smoker_status",
        "target_retirement_age",
        "premium_payment_term",
        "income_payout_period",
        "guaranteed_monthly_income_basis",
        "estimation_method",
        "anchor_ages",
        "proxy_slope_keys",
        "premium_rate_per_10_gmi",
        "estimated_annual_premium_for_gmi_1000",
        "estimated_single_premium_for_gmi_1000",
        "estimated_total_premiums_paid_for_gmi_1000",
        "cash_bonus_rate_iirr_300",
        "cash_bonus_rate_iirr_425",
        "estimated_non_guaranteed_monthly_income_iirr_300_for_gmi_1000",
        "estimated_non_guaranteed_monthly_income_iirr_425_for_gmi_1000",
        "estimated_total_monthly_income_iirr_300_for_gmi_1000",
        "estimated_total_monthly_income_iirr_425_for_gmi_1000",
        "estimated_total_benefits_iirr_300_for_gmi_1000",
        "estimated_total_benefits_iirr_425_for_gmi_1000",
        "estimated_total_illustrated_yield_maturity_iirr_300_pct_pa",
        "estimated_total_illustrated_yield_maturity_iirr_425_pct_pa",
        "source_pdfs",
    ]
    write_csv(output_folder / "rrp3_estimated_age_grid.csv", estimated_age_grid, estimated_fieldnames)

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_folder": str(input_folder),
        "pdf_count": len(pdfs),
        "parsed_count": len(raw_records),
        "error_count": len(errors),
        "unique_scenario_count": len(normalized_records),
        "estimated_age_grid_count": len(estimated_age_grid),
        "duplicate_group_count": len(duplicate_groups),
        "duplicate_groups": duplicate_groups,
        "coverage": {
            "expected_product_combo_count": len(expected_keys),
            "present_combo_count": sum(1 for row in coverage_rows if row["status"] == "present"),
            "duplicate_combo_count": sum(1 for row in coverage_rows if row["status"] == "duplicate"),
            "missing_combo_count": sum(1 for row in coverage_rows if row["status"] == "missing"),
            "blocked_by_user_rule_count": sum(1 for row in coverage_rows if row["blocked_by_user_rule"]),
            "missing_combos": [row for row in coverage_rows if row["status"] == "missing"],
        },
        "source_distribution": {
            "ages": dict(Counter(str(record["life_insured_age"]) for record in raw_records)),
            "gender": dict(Counter(record["gender"] for record in raw_records)),
            "smoker_status": dict(Counter(record["smoker_status"] for record in raw_records)),
            "premium_terms": dict(Counter(str(record["premium_payment_term"]) for record in raw_records)),
            "retirement_ages": dict(Counter(str(record["target_retirement_age"]) for record in raw_records)),
            "payout_periods": dict(Counter(str(record["income_payout_period"]) for record in raw_records)),
        },
        "estimated_age_grid_distribution": {
            "ages": dict(Counter(str(record["life_insured_age"]) for record in estimated_age_grid)),
            "methods": dict(Counter(record["estimation_method"] for record in estimated_age_grid)),
        },
        "errors": errors,
    }
    (output_folder / "rrp3_audit_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    app_payload = {
        "generatedAt": summary["generated_at"],
        "source": {
            "inputFolder": str(input_folder),
            "pdfCount": len(pdfs),
            "parsedCount": len(raw_records),
            "uniqueScenarioCount": len(normalized_records),
            "duplicateGroupCount": len(duplicate_groups),
            "estimatedAgeGridCount": len(estimated_age_grid),
        },
        "productConstants": {
            "retirementAges": RETIREMENT_AGES,
            "premiumTerms": PREMIUM_TERMS,
            "payoutPeriods": PAYOUT_PERIODS,
            "entryAgeLimits": ENTRY_AGE_LIMITS,
            "gmiMin": 250,
            "gmiMax": 190000,
            "gmiIncrement": 10,
            "importantNote": (
                "Figures generated by this tool are extrapolated from uploaded policy illustrations "
                "and are approximate only. They are not official Manulife policy illustrations, "
                "are not guaranteed to be 100% accurate, and must be validated against an official "
                "policy illustration before client use or application."
            ),
        },
        "records": normalized_records,
        "estimatedAgeGrid": estimated_age_grid,
        "coverage": summary["coverage"],
    }
    app_data_path.parent.mkdir(parents=True, exist_ok=True)
    app_body = (
        "window.RRP3_RATES = "
        + json.dumps(app_payload, indent=2, ensure_ascii=False)
        + ";\n"
    )
    # Write atomically (temp + replace) so a crash mid-write cannot leave a
    # truncated, syntactically-broken rrp3-rates.js committed and shipped.
    tmp_path = app_data_path.parent / (app_data_path.name + ".tmp")
    tmp_path.write_text(app_body, encoding="utf-8")
    tmp_path.replace(app_data_path)
    verify = app_data_path.read_text(encoding="utf-8")
    if not verify.startswith("window.RRP3_RATES = ") or not verify.rstrip().endswith(";"):
        raise SystemExit(f"{app_data_path} did not write correctly")

    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
