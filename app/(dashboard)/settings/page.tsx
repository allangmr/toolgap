"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  clearDerivedData,
  publishedRepo,
  resetAllData,
  settingsRepo,
} from "@/lib/db/repositories";
import { exportDump, importDump } from "@/lib/db/dump";
import { rebuildDerivedData } from "@/lib/analysis/pipeline";
import { seedAllScenarios, seedPostPublishTraffic } from "@/lib/seed/scenarios";
import { Button, Card, Dialog } from "@/components/ui";
import { useAnalysisStatus } from "@/components/providers/AnalysisStatusProvider";
import { driveSequence } from "@/lib/webmcp/driver";
import { SEED_PRODUCTS } from "@/lib/store-domain/catalog";
import { resetSessionizer } from "@/lib/sessions/sessionizer";
import {
  TIMEOUT_SECONDS_MAX,
  TIMEOUT_SECONDS_MIN,
  timeoutMsToSeconds,
  timeoutSecondsToMs,
} from "@/lib/sessions/timeout";

export default function SettingsPage() {
  const settings = useLiveQuery(() => settingsRepo.get(), []);
  const activeCaps = useLiveQuery(() => publishedRepo.active(), []) ?? [];
  const analysis = useAnalysisStatus();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newRedactionKey, setNewRedactionKey] = useState("");
  const [timeoutDraft, setTimeoutDraft] = useState<string | null>(null);
  const [pendingDump, setPendingDump] = useState<unknown>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const timeoutSeconds =
    timeoutDraft ??
    (settings ? String(timeoutMsToSeconds(settings.inactivityTimeoutMs)) : "");

  async function saveTimeout() {
    if (!settings) return;
    const parsed = Number(timeoutSeconds);
    const nextMs = timeoutSecondsToMs(parsed);
    setTimeoutDraft(null);
    await settingsRepo.put({ ...settings, inactivityTimeoutMs: nextMs });
    setMessage(`Inactivity timeout set to ${timeoutMsToSeconds(nextMs)}s.`);
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage(label);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">Seed data, analysis rebuild, and local data controls.</p>
      </header>

      <p className="text-sm" aria-live="polite">
        {message}
      </p>

      <Card as="section" className="space-y-3">
        <h2 className="font-semibold">Sample data</h2>
        <p className="text-sm text-muted">
          Drives sample journeys through the live store WebMCP tools so telemetry,
          sessions, and analysis use the same path as a real agent.
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            void run("Sample data loaded.", async () => {
              await seedAllScenarios();
              await analysis.refresh();
            })
          }
        >
          Load all seed scenarios
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run("Live driver sequence complete.", async () => {
              resetSessionizer();
              await driveSequence([
                { tool: "search_products", params: { category: "headphones" } },
                { tool: "get_product", params: { productId: SEED_PRODUCTS[0]!.id } },
                { tool: "get_product", params: { productId: SEED_PRODUCTS[1]!.id } },
                { tool: "get_product", params: { productId: SEED_PRODUCTS[2]!.id } },
                {
                  tool: "get_availability",
                  params: { productId: SEED_PRODUCTS[0]!.id },
                },
                {
                  tool: "get_availability",
                  params: { productId: SEED_PRODUCTS[1]!.id },
                },
              ]);
              await analysis.refresh();
            })
          }
        >
          Run live agent-driver comparison sequence
        </Button>
        <Button
          variant="secondary"
          disabled={busy || activeCaps.length === 0}
          onClick={() =>
            void run("Post-publish traffic loaded.", async () => {
              await seedPostPublishTraffic(activeCaps[0]?.id);
              await analysis.refresh();
            })
          }
        >
          Load post-publish traffic
        </Button>
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className="font-semibold">Session & analysis</h2>
        <p className="text-sm text-muted">
          New session after this many seconds without a tool call. Range{" "}
          {TIMEOUT_SECONDS_MIN} to {TIMEOUT_SECONDS_MAX}s.
        </p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveTimeout();
          }}
        >
          <label className="text-sm">
            Inactivity timeout (seconds)
            <input
              className="mt-1 block w-28 rounded border border-border bg-transparent px-2 py-1"
              type="number"
              min={TIMEOUT_SECONDS_MIN}
              max={TIMEOUT_SECONDS_MAX}
              value={timeoutSeconds}
              onChange={(e) => setTimeoutDraft(e.target.value)}
              aria-label="Inactivity timeout in seconds"
              disabled={busy || !settings}
            />
          </label>
          <Button type="submit" variant="secondary" disabled={busy || !settings}>
            Save timeout
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run("Derived data rebuilt.", async () => {
                await rebuildDerivedData();
                await analysis.refresh();
              })
            }
          >
            Rebuild derived data
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              resetSessionizer();
              setMessage("Sessionizer reset for this tab.");
            }}
          >
            Reset current tab session
          </Button>
        </div>
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className="font-semibold">Redaction</h2>
        <p className="text-sm text-muted">
          Keys redacted from persisted tool inputs. Tool-specific keys still apply
          on top of this list.
        </p>
        <ul className="flex flex-wrap gap-2 text-xs">
          {(settings?.redactionKeys ?? []).map((k) => (
            <li key={k} className="flex items-center gap-1 rounded bg-surface-muted px-2 py-1">
              <span>{k}</span>
              <button
                type="button"
                className="text-muted hover:text-foreground"
                aria-label={`Remove ${k}`}
                disabled={busy || !settings}
                onClick={() => {
                  if (!settings) return;
                  void settingsRepo.put({
                    ...settings,
                    redactionKeys: settings.redactionKeys.filter((key) => key !== k),
                  });
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const key = newRedactionKey.trim();
            if (!settings || !key || settings.redactionKeys.includes(key)) return;
            void settingsRepo.put({
              ...settings,
              redactionKeys: [...settings.redactionKeys, key],
            });
            setNewRedactionKey("");
          }}
        >
          <input
            className="rounded border border-border bg-transparent px-2 py-1 text-sm"
            value={newRedactionKey}
            onChange={(e) => setNewRedactionKey(e.target.value)}
            placeholder="Add key"
            aria-label="New redaction key"
          />
          <Button type="submit" variant="secondary" disabled={busy || !newRedactionKey.trim()}>
            Add key
          </Button>
        </form>
      </Card>

      <Card as="section" className="space-y-3">
        <h2 className="font-semibold">Export / import</h2>
        <p className="text-sm text-muted">
          Export writes every IndexedDB table. Import replaces local data with
          that dump.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run("Export downloaded.", async () => {
                const dump = await exportDump();
                const blob = new Blob([JSON.stringify(dump, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `toolgap-export-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              })
            }
          >
            Export JSON
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import JSON file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void file.text().then((text) => {
                try {
                  setPendingDump(JSON.parse(text));
                } catch {
                  setMessage("Import file is not valid JSON.");
                }
              });
            }}
          />
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => importInputRef.current?.click()}
          >
            Import JSON…
          </Button>
        </div>
      </Card>

      <Card as="section" className="space-y-3 border-danger/30">
        <h2 className="font-semibold text-danger">Danger zone</h2>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() =>
            void run("All local ToolGap data cleared.", async () => {
              await resetAllData();
              resetSessionizer();
              await clearDerivedData();
              await analysis.refresh();
            })
          }
        >
          Reset all data
        </Button>
      </Card>

      <Dialog
        open={pendingDump != null}
        title="Replace local data?"
        onClose={() => setPendingDump(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDump(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void run("Import complete.", async () => {
                  const dump = pendingDump;
                  setPendingDump(null);
                  await importDump(dump);
                  resetSessionizer();
                  await analysis.refresh();
                })
              }
            >
              Replace data
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This clears current ToolGap tables and writes the imported dump. Use a
          file produced by Export JSON.
        </p>
      </Dialog>
    </div>
  );
}
