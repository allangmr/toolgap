"use client";

import { Suspense } from "react";
import SessionsPageClient from "./SessionsPageClient";

export default function SessionsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading sessions…</p>}>
      <SessionsPageClient />
    </Suspense>
  );
}
