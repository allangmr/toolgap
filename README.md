# ToolGap

**Your website learns what agents need next.**

Agent Capability Intelligence for WebMCP. ToolGap observes how AI agents use WebMCP tools on your site, reconstructs journeys, detects capability gaps, recommends safe template-based tools, lets you simulate and approve them, then measures before/after impact.

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

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Production server |
| `pnpm test` | Vitest unit + integration tests |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

## WebMCP modes

ToolGap uses `navigator.modelContext.registerTool` / `unregisterTool`.

1. **Native** — Chrome with WebMCP enabled (Canary / flag). Detected automatically.
2. **Polyfill** — set `NEXT_PUBLIC_WEBMCP_POLYFILL=1` to load `@mcp-b/global`.
3. **Noop** — when neither is available. The app and analytics still work; tools are not exposed to agents. Use **Settings → Run live agent-driver** or seed data instead.

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

- [ ] Browser without WebMCP: status badge shows unavailable; dashboard usable; seed data works
- [ ] Polyfill mode: tools register on `/store` load
- [ ] Native mode: tools register via `navigator.modelContext`
- [ ] Publish `compare_products` from a gap; reload `/store`; tool still registered
- [ ] Deactivate capability; tool unregisters
- [ ] Dashboard tools (`list_capability_gaps`, etc.) register on dashboard layouts
- [ ] Agents cannot publish (no publish tool exposed)

## Security notes

- No arbitrary generated code execution — only capability templates
- MVP dynamic tools are read-only
- Tool inputs are redacted before persistence; result payloads are not stored
- Publishing requires explicit human confirmation in the UI
