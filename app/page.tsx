"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { HeroCoastalVideo } from "@/components/viz/HeroCoastalVideo";
import { SignalChainHero } from "@/components/viz/SignalChainHero";
import { seedAllScenarios } from "@/lib/seed/scenarios";
import { runAnalysis } from "@/lib/analysis/pipeline";

const REPO_URL = "https://github.com/allangmr/toolgap";

const STEPS = [
  {
    number: "1",
    title: "Agents use your tools",
    copy: "Fieldkit Market exposes WebMCP tools through navigator.modelContext. Every agent call is typed telemetry.",
  },
  {
    number: "2",
    title: "ToolGap finds the gap",
    copy: "Calls become sessions and journeys. Detectors spot hand-built comparisons and name the missing capability.",
  },
  {
    number: "3",
    title: "You publish the fix",
    copy: "Simulate a safe template, approve it, and the tool registers on WebMCP. Impact is measured on recorded calls.",
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
    <main id="main" className="page-grain relative flex flex-1 flex-col">
      <header className="flex h-16 items-center justify-between gap-4 px-5 md:px-10 lg:px-16">
        <p className="font-display text-lg font-semibold tracking-tight">ToolGap</p>
        <nav aria-label="Primary" className="flex items-center gap-5 text-sm">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-foreground"
          >
            Source on GitHub
          </a>
          <Link href="/overview">
            <Button>Open dashboard</Button>
          </Link>
        </nav>
      </header>

      <section className="grid items-center gap-12 px-5 pb-24 pt-10 md:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] md:px-10 md:pt-16 lg:gap-16 lg:px-16">
        <div className="max-w-xl">
          <span className="inline-flex items-center rounded-sm bg-accent px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-ink">
            WebMCP intelligence
          </span>
          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-balance md:text-5xl lg:text-6xl">
            Your website learns what agents need next.
          </h1>
          <p className="mt-5 max-w-[36ch] text-base leading-relaxed text-muted">
            ToolGap watches agent traffic, names the friction, and recommends the
            missing WebMCP capability.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => void seedAndOpen()} disabled={seeding}>
              {seeding ? "Loading demo data…" : "View demo with sample data"}
            </Button>
            <Link href="/store">
              <Button variant="secondary" size="lg">
                Open demo store
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative">
          <HeroCoastalVideo />
          <div className="landing-glass relative z-10 -mt-12 ml-4 max-w-[23rem] p-5 md:-ml-10 md:-mt-20">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Observed journey
            </p>
            <div className="mt-3">
              <SignalChainHero />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#211b12] px-5 py-20 text-[#f4ecdd] md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="max-w-[24ch] font-display text-3xl font-semibold leading-[1.12] tracking-[-0.02em] md:text-4xl">
            From raw agent traffic to a published capability
          </h2>
          <ol className="mt-12">
            {STEPS.map((step) => (
              <li
                key={step.number}
                className="grid gap-3 border-t border-[#f4ecdd]/15 py-8 md:grid-cols-[5rem_minmax(0,17rem)_minmax(0,1fr)] md:gap-8 md:py-10"
              >
                <span
                  aria-hidden="true"
                  className="font-display text-5xl font-semibold leading-none text-[#d99a3d]"
                >
                  {step.number}
                </span>
                <h3 className="font-display text-xl font-medium tracking-tight">
                  {step.title}
                </h3>
                <p className="max-w-[44ch] text-sm leading-relaxed text-[#c6bba4]">
                  {step.copy}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="max-w-[24ch] font-display text-3xl font-semibold leading-[1.12] tracking-[-0.02em] md:text-5xl">
            Instead of forcing agents to adapt to your website, your website adapts
            to agents.
          </h2>
          <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-muted">
            Human review stays in the loop. Every published capability is a read-only
            template someone simulated, edited, and approved. AI proposes. Human
            decides.
          </p>
          <div className="mt-14 overflow-hidden rounded-lg border border-border shadow-[var(--shadow)]">
            <Image
              src="/media/hero-coastal-ref-03-promenade.jpg"
              alt="Sunlit coastal promenade at golden hour"
              width={1920}
              height={1280}
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-10 md:px-10 lg:px-16">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <p className="font-display text-base font-semibold tracking-tight">ToolGap</p>
          <p className="max-w-[72ch] text-xs leading-relaxed text-muted">
            Everything runs in your browser. Telemetry, gaps, and published
            capabilities live in IndexedDB, so a fresh profile starts empty and the
            demo button rebuilds the whole story.
          </p>
        </div>
      </footer>
    </main>
  );
}
