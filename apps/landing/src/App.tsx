import { useLang } from "./i18n";
import { loginUrl } from "./auth-links";
import AuthButtons from "./sections/AuthButtons";
import Features from "./sections/Features";
import Footer from "./sections/Footer";
import Hero from "./sections/Hero";
import HowItWorks from "./sections/HowItWorks";
import LangToggle from "./sections/LangToggle";

const logo = "/Logo-connectedNeighbours.png";

const App = () => {
  const { lang, setLang, t } = useLang();

  return (
    <div className="min-h-screen bg-blc text-ink">
      <header className="sticky top-0 z-20 border-b border-ink/8 bg-blc/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <a href="#" className="flex items-center gap-2.5">
            <img src={logo} alt="" className="size-9" />
            <span className="font-display text-lg leading-none font-bold text-ink">Connected NeighBours</span>
          </a>
          <div className="flex items-center gap-3">
            <LangToggle lang={lang} onChange={setLang} />
            <a
              href={loginUrl}
              className="hidden rounded-full border border-ink/15 px-4 py-1.5 text-sm font-semibold text-ink transition hover:border-ink/40 sm:inline-flex"
            >
              {t.nav.login}
            </a>
          </div>
        </div>
      </header>

      <main>
        <Hero t={t} />

        <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 font-mono text-xs font-bold tracking-widest text-primary uppercase">
              {t.problem.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t.problem.title}</h2>
            <p className="mt-5 text-lg leading-relaxed text-ink/70">{t.problem.body}</p>
          </div>
        </section>

        <Features t={t} />
        <HowItWorks t={t} />

        <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <div className="overflow-hidden rounded-3xl bg-ink px-8 py-14 text-center sm:px-14">
            <h2 className="font-display text-3xl font-bold tracking-tight text-blc sm:text-4xl">{t.cta.title}</h2>
            <p className="mx-auto mt-4 max-w-xl text-blc/70">{t.cta.body}</p>
            <div className="mt-8 flex justify-center">
              <AuthButtons primaryLabel={t.cta.primary} secondaryLabel={t.cta.secondary} size="lg" tone="dark" />
            </div>
          </div>
        </section>
      </main>

      <Footer t={t} />
    </div>
  );
};

export default App;
