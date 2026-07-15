// Structured, bilingual legal content rendered by the public legal pages.
//
// DRAFT NOTE: this mirrors the provisional markdown drafts in documentation/legal/.
// All lawful bases, retention periods and [PLACEHOLDER] identifiers require legal
// review before this is treated as a published notice. Kept as typed data (rather
// than in the react-i18next JSON) because the prose is long-form and paired
// FR/EN — the pages pick the active language from i18n.
//
// The i18n locale files intentionally hold only the page *chrome* (banner label,
// nav, "last updated") under the `legal` key; the document bodies live here.

export type LegalLang = "fr" | "en";

export type LegalBlock =
  | { type: "h2"; text: Record<LegalLang, string> }
  | { type: "p"; text: Record<LegalLang, string> }
  | { type: "ul"; items: Record<LegalLang, string[]> }
  | { type: "table"; head: Record<LegalLang, string[]>; rows: Record<LegalLang, string[][]> };

export interface LegalDoc {
  slug: string;
  title: Record<LegalLang, string>;
  intro: Record<LegalLang, string>;
  blocks: LegalBlock[];
}

export const privacyDoc: LegalDoc = {
  slug: "privacy",
  title: { fr: "Politique de confidentialité", en: "Privacy Policy" },
  intro: {
    fr: "Comment Connected NeighBours collecte et traite vos données personnelles.",
    en: "How Connected NeighBours collects and processes your personal data.",
  },
  blocks: [
    { type: "h2", text: { fr: "1. Responsable du traitement", en: "1. Data controller" } },
    {
      type: "p",
      text: {
        fr: "Le responsable du traitement est [À COMPLÉTER : dénomination sociale, forme juridique, SIREN/SIRET, adresse]. Contact vie privée / DPO : [À COMPLÉTER].",
        en: "The data controller is [TO BE COMPLETED: company name, legal form, registration number, address]. Privacy / DPO contact: [TO BE COMPLETED].",
      },
    },
    { type: "h2", text: { fr: "2. Données collectées", en: "2. Data we collect" } },
    {
      type: "table",
      head: { fr: ["Catégorie", "Données"], en: ["Category", "Data"] },
      rows: {
        fr: [
          [
            "Compte & identité",
            "E-mail, mot de passe (haché argon2), prénom, nom, téléphone (facultatif), adresse, quartier, solde de points, rôle.",
          ],
          ["Sécurité", "Secret TOTP ; par session : adresse IP, agent utilisateur, dernière utilisation."],
          [
            "Communications",
            "Conversations et messages, dont images, messages vocaux et fichiers ; accusés de lecture.",
          ],
          ["Contrats", "Contrats d'échange et PDF signés (contiennent nom, adresse, prix)."],
          ["Points", "Historique des transactions de points."],
          ["Contenus", "Annonces (et images), événements, sondages, incidents (et photos), notifications."],
        ],
        en: [
          [
            "Account & identity",
            "Email, password (argon2 hash), first/last name, phone (optional), address, district, points balance, role.",
          ],
          ["Security", "TOTP secret; per session: IP address, User-Agent, last-used timestamp."],
          ["Communications", "Conversations and messages, incl. images, voice messages and files; read receipts."],
          ["Contracts", "Exchange contracts and signed PDFs (contain name, address, price)."],
          ["Points", "History of points transactions."],
          ["Content", "Listings (and images), events, polls, incidents (and photos), notifications."],
        ],
      },
    },
    {
      type: "p",
      text: {
        fr: "Nous ne collectons pas de géolocalisation en temps réel : votre quartier est déduit de votre adresse et des limites des districts. [Brouillon — à confirmer]",
        en: "We do not collect real-time geolocation: your neighbourhood is derived from your address and district boundaries. [Draft — to confirm]",
      },
    },
    { type: "h2", text: { fr: "3. Finalités et bases légales", en: "3. Purposes and lawful bases" } },
    {
      type: "p",
      text: {
        fr: "[Brouillon — bases légales à confirmer par un juriste.] Nous traitons vos données principalement pour exécuter le contrat de service (compte, entraide, messagerie, contrats), au titre d'obligations légales (comptabilité, conservation des contrats) et de notre intérêt légitime (sécurité des sessions, e-mails). Aucun cookie publicitaire ou analytique.",
        en: "[Draft — lawful bases to be confirmed by counsel.] We process your data mainly to perform the service contract (account, mutual aid, messaging, contracts), to meet legal obligations (accounting, contract retention), and for our legitimate interest (session security, email). No advertising or analytics cookies.",
      },
    },
    { type: "h2", text: { fr: "4. Durées de conservation", en: "4. Retention periods" } },
    {
      type: "ul",
      items: {
        fr: [
          "Compte : pendant la vie du compte ; suppression 30 jours après demande ; 3 ans d'inactivité. [à confirmer]",
          "Journaux de sécurité (IP, agent utilisateur) : 12 mois. [à confirmer]",
          "Contrats finalisés, PDF signés et registre de points : 10 ans (obligations comptables/légales, exception art. 17-3). [à confirmer]",
          "Messages et médias : jusqu'à suppression du compte ou du contenu.",
        ],
        en: [
          "Account: for the life of the account; deleted 30 days after a request; 3 years of inactivity. [confirm]",
          "Security logs (IP, User-Agent): 12 months. [confirm]",
          "Completed contracts, signed PDFs and points ledger: 10 years (accounting/legal obligation, Art. 17(3) carve-out). [confirm]",
          "Messages and media: until the account or content is deleted.",
        ],
      },
    },
    { type: "h2", text: { fr: "5. Destinataires et sous-traitants", en: "5. Recipients and sub-processors" } },
    {
      type: "ul",
      items: {
        fr: [
          "Resend — e-mails transactionnels (hébergé aux États-Unis → transfert hors UE, garanties à confirmer).",
          "Documenso — signature électronique (auto-hébergé, région UE à confirmer).",
          "MinIO — stockage des fichiers/médias (auto-hébergé, région UE à confirmer).",
          "Nom et adresse figurent dans les PDF de contrats partagés avec l'autre partie.",
        ],
        en: [
          "Resend — transactional email (hosted in the US → transfer outside the EU, safeguards to confirm).",
          "Documenso — e-signature (self-hosted, EU region to confirm).",
          "MinIO — file/media storage (self-hosted, EU region to confirm).",
          "Name and address appear in contract PDFs shared with the other party.",
        ],
      },
    },
    { type: "h2", text: { fr: "6. Vos droits", en: "6. Your rights" } },
    {
      type: "p",
      text: {
        fr: "Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité. Pour les exercer, écrivez à [À COMPLÉTER : contact DPO]. Vous pouvez saisir la CNIL (www.cnil.fr).",
        en: "You have the rights of access, rectification, erasure, restriction, objection and portability. To exercise them, write to [TO BE COMPLETED: DPO contact]. You may lodge a complaint with the CNIL (www.cnil.fr).",
      },
    },
    { type: "h2", text: { fr: "7. Sécurité", en: "7. Security" } },
    {
      type: "p",
      text: {
        fr: "Mots de passe hachés (argon2), double authentification (TOTP) disponible, échanges chiffrés, contenus cloisonnés par quartier. En cas de violation à risque, nous notifions la CNIL sous 72 heures.",
        en: "Passwords hashed (argon2), two-factor authentication (TOTP) available, encrypted traffic, content partitioned by neighbourhood. In case of a risky breach, we notify the CNIL within 72 hours.",
      },
    },
  ],
};

export const termsDoc: LegalDoc = {
  slug: "terms",
  title: { fr: "Conditions générales d'utilisation", en: "Terms of Service" },
  intro: {
    fr: "Les règles d'accès et d'usage de Connected NeighBours.",
    en: "The rules for accessing and using Connected NeighBours.",
  },
  blocks: [
    { type: "h2", text: { fr: "1. Objet", en: "1. Purpose" } },
    {
      type: "p",
      text: {
        fr: "Connected NeighBours est une plateforme d'entraide de quartier où les services s'échangent en points (pas en euros), éditée par [À COMPLÉTER].",
        en: "Connected NeighBours is a neighbourhood mutual-aid platform where services are exchanged in points (not euros), operated by [TO BE COMPLETED].",
      },
    },
    { type: "h2", text: { fr: "2. Compte", en: "2. Account" } },
    {
      type: "p",
      text: {
        fr: "L'inscription nécessite un e-mail vérifié et une adresse déterminant votre quartier. Vous protégez vos identifiants (2FA recommandée). Âge minimum : [À COMPLÉTER].",
        en: "Registration requires a verified email and an address that sets your neighbourhood. Keep your credentials safe (2FA recommended). Minimum age: [TO BE COMPLETED].",
      },
    },
    { type: "h2", text: { fr: "3. Économie de points", en: "3. Points economy" } },
    {
      type: "p",
      text: {
        fr: "Les points sont une unité interne sans valeur monétaire, non convertibles et non remboursables. [Brouillon — à confirmer]",
        en: "Points are an internal unit with no monetary value, non-convertible and non-refundable. [Draft — to confirm]",
      },
    },
    { type: "h2", text: { fr: "4. Contrats entre voisins", en: "4. Contracts between neighbours" } },
    {
      type: "p",
      text: {
        fr: "Un échange peut être formalisé par un contrat signé (Documenso). Connected NeighBours facilite la mise en relation mais n'est pas partie au contrat. [Brouillon — clause de responsabilité à valider]",
        en: "An exchange may be formalised by a signed contract (Documenso). Connected NeighBours facilitates introductions but is not a party to the contract. [Draft — liability clause to validate]",
      },
    },
    { type: "h2", text: { fr: "5. Règles de conduite", en: "5. Acceptable use" } },
    {
      type: "p",
      text: {
        fr: "Interdits : contenus illicites, harcèlement, usurpation d'identité, contournement des points, collecte des données d'autrui. Nous pouvons suspendre ou bannir un compte.",
        en: "Prohibited: unlawful content, harassment, impersonation, circumventing the points economy, scraping other members' data. We may suspend or ban accounts.",
      },
    },
    { type: "h2", text: { fr: "6. Données personnelles", en: "6. Personal data" } },
    {
      type: "p",
      text: {
        fr: "Le traitement de vos données est décrit dans la Politique de confidentialité et la Politique cookies.",
        en: "Processing of your data is described in the Privacy Policy and the Cookie Policy.",
      },
    },
    { type: "h2", text: { fr: "7. Responsabilité et droit applicable", en: "7. Liability and governing law" } },
    {
      type: "p",
      text: {
        fr: "Le service est fourni « en l'état ». Notre responsabilité est limitée dans les conditions prévues par la loi. Droit français. [À COMPLÉTER — clauses à valider]",
        en: "The service is provided “as is”. Our liability is limited to the extent permitted by law. French law. [TO BE COMPLETED — clauses to validate]",
      },
    },
  ],
};

export const cookieDoc: LegalDoc = {
  slug: "cookies",
  title: { fr: "Politique cookies", en: "Cookie Policy" },
  intro: {
    fr: "Uniquement des cookies strictement nécessaires.",
    en: "Strictly necessary cookies only.",
  },
  blocks: [
    {
      type: "p",
      text: {
        fr: "Connected NeighBours n'utilise que des cookies strictement nécessaires au fonctionnement du service. Aucun cookie publicitaire ou analytique n'est déposé ; aucun bandeau de consentement n'est donc requis. [Brouillon — à confirmer]",
        en: "Connected NeighBours uses only strictly necessary cookies required to run the service. No advertising or analytics cookies are set, so no consent banner is required. [Draft — to confirm]",
      },
    },
    {
      type: "table",
      head: { fr: ["Cookie", "Finalité", "Durée"], en: ["Cookie", "Purpose", "Duration"] },
      rows: {
        fr: [
          ["refresh_token", "Maintien de la session (httpOnly, chemin /auth).", "Session / expiration du jeton"],
          ["Jeton CSRF (double-submit)", "Protection contre la falsification de requêtes.", "Session"],
        ],
        en: [
          ["refresh_token", "Session continuity (httpOnly, /auth path).", "Session / token expiry"],
          ["CSRF token (double-submit)", "Protection against request forgery.", "Session"],
        ],
      },
    },
    {
      type: "p",
      text: {
        fr: "Si un outil d'analyse ou de marketing est ajouté à l'avenir, cette politique sera mise à jour et un bandeau de consentement sera mis en place.",
        en: "If an analytics or marketing tool is added in the future, this policy will be updated and a consent banner implemented.",
      },
    },
  ],
};

export const legalNoticeDoc: LegalDoc = {
  slug: "legal",
  title: { fr: "Mentions légales", en: "Legal Notice" },
  intro: {
    fr: "Informations sur l'éditeur et l'hébergeur.",
    en: "Publisher and hosting information.",
  },
  blocks: [
    { type: "h2", text: { fr: "Éditeur", en: "Publisher" } },
    {
      type: "p",
      text: {
        fr: "[À COMPLÉTER : dénomination sociale, forme juridique, capital, adresse du siège, SIREN/SIRET, TVA].",
        en: "[TO BE COMPLETED: company name, legal form, share capital, registered address, registration number, VAT].",
      },
    },
    { type: "h2", text: { fr: "Directeur de la publication", en: "Publication director" } },
    { type: "p", text: { fr: "[À COMPLÉTER : nom].", en: "[TO BE COMPLETED: name]." } },
    { type: "h2", text: { fr: "Hébergement", en: "Hosting provider" } },
    {
      type: "p",
      text: {
        fr: "[À COMPLÉTER : nom, adresse et téléphone de l'hébergeur].",
        en: "[TO BE COMPLETED: hosting provider name, address and phone].",
      },
    },
    { type: "h2", text: { fr: "Contact & données", en: "Contact & data" } },
    {
      type: "p",
      text: {
        fr: "Contact : [À COMPLÉTER]. Traitement des données : voir la Politique de confidentialité. Réclamations : CNIL (www.cnil.fr).",
        en: "Contact: [TO BE COMPLETED]. Data processing: see the Privacy Policy. Complaints: the CNIL (www.cnil.fr).",
      },
    },
  ],
};

export const legalDocs: Record<string, LegalDoc> = {
  privacy: privacyDoc,
  terms: termsDoc,
  cookies: cookieDoc,
  legal: legalNoticeDoc,
};
