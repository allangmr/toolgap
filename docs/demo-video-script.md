# Demo video script

Target runtime: **2:40–2:48**. Hard cut by **2:48**. No title card, logo sting, or music. Silent picture with English captions; original English narration is added in post.

Record against the live UI (fresh Chrome profile, empty IndexedDB):

```bash
BASE_URL=https://toolgap.netlify.app pnpm demo:video
```

The recorder drives the deployed app, overlays English lower-thirds, and writes `toolgap-hackathon-demo.mp4` (1920×1080, H.264, CRF 16, no audio). Captions stay in English. Pronounce punctuation in API paths as “dot” when recording VO (`navigator.modelContext.registerTool`).

Word count of the VO: 360. Estimated 2:40 at 135 WPM or 2:46 at 130 WPM. Direction: clear, measured technical delivery.

## Scene 1. Hook (0:00 to 0:18)

Screen: live landing at `https://toolgap.netlify.app/`. Cursor still for the first sentence, then slowly to **View demo with sample data**. Click near the end of the scene. No separate title card.

> AI agents already shop on your site, but ordinary analytics cannot reveal the capability they needed and could not find.
>
> With WebMCP, each action becomes a typed tool call. ToolGap watches those calls and identifies the capability your site is missing.

## Scene 2. Agents using the store (0:18 to 0:55)

Screen: `/overview` populated, then `/store` (WebMCP status), Traffic → Tools (six static names), then a session with typed name / parameters / outcome, then the session list (23 samples).

> We built ToolGap, capability intelligence for site owners whose pages are already used by AI agents.
>
> This is Fieldkit Market. The page uses the WebMCP API and the active registration path navigator.modelContext.registerTool, not document.modelContext.registerTool, to publish six static tools: search_products, get_product, get_availability, add_to_cart, get_cart, and complete_checkout.
>
> Every action has a typed name, parameters, and outcome. I loaded twenty-three sample agent sessions through the same instrumented path a real agent uses. ToolGap recorded the calls, sessionized them, reconstructed each journey, and scored friction.

## Scene 3. The capability gap (0:55 to 1:33)

Screen: Capability Gaps → COMPARE / `compare_products` → Evidence → headphones supporting session (`hp-01`) → supporting-session list → an Observational gap.

> Here is the payoff. Several agents fetched product after product, back to back, including this headphones path. They were comparing by hand because the site had no comparison tool.
>
> ToolGap detected the repeated get_product pattern, mapped it to a COMPARE capability gap named compare_products, and backed the finding with exact supporting sessions.
>
> It observes real journeys, names the missing capability, and quantifies the friction. When a gap cannot be automated safely, ToolGap reports it as observational instead of guessing.

## Scene 4. Publish and measure (1:33 to 2:25)

Screen: Build recommendation → Run simulation → Approve for publish → Confirm publish → `/store` (runtime registration) → Published before/after after loading post-publish traffic.

> From the gap, a human builds a recommendation using a safe, read-only template. I simulate compare_products against the recorded journeys, review the projected change, approve it, and publish.
>
> Agents cannot publish, and dynamic tools remain read-only. There is no deploy and no API gateway change. Publishing registers compare_products through navigator.modelContext.registerTool in this tab, at runtime.
>
> Back on Fieldkit Market, the tool is now available to the next agent. After more traffic, the Published view measures the complete loop before and after: fewer tool calls, shorter journeys, and higher completion.
>
> This is not just a tool catalog; the site learns from agent behavior and ships the approved fix through the same WebMCP channel.

## Scene 5. Close (2:25 to 2:47)

Screen: Overview metrics / sparklines, then the landing page. End on the ToolGap name and tagline. Hard cut by 2:48.

> That is the loop. WebMCP telemetry reveals where agents struggle. ToolGap reconstructs intent, names the missing tool, and gives a human evidence to approve the fix.
>
> Then WebMCP publishes it in seconds. ToolGap: your website learns what agents need next.

## Recording checklist

- [x] 1920×1080, cursor visible
- [x] Fresh profile so IndexedDB starts empty
- [x] Live deployed UI (`https://toolgap.netlify.app`), full-size, no fake inserts
- [x] English captions only
- [x] No title card, logo sting, or music
- [x] 2:40–2:48, hard cut by 2:48
- [x] Do not claim live traffic changed unless the Published view actually shows newly processed traffic (use **Load post-publish traffic**, then **Compute before/after**)
- [x] Public YouTube: https://www.youtube.com/watch?v=mUor09Qkf40
