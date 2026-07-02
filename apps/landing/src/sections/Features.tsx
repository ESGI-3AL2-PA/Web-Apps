import type { ReactNode } from "react";
import type { Dict, FeatureId } from "../i18n";

const icons: Record<FeatureId, ReactNode> = {
  annonces: <path d="M3 11l16-6-3 15-4-5-5-1z M11 13l5-6" strokeLinecap="round" strokeLinejoin="round" />,
  points: (
    <>
      <ellipse cx="12" cy="7" rx="7" ry="3" />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7 M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" strokeLinecap="round" />
    </>
  ),
  contrats: (
    <path
      d="M7 3h7l4 4v9a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z M13 3v5h5 M8.5 16.5l2 2 4-4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  messagerie: (
    <path
      d="M20 12a7 7 0 01-7 7H8l-4 3v-4.5A7 7 0 014 12V11a7 7 0 017-7h1a7 7 0 018 8z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  events: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 9h16 M8 3v4 M16 3v4 M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  civic: (
    <path
      d="M12 3l7 3v5c0 4.2-2.9 7.4-7 8.5C7.9 18.4 5 15.2 5 11V6z M9 11.5l2 2 4-4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

const Features = ({ t }: { t: Dict }) => {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
      <div className="max-w-2xl">
        <p className="mb-3 font-mono text-xs font-bold tracking-widest text-primary uppercase">{t.features.eyebrow}</p>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t.features.title}</h2>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {t.features.items.map((f, i) => (
          <article
            key={f.id}
            className="reveal group rounded-2xl border border-ink/10 bg-white p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_16px_40px_-24px_rgba(99,102,241,0.6)]"
            style={{ animationDelay: `${0.05 * i}s` }}
          >
            <span className="mb-5 inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
                {icons[f.id]}
              </svg>
            </span>
            <h3 className="font-display text-lg font-bold text-ink">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/65">{f.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Features;
