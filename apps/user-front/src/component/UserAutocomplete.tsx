import { useEffect, useRef, useState } from "react";
import { searchUsersPublic, type UserPublic } from "../api-service/users.service";

type UserAutocompleteProps = {
  selected: UserPublic | null;
  onSelect: (user: UserPublic | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
};

// Champ de recherche par nom (scopé au quartier côté backend) : l'user tape un nom,
// choisit dans la liste, et on remonte le UserPublic sélectionné au parent.
const UserAutocomplete = ({ selected, onSelect, placeholder, autoFocus, id }: UserAutocompleteProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPublic[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounce 300 ms (aligné sur useList côté admin) pour ne pas requêter à chaque frappe.
  useEffect(() => {
    if (selected) return; // un choix est fait : on ne recherche plus
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
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
      clearTimeout(t);
    };
  }, [query, selected]);

  // Ferme la liste au clic extérieur.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (user: UserPublic) => {
    onSelect(user);
    setQuery(`${user.firstName} ${user.lastName}`);
    setOpen(false);
  };

  const clear = () => {
    onSelect(null);
    setQuery("");
    setResults([]);
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        id={id}
        type="text"
        value={query}
        autoFocus={autoFocus}
        placeholder={placeholder ?? "Rechercher un voisin par nom…"}
        onChange={(e) => {
          if (selected) onSelect(null);
          setQuery(e.target.value);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        style={{
          width: "100%",
          padding: 8,
          paddingRight: selected ? 32 : 8,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          fontSize: 14,
        }}
      />
      {selected && (
        <button
          type="button"
          onClick={clear}
          aria-label="Effacer la sélection"
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            color: "#6b7280",
            lineHeight: 1,
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
      {open && !selected && (
        <ul
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            margin: 0,
            padding: 4,
            listStyle: "none",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
            maxHeight: 220,
            overflowY: "auto",
            zIndex: 60,
          }}
        >
          {loading && <li style={{ padding: "8px 10px", fontSize: 13, color: "#6b7280" }}>Recherche…</li>}
          {!loading && results.length === 0 && (
            <li style={{ padding: "8px 10px", fontSize: 13, color: "#6b7280" }}>Aucun voisin trouvé</li>
          )}
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => pick(u)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px 10px",
                  fontSize: 14,
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                {u.firstName} {u.lastName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UserAutocomplete;
