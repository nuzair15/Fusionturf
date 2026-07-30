import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import type { ColumnDef } from "./DataTable";

interface ColumnSelectorProps {
  columns: ColumnDef<any>[];
  visibleColumns: Set<string>;
  onToggle: (key: string) => void;
}

export function ColumnSelector({ columns, visibleColumns, onToggle }: ColumnSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setOpen(!open)}>
        <Eye className="h-3.5 w-3.5" /> Columns
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute bottom-full left-0 mb-1 z-20 min-w-40 rounded-lg border bg-popover p-2 shadow-lg"
          >
            {columns.map((col) => (
              <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                <input type="checkbox" checked={visibleColumns.has(col.key)} onChange={() => onToggle(col.key)} className="rounded" />
                {col.label}
              </label>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
