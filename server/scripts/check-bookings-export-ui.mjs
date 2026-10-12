// Real browser regression check with synthetic data; never touches bookings.
// Run after npm run build and Playwright browser installation.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { renderCalendarSnapshot } from "../dist/integrations/bookings/images.js";
import { imageWidgetHtml } from "../dist/integrations/bookings/widget.js";

const snapshot = { venue: { id: "test", name: "Fusion test", timezone: "Asia/Kolkata" }, startDate: "2026-10-01", endDate: "2026-10-31", audience: "public", bookings: [], generatedAt: new Date().toISOString() };
const png = await renderCalendarSnapshot(snapshot);
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "image/png", "Content-Disposition": req.url.includes("download=1") ? 'attachment; filename="calendar.png"' : 'inline; filename="calendar.png"' });
  res.end(png);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = `${origin}/api/integrations/bookings/files/${"a".repeat(32)}/image-calendar.png?token=test`;
const output = { ...snapshot, summary: { totalBookings: 0, hoursBooked: 0 }, image: { url, downloadUrl: url + "&download=1", expiresAt: new Date(Date.now() + 86400000).toISOString() } };
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.BOOKINGS_CHROMIUM_EXECUTABLE || undefined });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setContent('<iframe id="viewer"></iframe>');
  await page.locator("#viewer").evaluate((frame, html) => { frame.srcdoc = html; }, imageWidgetHtml(origin));
  const frame = page.frames().find(candidate => candidate.parentFrame());
  await frame.waitForSelector("#status");
  const send = data => page.evaluate(data => document.querySelector("#viewer").contentWindow.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { structuredContent: data } }, "*"), data);
  await send(output);
  await frame.waitForFunction(() => !document.querySelector("#image").hidden && document.querySelector("#image").naturalWidth === 1600);
  assert.equal(await frame.locator("#download").getAttribute("href"), output.image.downloadUrl);
  assert.match(await frame.locator("#expiry").textContent(), /Download available until/);
  const response = await fetch(output.image.downloadUrl);
  assert.match(response.headers.get("content-disposition"), /^attachment;/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  // A host-provided navigation and tool bridge must be used on user clicks.
  await frame.evaluate(newOutput => {
    window.openai = {
      openExternal: ({ href }) => { window.openedUrl = href; },
      callTool: async (name, args) => { window.refreshRequest = { name, args }; return newOutput; },
    };
  }, { ...output, image: { ...output.image, url: url + "&fresh=1" } });
  await frame.locator("#download").click();
  assert.equal(await frame.evaluate(() => window.openedUrl), output.image.downloadUrl);
  await frame.locator("#refresh").click();
  await frame.waitForFunction(() => document.querySelector("#image").src.endsWith("&fresh=1") && !document.querySelector("#refresh").disabled);
  assert.deepEqual(await frame.evaluate(() => window.refreshRequest), { name: "get_calendar", args: { venueId: "test", startDate: snapshot.startDate, endDate: snapshot.endDate, audience: "public" } });
  // Reject URLs outside the plugin and messages from non-parent sources.
  await send({ ...output, image: { ...output.image, url: "https://other.example/calendar.png" } });
  assert.match(await frame.locator("#image").getAttribute("src"), /fresh=1$/);
  await frame.evaluate(data => window.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { structuredContent: data } }, "*"), output);
  assert.match(await frame.locator("#image").getAttribute("src"), /fresh=1$/);
  assert.deepEqual(errors, []);
  console.log("PASS: actual PNG render, viewer display, explicit download, host navigation, refresh and untrusted message/URL rejection.");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
