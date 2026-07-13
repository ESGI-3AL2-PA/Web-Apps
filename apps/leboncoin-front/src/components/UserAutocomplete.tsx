import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { searchUsersPublic, type UserPublic } from "../api-service/users.service";

// Search neighbours by name (backend scopes to the caller's district). The parent
// owns the selected user; this only drives the query + dropdown.
export default function UserAutocomplete({
  selected,
  onSelect,
  autoFocus,
  id,
}: {
  selected: UserPublic | null;
  onSelect: (u: UserPublic | null) => void;
  autoFocus?: boolean;
  id?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPublic[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const tid = setTimeout(() => {
      searchUsersPublic(q)
        .then((users) => {
          if (cancelled) return;
          setResults(users);
          setOpen(true);
        })
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [query, selected]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (u: UserPublic) => {
    onSelect(u);
    setQuery(`${u.firstName} ${u.lastName}`);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        value={query}
        autoFocus={autoFocus}
        placeholder={t("messages.searchNeighbour")}
        onChange={(e) => {
          if (selected) onSelect(null);
          setQuery(e.target.value);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="h-10 w-full rounded-lg border border-neutral-300 px-3 pr-8 text-sm outline-none focus:border-[color:var(--color-brand)]"
      />
      {selected && (
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery("");
            setResults([]);
          }}
          aria-label={t("common.cancel")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-lg leading-none text-neutral-400 hover:text-neutral-600"
        >
          ×
        </button>
      )}
      {open && !selected && (
        <ul className="absolute inset-x-0 top-[calc(100%+4px)] z-[60] max-h-56 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-neutral-500">{t("messages.searching")}</li>}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-500">{t("messages.noNeighbour")}</li>
          )}
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => pick(u)}
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[color:var(--color-brand-soft)]"
              >
                {u.firstName} {u.lastName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
