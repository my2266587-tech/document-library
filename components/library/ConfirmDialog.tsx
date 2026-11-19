"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  /** Red confirm button, for deleting. */
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const Ctx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Returns `confirm(opts)`, resolving to true when the user approves. Replaces the browser's confirm(). */
export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider />");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...opts, resolve });
      }),
    []
  );

  const answer = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending]
  );

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {pending && <ConfirmView pending={pending} onAnswer={answer} />}
    </Ctx.Provider>
  );
}

function ConfirmView({ pending, onAnswer }: { pending: Pending; onAnswer: (ok: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus starts on "cancel" so Enter never deletes by accident.
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onAnswer(false);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onAnswer]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onAnswer(false)} />
      <div className="relative w-full max-w-sm bg-surface rounded-2xl shadow-xl border border-border p-5">
        <div className="flex items-start gap-3">
          {pending.danger && (
            <div className="size-10 shrink-0 rounded-full bg-danger-soft text-danger flex items-center justify-center">
              <AlertTriangle className="size-5" />
            </div>
          )}
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-semibold text-foreground break-words">
              {pending.title}
            </h2>
            {pending.message && <p className="text-sm text-muted mt-1">{pending.message}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onAnswer(false)}
            className="min-h-11 px-4 rounded-xl border border-border text-foreground hover:bg-accent-soft transition"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => onAnswer(true)}
            className={`min-h-11 px-4 rounded-xl font-medium text-white transition ${
              pending.danger ? "bg-danger hover:bg-danger/90" : "bg-accent hover:bg-accent-hover"
            }`}
          >
            {pending.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
