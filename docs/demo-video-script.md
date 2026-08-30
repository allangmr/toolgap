# Demo video script

Target length is 2:50. Public YouTube upload with narrated audio. Record at the deployed URL in a fresh browser profile so the story starts from an empty database.

## Scene 1. Hook (0:00 to 0:15)

Screen: landing page at `/`.

Narration:

> AI agents already shop on your website. When your site speaks WebMCP, every agent action is a typed tool call. ToolGap watches those calls and answers one question no analytics tool can: which capability is your site missing?

## Scene 2. Agents using the store (0:15 to 0:45)

Screen: click "Load sample data", then open `/store` briefly, then the Sessions page.

Narration:

> This is Fieldkit Market, a demo store that exposes WebMCP tools like search, get product, and checkout. I just replayed twenty-three real agent sessions against it. ToolGap recorded every tool call, rebuilt each journey, and scored the friction.

## Scene 3. The gap (0:45 to 1:25)

Screen: Gaps page, open the compare-products gap, scroll the evidence panel.

Narration:

> Here is the payoff. Several agents fetched product after product, back to back. They were comparing headphones by hand because the site has no compare tool. ToolGap detected that pattern, mapped it to a COMPARE capability gap, and backed it with the exact sessions as evidence. Notice the observational gaps too: ToolGap reports what it cannot safely automate instead of guessing.

## Scene 4. Publish and measure (1:25 to 2:20)

Screen: Build recommendation, Simulate tab, Approve, Publish dialog, then `/store` showing the tool registered, then Published page with before/after.

Narration:

> One click builds a recommendation from a safe, read-only template. I simulate it against the recorded journeys, approve it, and publish. No deploy, no release: the tool registers through navigator.modelContext right now, in this tab. Back on the store, compare products is live for the next agent. After new traffic arrives, ToolGap measures before and after: fewer calls, shorter journeys, higher completion.

## Scene 5. Close (2:20 to 2:50)

Screen: Overview with sparklines, then the landing page again.

Narration:

> That is the loop. Agents reveal the gap through WebMCP telemetry, a human approves the fix, and the same WebMCP channel ships it seconds later. ToolGap: your website learns what agents need next.

## Recording checklist

- [ ] Fresh profile or incognito so `/` starts empty
- [ ] 1080p screen recording, cursor visible
- [ ] Narration recorded or AI-read from this script
- [ ] Under 3 minutes total
- [ ] Uploaded public on YouTube, link pasted into Devpost
