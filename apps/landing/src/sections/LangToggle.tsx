import type { Lang } from "../i18n";

interface LangToggleProps {
  lang: Lang;
  onChange: (lang: Lang) => void;
}

const options: { value: Lang; label: string }[] = [
  { value: "fr", label: "FR" },
  { value: "en", label: "EN" },
];

// Segmented FR/EN switch — mirrors the language control already in the app header.
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
