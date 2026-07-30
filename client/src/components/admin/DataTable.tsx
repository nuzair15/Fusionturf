import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { BottomSheet, SheetAction } from "@/components/admin/BottomSheet";
import {
  Search, ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight,
  Eye, Download, CheckSquare, Square, X, Edit2, Plus, AlertTriangle, Trash2,
  MoreHorizontal,
} from "lucide-react";

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  hidden?: boolean;
  render: (item: T) => React.ReactNode;
}

export interface BulkAction<T> {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary";
  onClick: (items: T[]) => void;
  confirmMessage?: (count: number) => string;
}

interface DataTableProps<T> {
  title: string;
  columns: ColumnDef<T>[];
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (value: string) => void;
  onSort?: (field: string, dir: "asc" | "desc") => void;
  onAdd?: () => void;
  onEdit?: (item: T) => void;
  onView?: (item: T) => void;
  onDelete?: (item: T) => void;
  bulkActions?: BulkAction<T>[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  filters?: React.ReactNode;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return debounced;
}

export function DataTable<T extends { id: string }>({
  title, columns, data, total: propTotal, page: propPage, pageSize: propPageSize = 15,
  onPageChange, onSearch, onSort, onAdd, onEdit, onView, onDelete, bulkActions,
  keyExtractor, loading, emptyMessage, filters,
}: DataTableProps<T>) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(columns.map((c) => c.key)));
  const [localSearch, setLocalSearch] = useState("");
  const debouncedSearch = useDebounce(localSearch, 300);
  const [confirmAction, setConfirmAction] = useState<{ action: BulkAction<T>; items: T[] } | null>(null);
  const [sheetItem, setSheetItem] = useState<T | null>(null);

  const isServerDriven = !!onPageChange;

  const [clientPage, setClientPage] = useState(1);
  const [clientSort, setClientSort] = useState<{ field: string; dir: "asc" | "desc" } | null>(null);

  const page = isServerDriven ? (propPage || 1) : clientPage;
  const total = isServerDriven ? (propTotal || data.length) : data.length;
  const totalPages = Math.max(1, Math.ceil(total / propPageSize));

  useEffect(() => { onSearch?.(debouncedSearch); }, [debouncedSearch]);
  useEffect(() => { if (!isServerDriven) setClientPage(1); }, [debouncedSearch]);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const visibleCols = columns.filter((c) => visibleColumns.has(c.key));

  const toggleAll = () => {
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map((d) => keyExtractor(d))));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleBulkAction = (action: BulkAction<T>) => {
    const items = data.filter((d) => selected.has(keyExtractor(d)));
    if (action.confirmMessage) setConfirmAction({ action, items });
    else { action.onClick(items); setSelected(new Set()); }
  };

  const exportCsv = useCallback(() => {
    const headers = visibleCols.map((c) => c.label).join(",");
    const rows = data.map((item) => visibleCols.map((c) => {
      const r = c.render(item);
      return typeof r === "string" ? `"${r.replace(/"/g, '""')}"` : `"${keyExtractor(item)}"`;
    }).join(","));
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
  }, [data, visibleCols, title]);

  const handleSort = (key: string) => {
    if (isServerDriven && onSort) {
      const dir = sortField === key && sortDirection === "asc" ? "desc" : "asc";
      onSort(key, dir);
    } else {
      setClientSort((prev) => {
        if (prev?.field === key) return { field: key, dir: prev.dir === "asc" ? "desc" : "asc" };
        return { field: key, dir: "asc" };
      });
    }
  };

  const processed = useMemo(() => {
    let items = [...data];
    if (!isServerDriven && debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter((item) =>
        visibleCols.some((col) => {
          const rendered = col.render(item);
          return typeof rendered === "string" && rendered.toLowerCase().includes(q);
        })
      );
    }
    if (!isServerDriven && clientSort) {
      items.sort((a, b) => {
        const aVal = String(clientSort.field === "id" ? keyExtractor(a) : clientSort.field);
        const bVal = String(clientSort.field === "id" ? keyExtractor(b) : clientSort.field);
        const cmp = aVal.localeCompare(bVal);
        return clientSort.dir === "asc" ? cmp : -cmp;
      });
    }
    if (!isServerDriven) {
      const start = (page - 1) * propPageSize;
      items = items.slice(start, start + propPageSize);
    }
    return items;
  }, [data, isServerDriven, debouncedSearch, clientSort, page, propPageSize, visibleCols]);

  const displayTotal = !isServerDriven && debouncedSearch ? processed.length : total;

  const goToPage = (p: number) => {
    if (isServerDriven) onPageChange?.(p);
    else setClientPage(p);
  };

  const sortField = isServerDriven ? undefined : clientSort?.field;
  const sortDirection = isServerDriven ? undefined : clientSort?.dir;

  const sortIndicator = (key: string) => {
    const sf = isServerDriven ? undefined : clientSort?.field;
    const sd = isServerDriven ? undefined : clientSort?.dir;
    if (sf !== key) return <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 text-muted-foreground/40" />;
    return sd === "asc" ? <ChevronUp className="ml-1 h-3 w-3 shrink-0" /> : <ChevronDown className="ml-1 h-3 w-3 shrink-0" />;
  };

  const allSelected = data.length > 0 && selected.size === data.length;
  const someSelected = selected.size > 0 && !allSelected;
  const empty = !loading && processed.length === 0;

  const sheetActions = useMemo((): SheetAction[] => {
    if (!sheetItem) return [];
    const acts: SheetAction[] = [];
    if (onView) acts.push({ label: "View Details", onClick: () => onView(sheetItem) });
    if (onEdit) acts.push({ label: "Edit", icon: <Edit2 className="h-4 w-4" />, onClick: () => onEdit(sheetItem) });
    if (onDelete) acts.push({ label: "Delete", icon: <Trash2 className="h-4 w-4" />, variant: "destructive", onClick: () => onDelete(sheetItem) });
    return acts;
  }, [sheetItem, onView, onEdit, onDelete]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{title} <span className="text-sm font-normal text-muted-foreground">({displayTotal})</span></h2>
        <div className="flex items-center gap-2">
          {onSearch !== undefined && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={localSearch} onChange={(e) => setLocalSearch(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}...`}
                className="h-9 w-44 pl-8 text-sm sm:w-64" />
            </div>
          )}
          {!isMobile && onAdd && <Button size="sm" onClick={onAdd}><Plus className="mr-1 h-4 w-4" /> Add</Button>}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <div className="ml-auto flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}><X className="mr-1 h-3.5 w-3.5" /> Clear</Button>
                {(bulkActions || []).map((action, i) => (
                  <Button key={i} size="sm" variant={action.variant || "outline"} onClick={() => handleBulkAction(action)}>
                    {action.icon}{action.label}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {filters && <div className="flex flex-wrap gap-2">{filters}</div>}

      {/* Mobile: Card layout */}
      {isMobile ? (
        <div className="space-y-3 pb-20">
          {loading ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          )) : empty ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="h-10 w-10 opacity-30" />
              <p className="mt-2 text-sm">{emptyMessage || `No ${title.toLowerCase()} found`}</p>
            </div>
          ) : processed.map((item) => {
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
                onClick={() => {
                  if (onView) onView(item);
                }}
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
                        onClick={(e) => { e.stopPropagation(); toggleOne(id); }}
                        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                      >
                        {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
                      </button>
                    )}
                    {(onEdit || onDelete) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSheetItem(item); }}
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
      ) : (
        /* Desktop: Table layout */
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-secondary/90 backdrop-blur">
                <tr>
                  {(bulkActions || onDelete) && (
                    <th className="w-10 p-3">
                      <button onClick={toggleAll} className="flex items-center justify-center">
                        {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : someSelected ? <CheckSquare className="h-4 w-4 text-primary/60" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </th>
                  )}
                  {visibleCols.map((col) => (
                    <th key={col.key} className={cn("p-3 text-left font-medium text-muted-foreground", col.sortable && "cursor-pointer select-none hover:text-foreground")}
                      onClick={() => col.sortable && handleSort(col.key)}>
                      <div className="flex items-center">{col.label}{col.sortable && sortIndicator(col.key)}</div>
                    </th>
                  ))}
                  {(onEdit || onDelete) && <th className="w-20 p-3 text-right text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3" colSpan={visibleCols.length + 2}><div className="h-6 animate-pulse rounded bg-muted" /></td>
                  </tr>
                )) : empty ? (
                  <tr>
                    <td colSpan={visibleCols.length + 2} className="p-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-1"><Search className="h-8 w-8 opacity-30" /><p>{emptyMessage || `No ${title.toLowerCase()} found`}</p></div>
                    </td>
                  </tr>
                ) : processed.map((item) => {
                  const id = keyExtractor(item);
                  return (
                    <tr key={id} className={cn("border-t transition hover:bg-muted/20", selected.has(id) && "bg-primary/5", onView && "cursor-pointer")}
                      onClick={() => onView?.(item)}>
                      {(bulkActions || onDelete) && (
                        <td className="w-10 p-3">
                          <button onClick={() => toggleOne(id)} className="flex items-center justify-center">
                            {selected.has(id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        </td>
                      )}
                      {visibleCols.map((col) => <td key={col.key} className="p-3">{col.render(item)}</td>)}
                      {(onEdit || onDelete) && (
                        <td className="w-20 p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {onEdit && <Button variant="ghost" size="sm" onClick={() => onEdit(item)}><Edit2 className="h-4 w-4" /></Button>}
                            {onDelete && <Button variant="ghost" size="sm" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom bar: Columns + CSV + pagination (hidden on mobile, replaced by FAB) */}
      <div className={cn("flex flex-wrap items-center justify-between gap-3", isMobile && "hidden")}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowColumns(!showColumns)}>
              <Eye className="h-3.5 w-3.5" /> Columns
            </Button>
            <AnimatePresence>
              {showColumns && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute bottom-full left-0 mb-1 z-20 min-w-40 rounded-lg border bg-popover p-2 shadow-lg">
                  {columns.map((col) => (
                    <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                      <input type="checkbox" checked={visibleColumns.has(col.key)} onChange={() => toggleColumn(col.key)} className="rounded" />
                      {col.label}
                    </label>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>

        <div className="flex items-center gap-1 text-sm">
          <span className="mr-2 text-muted-foreground">Page {page} of {totalPages} ({displayTotal} items)</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => goToPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            const p = start + i;
            if (p > totalPages) return null;
            return <Button key={p} variant={p === page ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => goToPage(p)}>{p}</Button>;
          })}
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Mobile: Sticky FAB */}
      {isMobile && onAdd && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fixed bottom-6 right-6 z-30"
        >
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90"
            onClick={onAdd}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </motion.div>
      )}

      {/* Mobile: Pagination strip */}
      {isMobile && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Button variant="outline" size="sm" className="h-9 px-3" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[80px] text-center text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" className="h-9 px-3" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Mobile: Bottom Sheet for actions */}
      <BottomSheet
        open={!!sheetItem}
        onClose={() => setSheetItem(null)}
        title="Actions"
        actions={sheetActions}
      />

      {/* Confirmation dialog */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmAction(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="mx-4 w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertTriangle className="h-10 w-10 text-destructive" />
                <h3 className="text-lg font-semibold">Confirm Action</h3>
                <p className="text-sm text-muted-foreground">
                  {confirmAction.action.confirmMessage?.(confirmAction.items.length) || `Are you sure you want to perform this action on ${confirmAction.items.length} item(s)?`}
                </p>
                <div className="mt-2 flex gap-3">
                  <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
                  <Button variant={confirmAction.action.variant === "destructive" ? "destructive" : "default"}
                    onClick={() => { confirmAction.action.onClick(confirmAction.items); setSelected(new Set()); setConfirmAction(null); }}>
                    Confirm
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
