import { chromium } from "playwright";

const SHOTS = "/tmp/fraudlens-shots";
const BASE = "http://localhost:3000";
import { mkdirSync } from "node:fs";
mkdirSync(SHOTS, { recursive: true });

const targets = [
  { name: "01-case-queue", path: "/" },
  { name: "02-case-detail-hero", path: "/case/C-2026-0042" },
  { name: "03-provider-dashboard-villain", path: "/providers/P-001" },
  { name: "04-providers-list", path: "/providers" },
];

// Use the system Google Chrome so we don't wait on a browser download.
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

for (const t of targets) {
  await page.goto(`${BASE}${t.path}`, { waitUntil: "networkidle", timeout: 30000 });
  if (t.path.includes("/case/")) await page.waitForTimeout(4500);
  else await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/${t.name}.png`, fullPage: false });
  console.log("shot:", t.name);
}

await browser.close();
console.log("done");
