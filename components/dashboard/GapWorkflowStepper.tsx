"use client";

import { Separator } from "@/components/ui/separator";
import {
  WORKFLOW_STEPS,
  type WorkflowStep,
  type WorkflowStepState,
  workflowStepLabel,
} from "@/lib/gaps/workflow-steps";
import { cn } from "@/lib/utils";

export function GapWorkflowStepper({
  activeStep,
  stepStates,
  onStepChange,
}: {
  activeStep: WorkflowStep;
  stepStates: Record<WorkflowStep, WorkflowStepState>;
  onStepChange: (step: WorkflowStep) => void;
}) {
  return (
    <nav
      aria-label="Gap workflow"
      className="rounded-2xl border border-border bg-surface px-3 py-3 shadow-[var(--shadow-card)] md:px-4"
    >
      <ol className="flex flex-col gap-1 md:flex-row md:items-center md:gap-0">
        {WORKFLOW_STEPS.map((step, index) => {
          const state = stepStates[step];
          const selected = step === activeStep;
          const disabled = state === "blocked";

          return (
            <li key={step} className="flex items-center md:flex-1">
              <button
                type="button"
                disabled={disabled}
                aria-current={selected ? "step" : undefined}
                onClick={() => onStepChange(step)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[15px] font-medium transition-colors md:px-3",
                  selected && "bg-accent-subtle text-accent",
                  !selected && state === "complete" && "text-success hover:bg-surface-muted",
                  !selected &&
                    state === "upcoming" &&
                    "text-muted hover:bg-surface-muted hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-45",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold",
                    selected && "border-accent bg-accent text-accent-ink",
                    !selected &&
                      state === "complete" &&
                      "border-success bg-success-subtle text-success",
                    !selected &&
                      state !== "complete" &&
                      "border-border bg-surface text-muted",
                  )}
                  aria-hidden="true"
                >
                  {state === "complete" && !selected ? "✓" : index + 1}
                </span>
                <span>{workflowStepLabel(step)}</span>
              </button>
              {index < WORKFLOW_STEPS.length - 1 ? (
                <Separator
                  orientation="horizontal"
                  className="mx-1 hidden flex-1 md:block"
                  decorative
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
