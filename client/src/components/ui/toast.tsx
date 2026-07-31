import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let listeners: Listener[] = [];
let nextId = 1;

function emit() {
  listeners.forEach((l) => l([...toasts]));
}

export function toast(title: string, description?: string, variant: ToastVariant = "info") {
  const id = nextId++;
  toasts = [...toasts, { id, title, description, variant }];
  emit();
  setTimeout(() => dismiss(id), 4000);
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const styles: Record<ToastVariant, { icon: React.ReactNode; bar: string; iconColor: string }> = {
  success: { icon: <CheckCircle2 className="h-5 w-5" />, bar: "bg-emerald-500", iconColor: "text-emerald-500" },
  error: { icon: <XCircle className="h-5 w-5" />, bar: "bg-red-500", iconColor: "text-red-500" },
  warning: { icon: <AlertTriangle className="h-5 w-5" />, bar: "bg-amber-500", iconColor: "text-amber-500" },
  info: { icon: <Info className="h-5 w-5" />, bar: "bg-blue-500", iconColor: "text-blue-500" },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const l: Listener = setItems;
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[min(92vw,360px)] flex-col gap-2">
      <AnimatePresence>
        {items.map((t) => {
          const s = styles[t.variant];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto relative overflow-hidden rounded-xl border bg-card shadow-lg"
              role="status"
            >
              <span className={cn("absolute left-0 top-0 h-full w-1", s.bar)} />
              <div className="flex items-start gap-3 py-3 pl-4 pr-3">
                <span className={cn("mt-0.5 shrink-0", s.iconColor)}>{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} className="rounded p-1 text-muted-foreground transition hover:bg-accent" aria-label="Dismiss notification">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function useToast() {
  const notify = useCallback((title: string, description?: string, variant: ToastVariant = "info") => {
    toast(title, description, variant);
  }, []);
  return { toast: notify };
}
