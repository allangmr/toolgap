# Devpost submission copy

Paste-ready text for the WebMCP Challenge form. Keep the Testing Instructions
field in sync with this file.

Demo video (separate form field):
https://www.youtube.com/watch?v=mUor09Qkf40

Live URL: https://toolgap.netlify.app
Repo: https://github.com/allangmr/toolgap
License: MIT

---

## Testing Instructions

```
No login. No credentials. Free to test.

Stay in one browser profile. WebMCP tools and telemetry are per tab / IndexedDB.

1) STORE (this Live URL)
   https://toolgap.netlify.app/store
   Wait until the badge reads "WebMCP polyfill" or "WebMCP native"
   (not "WebMCP demo mode").
   Store tools: search_products, get_product, get_availability,
   add_to_cart, get_cart, complete_checkout.

   Optional agent check in this same tab:
   ChatGPT in-app browser, or Chrome 149+ with
   chrome://flags/#enable-webmcp-testing enabled, or Cursor via MCP-B.
   Prompt (do not name a tool): "I need commuting headphones. Compare a
   few on battery vs price."
   DevTools (discovery): (await document.modelContext.getTools()).map(t => t.name)
   Native execute (Chrome with executeTool): pass the tool object, args as JSON string:
     const t = (await document.modelContext.getTools()).find(t => t.name === "search_products")
     await document.modelContext.executeTool(t, JSON.stringify({ q: "headphones" }))
   Polyfill execute (only if navigator.modelContextTesting exists):
     await navigator.modelContextTesting.executeTool("search_products", JSON.stringify({ q: "headphones" }))

   A live call creates a session. It does NOT open a gap yet.
   Gaps need 3 supporting sessions of the same friction pattern
   (search_products, then get_product on 3 different products).
   Calls in the same tab stay one session until ~3 minutes idle.
   If Capabilities is empty after one live session, that is expected.

2) DASHBOARD (same tab — do not open a new profile)
   In the store header, click the orange "ToolGap" link
   (it goes to /overview).
   Fallback URL: https://toolgap.netlify.app/overview

   Fastest way to walk the publish loop: if you see "No agent activity yet"
   OR you only have 1–2 live sessions and Capabilities is empty,
   click "Load sample data". That seeds 23 sessions and the compare_products gap.
   Do not click Load sample data in a profile where you are still
   recording a live agent call (it clears IndexedDB).

   Alternative without wiping the live session: Settings →
   "Run live agent-driver comparison sequence" three times.

   Then: Capabilities → "Missing compare_products capability" → Evidence
   → Build recommendation → Run simulation → Approve for publish
   → Confirm publish.

   Dashboard WebMCP (this tab): get_agent_summary, list_capability_gaps,
   create_recommendation, simulate_recommendation, …
   Agents cannot publish. Publish is a human click.

3) BACK TO STORE (same tab)
   Sidebar: "Open demo store" (or https://toolgap.netlify.app/store).
   compare_products is now registered at runtime via
   document.modelContext.registerTool.
   Published → Load post-publish traffic → Compute before/after.
```

---

## Inspiration

AI agents already shop on websites. Ordinary analytics still treat them as bounces. You cannot see the capability they needed and could not find.

WebMCP changes that: every action becomes a typed tool call with a name, parameters, and an outcome. Once calls look like that, a missing tool is no longer a guess. If agents call `get_product` three times in a row to compare headphones, the log itself is the gap.

ToolGap is capability intelligence for site owners whose pages are already used by agents. The site should learn what those agents need next.

## What it does

[ToolGap](https://toolgap.netlify.app) watches WebMCP traffic on an instrumented store (**Fieldkit Market**), reconstructs each agent journey, names the missing capability, and lets a human publish a safe fix through the same channel.

The loop:

1. Agents use static tools: `search_products`, `get_product`, `get_availability`, `add_to_cart`, `get_cart`, `complete_checkout`.
2. ToolGap sessionizes calls, scores friction, and opens a **COMPARE** gap named `compare_products` only after **3 supporting sessions** of that pattern, backed by exact session ids.
3. A human builds a recommendation from a **read-only template**, simulates it against recorded journeys, approves it, and publishes.
4. Publishing calls `document.modelContext.registerTool` in that tab, at runtime. No deploy. No API gateway change. Agents cannot publish.
5. After more traffic, **Published** measures before and after: fewer calls, shorter journeys, higher completion.

On the seeded demo this is concrete: comparison journeys drop from **5.67 to 3 avg calls (−47%)** and completion goes from **0% to 100%**.

Gaps that cannot be automated safely stay **observational**. ToolGap reports them instead of inventing a tool.

## Why this is a strong fit for WebMCP

Page views cannot express intent. A WebMCP tool call can. That structure is what makes journeys, friction, and a named gap computable. The fix ships on the same API the agent already uses (`document.modelContext.registerTool`), so the next session already has `compare_products`.

People and agents can now do something that was awkward before: the agent stops comparing products by hand, and the site owner stays in the loop with evidence, simulation, and an explicit approve step.

## How I built it

- **WebMCP.** Tools register through `document.modelContext.registerTool` when that canonical surface exists (ChatGPT in-app browser, Chrome 149+ with WebMCP). Chrome builds that only expose a navigator-only `registerTool` stub are not treated as native: the live site loads `@mcp-b/global` (`NEXT_PUBLIC_WEBMCP_POLYFILL=1` by default) so agents can list and call tools. If neither surface works, a noop mode keeps the dashboard usable.
- **Surfaces.** Fieldkit Market (`/store`) exposes the six static commerce tools. The dashboard exposes read/simulate tools such as `list_capability_gaps`. There is no publish tool for agents.
- **Pipeline.** `WebMCP call → telemetry → session → journey → friction detectors → capability gap → template recommendation → simulation → human approve → dynamic register → before/after`.
- **Safety.** Dynamic tools are instantiated from approved templates (Zod-validated config, field whitelist, batch caps). No generated code runs. Inputs are redacted before persistence.
- **Stack.** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Dexie (IndexedDB), Vitest. Hosted on Netlify.

Core logic lives under `lib/` so it can be tested without the UI. Sample traffic and the live agent-driver enter the registry through the same instrumented path a real agent uses. They are regression checks, not a substitute for an external model.

## Challenges

**Native vs polyfill.** Judges may open ChatGPT’s in-app browser or Chrome with `chrome://flags/#enable-webmcp-testing`. ChatGPT and Chrome 149+ use `document.modelContext`. Some Chromium builds only expose `navigator.modelContext.registerTool` without `getTools`; treating that stub as native meant agents saw zero tools. The live site prefers `document.modelContext`, otherwise installs the polyfill, and the badge is honest: native, polyfill, or demo mode.

**Human control.** The obvious hackathon move is “the agent publishes a new tool.” That is unsafe. Publishing is a human-only UI action. Templates stay read-only. If a detector cannot map to a template, the gap is observational.

**Telemetry that is not a lie.** IndexedDB is per browser profile. An empty dashboard is expected until you click **View demo with sample data**. A single live tool call is a session, not a gap: **3 supporting sessions** are required. Before/after numbers only appear after **Load post-publish traffic** and **Compute before/after**. The UI does not pretend live traffic arrived if it did not.

## What I learned

Typed tool calls are a product surface, not only a model API. Once an agent’s work is named, parameterized, and scored, a site can detect a missing capability and ship it on the same channel — without giving the agent the power to publish.
