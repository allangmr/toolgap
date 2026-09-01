"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  addToCart,
  getAvailability,
  getProduct,
} from "@/lib/store-domain/services";
import type { Inventory, Product } from "@/lib/shared/types";
import { Button } from "@/components/ui";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [availability, setAvailability] = useState<Inventory | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setProduct(await getProduct(id));
      setAvailability(await getAvailability(id));
    })();
  }, [id]);

  if (!product) {
    return <p className="text-muted">Loading product…</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div
        className="min-h-72 rounded-lg bg-gradient-to-br from-[#44403c] to-[#1c1917]"
        aria-hidden="true"
      />
      <div className="space-y-4">
        <Link href="/store" className="text-sm text-accent hover:underline">
          ← Catalog
        </Link>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            {product.brand} · {product.category}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
            {product.name}
          </h1>
          <p className="mt-2 text-2xl font-semibold tabular-nums">${product.price}</p>
        </div>
        <p className="text-muted">{product.description}</p>
        <div>
          <h2 className="text-sm font-semibold">Specs</h2>
          <table className="mt-2 w-full text-left text-sm">
            <caption className="sr-only">Product specifications</caption>
            <tbody>
              {Object.entries(product.specs).map(([k, v]) => (
                <tr key={k} className="border-b border-border">
                  <th scope="row" className="py-2 font-medium">
                    {k}
                  </th>
                  <td className="py-2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm">
          Availability:{" "}
          {availability
            ? availability.stock > 0
              ? `${availability.stock} in stock (${availability.warehouse})`
              : "Out of stock"
            : "Unknown"}
        </p>
        <Button
          onClick={() =>
            void (async () => {
              await addToCart(product.id, 1);
              setMessage("Added to cart.");
            })()
          }
        >
          Add to cart
        </Button>
        <p className="text-sm text-muted" aria-live="polite">
          {message}
        </p>
      </div>
    </div>
  );
}
