import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Champ d'adresse contrôlé avec autocomplétion depuis la Base Adresse Nationale
 * française (BAN, api-adresse.data.gouv.fr). La saisie libre reste autorisée ;
 * choisir une suggestion réécrit le libellé complet canonique.
 *
 * Purement présentationnel : tape directement la BAN et non notre backend, d'où sa
 * place hors de api-service/.
 *
 * @param value        Valeur contrôlée du champ.
 * @param onChange     Rappelé à chaque frappe et à la sélection d'une suggestion.
 * @param dropUp       Ouvre la liste de suggestions AU-DESSUS du champ. À utiliser
 *                     quand le champ surplombe des boutons d'action (ex. formulaire
 *                     d'édition de profil) pour que la liste flottante ne les masque pas.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  id,
  placeholder,
  dropUp = false,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
  dropUp?: boolean;
}) {
  const { t } = useTranslation();
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false); // supprime le fetch déclenché par une sélection

  // Recherche BAN débouncée à chaque changement de `value`. Ignore le cycle
  // consécutif à une sélection (skipNext), n'interroge qu'à partir de 3 caractères,
  // et annule proprement (drapeau `cancelled` + clearTimeout) si la valeur change
  // avant la fin du délai.
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // Débounce de 300 ms avant de taper l'API BAN.
    const tid = setTimeout(() => {
      const url = `https://api-adresse.data.gouv.fr/search/?limit=5&autocomplete=1&q=${encodeURIComponent(q)}`;
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const labels: string[] = (data.features ?? [])
            .map((f: { properties?: { label?: string } }) => f.properties?.label)
            .filter(Boolean);
          setResults(labels);
          setOpen(true);
        })
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [value]);

  // Ferme la liste sur un clic en dehors du composant (détection via boxRef).
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Sélection d'une suggestion : arme skipNext pour ne pas relancer un fetch sur le
  // libellé qu'on vient d'écrire, remonte la valeur canonique et referme la liste.
  const pick = (label: string) => {
    skipNext.current = true;
    onChange(label);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative mt-1">
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="input w-full"
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      {open && (
        <ul
          className={`menu absolute inset-x-0 z-[60] max-h-56 flex-nowrap overflow-y-auto rounded-box border border-base-content/10 bg-base-100 p-1 shadow-lg ${
            dropUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
          }`}
        >
          {loading && <li className="px-3 py-2 text-sm text-base-content/60">{t("messages.searching")}</li>}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-base-content/60">{t("messages.noAddress")}</li>
          )}
          {results.map((label) => (
            <li key={label}>
              <button type="button" onClick={() => pick(label)}>
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
