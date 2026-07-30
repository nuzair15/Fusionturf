import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { BulkAction } from "./DataTable";

interface BulkActionBarProps<T> {
  selectedCount: number;
  bulkActions: BulkAction<T>[];
  onClear: () => void;
  onAction: (action: BulkAction<T>) => void;
}

export function BulkActionBar<T>({ selectedCount, bulkActions, onClear, onAction }: BulkActionBarProps<T>) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2">
            <span className="text-sm font-medium">{selectedCount} selected</span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button size="sm" variant="ghost" onClick={onClear}><X className="mr-1 h-3.5 w-3.5" /> Clear</Button>
              {bulkActions.map((action, i) => (
                <Button key={i} size="sm" variant={action.variant || "outline"} onClick={() => onAction(action)}>
                  {action.icon}{action.label}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
