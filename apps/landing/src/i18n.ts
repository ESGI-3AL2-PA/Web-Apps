import { useCallback, useEffect, useState } from "react";

export type Lang = "fr" | "en";

const STORAGE_KEY = "cn-lang";

// Feature ids map 1:1 onto the real API domains in packages/contracts, so the
// copy never promises something the product can't do.
export type FeatureId = "annonces" | "points" | "contrats" | "messagerie" | "events" | "civic";

interface Feature {
  id: FeatureId;
  title: string;
  desc: string;
}

interface Step {
  title: string;
  desc: string;
}

export interface Dict {
  htmlLang: string;
  nav: { login: string; signup: string };
  hero: {
    eyebrow: string;
    titleLead: string;
    titleEmph: string;
    titleTail: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    graphCaption: string;
    node: string;
  };
  problem: { eyebrow: string; title: string; body: string };
  features: { eyebrow: string; title: string; items: Feature[] };
  how: { eyebrow: string; title: string; steps: Step[] };
  cta: { title: string; body: string; primary: string; secondary: string };
  footer: { tagline: string; product: string; scoped: string; rights: string };
}

export const translations: Record<Lang, Dict> = {
  fr: {
    htmlLang: "fr",
    nav: { login: "Se connecter", signup: "S'inscrire" },
    hero: {
      eyebrow: "Le réseau d'entraide de votre quartier",
      titleLead: "Rendez service à vos voisins,",
      titleEmph: "payé en points",
      titleTail: "— pas en euros.",
      subtitle:
        "Connected NeighBours relie les habitants d'un même quartier pour échanger des services. Vous offrez un coup de main, vous gagnez des points ; vous en avez besoin, vous les dépensez. Local, de confiance, sans argent.",
      primaryCta: "Rejoindre mon quartier",
      secondaryCta: "Se connecter",
      graphCaption: "Un fil d'annonces classé pour votre quartier, pas pour tout le monde.",
      node: "Voisin",
    },
    problem: {
      eyebrow: "Le problème",
      title: "On vit à côté sans jamais s'entraider.",
      body: "Un voisin sait réparer un robinet, un autre cherche justement un plombier — et ils ne se croiseront jamais. Connected NeighBours réunit les compétences d'un quartier autour d'une monnaie de points : chaque service rendu en crédite un futur service reçu.",
    },
    features: {
      eyebrow: "Ce que vous pouvez faire",
      title: "Tout ce qu'il faut pour faire tourner l'entraide.",
      items: [
        {
          id: "annonces",
          title: "Annonces",
          desc: "Publiez une offre ou une demande, fixez son prix en points. « Plombier dispo pour petites réparations », 10 points.",
        },
        {
          id: "points",
          title: "Économie de points",
          desc: "Un solde, un historique, des transferts entre voisins. Les points sont la monnaie du quartier — jamais d'argent qui circule.",
        },
        {
          id: "contrats",
          title: "Contrats",
          desc: "Formalisez un échange entre prestataire et bénéficiaire : signature, suivi, et litige si ça tourne mal.",
        },
        {
          id: "messagerie",
          title: "Messagerie",
          desc: "Discutez en direct, partagez photos et fichiers, avec accusés de lecture. Réservé aux participants de la conversation.",
        },
        {
          id: "events",
          title: "Événements",
          desc: "Organisez et rejoignez les rendez-vous du quartier, inscrivez-vous, puis notez ce que vous avez vécu.",
        },
        {
          id: "civic",
          title: "Votes & incidents",
          desc: "Lancez des sondages de quartier et signalez les problèmes (dégradations, nuisances) jusqu'à leur résolution.",
        },
      ],
    },
    how: {
      eyebrow: "Comment ça marche",
      title: "Trois pas, et vous êtes dans la boucle.",
      steps: [
        {
          title: "Rejoignez votre quartier",
          desc: "Créez votre compte : vous êtes rattaché au district où vous habitez.",
        },
        { title: "Offrez ou demandez", desc: "Publiez une annonce ou répondez à celle d'un voisin, prix en points." },
        {
          title: "Échangez des points",
          desc: "Le service rendu, les points passent d'un solde à l'autre. À vous de jouer.",
        },
      ],
    },
    cta: {
      title: "Votre quartier vous attend.",
      body: "Créez votre compte en une minute et découvrez ce que vos voisins proposent déjà.",
      primary: "S'inscrire",
      secondary: "J'ai déjà un compte",
    },
    footer: {
      tagline: "S'entraider près de chez soi.",
      product: "Produit",
      scoped: "Chaque quartier, son propre réseau.",
      rights: "Connected NeighBours",
    },
  },
  en: {
    htmlLang: "en",
    nav: { login: "Log in", signup: "Sign up" },
    hero: {
      eyebrow: "Your neighbourhood's mutual-aid network",
      titleLead: "Help your neighbours,",
      titleEmph: "paid in points",
      titleTail: "— not euros.",
      subtitle:
        "Connected NeighBours links residents of the same district to trade services. Lend a hand and earn points; need one and spend them. Local, trusted, money-free.",
      primaryCta: "Join my neighbourhood",
      secondaryCta: "Log in",
      graphCaption: "A listings feed ranked for your neighbourhood — not for everyone.",
      node: "Neighbour",
    },
    problem: {
      eyebrow: "The problem",
      title: "We live side by side and never help each other.",
      body: "One neighbour can fix a tap, another is looking for exactly that — and they'll never meet. Connected NeighBours pools a district's skills around a points currency: every favour you give credits a future favour you receive.",
    },
    features: {
      eyebrow: "What you can do",
      title: "Everything it takes to keep mutual aid moving.",
      items: [
        {
          id: "annonces",
          title: "Listings",
          desc: "Post an offer or a request and price it in points. “Plumber available for small repairs,” 10 points.",
        },
        {
          id: "points",
          title: "Points economy",
          desc: "A balance, a history, transfers between neighbours. Points are the district's currency — no money changes hands.",
        },
        {
          id: "contrats",
          title: "Contracts",
          desc: "Formalise an exchange between provider and beneficiary: sign it, track it, and dispute it if things go wrong.",
        },
        {
          id: "messagerie",
          title: "Messaging",
          desc: "Chat directly, share photos and files, with read receipts. Access is limited to the conversation's participants.",
        },
        {
          id: "events",
          title: "Events",
          desc: "Host and join neighbourhood gatherings, register to attend, then rate how it went.",
        },
        {
          id: "civic",
          title: "Votes & incidents",
          desc: "Run neighbourhood polls and report problems (vandalism, nuisances) all the way through to resolution.",
        },
      ],
    },
    how: {
      eyebrow: "How it works",
      title: "Three steps and you're in the loop.",
      steps: [
        {
          title: "Join your neighbourhood",
          desc: "Create your account and you're attached to the district where you live.",
        },
        { title: "Offer or request", desc: "Post a listing or answer a neighbour's, priced in points." },
        {
          title: "Exchange points",
          desc: "Once the service is done, points move from one balance to the other. Your turn.",
        },
      ],
    },
    cta: {
      title: "Your neighbourhood is waiting.",
      body: "Create your account in a minute and see what your neighbours are already offering.",
      primary: "Sign up",
      secondary: "I already have an account",
    },
    footer: {
      tagline: "Helping out, close to home.",
      product: "Product",
      scoped: "Every neighbourhood, its own network.",
      rights: "Connected NeighBours",
    },
  },
};

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "fr" || stored === "en") return stored;
  return window.navigator.language.toLowerCase().startsWith("en") ? "en" : "fr";
}

export function useLang() {
  const [lang, setLang] = useState<Lang>(readInitialLang);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = translations[lang].htmlLang;
  }, [lang]);

  const toggle = useCallback((next: Lang) => setLang(next), []);

  return { lang, setLang: toggle, t: translations[lang] };
}
