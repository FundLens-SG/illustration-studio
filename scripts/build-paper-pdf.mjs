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
const ROWS_PER_TABLE_PAGE = 13;

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

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function card(label, value, note = "") {
  return `
    <div class="metric-card">
      <div class="metric-label">${esc(label)}</div>
      <div class="metric-value">${esc(value || "—")}</div>
      ${note ? `<div class="metric-note">${esc(note)}</div>` : ""}
    </div>
  `;
}

function tableHtml(headers, rows) {
  return `
    <table class="annual-table">
      <thead>
        <tr>
          ${headers.map((h, index) => `<th class="${index > 1 ? "right" : ""}">${esc(h)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr class="${row.milestone ? "milestone" : ""}">
            ${row.cells.map((c, index) => `<td class="${index > 1 ? "right" : ""}">${esc(c)}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function pageShell({ pageNo, totalPages, title, kicker = "Private Client Illustration", body }) {
  return `
    <section class="paper-page">
      <header class="paper-head">
        <div class="paper-lockup">
          <img class="paper-logo" src="${esc(pageShell.logoSrc)}" alt="" />
          <div>
            <div class="paper-kicker">${esc(kicker)}</div>
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

function buildDeckHtml(data) {
  pageShell.logoSrc = data.logoSrc;
  pageShell.generatedAt = data.generatedAt;

  const control = Object.fromEntries(data.controls.map((item) => [item.label, item.value]));
  const compValue = (needle) => {
    const found = data.composition.find((item) => item.label.toLowerCase().includes(needle));
    return found ? found.value : "—";
  };

  const annualChunks = chunk(data.annualRows, ROWS_PER_TABLE_PAGE);
  const totalPages = 3 + annualChunks.length + 1;
  let pageNo = 1;
  const pages = [];

  pages.push(pageShell({
    pageNo: pageNo++,
    totalPages,
    title: "Summary",
    body: `
      <main class="summary-grid">
        <section class="hero-panel">
          <div class="section-kicker">${esc(data.heroKicker)}</div>
          <div class="hero-value">${esc(data.heroValue)}</div>
          <p class="hero-caption">${esc(data.heroCaption)}</p>
        </section>

        <section class="metric-grid">
          ${card("Variant", control.Variant)}
          ${card("Currency / payment", `${control.Currency || "—"} · ${control["Payment mode"] || "—"}`)}
          ${card("Annualised premium", control["Annualised premium"])}
          ${card("Age window", `${control["Start age"] || "—"} → ${data.endAge || "99"}`)}
          ${card("Capital paid in", compValue("capital"))}
          ${card("Dividends accrued", compValue("dividend"))}
        </section>

        <section class="panel wide">
          <div class="panel-head">
            <h2>Composition of projected wealth</h2>
            <span>${esc(data.heroValue)}</span>
          </div>
          <div class="print-comp-bar">
            ${data.segments.map((s) => `
              <span style="width:${esc(s.width)}; background:${esc(s.color)}">${esc(s.text)}</span>
            `).join("")}
          </div>
          <div class="composition-grid">
            ${data.composition.map((item) => `
              <div class="composition-row">
                <i style="background:${esc(item.color)}"></i>
                <span>${esc(item.label)}</span>
                <b>${esc(item.value)}</b>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Model status</h2>
          </div>
          <div class="status-callout">
            <strong>${esc(data.checks.title || "Ready for client view")}</strong>
            <p>${esc(data.checks.body || "Premium term, charges and withdrawal rules are aligned to the selected variation.")}</p>
          </div>
        </section>
      </main>
    `,
  }));

  pages.push(pageShell({
    pageNo: pageNo++,
    totalPages,
    title: "Protection and access",
    body: `
      <main class="two-col">
        <section class="benefit-panel">
          <div class="section-kicker">Legacy Protection</div>
          <div class="benefit-number">101%</div>
          <h2>Death and Terminal Illness Benefit</h2>
          <p>Capital-protected floor for clients and beneficiaries alongside the investment strategy.</p>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Selected product assumptions</h2>
          </div>
          <div class="assumption-grid">
            ${data.assumptions.map((item) => `
              <div>
                <span>${esc(item.label)}</span>
                <b>${esc(item.value)}</b>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="panel wide">
          <div class="panel-head">
            <h2>Withdrawal access</h2>
            <span>Calculated from current scenario</span>
          </div>
          <div class="access-grid">
            ${data.accessCards.length ? data.accessCards.map((item) => `
              <article class="access-card">
                <h3>${esc(item.title)}</h3>
                ${item.lines.map((line) => `
                  <div class="access-line">
                    <span>${esc(line.label)}</span>
                    <b>${esc(line.value)}</b>
                  </div>
                `).join("")}
              </article>
            `).join("") : `
              <article class="access-card">
                <h3>Access details</h3>
                <div class="access-line"><span>No withdrawal access detail was rendered in the source HTML.</span><b>—</b></div>
              </article>
            `}
          </div>
        </section>
      </main>
    `,
  }));

  pages.push(pageShell({
    pageNo: pageNo++,
    totalPages,
    title: "Projection chart",
    body: `
      <main class="chart-page">
        <section class="panel chart-panel-print">
          <div class="panel-head">
            <h2>Projected client value and benchmark</h2>
            <span>${esc(data.chartEndLabel)}</span>
          </div>
          <div class="chart-legend-print">
            ${data.chartLegend.map((item) => `<span>${esc(item)}</span>`).join("")}
          </div>
          <img class="chart-image" src="${esc(data.chartPng)}" alt="Projected client value chart" />
        </section>

        <section class="metric-grid compact">
          ${card("Projected wealth", data.heroValue)}
          ${card("Capital paid in", compValue("capital"))}
          ${card("Bonuses credited", compValue("bonus"))}
          ${card("Dividends accrued", compValue("dividend"))}
          ${card("Investment growth", compValue("growth"))}
          ${card("Chart basis", data.chartEndLabel || "End age")}
        </section>
      </main>
    `,
  }));

  annualChunks.forEach((rows, index) => {
    pages.push(pageShell({
      pageNo: pageNo++,
      totalPages,
      title: annualChunks.length > 1
        ? `Annual projection · ${index + 1}/${annualChunks.length}`
        : "Annual projection",
      body: `
        <main class="table-page">
          <section class="panel table-panel">
            <div class="panel-head">
              <h2>Annual Projection</h2>
              <span>${esc(data.annualMode)}</span>
            </div>
            ${tableHtml(data.annualHeaders, rows)}
          </section>
        </main>
      `,
    }));
  });

  pages.push(pageShell({
    pageNo: pageNo++,
    totalPages,
    title: "Important disclaimers",
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
  }));

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

    * {
      box-sizing: border-box;
    }

    html,
    body {
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

    .paper-page {
      position: relative;
      width: 297mm;
      height: 210mm;
      padding: 10mm 12mm 11mm;
      overflow: hidden;
      page-break-after: always;
      background: #fbfaf7;
    }

    .paper-page:last-child {
      page-break-after: auto;
    }

    .paper-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 16mm;
      border-bottom: 1px solid #dedbd4;
      margin-bottom: 7mm;
    }

    .paper-lockup {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
    }

    .paper-logo {
      width: 28px;
      height: 28px;
      border-radius: 6px;
    }

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
      font-size: 13pt;
      line-height: 1;
      font-weight: 600;
      color: #1a1d22;
    }

    .paper-title {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #454a51;
      font-size: 10pt;
      font-weight: 600;
    }

    .paper-title b {
      font-weight: 500;
      color: #8e6936;
    }

    .paper-foot {
      position: absolute;
      left: 12mm;
      right: 12mm;
      bottom: 5mm;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #e8e5dc;
      padding-top: 3mm;
      font-size: 6.8pt;
      color: #8a8d93;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: 1.05fr 1fr;
      gap: 5mm;
    }

    .hero-panel {
      min-height: 58mm;
      padding: 8mm;
      border: 1px solid #e5e5e3;
      border-radius: 8px;
      background: #ffffff;
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
      max-width: 95%;
      margin: 5mm 0 0;
      color: #454a51;
      font-size: 10.5pt;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4mm;
    }

    .metric-grid.compact {
      grid-template-columns: repeat(3, 1fr);
      margin-top: 5mm;
    }

    .metric-card,
    .panel,
    .benefit-panel {
      border: 1px solid #e5e5e3;
      border-radius: 8px;
      background: #ffffff;
    }

    .metric-card {
      min-height: 24mm;
      padding: 5mm;
    }

    .metric-value {
      margin-top: 2mm;
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      font-size: 14pt;
      font-weight: 600;
      color: #1a1d22;
      font-variant-numeric: tabular-nums lining-nums;
    }

    .metric-note {
      margin-top: 1mm;
      color: #7a7f87;
      font-size: 8pt;
    }

    .panel {
      padding: 6mm;
    }

    .wide {
      grid-column: 1 / -1;
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
      font-size: 12pt;
      font-weight: 600;
    }

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
      gap: 2mm 8mm;
      margin-top: 4mm;
    }

    .composition-row {
      display: grid;
      grid-template-columns: 10px 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 2.5mm 0;
      border-bottom: 1px solid #eeeeec;
    }

    .composition-row i {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }

    .composition-row span {
      color: #454a51;
      font-size: 9pt;
    }

    .composition-row b {
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      font-size: 9pt;
      font-weight: 600;
      color: #1a1d22;
    }

    .status-callout strong {
      display: block;
      color: #1a1d22;
      font-size: 12pt;
      margin-bottom: 2mm;
    }

    .status-callout p {
      margin: 0;
      color: #454a51;
    }

    .two-col {
      display: grid;
      grid-template-columns: 0.8fr 1.2fr;
      gap: 5mm;
    }

    .benefit-panel {
      padding: 8mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 68mm;
    }

    .benefit-number {
      margin: 3mm 0 2mm;
      font-size: 42pt;
      line-height: 1;
      color: #8e6936;
      font-weight: 500;
      letter-spacing: -0.03em;
    }

    .benefit-panel h2 {
      margin: 0 0 3mm;
      font-size: 13pt;
      color: #1a1d22;
    }

    .benefit-panel p {
      margin: 0;
      color: #454a51;
    }

    .assumption-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3mm 6mm;
    }

    .assumption-grid div {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1px solid #eeeeec;
      padding-bottom: 2mm;
    }

    .assumption-grid span {
      color: #7a7f87;
      font-size: 8.2pt;
    }

    .assumption-grid b {
      text-align: right;
      color: #1a1d22;
      font-size: 8.6pt;
    }

    .access-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4mm;
    }

    .access-card {
      border: 1px solid #eeeeec;
      border-radius: 6px;
      background: #fbfaf7;
      padding: 4mm;
    }

    .access-card h3 {
      margin: 0 0 2mm;
      font-size: 10pt;
      color: #1a1d22;
    }

    .access-line {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-top: 1px solid #eeeeec;
      padding: 2mm 0 0;
      margin-top: 2mm;
      font-size: 8.2pt;
    }

    .access-line span {
      color: #454a51;
    }

    .access-line b {
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      color: #1a1d22;
      text-align: right;
      font-weight: 600;
    }

    .chart-page {
      display: grid;
      grid-template-columns: 1fr;
      gap: 5mm;
    }

    .chart-panel-print {
      padding: 6mm 7mm;
    }

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
      height: 112mm;
      object-fit: contain;
      border: 1px solid #eeeeec;
      border-radius: 6px;
      background: #ffffff;
    }

    .table-page {
      height: 158mm;
    }

    .table-panel {
      height: 100%;
      padding: 5mm;
    }

    .annual-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-family: "SFMono-Regular", "Roboto Mono", "Geist Mono", Consolas, monospace;
      font-size: 6.7pt;
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
      padding: 2.1mm 1.4mm;
      color: #1a1d22;
      border-bottom: 1px solid #eeeeec;
      vertical-align: top;
    }

    .annual-table .right {
      text-align: right;
    }

    .annual-table tr.milestone td {
      background: #fcf6ec;
    }

    .disclaimer-panel {
      height: 154mm;
      padding: 6mm 7mm;
    }

    .disclaimer-list {
      margin: 0;
      padding-left: 6mm;
      columns: 2;
      column-gap: 10mm;
    }

    .disclaimer-list li {
      break-inside: avoid;
      margin: 0 0 3.2mm;
      color: #454a51;
      font-size: 8.4pt;
    }

    .disclaimer-list strong {
      display: block;
      color: #1a1d22;
      margin-bottom: 0.8mm;
    }
  </style>
</head>
<body>
  ${pages.join("\n")}
</body>
</html>`;
}

async function extractData(page) {
  return page.evaluate(() => {
    const byId = (id) => document.getElementById(id);
    const q = (selector) => document.querySelector(selector);
    const qa = (selector) => Array.from(document.querySelectorAll(selector));

    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const text = (selector) => clean(q(selector)?.textContent);
    const idText = (id) => clean(byId(id)?.textContent);

    const selectedText = (id) => {
      const el = byId(id);
      if (!el) return "";
      return clean(el.selectedOptions?.[0]?.textContent || el.value);
    };

    const logoSrc = q(".brand-mark")?.src || new URL("assets/illustration-studio-logo.svg", location.href).href;

    const startAge = clean(byId("startAge")?.value);
    const heroEndAge = idText("heroEndAge").match(/\d+/)?.[0] || "99";

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

    const assumptions = qa("#assumptions dl div").map((div) => ({
      label: clean(div.querySelector("dt")?.textContent),
      value: clean(div.querySelector("dd")?.textContent),
    })).filter((item) => item.label || item.value);

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
      return {
        title: strong.replace(/\.$/, ""),
        body,
      };
    });

    const chartLegend = qa("#chartLegend span").map((span) => clean(span.textContent)).filter(Boolean);

    const annualMode = q("#annualFullBtn")?.classList.contains("active")
      ? "All years"
      : "Milestones";

    return {
      generatedAt: new Date().toLocaleString("en-SG", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      logoSrc,
      heroKicker: `${idText("heroLabel") || "Projected wealth"} · ${idText("heroEndAge") || "age 99"}`,
      heroValue: idText("heroTotal"),
      heroCaption: idText("heroCaption"),
      endAge: heroEndAge,
      controls: [
        { label: "Variant", value: selectedText("variantKey") },
        { label: "Currency", value: selectedText("currency") },
        { label: "Payment mode", value: selectedText("paymentFrequency") },
        { label: "Annualised premium", value: byId("annualizedPremium")?.value ? `${selectedText("currency") === "USD" ? "US$" : "S$"}${Number(byId("annualizedPremium").value).toLocaleString("en-US")}` : "" },
        { label: "Start age", value: startAge },
      ],
      checks: {
        title: text("#checks strong"),
        body: text("#checks span"),
      },
      assumptions,
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
      return hasValue && hasTable && hasCanvas;
    }, { timeout: 20000 });

    if (args.fullTable) {
      await appPage.locator("#annualFullBtn").click({ timeout: 3000 }).catch(() => {});
      await appPage.waitForTimeout(500);
    }

    await appPage.waitForTimeout(500);

    const data = await extractData(appPage);
    const deckHtml = buildDeckHtml(data);

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
