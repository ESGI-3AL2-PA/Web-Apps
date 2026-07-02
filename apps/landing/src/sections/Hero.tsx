import type { Dict } from "../i18n";
import AuthButtons from "./AuthButtons";
import NeighbourhoodGraph from "./NeighbourhoodGraph";

const Hero = ({ t }: { t: Dict }) => {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24 lg:pb-28">
      <div className="reveal">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/60 px-3 py-1 font-mono text-xs font-bold tracking-wide text-primary uppercase">
          <span className="inline-block size-1.5 rounded-full bg-secondary" aria-hidden="true" />
          {t.hero.eyebrow}
        </p>
        <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl">
          {t.hero.titleLead}{" "}
          <span className="relative whitespace-nowrap text-primary">
            {t.hero.titleEmph}
            <span className="absolute inset-x-0 bottom-1 -z-10 h-3 rounded-sm bg-secondary/35" aria-hidden="true" />
          </span>{" "}
          {t.hero.titleTail}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">{t.hero.subtitle}</p>
        <div className="mt-9">
          <AuthButtons primaryLabel={t.hero.primaryCta} secondaryLabel={t.hero.secondaryCta} size="lg" />
        </div>
      </div>

      <div className="reveal" style={{ animationDelay: "0.12s" }}>
        <figure className="rounded-3xl border border-ink/10 bg-white p-5 shadow-[0_20px_60px_-30px_rgba(28,27,46,0.4)]">
          <div className="aspect-[10/9] w-full">
            <NeighbourhoodGraph label={t.hero.node} />
          </div>
          <figcaption className="mt-2 border-t border-ink/8 pt-3 text-center text-sm text-ink/55">
            {t.hero.graphCaption}
          </figcaption>
        </figure>
      </div>
    </section>
  );
};

export default Hero;
