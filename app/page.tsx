"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { HeroCoastalVideo } from "@/components/viz/HeroCoastalVideo";
import { SignalChainHero } from "@/components/viz/SignalChainHero";
import { seedAllScenarios } from "@/lib/seed/scenarios";
import { runAnalysis } from "@/lib/analysis/pipeline";

const REPO_URL = "https://github.com/allangmr/toolgap";

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
      <header className="flex h-16 items-center justify-between gap-4 px-5 md:px-10">
        <p className="font-display text-lg font-medium tracking-tight">ToolGap</p>
        <nav aria-label="Primary" className="flex items-center gap-5 text-sm">
          <Link href="/overview" className="text-muted hover:text-foreground">
            Open dashboard
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-foreground"
          >
            Source on GitHub
          </a>
        </nav>
      </header>

      <section className="relative isolate grid min-h-[100dvh] items-center gap-12 overflow-hidden px-5 pb-16 pt-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:px-10 md:pt-10 lg:gap-20">
        <HeroCoastalVideo />
        <div className="relative z-10 max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            Agent Capability Intelligence for WebMCP
          </p>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.08] tracking-tight md:text-5xl lg:text-6xl">
            Your website learns what agents need next.
          </h1>
          <p className="mt-5 max-w-[38ch] text-base leading-relaxed text-muted">
            ToolGap watches agent traffic and turns inefficient journeys into better
            WebMCP capabilities.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button onClick={() => void seedAndOpen()} disabled={seeding}>
              {seeding ? "Loading demo data…" : "View demo with sample data"}
            </Button>
            <Link href="/store">
              <Button variant="secondary">Open demo store</Button>
            </Link>
          </div>
        </div>
        <div className="relative z-10 border-l border-border pl-6 md:pl-10">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Real agent traffic
          </p>
          <div className="mt-4">
            <SignalChainHero />
          </div>
        </div>
      </section>

      <section className="border-t border-border px-5 py-16 md:px-10 md:py-24">
        <ol className="mx-auto grid max-w-5xl gap-10 md:grid-cols-3">
          <li>
            <p className="font-mono text-xs text-accent">call</p>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight">
              Agents use your tools
            </h2>
            <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-muted">
              Fieldkit Market exposes WebMCP tools through navigator.modelContext. Every
              agent call is typed telemetry.
            </p>
          </li>
          <li className="md:border-l md:border-border md:pl-8">
            <p className="font-mono text-xs text-accent">signal</p>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight">
              ToolGap finds the gap
            </h2>
            <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-muted">
              Calls become sessions and journeys. Detectors spot hand-built comparisons
              and name the missing capability.
            </p>
          </li>
          <li className="md:border-l md:border-border md:pl-8">
            <p className="font-mono text-xs text-accent">capability</p>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight">
              You publish the fix
            </h2>
            <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-muted">
              Simulate a safe template, approve it, and the tool registers on WebMCP.
              Impact is measured on recorded calls.
            </p>
          </li>
        </ol>
      </section>

      <section className="border-t border-border px-5 py-16 md:grid md:grid-cols-[1.2fr_0.8fr] md:items-end md:gap-16 md:px-10 md:py-24">
        <h2 className="max-w-[16ch] font-display text-3xl font-medium leading-tight tracking-tight md:text-5xl">
          Instead of forcing agents to adapt to your website, your website adapts to
          agents.
        </h2>
        <p className="mt-6 max-w-[42ch] text-sm leading-relaxed text-muted md:mt-0">
          Human review stays in the loop. Every published capability is a read-only
          template someone simulated, edited, and approved. AI proposes. Human decides.
        </p>
      </section>

      <footer className="border-t border-border px-5 py-8 text-xs text-muted md:px-10">
        Everything runs in your browser. Telemetry, gaps, and published capabilities live
        in IndexedDB, so a fresh profile starts empty and the demo button rebuilds the
        whole story.
      </footer>
    </main>
  );
}
