#!/usr/bin/env node

import { chromium } from "playwright";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_ENTRY = "illustration-studio.html";
const DEFAULT_OUT = path.join(ROOT, "Illustration Studio - Paper Printout.pdf");
// Annual table page caps strictly so the table never overflows into the
// next page. Tuned at 12 — fits comfortably with header + footer.
const ROWS_PER_TABLE_PAGE = 12;

function parseArgs() {
  const out = {
    entry: DEFAULT_ENTRY,
    out: DEFAULT_OUT,
    fullTable: false,
  };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--entry") out.entry = argv[++i] || DEFAULT_ENTRY;
    else if (arg === "--out") out.out = path.resolve(argv[++i] || DEFAULT_OUT);
    else if (arg === "--full-table") out.fullTable = true;
  }
  return out;
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".json": "application/json; charset=utf-8",
  }[ext] || "application/octet-stream";
}

async function startServer(root) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = `/${DEFAULT_ENTRY}`;
      const filePath = path.resolve(root, `.${pathname}`);
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const data = await fs.readFile(filePath);
      res.writeHead(200, { "Content-Type": mimeFor(filePath) });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// ===== Helpers =====
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}
function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}
function currencySymbol(currency) {
  return currency === "USD" ? "US$" : "S$";
}
function fmtMoney(value, currency = "SGD", decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sym = currencySymbol(currency);
  const num = Number(value || 0);
  const sign = num < 0 ? "-" : "";
  return `${sign}${sym}${Math.abs(num).toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
}
function fmtCompactMoney(value, currency = "SGD") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sym = currencySymbol(currency);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}${sym}${Math.round(abs / 1000)}K`;
  return `${sign}${sym}${Math.round(abs)}`;
}
function fmtPercent(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(decimals)}%`;
}

function pageShell({ pageNo, totalPages, title, kicker = "Private Client Illustration", body, extraClass = "" }) {
  const lockupKicker = pageShell.scenarioName
    ? `${pageShell.scenarioName} · ${kicker}`
    : kicker;
  return `
    <section class="paper-page ${extraClass}">
      <header class="paper-head">
        <div class="paper-lockup">
          <img class="paper-logo" src="${esc(pageShell.logoSrc)}" alt="" />
          <div>
            <div class="paper-kicker">${esc(lockupKicker)}</div>
            <h1>Illustration Studio</h1>
          </div>
        </div>
        <div class="paper-title">
          <span>${esc(title)}</span>
          <b>${pageNo}/${totalPages}</b>
        </div>
      </header>
      ${body}
      <footer class="paper-foot">
        <span>For educational discussion only · Not an offer, solicitation, or recommendation</span>
        <span>${esc(pageShell.generatedAt)}</span>
      </footer>
    </section>
  `;
}

function metricCard(label, value, note = "") {
  return `
    <div class="metric-card">
      <div class="metric-label">${esc(label)}</div>
      <div class="metric-value">${esc(value || "—")}</div>
      ${note ? `<div class="metric-note">${esc(note)}</div>` : ""}
    </div>
  `;
}

// ===== Page builders =====

function executiveSummaryPage({ data, snapshot, pageNo, totalPages }) {
  const settings = snapshot ? snapshot.settings : {};
  const currency = settings.currency || "SGD";
  const startAge = Number(settings.startAge) || 62;
  const endAge = startAge + (snapshot?.annual?.length || 37);
  const irrText = snapshot && snapshot.final && Number.isFinite(snapshot.final.irr)
    ? fmtPercent(snapshot.final.irr, 2)
    : "—";

  const compositionRows = data.composition.map((item) => `
    <div class="composition-row">
      <i style="background:${esc(item.color)}"></i>
      <span>${esc(item.label)}</span>
      <b>${esc(item.value)}</b>
    </div>
  `).join("");

  const segments = data.segments.map((s) => `
    <span style="width:${esc(s.width)}; background:${esc(s.color)}">${esc(s.text)}</span>
  `).join("");

  return pageShell({
    pageNo, totalPages,
    title: "Executive Summary",
    body: `
      <main class="exec-grid">
        <section class="hero-panel">
          <div class="section-kicker">${esc(data.heroKicker || `Projected wealth · age ${endAge}`)}</div>
          <div class="hero-value">${esc(data.heroValue)}</div>
          <p class="hero-caption">${esc(data.heroCaption)}</p>
          <div class="hero-foot">
            <div><div class="metric-label">IRR</div><div class="metric-value-sm brass">${esc(irrText)}</div></div>
            <div><div class="metric-label">Capital paid</div><div class="metric-value-sm">${esc(fmtCompactMoney(snapshot?.protection?.capitalPaid || 0, currency))}</div></div>
            <div><div class="metric-label">Total bonuses</div><div class="metric-value-sm">${esc(fmtCompactMoney(snapshot?.bonuses?.totalBonuses || 0, currency))}</div></div>
          </div>
        </section>

        <section class="metric-grid exec-meta">
          ${metricCard("Variant", snapshot?.variant?.label || settings.variantKey || "—")}
          ${metricCard("Currency · payment", `${currency} · ${settings.paymentFrequency || "—"}`)}
          ${metricCard("Annualised premium", fmtMoney(settings.annualizedPremium || 0, currency))}
          ${metricCard("Premium term", `${snapshot?.variant?.shortfallYears || 0} yrs (MIP ${snapshot?.variant?.mipYears || 0} yrs)`)}
          ${metricCard("Age window", `${startAge} → ${endAge}`)}
          ${metricCard("End-age value", data.heroValue || "—", "All bonuses, dividends and growth")}
        </section>

        <section class="panel wide composition-panel">
          <div class="panel-head">
            <h2>Composition of projected wealth</h2>
            <span>${esc(data.heroValue)}</span>
          </div>
          <div class="print-comp-bar">${segments}</div>
          <div class="composition-grid">${compositionRows}</div>
        </section>
      </main>
    `,
  });
}

function valueMechanicsPage({ snapshot, pageNo, totalPages }) {
  const currency = snapshot?.settings?.currency || "SGD";
  const charges = snapshot?.charges || {};
  const bonuses = snapshot?.bonuses || {};
  const protection = snapshot?.protection || {};
  const variant = snapshot?.variant || {};

  const welcomeBig = fmtMoney(bonuses.welcomeBonusAmount || 0, currency);
  const welcomeRate = fmtPercent(bonuses.welcomeRate || 0, 1);
  const totalChargesBig = fmtMoney(charges.totalModeledCharges || 0, currency);
  const protectionBig = fmtMoney(protection.deathBenefit || 0, currency);

  const lineRow = (label, value, sub = "") => `
    <div class="line-row">
      <span>${esc(label)}${sub ? ` <small>${esc(sub)}</small>` : ""}</span>
      <b>${esc(value)}</b>
    </div>
  `;

  return pageShell({
    pageNo, totalPages,
    title: "Value Mechanics",
    body: `
      <main class="value-mechanics-grid">
        <section class="value-card welcome-card">
          <div class="section-kicker">Welcome bonus</div>
          <div class="value-card-big">${esc(welcomeBig)}</div>
          <div class="value-card-sub">Year 1 bonus credited to the policy account</div>
          <div class="value-card-lines">
            ${lineRow("Welcome bonus rate", welcomeRate, `On ${fmtMoney(snapshot?.settings?.annualizedPremium || 0, currency)} annualised premium`)}
            ${lineRow("Year 1 bonuses (total)", fmtMoney(bonuses.year1Bonuses || 0, currency), "Welcome + annual premium bonus")}
            ${lineRow("Annual premium bonus rate", fmtPercent(variant.annualPremiumBonusRate || 0, 2))}
            ${lineRow("Loyalty bonus rate", variant.loyaltyRate ? fmtPercent(variant.loyaltyRate, 2) : "Not applicable", "Per year, after MIP, no recent withdrawals")}
            ${lineRow("Total bonuses (over horizon)", fmtMoney(bonuses.totalBonuses || 0, currency))}
          </div>
        </section>

        <section class="value-card charges-card">
          <div class="section-kicker">Charges included</div>
          <div class="value-card-big">${esc(totalChargesBig)}</div>
          <div class="value-card-sub">Total modelled charges across the projection</div>
          <div class="value-card-lines">
            ${lineRow("Admin charge", fmtMoney(charges.adminCharges || 0, currency), `${fmtPercent(variant.adminDuring || 0, 2)} during MIP / ${fmtPercent(variant.adminAfter || 0, 2)} after`)}
            ${lineRow("Policy fee", fmtMoney(charges.policyFees || 0, currency), "Banded fee where applicable")}
            ${lineRow("Shortfall charge", fmtMoney(charges.shortfallCharges || 0, currency), "If basic premium falls short before flexi date")}
            ${lineRow("COI / protection charge", fmtMoney(charges.coiCharges || 0, currency), "On Death/TI net amount at risk")}
            ${lineRow("Partial-withdrawal charges", fmtMoney(charges.withdrawalCharges || 0, currency))}
            ${lineRow("Other deductions", fmtMoney(charges.optionalDeductions || 0, currency))}
          </div>
          <p class="value-card-note">Fund management charges are <b>not</b> double-deducted — the fund's NAV already reflects them.</p>
        </section>

        <section class="value-card protection-card">
          <div class="section-kicker">Legacy protection</div>
          <div class="value-card-big brass">101%</div>
          <div class="value-card-sub">Of net capital paid — Death &amp; Terminal Illness benefit</div>
          <div class="value-card-lines">
            ${lineRow("Death/TI benefit at end-age", protectionBig)}
            ${lineRow("Capital paid in", fmtMoney(protection.capitalPaid || 0, currency))}
            ${lineRow("Surrender value at end-age", fmtMoney(protection.surrenderValue || 0, currency), "Cash-out value, after charges")}
          </div>
          <p class="value-card-warn">Applies to the <b>Death &amp; Terminal Illness</b> benefit only — surrender value is not capital-protected and may be lower than premiums paid, particularly in early years.</p>
        </section>
      </main>
    `,
  });
}

function chartPage({ data, snapshot, pageNo, totalPages }) {
  const currency = snapshot?.settings?.currency || "SGD";
  const compValue = (needle) => {
    const found = data.composition.find((item) => item.label.toLowerCase().includes(needle));
    return found ? found.value : "—";
  };

  return pageShell({
    pageNo, totalPages,
    title: "Projection Chart",
    body: `
      <main class="chart-page">
        <section class="panel chart-panel-print">
          <div class="panel-head">
            <h2>Projected client value &amp; benchmark</h2>
            <span>${esc(data.chartEndLabel || "")}</span>
          </div>
          <div class="chart-legend-print">
            ${data.chartLegend.map((item) => `<span>${esc(item)}</span>`).join("")}
          </div>
          <img class="chart-image" src="${esc(data.chartPng)}" alt="Projected client value chart" />
        </section>

        <section class="metric-grid compact">
          ${metricCard("Projected wealth", data.heroValue)}
          ${metricCard("Capital paid in", compValue("capital"))}
          ${metricCard("Bonuses credited", compValue("bonus"))}
          ${metricCard("Dividends accrued", compValue("dividend"))}
          ${metricCard("Investment growth", compValue("growth"))}
          ${metricCard("End age", data.chartEndLabel || "—")}
        </section>
      </main>
    `,
  });
}

function annualTablePage({ data, rows, chunkIndex, chunkCount, pageNo, totalPages }) {
  const headerHtml = `
    <thead>
      <tr>
        ${data.annualHeaders.map((h, index) => `<th class="${index > 1 ? "right" : ""}">${esc(h)}</th>`).join("")}
      </tr>
    </thead>
  `;
  const bodyHtml = rows.map((row) => `
    <tr class="${row.milestone ? "milestone" : ""}">
      ${row.cells.map((c, index) => `<td class="${index > 1 ? "right" : ""}">${esc(c)}</td>`).join("")}
    </tr>
  `).join("");

  return pageShell({
    pageNo, totalPages,
    title: chunkCount > 1 ? `Annual Projection · ${chunkIndex + 1}/${chunkCount}` : "Annual Projection",
    body: `
      <main class="table-page">
        <section class="panel table-panel">
          <div class="panel-head">
            <h2>Annual Projection</h2>
            <span>${esc(data.annualMode)} · ${rows.length} row${rows.length === 1 ? "" : "s"} on this page</span>
          </div>
          <table class="annual-table">
            ${headerHtml}
            <tbody>${bodyHtml}</tbody>
          </table>
        </section>
      </main>
    `,
  });
}

function withdrawalAccessPage({ data, snapshot, pageNo, totalPages }) {
  const currency = snapshot?.settings?.currency || "SGD";
  const variant = snapshot?.variant || {};
  const partialCharges = variant.partialCharge || {};
  const surrenderCharges = variant.surrenderCharge || {};

  // Year-by-year partial-withdrawal charge schedule (compact list)
  const chargeSchedule = (Object.entries(partialCharges)
    .map(([yr, rate]) => ({ yr: Number(yr), rate: Number(rate) }))
    .sort((a, b) => a.yr - b.yr)
    .filter((row) => row.rate > 0)
    .slice(0, 12));

  const accessCardsHtml = data.accessCards.length
    ? data.accessCards.map((item) => `
        <article class="access-card">
          <h3>${esc(item.title)}</h3>
          ${item.lines.map((line) => `
            <div class="access-line">
              <span>${esc(line.label)}</span>
              <b>${esc(line.value)}</b>
            </div>
          `).join("")}
        </article>
      `).join("")
    : `
        <article class="access-card">
          <h3>Access details</h3>
          <p class="access-empty">No withdrawal access events were active in the source HTML at the time of generation.</p>
        </article>
      `;

  return pageShell({
    pageNo, totalPages,
    title: "Withdrawal &amp; Access Summary",
    body: `
      <main class="access-page">
        <section class="panel access-panel-print">
          <div class="panel-head">
            <h2>Calculated access points</h2>
            <span>From this scenario</span>
          </div>
          <div class="access-grid">
            ${accessCardsHtml}
          </div>
        </section>

        <section class="panel access-rules-panel">
          <div class="panel-head">
            <h2>Charge schedule</h2>
            <span>${esc(snapshot?.variant?.label || "")}</span>
          </div>
          <div class="rules-two-col">
            <div>
              <h4>Partial-withdrawal charge</h4>
              <table class="schedule-table">
                <thead><tr><th>Policy year</th><th class="right">Charge</th></tr></thead>
                <tbody>
                  ${chargeSchedule.map((row) => `
                    <tr><td>Year ${row.yr}</td><td class="right">${esc(fmtPercent(row.rate, 0))}</td></tr>
                  `).join("")}
                  ${chargeSchedule.length === 0 ? `<tr><td colspan="2"><em>No partial-withdrawal charge in this variant.</em></td></tr>` : ""}
                </tbody>
              </table>
            </div>
            <div>
              <h4>Notes</h4>
              <ul class="access-notes">
                <li>Partial-withdrawal access opens from year ${variant.mipYears && variant.mipYears >= 6 ? "6" : "the start of the policy"} for variants that allow it; before then only dividend drawdown is available where applicable.</li>
                <li>Surrender charge schedule shown on the original variant fact sheet; surrender values shown in this deck already net of admin and surrender charge.</li>
                <li>Dividend drawdown is limited to the reinvested-dividend basis at the time of withdrawal.</li>
                <li>Total cashout figures shown on the access cards are net of all applicable charges modelled in this scenario.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    `,
  });
}

function disclaimersPage({ data, pageNo, totalPages }) {
  return pageShell({
    pageNo, totalPages,
    title: "Important Disclaimers",
    extraClass: "disclaimers-paper-page",
    body: `
      <main class="disclaimer-page">
        <section class="panel disclaimer-panel">
          <div class="panel-head">
            <h2>Important Disclaimers</h2>
            <span>Source documents prevail</span>
          </div>
          <ol class="disclaimer-list">
            ${data.disclaimers.map((item) => `
              <li>
                <strong>${esc(item.title)}</strong>
                <span>${esc(item.body)}</span>
              </li>
            `).join("")}
          </ol>
        </section>
      </main>
    `,
  });
}

// ===== Deck composer =====

function buildDeckHtml(data, snapshot) {
  pageShell.logoSrc = data.logoSrc;
  pageShell.generatedAt = data.generatedAt;
  pageShell.scenarioName = (snapshot && snapshot.scenarioName) || data.scenarioName || "";

  const annualChunks = chunk(data.annualRows, ROWS_PER_TABLE_PAGE);
  // Page count: 1 (Exec) + 2 (Mechanics) + 3 (Chart) + N (Table chunks) + 1 (Access) + 1 (Disclaimers)
  const totalPages = 5 + annualChunks.length;

  const pages = [];
  let pageNo = 1;
  pages.push(executiveSummaryPage({ data, snapshot, pageNo: pageNo++, totalPages }));
  pages.push(valueMechanicsPage({ snapshot, pageNo: pageNo++, totalPages }));
  pages.push(chartPage({ data, snapshot, pageNo: pageNo++, totalPages }));
  annualChunks.forEach((rows, idx) => {
    pages.push(annualTablePage({ data, rows, chunkIndex: idx, chunkCount: annualChunks.length, pageNo: pageNo++, totalPages }));
  });
  pages.push(withdrawalAccessPage({ data, snapshot, pageNo: pageNo++, totalPages }));
  pages.push(disclaimersPage({ data, pageNo: pageNo++, totalPages }));

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Illustration Studio · Paper Printout</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }

    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #101a28;
      font-family: "Inter", "Geist", "Segoe UI", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.38;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Hide every interactive UI control that might leak from the source
       page if anything ends up embedded. The deck builder constructs
       its own static HTML, so this is pure belt-and-braces. */
    .paper-deck button,
    .paper-deck input,
    .paper-deck select,
    .paper-deck textarea,
    .paper-deck nav,
    .paper-deck .ckg-suite-strip,
    .paper-deck .topbar,
    .paper-deck .scenario-actions,
    .paper-deck .restore-banner,
    .paper-deck .controls,
    .paper-deck .toggle-groups,
    .paper-deck .action-row { display: none !important; }

    /* === Page chrome === */
    .paper-page {
      position: relative;
      width: 297mm;
      height: 210mm;
      padding: 10mm 12mm 12mm;
      overflow: hidden;
      page-break-after: always;
      background: #fbfaf7;
    }
    .paper-page:last-child { page-break-after: auto; }

    .paper-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 14mm;
      border-bottom: 1px solid #dedbd4;
      margin-bottom: 6mm;
    }
    .paper-lockup { display: flex; align-items: center; gap: 9px; min-width: 0; }
    .paper-logo { width: 26px; height: 26px; border-radius: 6px; }
    .paper-kicker,
    .section-kicker,
    .metric-label,
    .paper-foot,
    .paper-title b,
    .panel-head span {
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      font-size: 7.4pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #7a7f87;
    }
    .paper-head h1 {
      margin: 1px 0 0;
      font-size: 12.5pt;
      line-height: 1;
      font-weight: 600;
      color: #1a1d22;
    }
    .paper-title {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #454a51;
      font-size: 9.5pt;
      font-weight: 600;
    }
    .paper-title b { font-weight: 500; color: #8e6936; }

    .paper-foot {
      position: absolute;
      left: 12mm;
      right: 12mm;
      bottom: 6mm;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #e8e5dc;
      padding-top: 3mm;
      font-size: 6.8pt;
      color: #8a8d93;
    }

    /* === Generic panel === */
    .panel,
    .metric-card,
    .hero-panel,
    .value-card {
      border: 1px solid #e5e5e3;
      border-radius: 8px;
      background: #ffffff;
    }
    .panel-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 4mm;
    }
    .panel-head h2 {
      margin: 0;
      color: #1a1d22;
      font-size: 11.5pt;
      font-weight: 600;
    }
    .panel { padding: 6mm; }
    .wide { grid-column: 1 / -1; }

    /* === Page 1: Executive Summary === */
    .exec-grid {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      grid-auto-rows: min-content;
      gap: 5mm;
      height: calc(210mm - 10mm - 12mm - 14mm - 6mm - 14mm);
    }
    .hero-panel {
      padding: 8mm;
      grid-row: span 2;
      display: flex;
      flex-direction: column;
    }
    .hero-value {
      margin-top: 4mm;
      font-size: 34pt;
      line-height: 1;
      font-weight: 500;
      letter-spacing: -0.035em;
      color: #101a28;
      font-variant-numeric: tabular-nums lining-nums;
    }
    .hero-caption {
      margin: 5mm 0 0;
      color: #454a51;
      font-size: 10.5pt;
    }
    .hero-foot {
      margin-top: auto;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4mm;
      padding-top: 5mm;
      border-top: 1px solid #eeeeec;
    }
    .metric-value-sm {
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      font-size: 13pt;
      font-weight: 600;
      color: #1a1d22;
      font-variant-numeric: tabular-nums lining-nums;
      margin-top: 2mm;
    }
    .metric-value-sm.brass { color: #8e6936; }

    .exec-meta {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4mm;
    }
    .metric-card {
      min-height: 22mm;
      padding: 4mm 5mm;
    }
    .metric-value {
      margin-top: 2mm;
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      font-size: 13pt;
      font-weight: 600;
      color: #1a1d22;
      font-variant-numeric: tabular-nums lining-nums;
    }
    .metric-note { margin-top: 1mm; color: #7a7f87; font-size: 7.6pt; }

    .composition-panel { padding: 5mm 6mm; }
    .print-comp-bar {
      display: flex;
      height: 8mm;
      overflow: hidden;
      border-radius: 4px;
      background: #f3f3f1;
    }
    .print-comp-bar span {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 3px;
      color: #ffffff;
      font-size: 7pt;
      font-weight: 600;
      white-space: nowrap;
    }
    .composition-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1mm 8mm;
      margin-top: 3mm;
    }
    .composition-row {
      display: grid;
      grid-template-columns: 10px 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 1.8mm 0;
      border-bottom: 1px solid #eeeeec;
    }
    .composition-row i { width: 10px; height: 10px; border-radius: 2px; }
    .composition-row span { color: #454a51; font-size: 9pt; }
    .composition-row b {
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      font-size: 9pt;
      font-weight: 600;
      color: #1a1d22;
    }

    /* === Page 2: Value Mechanics === */
    .value-mechanics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5mm;
      height: calc(210mm - 10mm - 12mm - 14mm - 6mm - 14mm);
    }
    .value-card {
      padding: 8mm;
      display: flex;
      flex-direction: column;
    }
    .value-card-big {
      margin: 3mm 0 1mm;
      font-size: 28pt;
      line-height: 1;
      font-weight: 500;
      letter-spacing: -0.025em;
      color: #1a1d22;
      font-variant-numeric: tabular-nums lining-nums;
    }
    .value-card-big.brass { color: #8e6936; }
    .value-card-sub {
      color: #5f6670;
      font-size: 9.4pt;
      margin-bottom: 5mm;
    }
    .value-card-lines {
      display: flex;
      flex-direction: column;
      gap: 0;
      flex: 1;
    }
    .line-row {
      display: flex;
      justify-content: space-between;
      gap: 6mm;
      padding: 2.4mm 0;
      border-top: 1px solid #eeeeec;
      font-size: 9pt;
    }
    .line-row span {
      color: #454a51;
      font-family: inherit;
    }
    .line-row span small {
      display: block;
      color: #8a8d93;
      font-size: 7.6pt;
      margin-top: 0.5mm;
      letter-spacing: 0;
    }
    .line-row b {
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      color: #1a1d22;
      font-weight: 600;
      white-space: nowrap;
      align-self: start;
    }
    .value-card-note,
    .value-card-warn {
      margin: 4mm 0 0;
      font-size: 8.2pt;
      color: #5f6670;
      line-height: 1.45;
    }
    .value-card-warn {
      background: #fff7e8;
      border: 1px solid #f0d9a3;
      padding: 3mm;
      border-radius: 4px;
      color: #6b4f1c;
    }
    .welcome-card { background: #fff; }
    .charges-card { background: #fbfaf3; }
    .protection-card {
      background: #0f1d2d;
      color: #f5edd4;
      border-color: #1f2c44;
    }
    .protection-card .section-kicker { color: #d8c895; }
    .protection-card .value-card-sub { color: #d8c895; }
    .protection-card .line-row { border-top-color: rgba(216, 200, 149, 0.18); }
    .protection-card .line-row span { color: #cfc6ad; }
    .protection-card .line-row span small { color: #918265; }
    .protection-card .line-row b { color: #f5edd4; }
    .protection-card .value-card-warn {
      background: rgba(216, 200, 149, 0.10);
      border-color: rgba(216, 200, 149, 0.35);
      color: #f4ecd5;
    }

    /* === Page 3: Chart === */
    .chart-page {
      display: grid;
      grid-template-columns: 1fr;
      gap: 5mm;
      height: calc(210mm - 10mm - 12mm - 14mm - 6mm - 14mm);
    }
    .chart-panel-print { padding: 6mm 7mm; }
    .chart-legend-print {
      display: flex;
      gap: 5mm;
      color: #69727d;
      font-size: 8pt;
      margin-bottom: 2mm;
    }
    .chart-image {
      display: block;
      width: 100%;
      height: 110mm;
      object-fit: contain;
      border: 1px solid #eeeeec;
      border-radius: 6px;
      background: #ffffff;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4mm;
    }
    .metric-grid.compact {
      grid-template-columns: repeat(3, 1fr);
      margin-top: 4mm;
    }

    /* === Annual table page === */
    .table-page { height: calc(210mm - 10mm - 12mm - 14mm - 6mm - 14mm); }
    .table-panel { height: 100%; padding: 5mm; overflow: hidden; }
    .annual-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      font-size: 6.8pt;
      font-variant-numeric: tabular-nums lining-nums;
    }
    .annual-table th {
      padding: 2.2mm 1.4mm;
      text-align: left;
      color: #5f6670;
      background: #f3f3f1;
      border-bottom: 1px solid #dedbd4;
      font-weight: 600;
      vertical-align: bottom;
    }
    .annual-table td {
      padding: 2mm 1.4mm;
      color: #1a1d22;
      border-bottom: 1px solid #eeeeec;
      vertical-align: top;
    }
    .annual-table .right { text-align: right; }
    .annual-table tr.milestone td { background: #fcf6ec; }

    /* === Withdrawal / Access page === */
    .access-page {
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 5mm;
      height: calc(210mm - 10mm - 12mm - 14mm - 6mm - 14mm);
    }
    .access-panel-print, .access-rules-panel { padding: 6mm; }
    .access-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4mm;
    }
    .access-card {
      border: 1px solid #eeeeec;
      border-radius: 6px;
      background: #fbfaf3;
      padding: 4mm 5mm;
    }
    .access-card h3 { margin: 0 0 2mm; font-size: 10pt; color: #1a1d22; }
    .access-card .access-empty { color: #5f6670; font-size: 8.5pt; margin: 0; }
    .access-line {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-top: 1px solid #eeeeec;
      padding: 2mm 0 0;
      margin-top: 2mm;
      font-size: 8.4pt;
    }
    .access-line span { color: #454a51; }
    .access-line b {
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      color: #1a1d22;
      text-align: right;
      font-weight: 600;
    }
    .rules-two-col {
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      gap: 6mm;
    }
    .rules-two-col h4 {
      margin: 0 0 2mm;
      font-size: 9.5pt;
      color: #1a1d22;
    }
    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      font-size: 8pt;
    }
    .schedule-table th, .schedule-table td {
      padding: 1.6mm 2mm;
      border-bottom: 1px solid #eeeeec;
      text-align: left;
      color: #1a1d22;
    }
    .schedule-table th { color: #5f6670; font-weight: 600; }
    .schedule-table .right { text-align: right; }
    .access-notes {
      margin: 0;
      padding-left: 4mm;
      color: #454a51;
      font-size: 8.6pt;
      line-height: 1.55;
    }
    .access-notes li { margin-bottom: 1.6mm; }

    /* === Disclaimers page (own page, no overflow from previous) === */
    .disclaimers-paper-page { break-before: page; }
    .disclaimer-page { height: calc(210mm - 10mm - 12mm - 14mm - 6mm - 14mm); }
    .disclaimer-panel { height: 100%; padding: 6mm 8mm; overflow: hidden; }
    .disclaimer-list {
      margin: 0;
      padding-left: 6mm;
      columns: 2;
      column-gap: 10mm;
    }
    .disclaimer-list li {
      break-inside: avoid;
      margin: 0 0 3mm;
      color: #454a51;
      font-size: 8.4pt;
      line-height: 1.45;
    }
    .disclaimer-list strong {
      display: block;
      color: #1a1d22;
      margin-bottom: 0.6mm;
    }
  </style>
</head>
<body class="paper-deck">
  ${pages.join("\n")}
</body>
</html>`;
}

// ===== DOM extraction (visual / presentation values) =====

async function extractDom(page) {
  return page.evaluate(() => {
    const byId = (id) => document.getElementById(id);
    const q = (selector) => document.querySelector(selector);
    const qa = (selector) => Array.from(document.querySelectorAll(selector));
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const idText = (id) => clean(byId(id)?.textContent);
    const logoSrc = q(".brand-mark")?.src || new URL("assets/illustration-studio-logo.svg", location.href).href;

    const composition = qa("#compositionLegend li").map((li) => {
      const swatch = li.querySelector("i");
      return {
        label: clean(li.querySelector("span")?.textContent),
        value: clean(li.querySelector("strong")?.textContent),
        color: swatch ? getComputedStyle(swatch).backgroundColor : "#8e6936",
      };
    });
    const segments = qa("#compositionBar .seg").map((seg) => ({
      text: clean(seg.textContent),
      width: seg.style.width || `${Math.max(1, Math.round(seg.getBoundingClientRect().width))}px`,
      color: getComputedStyle(seg).backgroundColor,
    })).filter((seg) => seg.width && seg.width !== "0%");

    const canvas = byId("valueChart");
    const chartPng = canvas ? canvas.toDataURL("image/png", 1) : "";

    const annualTable = byId("annualTable");
    const annualHeaders = annualTable
      ? qa("#annualTable thead th").map((th) => clean(th.textContent))
      : [];
    const annualRows = annualTable
      ? qa("#annualTable tbody tr").map((tr) => ({
          milestone: tr.classList.contains("milestone") || Boolean(tr.dataset.milestone),
          cells: Array.from(tr.cells).map((td) => clean(td.textContent)),
        }))
      : [];

    const accessCards = qa("#annualAccessLegend .access-legend-card").map((card) => ({
      title: clean(card.querySelector("strong")?.textContent),
      lines: Array.from(card.querySelectorAll(".access-line")).map((line) => ({
        label: clean(line.querySelector("span")?.textContent),
        value: clean(line.querySelector("b")?.textContent),
      })),
    })).filter((item) => item.title);

    const disclaimers = qa(".disclaimers li").map((li) => {
      const strong = clean(li.querySelector("strong")?.textContent);
      const body = clean(li.textContent).replace(strong, "").trim();
      return { title: strong.replace(/\.$/, ""), body };
    });

    const chartLegend = qa("#chartLegend span").map((span) => clean(span.textContent)).filter(Boolean);

    const annualMode = q("#annualFullBtn")?.classList.contains("active") ? "All years" : "Milestones";

    return {
      generatedAt: new Date().toLocaleString("en-SG", {
        year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
      }),
      scenarioName: window.__ckgScenarioName || "",
      logoSrc,
      heroKicker: `${idText("heroLabel") || "Projected wealth"} · ${idText("heroEndAge") || "age 99"}`,
      heroValue: idText("heroTotal"),
      heroCaption: idText("heroCaption"),
      composition,
      segments,
      chartPng,
      chartEndLabel: idText("chartEndLabel"),
      chartLegend,
      annualMode,
      annualHeaders,
      annualRows,
      accessCards,
      disclaimers,
    };
  });
}

// ===== Main =====

async function main() {
  const args = parseArgs();
  const server = await startServer(ROOT);
  const browser = await chromium.launch();

  try {
    const appPage = await browser.newPage({
      viewport: { width: 1500, height: 1000 },
      deviceScaleFactor: 2,
    });
    const sameOrigin = server.origin;
    await appPage.route("**/*", (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin === sameOrigin) route.continue();
      else route.abort();
    });
    await appPage.goto(`${server.origin}/${args.entry}`, { waitUntil: "domcontentloaded" });

    await appPage.waitForFunction(() => {
      const hero = document.getElementById("heroTotal")?.textContent?.trim();
      const hasValue = hero && !/^S\$0|^US\$0/.test(hero);
      const hasTable = document.querySelector("#annualTable tbody tr");
      const hasCanvas = document.getElementById("valueChart");
      const snapshot = window.IllustrationStudioPrint && typeof window.IllustrationStudioPrint.getSnapshot === "function"
        ? window.IllustrationStudioPrint.getSnapshot()
        : null;
      return hasValue && hasTable && hasCanvas && snapshot;
    }, { timeout: 25000 });

    if (args.fullTable) {
      await appPage.locator("#annualFullBtn").click({ timeout: 3000 }).catch(() => {});
      await appPage.waitForTimeout(500);
    }

    await appPage.waitForTimeout(400);

    // Real calculated values from the simulator (not DOM-scraped)
    const snapshot = await appPage.evaluate(() => window.IllustrationStudioPrint.getSnapshot());
    // Visual values (chart canvas, composition swatches, disclaimer text)
    const data = await extractDom(appPage);

    const deckHtml = buildDeckHtml(data, snapshot);

    const deckPage = await browser.newPage({
      viewport: { width: 1500, height: 1060 },
      deviceScaleFactor: 1,
    });
    await deckPage.setContent(deckHtml, { waitUntil: "load" });
    await deckPage.waitForFunction(() => Array.from(document.images).every((img) => img.complete), { timeout: 8000 }).catch(() => {});
    await deckPage.emulateMedia({ media: "print" });

    await fs.mkdir(path.dirname(args.out), { recursive: true });

    await deckPage.pdf({
      path: args.out,
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      scale: 1,
    });

    console.log(`Created: ${args.out}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
