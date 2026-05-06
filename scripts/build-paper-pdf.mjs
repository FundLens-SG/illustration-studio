#!/usr/bin/env node

/**
 * Build the canonical 6-page Illustration Studio paper deck as a PDF.
 *
 * The deck-builder logic lives in `assets/paper-deck.js`, which is
 * loaded by `illustration-studio.html` itself. So this script only has
 * to:
 *   1. Spin up a static server pointed at the project root.
 *   2. Open the live app in Playwright and wait for the simulator to
 *      compute (heroTotal !== 0, annual table populated, snapshot
 *      function exposed).
 *   3. Optionally toggle "All years" if --full-table is passed.
 *   4. In the live app's browser context, call
 *        window.IllustrationStudioPaperDeck.buildHtml(
 *          window.IllustrationStudioPaperDeck.extractDomData(),
 *          window.IllustrationStudioPrint.getSnapshot()
 *        )
 *      to get the deck HTML — same code path the in-app Print button
 *      uses, no duplication.
 *   5. Render that HTML in a fresh page and `pdf({ landscape: true })`
 *      it to disk.
 */

import { chromium } from "playwright";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_ENTRY = "illustration-studio.html";
const DEFAULT_OUT = path.join(ROOT, "Illustration Studio - Paper Printout.pdf");

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

    // Wait for: simulator computed (hero ≠ 0), annual table rendered,
    // chart canvas drawn, both paper-deck and print-snapshot APIs live.
    await appPage.waitForFunction(() => {
      const hero = document.getElementById("heroTotal")?.textContent?.trim();
      const hasValue = hero && !/^S\$0|^US\$0/.test(hero);
      const hasTable = document.querySelector("#annualTable tbody tr");
      const hasCanvas = document.getElementById("valueChart");
      const deckReady = window.IllustrationStudioPaperDeck
        && typeof window.IllustrationStudioPaperDeck.buildHtml === "function"
        && typeof window.IllustrationStudioPaperDeck.extractDomData === "function";
      const snapReady = window.IllustrationStudioPrint
        && typeof window.IllustrationStudioPrint.getSnapshot === "function"
        && window.IllustrationStudioPrint.getSnapshot();
      return hasValue && hasTable && hasCanvas && deckReady && snapReady;
    }, { timeout: 25000 });

    if (args.fullTable) {
      await appPage.locator("#annualFullBtn").click({ timeout: 3000 }).catch(() => {});
      await appPage.waitForTimeout(500);
    }

    await appPage.waitForTimeout(300);

    // Build the deck HTML in the live page's context — same code path the
    // in-app Print button uses. The shared builder also injects an
    // auto-print script into the deck, but we strip that here since the
    // Playwright page does its own pdf() rendering.
    const deckHtml = await appPage.evaluate(() => {
      const data = window.IllustrationStudioPaperDeck.extractDomData();
      const snapshot = window.IllustrationStudioPrint.getSnapshot();
      const html = window.IllustrationStudioPaperDeck.buildHtml(data, snapshot);
      // Remove the auto-print bootstrap so the deckPage doesn't trigger
      // a print dialog inside Playwright. Playwright's pdf() handles output.
      return html.replace(/<script>[\s\S]*?<\/script>\s*<\/body>/, "</body>");
    });

    const deckPage = await browser.newPage({
      viewport: { width: 1500, height: 1060 },
      deviceScaleFactor: 1,
    });
    await deckPage.setContent(deckHtml, { waitUntil: "load" });
    await deckPage.waitForFunction(
      () => Array.from(document.images).every((img) => img.complete),
      { timeout: 8000 }
    ).catch(() => {});
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
