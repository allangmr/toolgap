"use client";

import { Suspense, use } from "react";
import GapDetailClient from "./GapDetailClient";

export default function GapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = use(params);
  return (
    <Suspense fallback={<p className="text-muted">Loading gap…</p>}>
      <GapDetailClient params={Promise.resolve(resolved)} />
    </Suspense>
  );
}
