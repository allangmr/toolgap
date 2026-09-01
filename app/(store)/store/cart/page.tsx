"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCart, getProduct } from "@/lib/store-domain/services";
import type { Cart, Product } from "@/lib/shared/types";
import { Button } from "@/components/ui";

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [products, setProducts] = useState<Record<string, Product>>({});

  useEffect(() => {
    void (async () => {
      const c = await getCart();
      setCart(c);
      const map: Record<string, Product> = {};
      for (const item of c.items) {
        const p = await getProduct(item.productId);
        if (p) map[p.id] = p;
      }
      setProducts(map);
    })();
  }, []);

  const total =
    cart?.items.reduce(
      (sum, item) => sum + (products[item.productId]?.price ?? 0) * item.qty,
      0,
    ) ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Cart</h1>
      {!cart || cart.items.length === 0 ? (
        <p className="text-muted">
          Your cart is empty.{" "}
          <Link href="/store" className="text-accent underline">
            Browse the catalog
          </Link>
        </p>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-md border border-border bg-surface shadow-[var(--shadow-card)]">
            {cart.items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {products[item.productId]?.name ?? item.productId}
                  </p>
                  <p className="text-sm text-muted">Qty {item.qty}</p>
                </div>
                <p className="tabular-nums">
                  ${((products[item.productId]?.price ?? 0) * item.qty).toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold tabular-nums">Total ${total.toFixed(2)}</p>
            <Link href="/store/checkout">
              <Button>Checkout</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
