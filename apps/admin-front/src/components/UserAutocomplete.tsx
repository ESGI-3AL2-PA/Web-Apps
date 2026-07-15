import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UserResponseDto } from "@repo/contracts";
import { getUserPublic, listUsers } from "../api-service/users";

type UserAutocompleteProps = {
  // Selected user id (controlled). Empty string = no assignee.
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  // Restrict candidates to a single role (e.g. "admin" for incident assignment).
  role?: "user" | "admin" | "superAdmin";
  // Forwarded onto the inner input so a wrapping <label htmlFor> can target it.
  id?: string;
};

// Name-based user picker backed by GET /users (district-scoped server-side). Resolves the
// initial value's id to a name, then lets the admin search by name and pick — writes the id back.
export function UserAutocomplete({ value, onChange, placeholder, role, id }: UserAutocompleteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResponseDto[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Resolve the incoming id → name so the field shows the current assignee on open.
  useEffect(() => {
    if (!value) {
      setQuery("");
      return;
    }
    let cancelled = false;
    getUserPublic(value)
      .then((u) => !cancelled && setQuery(`${u.firstName} ${u.lastName}`))
      .catch(() => !cancelled && setQuery(t("userAutocomplete.fallbackName")));
    return () => {
      cancelled = true;
    };
  }, [value, t]);

  // Debounced search (300ms). Skipped while a selection is reflected in the field.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      listUsers({ search: q, limit: 10, ...(role ? { role } : {}) })
        .then((res) => !cancelled && setResults(res.data))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, role]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (u: UserResponseDto) => {
    onChange(u.id);
    setQuery(`${u.firstName} ${u.lastName}`);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <label className="input">
        <span className="icon-[tabler--user] size-4 text-base-content/60" />
        <input
          id={id}
          value={query}
          placeholder={placeholder ?? t("userAutocomplete.placeholder")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          onFocus={() => setOpen(true)}
        />
        {value && (
          <button
            type="button"
            aria-label={t("userAutocomplete.clear")}
            className="btn btn-circle btn-text btn-xs"
            onClick={() => {
              onChange("");
              setQuery("");
              setResults([]);
            }}
          >
            <span className="icon-[tabler--x] size-4" />
          </button>
        )}
      </label>
      {open && query.trim().length >= 2 && (
        <ul className="menu absolute z-10 mt-1 w-full rounded-box border border-base-content/10 bg-base-100 shadow-lg max-h-56 overflow-y-auto flex-nowrap">
          {loading && (
            <li className="disabled px-3 py-2 text-sm text-base-content/60">{t("userAutocomplete.searching")}</li>
          )}
          {!loading && results.length === 0 && (
            <li className="disabled px-3 py-2 text-sm text-base-content/60">{t("userAutocomplete.noUserFound")}</li>
          )}
          {results.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => pick(u)}>
                {u.firstName} {u.lastName}
                <span className="text-xs text-base-content/50">{u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
