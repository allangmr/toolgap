# External agent verification

How to confirm that a real AI agent, running outside ToolGap, can discover and call the WebMCP tools on the deployed site, and that ToolGap records the call.

Production URL is [https://toolgap.netlify.app](https://toolgap.netlify.app).

## Automated verification is not external-model verification

These four paths all enter the registry through the same `invokeInternal` function in `lib/webmcp/registry.ts`, which is the function that records telemetry:

- The sample data seeder (`seedAllScenarios`)
- Settings, "Run live agent-driver"
- The Vitest suite
- A DevTools console call to `document.modelContext.executeTool(...)` or `navigator.modelContextTesting.executeTool(...)` (the testing shim exists only in polyfill mode)

They are useful regression checks. None of them is a model deciding what to call. Do not describe any of them as external-agent verification.

## What is already verified

Discovery and transport on the deployed build. In ChatGPT's in-app browser or Chrome 149+ with WebMCP, the badge reads `WebMCP native`. In Chrome without a complete `document.modelContext`, the badge reads `WebMCP polyfill`. On `/store` this returns all six store tools:

```js
(await document.modelContext.getTools()).map((t) => t.name);
// ['add_to_cart','complete_checkout','get_availability','get_cart','get_product','search_products']
```

An external caller outside the app's own React code can therefore list and execute the tools, and ToolGap records those calls. That proves the channel works. It does not prove a model chose to use it.

## What still needs a real model

A model that was never told a tool name has to discover the tools and call one on its own.

## Environment requirements

Pick one. Each needs something installed on your machine that this repository cannot provide.

**Chrome plus the MCP-B extension.** The deployment already loads the `@mcp-b/global` polyfill, which serves tools over `TabServerTransport`. Install the MCP-B browser extension and connect ChatGPT, Claude, or Cursor as the MCP client. This is the most likely path to work today.

**Chrome with native WebMCP.** Enable WebMCP in Chrome 149+ (`chrome://flags/#enable-webmcp-testing`) or use ChatGPT's in-app browser. `resolveAdapter` prefers `document.modelContext` whenever that canonical surface exists. A navigator-only stub does not skip the polyfill.

**ChatGPT in-app browser.** Only if that browser exposes WebMCP to its own agent. If it does not, record that as a limitation. Do not stage a call by hand and describe it as a model call.

## Steps

1. Open `https://toolgap.netlify.app/store` in a fresh browser profile.
2. Confirm the badge reads `WebMCP polyfill` or `WebMCP native`. If it reads `WebMCP demo mode`, the build lost its polyfill flag and no agent can see the tools.
3. Do not load sample data. Every read tool calls `ensureCatalogSeeded()`, so the catalog fills itself on the first tool call.
4. Connect your MCP client or extension to the tab.
5. Give a task in plain language that never names a tool. For example, "I need headphones for commuting. Find a few options and tell me which gives the best battery life for the price."
6. Watch for at least one successful tool call you did not ask for by name.

## Export the evidence before anything else

Go to Settings and click **Export JSON** immediately.

`seedAllScenarios` calls `clearTelemetryData()`, which clears tool calls, sessions, and journeys. Anyone who clicks "View demo with sample data" in that browser profile destroys the recording. The exported dump is the durable artifact.

## Confirm the call inside ToolGap

In the same browser profile, because all telemetry lives in that profile's IndexedDB:

- `/sessions` shows a session whose call count matches what you observed
- `/sessions/<id>` lists each tool call with its arguments and outcome
- `/tools` shows a non-zero call count for the tool the model used

## What to record

- Date and time
- Deployed URL
- MCP client name and version, and the browser
- Model
- The exact prompt
- Tools discovered, if the client shows them
- Tool invoked, and the arguments it supplied
- Result, and whether the call succeeded
- Session id, and the filename of the exported dump
- Screenshots of the client and of `/sessions`

## Limitations to state honestly

ToolGap observes tool calls. It does not observe reasoning. Do not claim to know why a model chose a tool, only that it called one with given arguments at a given time.

Telemetry is per browser profile in IndexedDB. A different profile, or incognito closed and reopened, starts empty.

The sample data in every screenshot elsewhere in this repository comes from the scripted driver, not from a model.

## Verified runs

None recorded yet. Add a subsection here only after a real model call has been observed, with the fields from "What to record" filled in.
