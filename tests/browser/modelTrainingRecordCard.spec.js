import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SCREENSHOT_DIRECTORY = resolve(ROOT, "test-output/model-training-record-card");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

async function startStaticServer(t) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const relative = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = resolve(ROOT, `.${decodeURIComponent(relative)}`);
    if (!filePath.startsWith(`${ROOT}${sep}`)) {
      response.writeHead(404).end();
      return;
    }
    try {
      if (!(await stat(filePath)).isFile()) throw new Error("not a file");
      response.writeHead(200, { "content-type": CONTENT_TYPES[extname(filePath)] || "application/octet-stream" });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

async function launchBrowserOrSkip(t) {
  try {
    return await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE } : {})
    });
  } catch (error) {
    t.skip(`Playwright browser executable is unavailable locally: ${error.message.split("\n")[0]}`);
    return null;
  }
}

function captureBrowserProblems(page, problems) {
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
}

async function getRectangles(page) {
  return page.evaluate(() => {
    const rectangle = (selector) => {
      const value = document.querySelector(selector)?.getBoundingClientRect();
      return value && { x: value.x, width: value.width, right: value.right };
    };
    return {
      card: rectangle("#model-training-record"),
      workspace: rectangle("#experiment-workspace"),
      advanced: rectangle("#advanced-research-tools"),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
    };
  });
}

function assertAlignedLayout(layout) {
  assert.ok(layout.card && layout.workspace && layout.advanced, "training card and adjacent sections must render");
  assert.equal(layout.card.x, layout.workspace.x, "training card must share the workspace left edge");
  assert.equal(layout.card.width, layout.workspace.width, "training card must share the workspace outer width");
  assert.equal(layout.card.x, layout.advanced.x, "training card must share the advanced-tools left edge");
  assert.equal(layout.card.width, layout.advanced.width, "training card must share the advanced-tools outer width");
  assert.equal(layout.horizontalOverflow, false, "training history must not cause horizontal overflow");
}

test("training record outer card exactly aligns with surrounding app sections at desktop width", async (t) => {
  const origin = await startStaticServer(t);
  const browser = await launchBrowserOrSkip(t);
  if (!browser) return;
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const messages = [];
  captureBrowserProblems(page, messages);

  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  const layout = await getRectangles(page);

  assertAlignedLayout(layout);
  await assert.doesNotReject(page.locator("#model-training-record-content").getByText("Training record unavailable.").waitFor());
  assert.deepEqual(messages, [], "production unavailable page must have a clean browser console");
});

test("cryptographically verified training history is accessible, aligned, and visually safe at desktop and mobile", async (t) => {
  const origin = await startStaticServer(t);
  const browser = await launchBrowserOrSkip(t);
  if (!browser) return;
  t.after(() => browser.close());
  await mkdir(SCREENSHOT_DIRECTORY, { recursive: true });

  for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
    const page = await browser.newPage({ viewport });
    const problems = [];
    captureBrowserProblems(page, problems);
    await page.goto(`${origin}/tests/browser/modelTrainingRecordCardHarness.html`, { waitUntil: "networkidle" });
    await page.locator("html[data-training-record-fixture=verified]").waitFor();
    assertAlignedLayout(await getRectangles(page));

    const rows = page.locator("details.model-training-record-row");
    assert.equal(await rows.count(), 2, "validated fixture must render both immutable records");
    assert.equal(await rows.evaluateAll((elements) => elements.every((element) => !element.open)), true, "records must be collapsed by default");
    const firstSummary = rows.nth(0).locator("summary");
    const secondSummary = rows.nth(1).locator("summary");
    await firstSummary.press("Space");
    assert.equal(await rows.nth(0).evaluate((element) => element.open), true, "Space must open the first native details row");
    await secondSummary.press("Enter");
    assert.equal(await rows.nth(0).evaluate((element) => element.open), false, "opening another row must close the first row");
    assert.equal(await rows.nth(1).evaluate((element) => element.open), true, "Enter must open the second native details row");

    const card = page.locator("#model-training-record");
    const cardText = await card.innerText();
    for (const text of [
      "Candidate did not pass; model knowledge and falsification results were retained.",
      "Publications",
      "Method",
      "Retained knowledge",
      "Modeling constraints",
      "Rejection reasons",
      "Uncertainty",
      "Limitations",
      "Missing mechanisms",
      "Architecture implications",
      "Formal model change",
      "The formal model was not changed."
    ]) assert.match(cardText, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(cardText, /98 observations/);
    assert.match(cardText, /70 observations/);
    assert.doesNotMatch(cardText, /formula|coefficient|candidate parameter|delete|approve|edit/i);
    assert.equal(await card.locator("button, input, select, textarea").count(), 0, "record card must remain read-only");
    const doiLinks = await card.locator("a").evaluateAll((links) => links.map((link) => ({ href: link.href, target: link.target, rel: link.rel, text: link.textContent })));
    assert.equal(doiLinks.length, 5, "all fixture DOI occurrences must render as links");
    for (const link of doiLinks) {
      assert.match(link.href, /^https:\/\/doi\.org\/10\.\d{4,9}\//i);
      assert.equal(link.target, "_blank");
      assert.match(link.rel, /noopener/);
      assert.match(link.rel, /noreferrer/);
      assert.doesNotMatch(link.text || "", /[<>]/);
    }
    await page.screenshot({ path: resolve(SCREENSHOT_DIRECTORY, `${name}.png`), fullPage: true });
    assert.deepEqual(problems, [], `${name} populated history must have a clean browser console`);
    await page.close();
  }
});
