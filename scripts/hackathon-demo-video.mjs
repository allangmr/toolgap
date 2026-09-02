/**
 * Records a YouTube-ready ToolGap walkthrough (max 2:30).
 *
 * Usage (dev server already running):
 *   BASE_URL=http://localhost:3000 node scripts/hackathon-demo-video.mjs
 *
 * Playwright is resolved from a local install or the npx cache.
 * Output: $DEMO_OUT_DIR/toolgap-hackathon-demo.mp4 (default /tmp/toolgap-demo)
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = process.env.DEMO_OUT_DIR ?? path.join(tmpdir(), "toolgap-demo");
const MAX_SECONDS = 150;
const VIEWPORT = { width: 1920, height: 1080 };

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

const { chromium } = await import(
  pathToFileURL(path.join(resolvePlaywright(), "index.js")).href
);

const startedAt = Date.now();
const elapsed = () => Number(((Date.now() - startedAt) / 1000).toFixed(1));
const log = (msg) => console.log(`[demo ${elapsed()}s] ${msg}`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}

const HUD_INIT = `(() => {
  if (window.__demoHudReady) return;
  window.__demoHudReady = true;

  function mount() {
    if (document.getElementById("demo-hud-root")) return;
    const root = document.createElement("div");
    root.id = "demo-hud-root";
    root.innerHTML = \`
      <style>
        #demo-hud-root { pointer-events: none; }
        #demo-cursor {
          position: fixed; z-index: 2147483645; width: 22px; height: 22px;
          margin-left: -3px; margin-top: -2px; left: 40%; top: 40%;
          background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'><path d='M3 2.2 3 17.4 7.4 13.2 10.6 20.2 13.1 19.1 9.8 12.1 16.2 12Z' fill='%231f1a14' stroke='%23fffaf3' stroke-width='1.4' stroke-linejoin='round'/></svg>") no-repeat;
        }
        #demo-caption {
          position: fixed; left: 48px; right: 48px; bottom: 36px; z-index: 2147483644;
          display: flex; flex-direction: column; gap: 6px;
          padding: 16px 22px;
          border-radius: 16px;
          background: rgb(31 26 20 / 0.92);
          box-shadow: 0 18px 44px rgb(31 26 20 / 0.28);
          color: #fffaf3; font-family: var(--font-geist-sans), ui-sans-serif, system-ui;
          opacity: 0; transform: translateY(10px);
          transition: opacity 280ms cubic-bezier(0.16,1,0.3,1), transform 280ms cubic-bezier(0.16,1,0.3,1);
        }
        #demo-caption.visible { opacity: 1; transform: translateY(0); }
        #demo-kicker {
          font-family: ui-monospace, var(--font-geist-mono), monospace;
          font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
          color: #d9772f;
        }
        #demo-title { font-size: 22px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.2; }
        #demo-sub { font-size: 15px; color: #c6bba4; line-height: 1.35; }
        #demo-intro {
          position: fixed; inset: 0; z-index: 2147483646;
          display: flex; flex-direction: column; justify-content: flex-end;
          padding: 72px 80px;
          background:
            radial-gradient(circle at 80% 0%, rgb(217 119 47 / 0.28), transparent 42%),
            linear-gradient(180deg, #2a2218 0%, #1a1611 100%);
          color: #fffaf3; font-family: var(--font-geist-sans), ui-sans-serif, system-ui;
          opacity: 1; transition: opacity 700ms cubic-bezier(0.16,1,0.3,1);
        }
        #demo-intro .brand {
          font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase;
          color: #d9772f; font-family: ui-monospace, monospace;
        }
        #demo-intro h1 {
          margin: 14px 0 0; font-size: 64px; font-weight: 600;
          letter-spacing: -0.04em; line-height: 0.95; max-width: 16ch;
        }
        #demo-intro p { margin: 18px 0 0; font-size: 22px; color: #c6bba4; max-width: 44ch; }
      </style>
      <div id="demo-cursor"></div>
      <div id="demo-caption">
        <div id="demo-kicker"></div>
        <div id="demo-title"></div>
        <div id="demo-sub"></div>
      </div>
    \`;
    document.documentElement.appendChild(root);
  }

  mount();
  const obs = new MutationObserver(mount);
  obs.observe(document.documentElement, { childList: true });

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
    document.getElementById("demo-caption")?.classList.remove("visible");
  };
  window.__demoMoveCursor = (x, y, down) => {
    mount();
    const el = document.getElementById("demo-cursor");
    if (!el) return;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.transform = down ? "scale(0.86)" : "scale(1)";
  };
  window.__demoShowIntro = (kind) => {
    document.getElementById("demo-intro")?.remove();
    const intro = document.createElement("div");
    intro.id = "demo-intro";
    intro.innerHTML = kind === "outro"
      ? \`<div class="brand">ToolGap</div>
         <h1>El nuevo flujo ya está vivo.</h1>
         <p>Agentes revelan el gap. Humanos aprueban. WebMCP publica. toolgap.netlify.app</p>\`
      : \`<div class="brand">Hackathon demo · WebMCP</div>
         <h1>Your website learns what agents need next.</h1>
         <p>ToolGap observa al agente, tú revisas el flujo, y publicas la capability que faltaba.</p>\`;
    document.documentElement.appendChild(intro);
  };
  window.__demoHideIntro = () => {
    const intro = document.getElementById("demo-intro");
    if (!intro) return;
    intro.style.opacity = "0";
    setTimeout(() => intro.remove(), 720);
  };
})()`;

async function installHud(page) {
  await page.evaluate(HUD_INIT);
}

async function caption(page, kicker, title, sub = "") {
  await installHud(page);
  await page.evaluate(
    ({ kicker, title, sub }) => window.__demoSetCaption(kicker, title, sub),
    { kicker, title, sub },
  );
}

async function moveTo(page, locator, { steps = 14 } = {}) {
  await locator.waitFor({ state: "visible", timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  await sleep(80);
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
  await sleep(120);
  if (pos) {
    await page.evaluate(
      ({ x, y }) => window.__demoMoveCursor?.(x, y, true),
      pos,
    );
  }
  await locator.click({ timeout: 15_000 });
  await sleep(60);
  if (pos) {
    await page.evaluate(
      ({ x, y }) => window.__demoMoveCursor?.(x, y, false),
      pos,
    );
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

async function scrollBy(page, dy) {
  await page.mouse.wheel(0, dy);
  await sleep(280);
}

async function transcode(rawPath, mp4Path) {
  await run("ffmpeg", [
    "-y",
    "-i",
    rawPath,
    "-vf",
    "scale=1920:1080:flags=lanczos,fps=30",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    mp4Path,
  ]);
}

async function maybeSpeedToCap(mp4Path) {
  const probe = spawn("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    mp4Path,
  ]);
  let out = "";
  probe.stdout.on("data", (d) => {
    out += d.toString();
  });
  await new Promise((resolve, reject) => {
    probe.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("ffprobe failed"))));
  });
  const duration = Number(out.trim());
  log(`encoded duration ${duration.toFixed(1)}s`);
  if (!Number.isFinite(duration) || duration <= MAX_SECONDS) return duration;
  const factor = MAX_SECONDS / duration;
  const sped = mp4Path.replace(/\.mp4$/, "-capped.mp4");
  await run("ffmpeg", [
    "-y",
    "-i",
    mp4Path,
    "-filter:v",
    `setpts=${factor.toFixed(4)}*PTS`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    sped,
  ]);
  rmSync(mp4Path);
  await run("mv", [sped, mp4Path]);
  log(`sped up by factor ${factor.toFixed(3)} to fit ${MAX_SECONDS}s`);
  return MAX_SECONDS;
}

async function record() {
  mkdirSync(OUT_DIR, { recursive: true });
  const videoDir = path.join(OUT_DIR, "raw");
  const profile = path.join(OUT_DIR, "chrome-profile");
  rmSync(videoDir, { recursive: true, force: true });
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(videoDir, { recursive: true });

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
    ],
    recordVideo: { dir: videoDir, size: VIEWPORT },
    locale: "en-US",
    colorScheme: "light",
  });

  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(20_000);
  await page.addInitScript(HUD_INIT);

  try {
    log("open landing");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 60_000 });
    await installHud(page);
    await page.evaluate(() => window.__demoShowIntro("intro"));
    await sleep(3800);
    await page.evaluate(() => window.__demoHideIntro());
    await sleep(700);

    await caption(
      page,
      "01  Dashboard",
      "Del landing al dashboard de ToolGap",
      "Cargamos 23 sesiones de agentes por el mismo canal WebMCP.",
    );
    await sleep(900);
    await click(page, page.getByRole("button", { name: /View demo with sample data/i }));
    await page.waitForURL("**/overview", { timeout: 60_000 });
    await waitHeading(page, "Overview", 60_000);
    await page
      .getByText("No agent activity yet")
      .waitFor({ state: "hidden", timeout: 30_000 })
      .catch(() => {});
    await caption(
      page,
      "01  Dashboard",
      "El dashboard ya tiene telemetría real",
      "Sesiones, journeys y friction reconstruidos desde tool calls.",
    );
    await sleep(1800);
    await scrollBy(page, 380);
    await sleep(1000);

    await caption(
      page,
      "02  El agente lee la página",
      "Fieldkit Market es lo que el agente ve",
      "Cada acción es un tool call tipado: search, get_product, availability.",
    );
    await click(page, page.getByRole("link", { name: "Open demo store" }));
    await page.waitForURL("**/store");
    await waitHeading(page, /Tools for making/);
    await sleep(900);

    await click(page, page.getByPlaceholder(/headphones/i));
    await page.getByPlaceholder(/headphones/i).fill("");
    await page.getByPlaceholder(/headphones/i).pressSequentially("headphones", { delay: 26 });
    await click(page, page.getByRole("button", { name: "Search", exact: true }));
    await page.getByRole("heading", { name: "Auralis Pulse ANC" }).waitFor();
    await sleep(500);
    await click(page, page.getByRole("link", { name: "Auralis Pulse ANC" }));
    await page.waitForURL("**/store/products/**");
    await caption(
      page,
      "02  El agente lee la página",
      "get_product: Auralis Pulse ANC",
      "El agente inspecciona specs una a una porque no hay compare.",
    );
    await sleep(1500);
    await click(page, page.getByRole("link", { name: "← Catalog" }));
    await click(page, page.getByRole("link", { name: "Soundform Drift" }));
    await caption(
      page,
      "02  El agente lee la página",
      "get_product otra vez, y otra",
      "search_products → get_product ×3 → get_availability ×3.",
    );
    await sleep(1200);
    await click(page, page.getByRole("link", { name: "← Catalog" }));
    await click(page, page.getByRole("link", { name: "EchoPeak Studio Pro" }));
    await sleep(1100);

    await caption(
      page,
      "03  Revisión humana",
      "Ahora comparas el flujo que el agente ejecutó",
      "ToolGap reconstruye el journey y nombra la capability que falta.",
    );
    await click(page, page.getByRole("link", { name: "ToolGap", exact: true }));
    await page.waitForURL("**/overview");
    await waitHeading(page, "Overview");
    await navDashboard(page, "Traffic");
    await waitHeading(page, "Traffic");
    await clickTab(page, "Journeys");
    await page.getByText("get_product").first().waitFor({ timeout: 15_000 });
    await sleep(1600);

    await caption(
      page,
      "03  Revisión humana",
      "El gap: falta compare_products",
      "Varios agentes compararon a mano. Eso ya es evidencia.",
    );
    await navDashboard(page, "Capabilities");
    await waitHeading(page, "Capability Gaps");
    await sleep(800);
    await click(
      page,
      page.getByRole("link").filter({ hasText: "Missing compare_products capability" }).first(),
    );
    await page.waitForURL("**/gaps/**");
    await page.getByRole("navigation", { name: "Gap workflow" }).waitFor();
    const evidenceStep = page
      .getByRole("navigation", { name: "Gap workflow" })
      .getByRole("button", { name: /Evidence/ });
    await click(page, evidenceStep);
    await waitHeading(page, "You review the evidence");
    await sleep(1400);
    await scrollBy(page, 420);
    await sleep(900);

    const sessionLink = page.getByRole("link", { name: /^Session / }).first();
    await click(page, sessionLink);
    await page.waitForURL("**/sessions/**");
    await caption(
      page,
      "03  Revisión humana",
      "Timeline del agente: el desvío de comparación",
      "El humano ve exactamente qué tools se llamaron, en qué orden y con qué friction.",
    );
    await sleep(2000);
    await scrollBy(page, 280);
    await sleep(700);

    await page.goBack();
    await waitHeading(page, "You review the evidence");
    await click(page, page.getByRole("button", { name: "Build recommendation" }));
    await waitHeading(page, "You shape the capability");
    await caption(
      page,
      "04  Modificas el flujo",
      "Tú das forma a la capability",
      "No es código arbitrario: editas un template read-only que el agente va a leer.",
    );
    await sleep(800);

    const desc = page.getByRole("textbox", { name: /Description/ });
    await desc.scrollIntoViewIfNeeded();
    await click(page, desc);
    await desc.fill("");
    await desc.pressSequentially(
      "Compare headphones in one call: name, price, battery, ANC and weight. Use this instead of repeated get_product.",
      { delay: 10 },
    );

    const categoryBox = page.getByRole("checkbox", { name: "category", exact: true });
    const descriptionBox = page.getByRole("checkbox", { name: "description", exact: true });
    await categoryBox.scrollIntoViewIfNeeded();
    if (await categoryBox.isChecked()) await click(page, categoryBox);
    if (!(await descriptionBox.isChecked())) await click(page, descriptionBox);
    await click(page, page.getByRole("button", { name: "Save changes" }));
    await page.getByText(/Configuration saved/i).waitFor({ timeout: 15_000 });
    await sleep(700);

    await click(page, page.getByRole("button", { name: "Run simulation" }));
    await waitHeading(page, "You compare the journeys");
    await caption(
      page,
      "04  Modificas el flujo",
      "Comparas el journey actual vs el propuesto",
      "De get_product repetido a search_products → compare_products.",
    );
    await sleep(2400);

    await click(page, page.getByRole("button", { name: "Approve for publish" }));
    await waitHeading(page, "You publish the fix");
    await caption(
      page,
      "05  Nuevo flujo",
      "Publicas. El tool queda vivo en WebMCP",
      "Sin deploy. navigator.modelContext.registerTool, ahora, en esta tab.",
    );
    await sleep(800);
    await click(page, page.getByRole("button", { name: "Confirm publish" }));
    await page.getByText(/Published compare_products/i).waitFor({ timeout: 20_000 });
    await sleep(1100);

    const publishedLink = page.getByRole("link", { name: "View published capabilities" });
    if (await publishedLink.isVisible().catch(() => false)) {
      await click(page, publishedLink);
    } else {
      await navDashboard(page, "Published");
    }
    await waitHeading(page, "Published Capabilities");
    await sleep(700);
    await click(page, page.getByRole("button", { name: "Load post-publish traffic" }));
    await page.getByText(/Post-publish traffic loaded/i).waitFor({ timeout: 40_000 });
    await sleep(500);
    await click(page, page.getByRole("button", { name: "Compute before/after" }));
    await page
      .getByText(/Before\/after snapshot updated|Insufficient data|avg calls/i)
      .first()
      .waitFor({ timeout: 20_000 });
    await caption(
      page,
      "05  Nuevo flujo",
      "Before / after sobre llamadas reales",
      "Menos calls, journeys más cortos, misma intención: comparar productos.",
    );
    await sleep(1800);

    await navDashboard(page, "Traffic");
    await waitHeading(page, "Traffic");
    await clickTab(page, "Journeys");
    await caption(
      page,
      "05  Nuevo flujo",
      "El agente ya no compara a mano",
      "El signature nuevo es search_products → compare_products.",
    );
    await sleep(1600);
    await clickTab(page, "Sessions");
    await click(page, page.locator("table a").first());
    await page.waitForURL("**/sessions/**");
    await page.getByText("compare_products").first().waitFor({ timeout: 15_000 });
    await sleep(2000);

    await installHud(page);
    await page.evaluate(() => {
      window.__demoHideCaption?.();
      window.__demoShowIntro("outro");
    });
    await sleep(3400);
  } catch (error) {
    const shot = path.join(OUT_DIR, "demo-failure.png");
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    writeFileSync(path.join(OUT_DIR, "demo-failure.txt"), String(error?.stack || error));
    log(`FAILED, screenshot ${shot}`);
    throw error;
  } finally {
    log("closing browser");
    await context.close();
  }

  const videos = readdirSync(videoDir).filter((f) => f.endsWith(".webm"));
  if (videos.length === 0) throw new Error("No webm recorded");
  const rawPath = path.join(videoDir, videos.sort()[0]);
  const mp4Path = path.join(OUT_DIR, "toolgap-hackathon-demo.mp4");
  log(`transcode ${rawPath}`);
  await transcode(rawPath, mp4Path);
  await maybeSpeedToCap(mp4Path);
  return mp4Path;
}

const out = await record();
log(`WROTE ${out}`);
