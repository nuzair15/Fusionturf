import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function ApiErrorNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMessage(detail?.message || "Something went wrong. Please try again.");
    };
    window.addEventListener("fusion-api-error", onError);
    return () => window.removeEventListener("fusion-api-error", onError);
  }, []);

  if (!message) return null;
  return (
    <div className="fixed inset-x-4 top-4 z-[100] mx-auto flex max-w-lg items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-lg">
      <span>{message}</span>
      <button aria-label="Dismiss error" onClick={() => setMessage(null)}><X className="h-4 w-4" /></button>
    </div>
  );
}
