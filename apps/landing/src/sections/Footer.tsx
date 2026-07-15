import { config } from "@repo/config";
import type { Dict } from "../i18n";

const logo = "/Logo-connectedNeighbours.png";

// The legal notices are rendered by the user-front app; link to them there.
const Footer = ({ t }: { t: Dict }) => {
  const legalLinks = [
    { href: `${config.appUrl}/privacy`, label: t.footer.privacy },
    { href: `${config.appUrl}/cgu`, label: t.footer.terms },
    { href: `${config.appUrl}/cookies`, label: t.footer.cookies },
    { href: `${config.appUrl}/legal`, label: t.footer.notice },
  ];

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
        <nav aria-label={t.footer.legal} className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-ink/55">
          {legalLinks.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="border-t border-ink/8 py-4 text-center font-mono text-xs text-ink/40">© {t.footer.rights}</div>
    </footer>
  );
};

export default Footer;
