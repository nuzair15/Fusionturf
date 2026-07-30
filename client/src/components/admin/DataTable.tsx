import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { BottomSheet } from "@/components/admin/BottomSheet";
import { ErrorState } from "@/components/admin/ErrorState";
import { TableToolbar } from "@/components/admin/TableToolbar";
import { BulkActionBar } from "@/components/admin/BulkActionBar";
import { ColumnSelector } from "@/components/admin/ColumnSelector";
import { TablePagination, MobilePagination } from "@/components/admin/TablePagination";
import { MobileTable } from "@/components/admin/MobileTable";
import {
  Search, ChevronDown, ChevronUp, ChevronsUpDown,
  Edit2, Plus, AlertTriangle, Download, Trash2,
  CheckSquare, Square,
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
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  filters?: React.ReactNode;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return debounced;
}

export function DataTable<T>({
  title, columns, data, total: propTotal, page: propPage, pageSize: propPageSize = 15,
  onPageChange, onSearch, onSort, onAdd, onEdit, onView, onDelete, bulkActions,
  keyExtractor, loading, error, onRetry, emptyMessage, filters,
}: DataTableProps<T>) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const visibleCols = columns.filter((c) => visibleColumns.has(c.key));
  const allSelected = data.length > 0 && selected.size === data.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

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
  }, [data, isServerDriven, clientSort, page, propPageSize]);

  const displayTotal = total;

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

  const sheetActions = useMemo(() => {
    if (!sheetItem) return [];
    const acts: { label: string; icon?: React.ReactNode; variant?: "default" | "destructive" | "outline" | "secondary"; onClick: () => void }[] = [];
    if (onView) acts.push({ label: "View Details", onClick: () => onView(sheetItem) });
    if (onEdit) acts.push({ label: "Edit", icon: <Edit2 className="h-4 w-4" />, onClick: () => onEdit(sheetItem) });
    if (onDelete) acts.push({ label: "Delete", icon: <Trash2 className="h-4 w-4" />, variant: "destructive" as const, onClick: () => onDelete(sheetItem) });
    return acts;
  }, [sheetItem, onView, onEdit, onDelete]);

  return (
    <div className="space-y-4">
      <TableToolbar
        title={title}
        displayTotal={displayTotal}
        searchable={onSearch !== undefined}
        searchValue={localSearch}
        onSearchChange={setLocalSearch}
        searchPlaceholder={`Search ${title.toLowerCase()}...`}
        onAdd={onAdd}
        showAddButton={!isMobile}
      />

      <BulkActionBar
        selectedCount={selected.size}
        bulkActions={bulkActions || []}
        onClear={() => setSelected(new Set())}
        onAction={handleBulkAction}
      />

      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <>
          {filters && <div className="flex flex-wrap gap-2">{filters}</div>}

          {isMobile ? (
            <MobileTable
              items={processed}
              columns={columns}
              visibleCols={visibleCols}
              selected={selected}
              keyExtractor={keyExtractor}
              loading={loading}
              emptyMessage={emptyMessage}
              title={title}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              bulkActions={bulkActions}
              onToggleOne={toggleOne}
              onSheetOpen={setSheetItem}
            />
          ) : (
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
                    )) : !loading && processed.length === 0 ? (
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
        </>
      )}

      <div className={cn("flex flex-wrap items-center justify-between gap-3", isMobile && "hidden")}>
        <div className="flex items-center gap-2">
          <ColumnSelector columns={columns} visibleColumns={visibleColumns} onToggle={toggleColumn} />
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
        <TablePagination page={page} totalPages={totalPages} displayTotal={displayTotal} onPageChange={goToPage} />
      </div>

      {isMobile && onAdd && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fixed bottom-6 right-6 z-30"
        >
          <Button size="lg" className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90" onClick={onAdd}>
            <Plus className="h-6 w-6" />
          </Button>
        </motion.div>
      )}

      {isMobile && <MobilePagination page={page} totalPages={totalPages} onPageChange={goToPage} />}

      <BottomSheet open={!!sheetItem} onClose={() => setSheetItem(null)} title="Actions" actions={sheetActions} />

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
