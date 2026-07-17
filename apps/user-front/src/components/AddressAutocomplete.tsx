import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// Controlled address input with typeahead from the French Base Adresse Nationale
// (BAN, api-adresse.data.gouv.fr). Free text stays allowed; picking a suggestion
// writes back the canonical full label. Presentation-only — hits BAN directly, not
// our backend, so it lives outside api-service/.
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
  // Open the suggestion list above the input. Use when the field sits directly on top of
  // action buttons (e.g. the profile edit form) so the floating list can't cover them.
  dropUp?: boolean;
}) {
  const { t } = useTranslation();
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false); // suppress the fetch triggered by a pick

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

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

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
