"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  DynamicCapabilityLoader,
  StoreToolsProvider,
} from "@/components/store/StoreToolsProvider";
import { cartRepo } from "@/lib/db/repositories";
import { ensureCatalogSeeded, getOrCreateCart } from "@/lib/store-domain/services";
import { useEffect, useState } from "react";
import { WebmcpStatusBadge } from "@/components/dashboard/WebmcpStatusBadge";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      await ensureCatalogSeeded();
      await getOrCreateCart();
      setReady(true);
    })();
  }, []);

  const cart = useLiveQuery(() => cartRepo.get("default-cart"), [ready]);
  const itemCount = cart?.items.reduce((s, i) => s + i.qty, 0) ?? 0;

  return (
    <StoreToolsProvider>
      <DynamicCapabilityLoader />
      <div className="min-h-screen bg-[#f7f3ee]">
        <header className="border-b border-[#e4ddd3] bg-[#faf7f2]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <div>
              <Link href="/store" className="text-xl font-semibold tracking-tight text-[#1c1917]">
                Fieldkit Market
              </Link>
              <p className="text-xs text-[#78716c]">Demo store · WebMCP instrumented</p>
            </div>
            <nav aria-label="Store" className="flex items-center gap-4 text-sm">
              <Link href="/store" className="hover:underline">
                Catalog
              </Link>
              <Link href="/store/cart" className="hover:underline">
                Cart ({itemCount})
              </Link>
              <Link href="/overview" className="text-accent hover:underline">
                ToolGap
              </Link>
              <WebmcpStatusBadge />
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-[#e4ddd3] py-6 text-center text-xs text-[#78716c]">
          Fieldkit Market is a ToolGap demo surface. Tool calls are observed for capability intelligence.
        </footer>
      </div>
    </StoreToolsProvider>
  );
}
