/**
 * Sélecteur de langue FR/EN de la landing page.
 */
import type { Lang } from "../i18n";

/**
 * Props du composant {@link LangToggle}.
 */
interface LangToggleProps {
  /** Langue actuellement active. */
  lang: Lang;
  /** Appelé avec la nouvelle langue lorsqu'un bouton est cliqué. */
  onChange: (lang: Lang) => void;
}

// Langues proposées, dans l'ordre d'affichage du sélecteur.
const options: { value: Lang; label: string }[] = [
  { value: "fr", label: "FR" },
  { value: "en", label: "EN" },
];

/**
 * Bouton segmenté FR/EN — reprend le contrôle de langue déjà présent dans
 * l'en-tête de l'application. Le bouton actif porte `aria-pressed` pour
 * l'accessibilité.
 */
const LangToggle = ({ lang, onChange }: LangToggleProps) => {
  return (
    <div
      className="inline-flex items-center rounded-full border border-ink/12 bg-white/70 p-0.5 backdrop-blur"
      role="group"
      aria-label="Language"
    >
      {options.map((opt) => {
        const active = opt.value === lang;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 font-mono text-xs font-bold tracking-wide transition-colors ${
              active ? "bg-ink text-blc" : "text-ink/55 hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default LangToggle;
