import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const browser = await chromium.launch();
const page = await browser.newPage();

const filePath = path.resolve('illustration-studio.html');
const fileUrl = pathToFileURL(filePath).href;
await page.goto(fileUrl);
await page.waitForLoadState('networkidle');

// Switch to SI variant
await page.selectOption('#variantKey', 'SI3_SP');
await page.waitForTimeout(500);

// Confirm SI section is showing
const siVisible = await page.evaluate(() => {
  const el = document.getElementById('siCalculator');
  return el && !el.hidden && el.offsetWidth > 0;
});
console.log('SI calculator visible on screen:', siVisible);

// Emulate print and render to PDF
await page.emulateMedia({ media: 'print' });

const pdfPath = path.resolve('si-print-smoketest.pdf');
await page.pdf({
  path: pdfPath,
  format: 'A4',
  landscape: true,
  margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
  printBackground: true,
});
console.log('PDF saved to:', pdfPath);

// Visibility checks in print media context
const checks = await page.evaluate(() => {
  const get = (sel) => document.querySelector(sel);
  const visibleH = (el) => el ? el.getBoundingClientRect().height > 5 : false;
  return {
    topbar:       visibleH(get('.topbar')),
    controls:     visibleH(get('.controls')),
    siCalc:       visibleH(get('#siCalculator')),
    siDbBanner:   visibleH(get('#siDeathBenefitBanner')),
    siInputs:     visibleH(get('.si-inputs-card')),
    siSummary:    visibleH(get('#siSummaryCard')),
    siTable:      visibleH(get('#siProjectionTable')),
    siTableHeaderCount: get('#siProjectionTable thead tr')?.children.length || 0,
    siTableBodyRows: get('#siProjectionBody')?.children.length || 0,
  };
});
console.log('Print-media visibility:', JSON.stringify(checks, null, 2));

await browser.close();
