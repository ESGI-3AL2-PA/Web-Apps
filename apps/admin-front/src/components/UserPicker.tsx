import { useEffect, useRef, useState } from "react";
import type { UserResponseDto } from "@repo/contracts";
import { getUser, listUsers } from "../api-service/users";

interface UserPickerProps {
  /** Selected user id, or "" when unassigned. */
  value: string;
  onChange: (id: string) => void;
  /** Restrict search to a district (also enforced server-side for regular admins). */
  districtId?: string | null;
  placeholder?: string;
}

// Typeahead for picking a user, backed by the existing `GET /users?search=` (name/email regex) and
// `GET /users/:id` for resolving an already-selected id into a label. Replaces raw user-id inputs.
export function UserPicker({ value, onChange, districtId, placeholder = "Search by name or email…" }: UserPickerProps) {
  const [selected, setSelected] = useState<UserResponseDto | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResponseDto[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastResolved = useRef<string | null>(null);

  // Resolve the current value to a user for its label. Fails soft (e.g. no access) — the id is kept.
  useEffect(() => {
    if (!value) {
      setSelected(null);
      lastResolved.current = null;
      return;
    }
    if (lastResolved.current === value) return;
    let cancelled = false;
    getUser(value)
      .then((u) => !cancelled && setSelected(u))
      .catch(() => !cancelled && setSelected(null))
      .finally(() => {
        if (!cancelled) lastResolved.current = value;
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  // Debounced search while the dropdown is open.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      listUsers({ page: 1, limit: 8, search: q, ...(districtId ? { districtId } : {}) })
        .then((r) => !cancelled && setResults(r.data))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, districtId]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const pick = (u: UserResponseDto) => {
    setSelected(u);
    lastResolved.current = u.id;
    onChange(u.id);
    setOpen(false);
    setQuery("");
  };

  const clear = () => {
    onChange("");
    setSelected(null);
    lastResolved.current = null;
    setQuery("");
  };

  const label = selected
    ? `${selected.firstName} ${selected.lastName}`
    : value
      ? value.length > 10
        ? `${value.slice(0, 8)}…`
        : value
      : "";

  return (
    <div ref={containerRef} className="relative">
      {value && !open ? (
        <div className="input flex items-center justify-between gap-2">
          <button type="button" className="flex-1 min-w-0 text-start truncate" onClick={() => setOpen(true)}>
            {label}
            {selected && <span className="text-base-content/50"> · {selected.email}</span>}
          </button>
          <button type="button" className="btn btn-xs btn-text btn-circle" aria-label="Clear assignee" onClick={clear}>
            <span className="icon-[tabler--x] size-4" />
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          className="input"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      )}

      {open && (query.trim() || loading) && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full bg-base-100 rounded-box border border-base-content/10 shadow-lg max-h-60 overflow-auto"
        >
          {loading && (
            <li className="px-3 py-2 text-sm text-base-content/60">
              <span className="loading loading-spinner loading-xs" /> Searching…
            </li>
          )}
          {!loading && results.length === 0 && <li className="px-3 py-2 text-sm text-base-content/60">No matches</li>}
          {!loading &&
            results.map((u) => (
              <li key={u.id} role="option" aria-selected={u.id === value}>
                <button
                  type="button"
                  className="w-full text-start px-3 py-2 hover:bg-base-200 text-sm"
                  onClick={() => pick(u)}
                >
                  <span className="font-medium">
                    {u.firstName} {u.lastName}
                  </span>
                  <span className="text-base-content/50"> · {u.email}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
