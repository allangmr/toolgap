"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { seedAllScenarios } from "@/lib/seed/scenarios";
import { runAnalysis } from "@/lib/analysis/pipeline";

const REPO_URL = "https://github.com/allangmr/toolgap";

const steps = [
  {
    title: "Agents use your tools",
    body: "Fieldkit Market, the demo store, exposes WebMCP tools like search_products and get_product through navigator.modelContext. Every agent call is recorded as typed telemetry.",
  },
  {
    title: "ToolGap finds the gap",
    body: "Calls become sessions and journeys. Friction detectors spot agents comparing products by hand, and ToolGap computes the missing capability with the sessions as evidence.",
  },
  {
    title: "You publish the fix",
    body: "A safe, read-only template becomes a recommendation. Simulate it, approve it, and the new tool registers through WebMCP instantly. Before/after impact is measured on real traffic.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);

  async function seedAndOpen() {
    setSeeding(true);
    try {
      await seedAllScenarios();
      await runAnalysis();
      router.push("/overview");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Agent Capability Intelligence for WebMCP
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Your website learns what agents need next.
          </h1>
          <p className="max-w-2xl text-lg text-muted">
            ToolGap watches how AI agents use your WebMCP tools, detects the
            capabilities they are missing, and lets you publish the fix through
            the same channel in seconds, with a human approving every step.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void seedAndOpen()} disabled={seeding}>
              {seeding ? "Loading demo data…" : "View demo with sample data"}
            </Button>
            <Link href="/store">
              <Button variant="secondary">Open demo store</Button>
            </Link>
            <Link href="/overview" className="text-sm text-accent hover:underline">
              Open dashboard
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted hover:text-foreground hover:underline"
            >
              Source on GitHub
            </a>
          </div>
        </div>

        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <p className="text-xs font-semibold text-accent">Step {i + 1}</p>
              <h2 className="mt-1 font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <p className="text-xs text-muted">
          Everything runs in your browser. Telemetry, gaps, and published
          capabilities live in IndexedDB, so a fresh profile starts empty and
          the demo button above rebuilds the whole story.
        </p>
      </section>
    </main>
  );
}
