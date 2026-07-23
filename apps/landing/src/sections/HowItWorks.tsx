/**
 * Section « comment ça marche » de la landing.
 *
 * Présente les étapes d'utilisation du produit sous forme de liste ordonnée
 * numérotée (01, 02, 03…), une étape par colonne. Textes issus du dictionnaire
 * i18n `t`.
 */
import type { Dict } from "../i18n";

// Les étapes forment une véritable séquence : la numérotation porte donc un sens
// réel ici (contrairement aux marqueurs 01/02/03 purement décoratifs ailleurs).
const HowItWorks = ({ t }: { t: Dict }) => {
  return (
    <section className="border-y border-ink/8 bg-white/50">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="max-w-2xl">
          <p className="mb-3 font-mono text-xs font-bold tracking-widest text-primary uppercase">{t.how.eyebrow}</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t.how.title}</h2>
        </div>

        <ol className="mt-14 grid gap-y-12 gap-x-8 md:grid-cols-3">
          {t.how.steps.map((step, i) => (
            <li key={i} className="reveal relative" style={{ animationDelay: `${0.08 * i}s` }}>
              <div className="flex items-baseline gap-3">
                {/* Numéro d'étape formaté sur deux chiffres (01, 02, 03…). */}
                <span className="font-mono text-2xl font-bold text-secondary">{String(i + 1).padStart(2, "0")}</span>
                <span className="h-px flex-1 translate-y-[-4px] bg-ink/12" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-ink/65">{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default HowItWorks;
