# Cookie Policy / Politique cookies — Connected NeighBours

> **⚠️ DRAFT — REQUIRES LEGAL REVIEW.** Provisional draft based on a code audit. Re-review is required if
> analytics/marketing trackers are ever added. **Last updated: [PLACEHOLDER — publication date].**

---

## 🇫🇷 Politique cookies

Connected NeighBours n'utilise que des cookies **strictement nécessaires** au fonctionnement du service.
Aucun cookie publicitaire, analytique ou de mesure d'audience n'est déposé. En conséquence, et
conformément aux lignes directrices de la CNIL, **aucun bandeau de consentement n'est requis** pour ces
cookies (l'exemption des cookies strictement nécessaires s'applique). `[DRAFT — à confirmer]`

Cookies utilisés :

| Cookie                     | Finalité                                                                                  | Type                   | Durée                                             |
| -------------------------- | ----------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------- |
| `refresh_token`            | Maintien de la session (jeton de rafraîchissement), `httpOnly`, limité au chemin `/auth`. | Strictement nécessaire | Durée de la session / jusqu'à expiration du jeton |
| Jeton CSRF (double-submit) | Protection contre la falsification de requêtes (CSRF).                                    | Strictement nécessaire | Session                                           |

> **Important :** si un outil d'analyse (ex. mesure d'audience) ou de marketing est ajouté à l'avenir,
> cette politique **devra être mise à jour** et un **bandeau de consentement** devra être mis en place
> avant tout dépôt de ces cookies.

---

## 🇬🇧 Cookie Policy

Connected NeighBours uses only **strictly necessary** cookies required to operate the service. No
advertising, analytics or audience-measurement cookies are set. Accordingly, and in line with CNIL
guidance, **no consent banner is required** for these cookies (the strictly-necessary exemption applies).
`[DRAFT — confirm]`

Cookies used:

| Cookie                     | Purpose                                                                     | Type               | Duration                     |
| -------------------------- | --------------------------------------------------------------------------- | ------------------ | ---------------------------- |
| `refresh_token`            | Session continuity (refresh token), `httpOnly`, scoped to the `/auth` path. | Strictly necessary | Session / until token expiry |
| CSRF token (double-submit) | Protection against cross-site request forgery (CSRF).                       | Strictly necessary | Session                      |

> **Important:** if any analytics or marketing tool is introduced in the future, this policy **must be
> updated** and a **consent banner** must be implemented before those cookies are set.
