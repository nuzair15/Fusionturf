import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";

interface TableToolbarProps {
  title: string;
  displayTotal: number;
  searchable: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  onAdd?: () => void;
  showAddButton: boolean;
}

export function TableToolbar({ title, displayTotal, searchable, searchValue, onSearchChange, searchPlaceholder, onAdd, showAddButton }: TableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{title} <span className="text-sm font-normal text-muted-foreground">({displayTotal})</span></h2>
      <div className="flex items-center gap-2">
        {searchable && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-44 pl-8 text-sm sm:w-64"
            />
          </div>
        )}
        {showAddButton && onAdd && <Button size="sm" onClick={onAdd}><Plus className="mr-1 h-4 w-4" /> Add</Button>}
      </div>
    </div>
  );
}
