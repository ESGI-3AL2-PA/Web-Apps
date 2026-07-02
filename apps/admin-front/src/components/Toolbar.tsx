import type { ReactNode } from "react";

export interface FilterSelect {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

interface ToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterSelect[];
  /** Trailing slot, e.g. a "Create" button. */
  actions?: ReactNode;
}

export function Toolbar({ search, onSearchChange, searchPlaceholder = "Search…", filters, actions }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      {onSearchChange && (
        <label className="input input-sm max-w-xs grow">
          <span className="icon-[tabler--search] size-4 text-base-content/60" />
          <input
            type="search"
            value={search ?? ""}
            placeholder={searchPlaceholder}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>
      )}
      {filters?.map((filter) => (
        <select
          key={filter.key}
          className="select select-sm max-w-[12rem]"
          value={filter.value}
          onChange={(e) => filter.onChange(e.target.value)}
        >
          <option value="">{filter.label}: all</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
      {actions && <div className="ms-auto">{actions}</div>}
    </div>
  );
}
