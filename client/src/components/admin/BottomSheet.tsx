import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface SheetAction {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick: () => void;
}

export function BottomSheet({ open, onClose, title, actions, children }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  actions?: SheetAction[];
  children?: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-lg rounded-t-2xl border bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-5 py-3">
              <p className="text-sm font-semibold">{title || ""}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-5 py-3">
              {children}
              {actions && (
                <div className="flex flex-col gap-2 pb-4">
                  {actions.map((action, i) => (
                    <Button
                      key={i}
                      variant={action.variant || "outline"}
                      className="w-full justify-start gap-3 py-6 text-base"
                      onClick={() => { action.onClick(); onClose(); }}
                    >
                      {action.icon}{action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
