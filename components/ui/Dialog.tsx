"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

export function Dialog({
  open,
  title,
  children,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef as RefObject<HTMLDialogElement>}
      aria-labelledby={titleId}
      className="w-[min(560px,calc(100vw-2rem))] rounded-md border border-border bg-surface p-0 text-foreground shadow-[var(--shadow)] backdrop:bg-foreground/45"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="flex items-start justify-between border-b border-border px-5 py-4">
        <h2 id={titleId} className="font-display text-lg font-medium tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm px-2 py-1 text-muted hover:bg-surface-muted hover:text-foreground"
          aria-label="Close dialog"
        >
          ✕
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {actions ? (
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          {actions}
        </div>
      ) : null}
    </dialog>
  );
}
