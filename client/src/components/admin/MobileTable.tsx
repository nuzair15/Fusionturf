import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Search, CheckSquare, Square, MoreHorizontal } from "lucide-react";
import type { ColumnDef, BulkAction } from "./DataTable";

interface MobileTableProps<T> {
  items: T[];
  columns: ColumnDef<T>[];
  visibleCols: ColumnDef<T>[];
  selected: Set<string>;
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  title: string;
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  bulkActions?: BulkAction<T>[];
  onToggleOne: (id: string) => void;
  onSheetOpen: (item: T) => void;
}

export function MobileTable<T>({
  items, visibleCols, selected, keyExtractor, loading, emptyMessage, title,
  onView, onEdit, onDelete, bulkActions, onToggleOne, onSheetOpen,
}: MobileTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-3 pb-20">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground">
        <Search className="h-10 w-10 opacity-30" />
        <p className="mt-2 text-sm">{emptyMessage || `No ${title.toLowerCase()} found`}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      {items.map((item) => {
        const id = keyExtractor(item);
        const isSelected = selected.has(id);
        return (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-xl border bg-card p-4 shadow-sm active:scale-[0.98] transition-transform",
              isSelected && "ring-2 ring-primary",
              onView && "cursor-pointer"
            )}
            onClick={() => { if (onView) onView(item); }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                {visibleCols.slice(0, 3).map((col) => (
                  <div key={col.key} className="text-sm">
                    <span className="text-xs font-medium text-muted-foreground">{col.label}: </span>
                    <span className="font-medium">{col.render(item)}</span>
                  </div>
                ))}
                {visibleCols.length > 3 && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer py-1 font-medium">More details</summary>
                    <div className="mt-1.5 space-y-1.5 pl-1">
                      {visibleCols.slice(3).map((col) => (
                        <div key={col.key}>
                          <span className="text-muted-foreground">{col.label}: </span>
                          {col.render(item)}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {(bulkActions || onDelete) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleOne(id); }}
                    className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                  >
                    {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
                  </button>
                )}
                {(onEdit || onDelete) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSheetOpen(item); }}
                    className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                  >
                    <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
