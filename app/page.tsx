"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { HeroCoastalVideo } from "@/components/viz/HeroCoastalVideo";
import { HeroMotionField } from "@/components/viz/HeroMotionField";
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
    <main id="main" className="page-grain relative flex flex-1 flex-col">
      <div className="relative isolate min-h-[100dvh] overflow-hidden">
        <HeroCoastalVideo />
        <HeroMotionField />

        <header className="relative z-20 flex h-16 items-center justify-between gap-4 px-5 md:px-10 lg:px-16">
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

        <section className="relative z-10 grid min-h-[calc(100dvh-4rem)] items-start gap-10 px-5 pb-16 pt-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:gap-8 md:px-10 md:pt-14 lg:gap-6 lg:px-16">
          <div className="relative max-w-[34rem] md:pt-2">
            <h1 className="font-serif text-[2.55rem] font-medium leading-[1.12] tracking-[-0.035em] text-balance text-foreground md:text-6xl lg:text-[4.15rem]">
              Your website learns
              <br className="hidden md:block" />{" "}
              <em className="font-serif font-medium italic">what agents need next.</em>
            </h1>
            <p className="mt-6 max-w-[34ch] text-base leading-relaxed text-muted">
              ToolGap watches agent traffic, names the friction, and recommends the missing
              WebMCP capability.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button
                size="lg"
                onClick={() => void seedAndOpen()}
                disabled={seeding}
                className="shadow-[0_0_0_1px_rgb(217_154_61_/_0.45),0_14px_40px_rgb(217_154_61_/_0.28)]"
              >
                {seeding ? "Loading demo data…" : "View demo with sample data"}
              </Button>
              <Link
                href="/store"
                className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                Open demo store
              </Link>
            </div>
          </div>

          <div className="relative md:mt-24 md:justify-self-end md:w-[min(100%,26.5rem)] lg:mt-32">
            <div className="landing-glass p-5 md:p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Observed journey
              </p>
              <div className="mt-3">
                <SignalChainHero />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="relative overflow-hidden border-t border-border px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <Image
          src="/media/hero-coastal-ref-03-promenade.jpg"
          alt=""
          width={1920}
          height={1280}
          className="pointer-events-none absolute -right-[18%] bottom-[-20%] w-[62%] max-w-none object-cover opacity-[0.22] md:w-[46%]"
        />
        <div className="relative max-w-[38rem]">
          <h2 className="font-serif text-3xl font-medium leading-[1.15] tracking-[-0.03em] md:text-5xl">
            Your website adapts to agents.
          </h2>
          <p className="mt-6 max-w-[46ch] text-sm leading-relaxed text-muted">
            Human review stays in the loop. Every published capability is a read-only template
            someone simulated, edited, and approved. AI proposes. Human decides.
          </p>
        </div>
      </section>

      <footer className="relative border-t border-border px-5 py-8 text-xs text-muted md:px-10 lg:px-16">
        Everything runs in your browser. Telemetry, gaps, and published capabilities live in
        IndexedDB, so a fresh profile starts empty and the demo button rebuilds the whole story.
      </footer>
    </main>
  );
}
