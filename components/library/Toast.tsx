"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastCtx = {
  show: (kind: ToastKind, message: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider />");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-2 pointer-events-none">
        {items.map((t) => (
          <ToastView
            key={t.id}
            item={t}
            onClose={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const palette =
    item.kind === "success"
      ? "border-[var(--success)] text-[var(--success)] bg-white"
      : item.kind === "error"
      ? "border-[var(--danger)] text-[var(--danger)] bg-white"
      : "border-border text-foreground bg-white";

  const Icon = item.kind === "success" ? CheckCircle2 : item.kind === "error" ? AlertCircle : Info;

  return (
    <div
      className={`pointer-events-auto rounded-xl border ${palette} shadow-md flex items-center gap-2 px-3 py-2.5 transition-all duration-200 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      <Icon className="size-5 shrink-0" />
      <div className="text-sm font-medium text-foreground flex-1">{item.message}</div>
      <button
        onClick={onClose}
        className="text-muted hover:text-foreground"
        aria-label="סגירה"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
