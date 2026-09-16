import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
mkdirSync("/tmp/fraudlens-shots", { recursive: true });
const BASE = "http://localhost:3939";
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const targets = [
  { name: "01-case-queue", path: "/", wait: 1200 },
  { name: "02-case-detail", path: "/case/C-2026-0042", wait: 4500 },
  { name: "03-providers", path: "/providers", wait: 1200 },
  { name: "04-tour", path: "/tour", wait: 1200 },
];
for (const t of targets) {
  await page.goto(`${BASE}${t.path}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(t.wait);
  await page.screenshot({ path: `/tmp/fraudlens-shots/${t.name}.png`, fullPage: false });
  console.log("shot:", t.name);
}
await browser.close();
console.log("done");
