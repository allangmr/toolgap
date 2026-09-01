import { Badge } from "./Badge";

const DASHED = new Set(["estimated", "inferred", "provisional"]);

const STATUS_MAP: Record<
  string,
  {
    label: string;
    tone: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
    icon: string;
  }
> = {
  active: { label: "Active", tone: "success", icon: "●" },
  completed: { label: "Completed", tone: "accent", icon: "✓" },
  expired: { label: "Settled", tone: "neutral", icon: "○" },
  failed: { label: "Failed", tone: "danger", icon: "✕" },
  unknown: { label: "Not measured", tone: "neutral", icon: "?" },
  abandoned: { label: "Not measured", tone: "neutral", icon: "?" },
  in_progress: { label: "In progress", tone: "info", icon: "…" },
  detected: { label: "Detected", tone: "info", icon: "!" },
  recommendation_ready: { label: "Ready", tone: "accent", icon: "→" },
  simulated: { label: "Simulated", tone: "info", icon: "≈" },
  approved: { label: "Approved", tone: "success", icon: "✓" },
  dismissed: { label: "Dismissed", tone: "neutral", icon: "-" },
  published: { label: "Published", tone: "success", icon: "↑" },
  resolved: { label: "Resolved", tone: "accent", icon: "✓" },
  draft: { label: "Draft", tone: "neutral", icon: "…" },
  ready: { label: "Ready", tone: "accent", icon: "→" },
  inactive: { label: "Inactive", tone: "neutral", icon: "○" },
  low: { label: "Low", tone: "neutral", icon: "·" },
  medium: { label: "Medium", tone: "warning", icon: "!" },
  high: { label: "High", tone: "danger", icon: "!!" },
  static: { label: "Static", tone: "neutral", icon: "S" },
  dynamic: { label: "Dynamic", tone: "accent", icon: "D" },
  measured: { label: "Measured", tone: "success", icon: "M" },
  estimated: { label: "Estimated", tone: "warning", icon: "E" },
  inferred: { label: "Inferred", tone: "info", icon: "?" },
  provisional: { label: "Provisional", tone: "warning", icon: "~" },
};

export function StatusBadge({ status }: { status: string }) {
  const mapped = STATUS_MAP[status] ?? {
    label: status,
    tone: "neutral" as const,
    icon: "·",
  };
  return (
    <Badge tone={mapped.tone} dashed={DASHED.has(status)}>
      <span aria-hidden="true">{mapped.icon}</span>
      <span>{mapped.label}</span>
    </Badge>
  );
}
