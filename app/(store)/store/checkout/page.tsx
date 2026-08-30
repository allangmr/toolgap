"use client";

import { useState } from "react";
import Link from "next/link";
import { completeCheckout } from "@/lib/store-domain/services";
import type { Order } from "@/lib/shared/types";
import { Button } from "@/components/ui";

export default function CheckoutPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-3xl font-semibold text-[#1c1917]">Checkout</h1>
      <p className="text-sm text-[#78716c]">
        Simulated checkout — no payment is processed.
      </p>

      {!order ? (
        <Button
          disabled={busy}
          onClick={() =>
            void (async () => {
              setBusy(true);
              setError(null);
              try {
                setOrder(await completeCheckout());
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            })()
          }
        >
          Complete simulated checkout
        </Button>
      ) : (
        <div className="rounded-xl border border-[#e4ddd3] bg-white p-6">
          <h2 className="text-lg font-semibold text-success">Order confirmed</h2>
          <p className="mt-2 text-sm">Order {order.id.slice(0, 8)}</p>
          <p className="tabular-nums">Total ${order.total.toFixed(2)}</p>
          <p className="mt-1 text-xs text-[#78716c]">Status: {order.status}</p>
          <Link href="/store" className="mt-4 inline-block text-accent underline">
            Continue shopping
          </Link>
        </div>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
