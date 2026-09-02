/**
 * Records a YouTube-ready ToolGap walkthrough timed to the English narration.
 *
 * Target runtime: 2:40–2:48 (hard cut at 2:48). Silent picture — captions only.
 *
 *   BASE_URL=https://toolgap.netlify.app pnpm demo:video
 *
 * Output: $DEMO_OUT_DIR/toolgap-hackathon-demo.mp4 (default /tmp/toolgap-demo)
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

let BASE_URL = (process.env.BASE_URL ?? "https://toolgap.netlify.app").replace(/\/$/, "");
const OUT_DIR = process.env.DEMO_OUT_DIR ?? path.join(tmpdir(), "toolgap-demo");
const TARGET_SECONDS = 164;
const MAX_SECONDS = 168;
const VIEWPORT = { width: 1920, height: 1080 };
const CURSOR_STEPS = 22;

function resolvePlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return path.dirname(require.resolve("playwright/package.json"));
  } catch {
    /* continue */
  }
  const npxRoot = path.join(process.env.HOME ?? "", ".npm/_npx");
  if (existsSync(npxRoot)) {
    for (const dir of readdirSync(npxRoot)) {
      const candidate = path.join(npxRoot, dir, "node_modules", "playwright");
      if (existsSync(path.join(candidate, "index.js"))) return candidate;
    }
  }
  throw new Error("Playwright not found. Run: npx playwright --version");
}

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(resolvePlaywright(), "index.js"));

const startedAt = Date.now();
const elapsed = () => Number(((Date.now() - startedAt) / 1000).toFixed(1));
const log = (msg) => console.log(`[demo ${elapsed()}s] ${msg}`);

let recStartedAt = 0;
const recElapsed = () => (Date.now() - recStartedAt) / 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function holdUntil(seconds, label = "") {
  const remaining = seconds * 1000 - (Date.now() - recStartedAt);
  log(
    `holdUntil ${seconds.toFixed(1)}s ${label} (clock ${recElapsed().toFixed(1)}s, wait ${Math.max(0, remaining / 1000).toFixed(1)}s)`,
  );
  if (remaining > 40) await sleep(remaining);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}

function probeDuration(file) {
  return new Promise((resolve, reject) => {
    const probe = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ]);
    let out = "";
    probe.stdout.on("data", (d) => {
      out += d.toString();
    });
    probe.on("exit", (code) =>
      code === 0 ? resolve(Number(out.trim())) : reject(new Error("ffprobe failed")),
    );
  });
}

function installDemoHudInPage() {
  function mount() {
    if (document.getElementById("demo-hud-root")) return;
    const root = document.createElement("div");
    root.id = "demo-hud-root";
    root.innerHTML = [
      "<style>",
      "#demo-hud-root { pointer-events: none; }",
      "#demo-cursor { position: fixed; z-index: 2147483645; width: 22px; height: 22px; margin-left: -3px; margin-top: -2px; left: 40%; top: 40%;",
      "background: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'><path d='M3 2.2 3 17.4 7.4 13.2 10.6 20.2 13.1 19.1 9.8 12.1 16.2 12Z' fill='%231f1a14' stroke='%23fffaf3' stroke-width='1.4' stroke-linejoin='round'/></svg>\") no-repeat; }",
      "#demo-caption { position: fixed; left: 48px; right: 48px; bottom: 36px; z-index: 2147483644; display: flex; flex-direction: column; gap: 6px; padding: 16px 22px; border-radius: 16px; background: rgb(31 26 20 / 0.92); box-shadow: 0 18px 44px rgb(31 26 20 / 0.28); color: #fffaf3; font-family: var(--font-geist-sans), ui-sans-serif, system-ui; opacity: 0; transform: translateY(10px); transition: opacity 280ms cubic-bezier(0.16,1,0.3,1), transform 280ms cubic-bezier(0.16,1,0.3,1); }",
      "#demo-caption.visible { opacity: 1; transform: translateY(0); }",
      "#demo-kicker { font-family: ui-monospace, var(--font-geist-mono), monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #d9772f; }",
      "#demo-title { font-size: 22px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.2; }",
      "#demo-sub { font-size: 15px; color: #c6bba4; line-height: 1.35; }",
      "</style>",
      "<div id=\"demo-cursor\"></div>",
      "<div id=\"demo-caption\"><div id=\"demo-kicker\"></div><div id=\"demo-title\"></div><div id=\"demo-sub\"></div></div>",
    ].join("\n");
    document.documentElement.appendChild(root);
  }

  mount();
  const hideNext = document.getElementById("demo-hide-next") || document.createElement("style");
  hideNext.id = "demo-hide-next";
  hideNext.textContent =
    "nextjs-portal, [data-next-badge-root], [data-nextjs-toast] { display: none !important; }";
  document.documentElement.appendChild(hideNext);

  window.__demoSetCaption = (kicker, title, sub) => {
    mount();
    const box = document.getElementById("demo-caption");
    if (!box) return;
    document.getElementById("demo-kicker").textContent = kicker;
    document.getElementById("demo-title").textContent = title;
    const subEl = document.getElementById("demo-sub");
    subEl.textContent = sub || "";
    subEl.style.display = sub ? "block" : "none";
    box.classList.add("visible");
  };
  window.__demoHideCaption = () => {
    const box = document.getElementById("demo-caption");
    if (box) box.classList.remove("visible");
  };
  window.__demoMoveCursor = (x, y, down) => {
    mount();
    const el = document.getElementById("demo-cursor");
    if (!el) return;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.transform = down ? "scale(0.86)" : "scale(1)";
  };
}

async function installHud(page) {
  await page.evaluate(installDemoHudInPage);
}

async function caption(page, kicker, title, sub = "") {
  await installHud(page);
  await page.evaluate(
    ({ kicker, title, sub }) => window.__demoSetCaption(kicker, title, sub),
    { kicker, title, sub },
  );
}

async function hideCaption(page) {
  await page.evaluate(() => window.__demoHideCaption?.()).catch(() => {});
}

async function moveTo(page, locator, { steps = CURSOR_STEPS } = {}) {
  await locator.waitFor({ state: "visible", timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  await sleep(90);
  const box = await locator.boundingBox();
  if (!box) return null;
  const x = Math.round(box.x + Math.min(Math.max(box.width / 2, 12), 140));
  const y = Math.round(box.y + Math.min(Math.max(box.height / 2, 10), 18));
  await page.mouse.move(x, y, { steps });
  await installHud(page);
  await page.evaluate(({ x, y }) => window.__demoMoveCursor?.(x, y, false), { x, y });
  return { x, y };
}

async function click(page, locator) {
  const pos = await moveTo(page, locator);
  await sleep(140);
  if (pos) {
    await page.evaluate(({ x, y }) => window.__demoMoveCursor?.(x, y, true), pos);
  }
  await locator.click({ timeout: 15_000 });
  await sleep(80);
  if (pos) {
    await page.evaluate(({ x, y }) => window.__demoMoveCursor?.(x, y, false), pos);
  }
}

async function waitHeading(page, name, timeout = 25_000) {
  await page.getByRole("heading", { name }).first().waitFor({
    state: "visible",
    timeout,
  });
}

async function navDashboard(page, label) {
  const nav = page.getByRole("navigation", { name: "Dashboard" });
  await click(page, nav.getByRole("link", { name: label, exact: true }));
}

async function clickTab(page, label) {
  await click(page, page.getByRole("tab", { name: label, exact: true }));
}

async function clickWorkflowStep(page, label) {
  const nav = page.getByRole("navigation", { name: "Gap workflow" });
  await nav.waitFor({ timeout: 20_000 });
  await click(page, nav.getByRole("button", { name: new RegExp(label, "i") }));
}

async function scrollBy(page, dy) {
  await page.mouse.wheel(0, dy);
  await sleep(320);
}

async function openCompareGap(page) {
  await navDashboard(page, "Capabilities");
  await waitHeading(page, "Capability Gaps");
  await page
    .getByRole("link")
    .filter({ hasText: "Missing compare_products capability" })
    .first()
    .waitFor({ timeout: 20_000 });
  await click(
    page,
    page.getByRole("link").filter({ hasText: "Missing compare_products capability" }).first(),
  );
  await page.waitForURL("**/gaps/**");
  await page.getByRole("navigation", { name: "Gap workflow" }).waitFor();
}

async function showHeadphonesSession(page) {
  const links = page.getByRole("link", { name: /^Session / });
  await links.first().waitFor({ timeout: 15_000 });
  const n = await links.count();
  for (let i = 0; i < n; i++) {
    await click(page, links.nth(i));
    await page.waitForURL("**/sessions/**");
    const marker = page.getByText("hp-01", { exact: true });
    try {
      await marker.waitFor({ state: "visible", timeout: 2_500 });
      return true;
    } catch {
      await page.goBack({ waitUntil: "domcontentloaded" });
      await waitHeading(page, "You review the evidence");
    }
  }
  return false;
}

async function transcode(rawPath, mp4Path, { start = 0, duration = MAX_SECONDS } = {}) {
  const args = ["-y"];
  if (start > 0.05) args.push("-ss", start.toFixed(3));
  args.push("-i", rawPath, "-t", duration.toFixed(3));
  args.push(
    "-vf",
    "scale=1920:1080:flags=lanczos,fps=30",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "16",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    mp4Path,
  );
  await run("ffmpeg", args);
}

async function resolveLanding(page) {
  const preferred = BASE_URL;
  const candidates = [preferred];
  if (!candidates.includes("https://toolgap.netlify.app")) {
    candidates.push("https://toolgap.netlify.app");
  }
  if (!candidates.includes("http://localhost:3000")) {
    candidates.push("http://localhost:3000");
  }

  let lastError;
  for (const url of candidates) {
    try {
      log(`try landing ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page
        .getByRole("button", { name: /View demo with sample data/i })
        .waitFor({ state: "visible", timeout: 20_000 });
      BASE_URL = url.replace(/\/$/, "");
      log(`using ${BASE_URL}`);
      return;
    } catch (error) {
      lastError = error;
      log(`landing miss at ${url}: ${error?.message ?? error}`);
    }
  }
  throw lastError ?? new Error("Landing CTA not found");
}

async function record() {
  mkdirSync(OUT_DIR, { recursive: true });
  const videoDir = path.join(OUT_DIR, "raw");
  const profile = path.join(OUT_DIR, "chrome-profile");
  const stillsDir = path.join(OUT_DIR, "stills");
  rmSync(videoDir, { recursive: true, force: true });
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(videoDir, { recursive: true });
  mkdirSync(stillsDir, { recursive: true });

  const contextLaunchAt = Date.now();
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chrome",
    headless: false,
    viewport: VIEWPORT,
    screen: VIEWPORT,
    deviceScaleFactor: 1,
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--window-size=1920,1080",
      "--window-position=0,0",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-session-crashed-bubble",
      "--hide-crash-restore-bubble",
      "--disable-infobars",
      "--disable-gpu",
    ],
    recordVideo: { dir: videoDir, size: VIEWPORT },
    locale: "en-US",
    colorScheme: "light",
  });

  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(20_000);
  await page.addInitScript(installDemoHudInPage);

  const shot = async (name) => {
    await page.screenshot({
      path: path.join(stillsDir, `${name}.jpg`),
      type: "jpeg",
      quality: 92,
    });
  };

  try {
    await resolveLanding(page);
    await page.waitForSelector("h1", { timeout: 60_000 });
    await installHud(page);
    recStartedAt = Date.now();
    log("recording clock start (landing ready)");

    // Scene 1 — Hook | 0:00–0:18
    await caption(
      page,
      "01  Hook",
      "AI agents already shop on your site",
      "Ordinary analytics cannot reveal the capability they needed and could not find.",
    );
    await moveTo(page, page.getByRole("heading", { level: 1 }), { steps: 10 });
    await holdUntil(8, "first sentence, cursor still");

    const demoCta = page.getByRole("button", { name: /View demo with sample data/i });
    await caption(
      page,
      "01  Hook",
      "Each action becomes a typed tool call",
      "ToolGap watches those calls and identifies the capability your site is missing.",
    );
    await moveTo(page, demoCta, { steps: 36 });
    await holdUntil(16.2, "arrive at View demo");
    await click(page, demoCta);

    // Scene 2 — Agents using the store | 0:18–0:55
    await page.waitForURL("**/overview", { timeout: 90_000 });
    await waitHeading(page, "Overview", 90_000);
    await page
      .getByText("No agent activity yet")
      .waitFor({ state: "hidden", timeout: 60_000 })
      .catch(() => {});
    await caption(
      page,
      "02  Agents in the store",
      "We built ToolGap for site owners",
      "Capability intelligence for pages already used by AI agents.",
    );
    await shot("01-overview");
    await holdUntil(24, "populated overview");

    await caption(
      page,
      "02  Agents in the store",
      "This is Fieldkit Market",
      "WebMCP via navigator.modelContext.registerTool — not document.modelContext.registerTool.",
    );
    await click(page, page.getByRole("link", { name: "Open demo store" }));
    await page.waitForURL("**/store");
    await waitHeading(page, /Tools for making/);
    const webmcpBadge = page.getByText(/WebMCP/i).first();
    if (await webmcpBadge.isVisible().catch(() => false)) {
      await moveTo(page, webmcpBadge);
    }
    await sleep(1600);

    await click(page, page.getByRole("link", { name: "ToolGap", exact: true }));
    await page.waitForURL("**/overview");
    await waitHeading(page, "Overview");
    await navDashboard(page, "Traffic");
    await waitHeading(page, "Traffic");
    await clickTab(page, "Tools");
    await page.getByRole("link", { name: "search_products" }).waitFor({ timeout: 15_000 });
    await caption(
      page,
      "02  Agents in the store",
      "Six static tools, typed end to end",
      "search_products, get_product, get_availability, add_to_cart, get_cart, complete_checkout.",
    );
    for (const name of [
      "search_products",
      "get_product",
      "get_availability",
      "add_to_cart",
      "get_cart",
      "complete_checkout",
    ]) {
      await moveTo(page, page.getByRole("link", { name, exact: true }));
      await sleep(380);
    }
    await shot("02-tools");

    await clickTab(page, "Sessions");
    await page.locator("table a").first().waitFor({ timeout: 15_000 });
    await caption(
      page,
      "02  Agents in the store",
      "Every action has a name, parameters, and outcome",
      "Twenty-three sample agent sessions loaded through the same instrumented path.",
    );
    await click(page, page.locator("table a").first());
    await page.waitForURL("**/sessions/**");
    await page.getByText("Parameters").first().waitFor({ timeout: 15_000 });
    await click(page, page.getByText("Parameters").first());
    await sleep(1400);
    await scrollBy(page, 220);
    await sleep(700);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await waitHeading(page, "Traffic");
    const sessionTotal = page.getByText(/\d+ sessions/);
    if (await sessionTotal.first().isVisible().catch(() => false)) {
      await moveTo(page, sessionTotal.first());
    }
    await holdUntil(55, "end scene 2");

    // Scene 3 — The capability gap | 0:55–1:33
    await caption(
      page,
      "03  Capability gap",
      "Agents compared products by hand",
      "Repeated get_product calls because the site had no comparison tool.",
    );
    await openCompareGap(page);
    await clickWorkflowStep(page, "Evidence");
    await waitHeading(page, "You review the evidence");
    await caption(
      page,
      "03  Capability gap",
      "COMPARE → compare_products",
      "ToolGap maps the repeated get_product pattern to a named capability gap.",
    );
    const compareName = page.getByText("compare_products").first();
    if (await compareName.isVisible().catch(() => false)) {
      await moveTo(page, compareName);
    }
    const confidence = page.getByText(/confidence/i).first();
    if (await confidence.isVisible().catch(() => false)) {
      await moveTo(page, confidence);
      await sleep(900);
    }
    await shot("03-compare-gap");
    await scrollBy(page, 420);
    await sleep(700);
    const getProductPattern = page.getByText("get_product").first();
    if (await getProductPattern.isVisible().catch(() => false)) {
      await moveTo(page, getProductPattern);
      await sleep(800);
    }

    await caption(
      page,
      "03  Capability gap",
      "Evidence from the headphones path",
      "Supporting sessions reconstruct the exact repeated product calls.",
    );
    await showHeadphonesSession(page);
    await sleep(900);
    const getProductCalls = page.getByText("get_product").first();
    if (await getProductCalls.isVisible().catch(() => false)) {
      await moveTo(page, getProductCalls);
    }
    await scrollBy(page, 280);
    await sleep(600);
    const hp = page.getByText("hp-01").first();
    if (await hp.isVisible().catch(() => false)) {
      await moveTo(page, hp);
      await sleep(700);
    }
    await scrollBy(page, 240);
    await sleep(500);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await waitHeading(page, "You review the evidence");
    const supporting = page.getByText(/supporting journeys/i).first();
    if (await supporting.isVisible().catch(() => false)) {
      await moveTo(page, supporting);
      await sleep(900);
    }

    await navDashboard(page, "Capabilities");
    await waitHeading(page, "Capability Gaps");
    await caption(
      page,
      "03  Capability gap",
      "Unsafe gaps stay observational",
      "When a gap cannot be automated safely, ToolGap reports it instead of guessing.",
    );
    const observational = page.getByText("Observational").first();
    if (await observational.isVisible().catch(() => false)) {
      await observational.scrollIntoViewIfNeeded();
      await moveTo(page, observational);
      await sleep(1400);
    }
    await holdUntil(93, "end scene 3");

    // Scene 4 — Publish and measure | 1:33–2:25
    await caption(
      page,
      "04  Publish",
      "A human builds the recommendation",
      "Safe, read-only template. Agents cannot publish.",
    );
    await openCompareGap(page);
    await clickWorkflowStep(page, "Evidence");
    await waitHeading(page, "You review the evidence");
    await click(page, page.getByRole("button", { name: "Build recommendation" }));
    await waitHeading(page, "You shape the capability");
    await page.getByRole("heading", { name: "compare_products" }).waitFor({ timeout: 15_000 });
    await moveTo(page, page.getByRole("heading", { name: "compare_products" }));
    await sleep(1200);
    const readOnlyHint = page.getByText(/read-only/i).first();
    if (await readOnlyHint.isVisible().catch(() => false)) {
      await moveTo(page, readOnlyHint);
      await sleep(900);
    }

    await caption(
      page,
      "04  Publish",
      "Simulate against recorded journeys",
      "Review the projected change, then a human approves.",
    );
    await click(page, page.getByRole("button", { name: "Run simulation" }));
    await waitHeading(page, "You compare the journeys");
    await sleep(2200);
    await shot("04-simulation");

    await click(page, page.getByRole("button", { name: "Approve for publish" }));
    await waitHeading(page, "You publish the fix");
    await caption(
      page,
      "04  Publish",
      "No deploy. No API gateway change.",
      "Publishing registers compare_products through navigator.modelContext.registerTool, in this tab.",
    );
    await sleep(1400);
    await click(page, page.getByRole("button", { name: "Confirm publish" }));
    await page.getByText(/Published compare_products/i).waitFor({ timeout: 20_000 });
    await sleep(1500);
    await shot("05-published-state");

    await caption(
      page,
      "04  Publish",
      "Back on Fieldkit Market",
      "compare_products is now available to the next agent.",
    );
    await click(page, page.getByRole("link", { name: "Open demo store" }));
    await page.waitForURL("**/store");
    await waitHeading(page, /Tools for making/);
    const liveBadge = page.getByText(/WebMCP/i).first();
    if (await liveBadge.isVisible().catch(() => false)) {
      await moveTo(page, liveBadge);
    }
    await sleep(1600);

    await click(page, page.getByRole("link", { name: "ToolGap", exact: true }));
    await page.waitForURL("**/overview");
    await waitHeading(page, "Overview");
    await navDashboard(page, "Published");
    await waitHeading(page, "Published Capabilities");
    await click(page, page.getByRole("button", { name: "Load post-publish traffic" }));
    await page.getByText(/Post-publish traffic loaded/i).waitFor({ timeout: 40_000 });
    await sleep(400);
    await click(page, page.getByRole("button", { name: "Compute before/after" }));
    await page.getByText(/avg calls/i).first().waitFor({ timeout: 20_000 });
    await caption(
      page,
      "04  Publish",
      "Published view: the complete loop",
      "Fewer tool calls, shorter journeys, higher completion.",
    );
    const before = page.getByText("Before (measured)").first();
    if (await before.isVisible().catch(() => false)) await moveTo(page, before);
    await sleep(800);
    const after = page.getByText("After (measured)").first();
    if (await after.isVisible().catch(() => false)) await moveTo(page, after);
    await sleep(800);
    const completion = page.getByText(/After completion/i).first();
    if (await completion.isVisible().catch(() => false)) await moveTo(page, completion);
    await sleep(1000);
    await shot("06-before-after");

    if (recElapsed() < 138) {
      await navDashboard(page, "Traffic");
      await waitHeading(page, "Traffic");
      await clickTab(page, "Tools");
      const compareLink = page.getByRole("link", { name: "compare_products", exact: true });
      if (await compareLink.isVisible().catch(() => false)) {
        await moveTo(page, compareLink);
        await sleep(1400);
      }
    }
    await holdUntil(145, "end scene 4");

    // Scene 5 — Close | 2:25–2:47
    await caption(
      page,
      "05  Close",
      "That is the loop",
      "WebMCP telemetry reveals where agents struggle. ToolGap names the missing tool.",
    );
    await navDashboard(page, "Overview");
    await waitHeading(page, "Overview");
    await sleep(900);
    const spark = page.getByText("sessions observed").first();
    if (await spark.isVisible().catch(() => false)) await moveTo(page, spark);
    await sleep(1200);
    await scrollBy(page, 240);
    await holdUntil(155, "overview hold");

    await caption(
      page,
      "05  Close",
      "Your website learns what agents need next.",
      "Then WebMCP publishes the approved fix in seconds.",
    );
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 30_000 });
    await installHud(page);
    await caption(
      page,
      "05  Close",
      "Your website learns what agents need next.",
      "ToolGap: capability intelligence for WebMCP.",
    );
    await moveTo(page, page.getByRole("heading", { level: 1 }), { steps: 18 });
    await shot("07-landing-close");
    await holdUntil(164, "final sentence");
    await hideCaption(page);
    await holdUntil(167.2, "end on tagline, hard cut by 2:48");
  } catch (error) {
    const failShot = path.join(OUT_DIR, "demo-failure.png");
    await page.screenshot({ path: failShot, fullPage: true }).catch(() => {});
    writeFileSync(path.join(OUT_DIR, "demo-failure.txt"), String(error?.stack || error));
    log(`FAILED, screenshot ${failShot}`);
    throw error;
  } finally {
    log("closing browser");
    await context.close();
  }

  const videos = readdirSync(videoDir).filter((f) => f.endsWith(".webm"));
  if (videos.length === 0) throw new Error("No webm recorded");
  const rawPath = path.join(videoDir, videos.sort()[0]);
  const mp4Path = path.join(OUT_DIR, "toolgap-hackathon-demo.mp4");
  const preRoll = Math.max(0, (recStartedAt - contextLaunchAt) / 1000 - 0.15);
  log(`transcode ${rawPath} preRoll=${preRoll.toFixed(2)}s`);
  await transcode(rawPath, mp4Path, { start: preRoll, duration: MAX_SECONDS });
  const duration = await probeDuration(mp4Path);
  log(`encoded duration ${duration.toFixed(1)}s (target ${TARGET_SECONDS}–${MAX_SECONDS})`);
  writeFileSync(
    path.join(OUT_DIR, "demo-meta.json"),
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        duration,
        preRoll,
        recElapsed: recElapsed(),
        target: [TARGET_SECONDS, MAX_SECONDS],
      },
      null,
      2,
    ),
  );
  return mp4Path;
}

const out = await record();
log(`WROTE ${out}`);
