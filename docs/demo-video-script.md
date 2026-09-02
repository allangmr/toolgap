# Demo video script

Target length is 2:30. Public YouTube upload. Record with:

```bash
pnpm dev
BASE_URL=http://localhost:3000 node scripts/hackathon-demo-video.mjs
```

The script drives the live app, overlays captions, and writes `toolgap-hackathon-demo.mp4` (1080p, max 150s).

## Scene 1. Dashboard (0:00 to 0:22)

Screen: landing at `/`, intro card, then **View demo with sample data** into `/overview`.

> Del landing al dashboard. ToolGap carga 23 sesiones de agentes por el mismo canal WebMCP.

## Scene 2. The agent reads the page (0:22 to 0:50)

Screen: `/store`, search `headphones`, open Auralis Pulse ANC, Soundform Drift, EchoPeak Studio Pro.

> El agente lee Fieldkit Market con tools tipados: search_products, luego get_product una y otra vez porque no hay compare.

## Scene 3. Human reviews the agent flow (0:50 to 1:20)

Screen: Traffic → Journeys, then the compare-products gap → Evidence → a supporting session timeline.

> El humano compara el journey reconstruido. Varios agentes inspeccionaron productos en serie. Falta `compare_products`.

## Scene 4. Human modifies the flow (1:20 to 1:55)

Screen: Build recommendation, edit description and returned fields, Save, Run simulation, Compare.

> Tú das forma a la capability (template read-only). Simulas y comparas el flujo actual contra search_products → compare_products.

## Scene 5. The new agent flow (1:55 to 2:30)

Screen: Approve, Confirm publish, Published before/after, Traffic journeys, a session that calls `compare_products`.

> Publicas sin deploy. El tool queda vivo en WebMCP. El agente ya no compara a mano.

## Recording checklist

- [ ] Fresh Chrome profile (the script deletes its temp profile each run)
- [ ] 1080p, cursor visible
- [ ] Captions in the recording (narration optional)
- [ ] Under 2:30 total
- [ ] Uploaded public on YouTube, link pasted into Devpost
