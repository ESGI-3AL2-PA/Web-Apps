// Composant : champ d'autocomplétion pour sélectionner un utilisateur par son nom.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UserResponseDto } from "@repo/contracts";
import { getUserPublic, listUsers } from "../api-service/users";

type UserAutocompleteProps = {
  // Id de l'utilisateur sélectionné (contrôlé). Chaîne vide = aucun assigné.
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  // Restreint les candidats à un seul rôle (ex. "admin" pour l'assignation d'un signalement).
  role?: "user" | "admin" | "superAdmin";
  // Relayé sur l'input interne pour qu'un <label htmlFor> englobant puisse le cibler.
  id?: string;
};

/**
 * Sélecteur d'utilisateur par nom, adossé à GET /users (filtré par quartier côté serveur).
 * Résout l'id de la valeur initiale en un nom affiché, puis laisse l'admin chercher par
 * nom et choisir — le composant réécrit l'id via onChange. Recherche debouncée à 300 ms.
 */
export function UserAutocomplete({ value, onChange, placeholder, role, id }: UserAutocompleteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResponseDto[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Résout l'id entrant → nom pour que le champ affiche l'assigné courant à l'ouverture.
  // Le drapeau `cancelled` ignore la réponse si la valeur a changé entre-temps (course).
  useEffect(() => {
    if (!value) {
      setQuery("");
      return;
    }
    let cancelled = false;
    getUserPublic(value)
      .then((u) => !cancelled && setQuery(`${u.firstName} ${u.lastName}`))
      .catch(() => !cancelled && setQuery(t("common.userFallback")));
    return () => {
      cancelled = true;
    };
  }, [value, t]);

  // Recherche debouncée (300 ms), déclenchée dès 2 caractères et seulement quand la liste est ouverte.
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

  // Ferme la liste au clic en dehors du composant.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Sélection d'un résultat : remonte l'id, affiche le nom, referme la liste.
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
          placeholder={placeholder ?? t("common.userSearchPlaceholder")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            // Retaper invalide la sélection courante : on remet l'id à vide tant qu'aucun choix n'est refait.
            if (value) onChange("");
          }}
          onFocus={() => setOpen(true)}
        />
        {value && (
          <button
            type="button"
            aria-label={t("common.actions.clear")}
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
            <li className="disabled px-3 py-2 text-sm text-base-content/60">{t("common.states.searching")}</li>
          )}
          {!loading && results.length === 0 && (
            <li className="disabled px-3 py-2 text-sm text-base-content/60">{t("common.noUserFound")}</li>
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
