"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { configOverrideFrom, type ConfigOverride } from "@/lib/recommendations/builder";
import { PRODUCT_FIELD_WHITELIST } from "@/lib/store-domain/catalog";

export function RecommendationConfigForm({
  templateConfig,
  issues,
  busy,
  onSave,
}: {
  templateConfig: Record<string, unknown>;
  issues: string[];
  busy: boolean;
  onSave: (override: ConfigOverride) => void;
}) {
  const suggested = configOverrideFrom(templateConfig);
  const [draft, setDraft] = useState<ConfigOverride>(suggested);
  const [dirty, setDirty] = useState(false);

  const supportsFields = suggested.fields !== undefined;
  const selected = new Set(draft.fields ?? []);

  function update(patch: Partial<ConfigOverride>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function toggleField(field: string) {
    const next = new Set(selected);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    update({ fields: PRODUCT_FIELD_WHITELIST.filter((f) => next.has(f)) });
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface-muted/40 p-4">
      <div>
        <h3 className="text-sm font-semibold">Edit before publishing</h3>
        <p className="mt-1 text-xs text-muted">
          Changes are validated against the capability template, then applied to
          the tool that gets registered. Editing clears the simulation and
          returns the recommendation to unapproved.
        </p>
      </div>

      <label className="block text-sm">
        Tool name
        <input
          className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 font-mono"
          value={draft.toolName ?? ""}
          onChange={(e) => update({ toolName: e.target.value })}
        />
      </label>

      <label className="block text-sm">
        Description
        <span className="ml-1 text-xs text-muted">
          the text an agent reads when it decides whether to call this tool
        </span>
        <textarea
          className="mt-1 w-full rounded border border-border bg-surface px-2 py-1"
          rows={3}
          value={draft.description ?? ""}
          onChange={(e) => update({ description: e.target.value })}
        />
      </label>

      <label className="block text-sm">
        Max batch size
        <input
          type="number"
          className="mt-1 w-32 rounded border border-border bg-surface px-2 py-1 tabular-nums"
          value={draft.maxBatchSize ?? 0}
          onChange={(e) => update({ maxBatchSize: Number(e.target.value) })}
        />
      </label>

      {supportsFields ? (
        <fieldset>
          <legend className="text-sm">Exposed fields</legend>
          <p className="text-xs text-muted">
            Only whitelisted product fields can be returned.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
            {PRODUCT_FIELD_WHITELIST.map((field) => (
              <label key={field} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.has(field)}
                  onChange={() => toggleField(field)}
                />
                <span className="font-mono">{field}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {issues.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-danger" aria-live="polite">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        <Button onClick={() => onSave(draft)} disabled={busy || !dirty}>
          Save changes
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setDraft(suggested);
            setDirty(false);
          }}
          disabled={busy || !dirty}
        >
          Reset to suggested
        </Button>
      </div>
    </section>
  );
}
