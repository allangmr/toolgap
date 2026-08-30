"use client";

import { Suspense } from "react";
import GapsPageClient from "./GapsPageClient";

export default function GapsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading gaps…</p>}>
      <GapsPageClient />
    </Suspense>
  );
}
