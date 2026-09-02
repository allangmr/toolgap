# ToolGap

**Your website learns what agents need next.**

Agent Capability Intelligence for WebMCP. ToolGap observes how AI agents use WebMCP tools on your site, reconstructs journeys, detects capability gaps, recommends safe template-based tools, lets you simulate and approve them, then measures before/after impact.

## Why WebMCP

Agents already visit your site. Without WebMCP they scrape HTML, you cannot tell an agent from a bounce, and you learn nothing about what they needed. WebMCP changes both directions of that exchange, and ToolGap only works because of it:

- Every agent action is a typed tool call with a name, parameters, and an outcome. That structure is what lets ToolGap reconstruct journeys and measure friction. Page-view analytics cannot see intent; tool telemetry is intent.
- The gap becomes computable. When an agent calls `get_product` seven times in a row to compare items, the missing `compare_products` capability is visible in the call log itself.
- The fix ships through the same channel. ToolGap publishes the recommended tool with `document.modelContext.registerTool` at runtime. No app release, no API gateway change, and the next agent session already has the capability.

What people and agents now do together: agents get the tool they were fumbling toward, and the site owner stays in the loop. Every published capability is a safe, read-only template that a human simulated, reviewed, and approved, and its before/after impact is measured on the WebMCP calls ToolGap actually recorded.

## Live demo

[https://toolgap.netlify.app](https://toolgap.netlify.app)

Start at the root for the walkthrough. The dashboard is at `/overview` and the instrumented store is at `/store`.

## Demo video

[https://www.youtube.com/watch?v=mUor09Qkf40](https://www.youtube.com/watch?v=mUor09Qkf40) — 2:48, public, with audio.

## Requirements

- Node.js 22+
- pnpm 11.24.0

## Setup

```bash
pnpm install
pnpm dev
```

Open:

- Dashboard: [http://localhost:3000/overview](http://localhost:3000/overview)
- Demo store: [http://localhost:3000/store](http://localhost:3000/store)

## Scripts

| Script           | Purpose                         |
| ---------------- | ------------------------------- |
| `pnpm dev`       | Next.js dev server              |
| `pnpm build`     | Production build                |
| `pnpm start`     | Production server               |
| `pnpm test`      | Vitest unit + integration tests |
| `pnpm typecheck` | TypeScript check                |
| `pnpm lint`      | ESLint                          |
| `pnpm format`    | Prettier                        |

## WebMCP modes

ToolGap registers tools on `document.modelContext` when that surface exists, and falls back to `navigator.modelContext`.

1. **Native** — ChatGPT's in-app browser or Chrome 149+ with WebMCP (`document.modelContext.registerTool`). Detected automatically and always preferred so agents see Chromium's tool list.
2. **Polyfill** — default on the deployed site. Loads `@mcp-b/global` when the canonical document surface is missing, including Chrome builds that only expose a navigator stub. Set `NEXT_PUBLIC_WEBMCP_POLYFILL=0` to disable.
3. **Noop** — when neither is available. The app and analytics still work; tools are not exposed to agents. Use **Settings → Run live agent-driver** or seed data instead.

The sample data seeder, the live agent-driver, and the test suite all enter the registry through the same instrumented path a real agent uses. That makes them good regression checks and **not** external-agent verification. To verify a real model, follow [docs/external-agent-verification.md](docs/external-agent-verification.md).

## First run

1. Open `/overview`
2. Click **Load sample data**
3. Inspect **Capability Gaps** → open the compare-products gap
4. Build recommendation → Simulate → Approve → Publish
5. Open `/store` — `compare_products` is now registered as a dynamic tool
6. On **Published**, compute before/after after more sessions

## Architecture

```
WebMCP call → telemetry → session → journey → friction detectors
  → capability gap → recommendation (template) → simulation
  → human approval → dynamic tool publish → before/after measurement
```

Core libraries live under `lib/` (framework-free, unit-testable). React only hosts UI and WebMCP lifecycle.

Persistence is IndexedDB via Dexie (repository abstraction ready for a later server).

## Manual WebMCP checklist

- [ ] Browser without WebMCP: status badge shows demo mode; dashboard usable; seed data works
- [ ] Polyfill mode: tools register on `/store` load
- [ ] Native mode: tools register via `document.modelContext`
- [ ] Publish `compare_products` from a gap; reload `/store`; tool still registered
- [ ] Deactivate capability; tool unregisters
- [ ] Dashboard tools (`list_capability_gaps`, etc.) register on dashboard layouts
- [ ] Agents cannot publish (no publish tool exposed)

## Security notes

- No arbitrary generated code execution — only capability templates
- MVP dynamic tools are read-only
- Tool inputs are redacted before persistence; result payloads are not stored
- Publishing requires explicit human confirmation in the UI
