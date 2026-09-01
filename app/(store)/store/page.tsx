"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ensureCatalogSeeded, searchProducts } from "@/lib/store-domain/services";
import type { Product } from "@/lib/shared/types";
import { ProductCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui";

export default function StoreCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");

  useEffect(() => {
    void (async () => {
      await ensureCatalogSeeded();
      const results = await searchProducts({});
      setProducts(results);
    })();
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );
  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand))].sort(),
    [products],
  );

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const results = await searchProducts({
      q: q || undefined,
      category: category || undefined,
      brand: brand || undefined,
    });
    setProducts(results);
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-lg border border-border bg-accent-subtle px-6 py-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgb(154 52 18 / 0.14), transparent 40%), radial-gradient(circle at 80% 0%, rgb(255 255 255 / 0.75), transparent 35%)",
          }}
        />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center rounded-sm bg-accent px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-ink">
            Fieldkit Market
          </span>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Tools for making, measuring, and moving.
          </h1>
          <p className="mt-4 text-muted">
            A living catalog instrumented with WebMCP so agents can shop the way the site
            actually works.
          </p>
        </div>
      </section>

      <form
        onSubmit={(e) => void onSearch(e)}
        className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
      >
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm text-foreground">
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="lab-input mt-0"
            placeholder="headphones, laptop…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="lab-input mt-0 w-auto"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground">
          Brand
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="lab-input mt-0 w-auto"
          >
            <option value="">All</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Search</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <p className="text-center text-sm text-muted">
        Prefer the dashboard?{" "}
        <Link href="/overview" className="text-accent underline">
          Open ToolGap
        </Link>
      </p>
    </div>
  );
}
