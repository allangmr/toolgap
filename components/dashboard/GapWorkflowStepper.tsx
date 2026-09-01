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
    <nav aria-label="Gap workflow" className="w-full">
      <ol className="flex flex-col gap-2 md:flex-row md:items-center md:gap-0">
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
                  "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium transition-colors md:px-3",
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
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
                    selected && "border-accent bg-accent text-accent-ink",
                    !selected && state === "complete" && "border-success bg-success-subtle text-success",
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
                  className="mx-2 hidden flex-1 md:block"
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
