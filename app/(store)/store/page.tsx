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
      <section className="relative overflow-hidden rounded-2xl bg-[#1c1917] px-6 py-14 text-[#faf7f2]">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, #d6d3d1, transparent 40%), radial-gradient(circle at 80% 0%, #a8a29e, transparent 35%)",
          }}
        />
        <div className="relative max-w-xl">
          <p className="text-sm uppercase tracking-[0.2em] text-[#a8a29e]">Fieldkit Market</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Tools for making, measuring, and moving.
          </h1>
          <p className="mt-4 text-[#d6d3d1]">
            A living catalog instrumented with WebMCP — so agents can shop the way the site
            actually works.
          </p>
        </div>
      </section>

      <form
        onSubmit={(e) => void onSearch(e)}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-[#e4ddd3] bg-white p-4"
      >
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm">
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded border border-[#e4ddd3] px-3 py-2"
            placeholder="headphones, laptop…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-[#e4ddd3] px-3 py-2"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Brand
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="rounded border border-[#e4ddd3] px-3 py-2"
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

      <p className="text-center text-sm text-[#78716c]">
        Prefer the dashboard?{" "}
        <Link href="/overview" className="text-accent underline">
          Open ToolGap
        </Link>
      </p>
    </div>
  );
}
