import type { Dict } from "../i18n";

const logo = "/Logo-connectedNeighbours.png";

const Footer = ({ t }: { t: Dict }) => {
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="size-9" />
          <div className="leading-tight">
            <p className="font-display font-bold text-ink">Connected NeighBours</p>
            <p className="text-sm text-ink/55">{t.footer.tagline}</p>
          </div>
        </div>
        <p className="font-mono text-xs text-ink/45">{t.footer.scoped}</p>
      </div>
      <div className="border-t border-ink/8 py-4 text-center font-mono text-xs text-ink/40">© {t.footer.rights}</div>
    </footer>
  );
};

export default Footer;
