import { z } from "zod";

const SENSITIVE_KEY_RE =
  /password|token|secret|api[_-]?key|email|card|credit|ssn|authorization|cookie/i;

export function redactValue(
  input: Record<string, unknown>,
  extraKeys: string[] = [],
): Record<string, unknown> {
  const extra = new Set(extraKeys.map((k) => k.toLowerCase()));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_RE.test(key) || extra.has(key.toLowerCase())) {
      out[key] = "[redacted]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redactValue(value as Record<string, unknown>, extraKeys);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function truncateError(message: string, max = 240): string {
  if (message.length <= max) return message;
  return `${message.slice(0, max - 1)}…`;
}

export function hashParams(input: Record<string, unknown>): string {
  const normalized = JSON.stringify(sortKeys(input));
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}

export function safeJsonSchema(schema: z.ZodType): Record<string, unknown> {
  try {
    return z.toJSONSchema(schema) as Record<string, unknown>;
  } catch {
    return { type: "object", additionalProperties: true };
  }
}
