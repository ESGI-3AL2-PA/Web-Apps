# Auth Service — authentification centralisée

## Architecture

Un `auth-service` dédié est l'unique autorité d'identité de la plateforme. Il héberge la page de
connexion, émet les JWT et gère MFA/TOTP, la vérification d'email, la réinitialisation de mot de
passe et les sessions. Les consommateurs (api, frontends, application JavaFX) vérifient les tokens
**localement** via la clé publique publiée en JWKS — aucun appel réseau à l'auth-service par requête.

```
Navigateur
  │  requête non authentifiée
  ▼
admin-front / user-front
  │  redirection vers la page de connexion
  ▼
auth-service:3001/login?redirect_uri=<url-app>
  │  POST identifiants → validation → 200 (tokens) OU 202 (MFA / enrôlement requis)
  ▼
l'app reçoit access_token (mémoire JS) + csrf_token ; le refresh token part en cookie httpOnly
  │  Authorization: Bearer <access_token> sur chaque appel
  ▼
apps/api  ──  vérifie le JWT via le endpoint JWKS (aucun appel à l'auth-service)

admin-desktop (JavaFX)
  │  authorization code + PKCE (voir « SSO desktop »)
  ▼
vérifie le JWT via le endpoint JWKS
```

La signature/vérification est **découplée** : le signataire vit dans l'auth-service
(`use-cases/issue-tokens.ts`), le vérificateur dans l'api (`middleware/auth.middleware.ts`). Seul le
_contrat_ (constantes d'émetteur, d'audience, forme des claims) est partagé, via `@repo/shared`
(`packages/shared/src/tokens.ts`) — un claim renommé ou une audience ajoutée se voit à la
compilation, pas seulement à l'exécution.

---

## Stratégie de tokens

L'auth-service émet plusieurs tokens RS256, tous signés avec la même clé et distingués par leur
**audience** (`aud`). L'api choisit quoi accepter selon le endpoint.

| Token                    | `aud`          | Durée  | Portage                              | Rôle                                                       |
| ------------------------ | -------------- | ------ | ------------------------------------ | ---------------------------------------------------------- |
| Access token (JWT)       | `api`          | 15 min | Mémoire (variable JS)                | Authentifie chaque appel api                               |
| Refresh token (opaque)   | —              | 7 j    | Cookie httpOnly, path `/auth`        | Fait tourner l'access token ; 64 octets, stocké en sha256  |
| Token de service interne | `api:internal` | 30 s   | En-tête Bearer, serveur à serveur    | L'auth-service crée l'utilisateur via `POST API_URL/users` |
| `mfa` token              | `mfa`          | 5 min  | Corps de `POST /auth/login/mfa`      | Ticket entre l'étape 1 et l'étape 2 d'un login MFA         |
| `enroll` token           | `enroll`       | 10 min | Corps de `POST /auth/login/enroll/*` | Ticket de la cérémonie d'enrôlement TOTP obligatoire       |
| Step-up token            | `step-up`      | 5 min  | En-tête `X-Step-Up-Token`            | Preuve d'un TOTP frais pour UNE opération sensible         |

Constantes correspondantes dans `@repo/shared` : `TOKEN_AUDIENCE` (`api`),
`TOKEN_AUDIENCE_INTERNAL` (`api:internal`), `TOKEN_AUDIENCE_STEP_UP` (`step-up`),
`TOKEN_AUDIENCE_ENROLL` (`enroll`). L'audience `mfa` est une chaîne littérale posée dans
`login.use-case.ts` (pas de constante partagée). Émetteur : `TOKEN_ISSUER = "auth-service"` ;
algorithme : `TOKEN_ALG = "RS256"`.

- L'access token n'est **jamais** stocké en `localStorage` (risque XSS) — il reste en mémoire.
- Le refresh token est un cookie **httpOnly** scellé au path `/auth` (`sameSite: "lax"`, `secure`
  en production), donc jamais lisible en JS.
- À l'expiration de l'access token, le front appelle silencieusement `POST /auth/refresh` (le cookie
  est envoyé automatiquement) ; le refresh token est **renouvelé à chaque appel** (rotation).

### Protection CSRF (double-submit)

`/auth/refresh` et `/auth/logout` s'appuient sur un cookie de refresh envoyé automatiquement par le
navigateur — donc vulnérables au CSRF sans garde-fou. La parade est un **double-submit** :

- à la connexion (et à chaque refresh), un `csrf_token` aléatoire (32 octets) est posé dans un cookie
  jumeau (`csrf_token`, mêmes attributs que le cookie de refresh) **et** renvoyé dans le corps JSON ;
- le SPA le relit via `GET /auth/csrf` et le réémet dans l'en-tête `X-CSRF-Token` sur refresh/logout ;
- le serveur compare cookie et en-tête **à temps constant** (`timingSafeEqual`). Divergence ⇒ `403`.

Le `csrf_token` est **pivoté à chaque refresh** en même temps que le refresh token.

### Identifiant de clé de signature (`kid`)

Le `kid` inscrit sur les tokens et publié dans le JWKS est le **JWK thumbprint RFC 7638** de la clé
— dérivé du matériel cryptographique, pas configuré (`keys.ts`, `calculateJwkThumbprint`).

Ce choix est structurant, pas cosmétique. Les consommateurs mettent le JWKS en cache **par `kid`**, et
le `createRemoteJWKSet` de jose ne re-fetch que si un `kid` est **absent** (`JWKSNoMatchingKey`) ;
un échec de signature sur un `kid` déjà en cache ne déclenche rien. Publier un nouveau matériel sous
un `kid` réutilisé renverrait donc silencieusement `401` sur tout jusqu'à l'expiration du cache de
10 minutes (`cacheMaxAge`) — et le cache par `kid` du client desktop n'a aucun TTL, il resterait cassé
jusqu'au relancement de l'app. Un `kid` = thumbprint rend cet état inatteignable : un nouveau matériel
implique toujours un nouveau `kid`, qui est justement le chemin de récupération des consommateurs
(≤30 s, borné par `cooldownDuration`).

`AUTH_KEY_ID` permet d'épingler un `kid` explicite, mais un pin qui ne correspond pas au thumbprint de
sa clé **avertit bruyamment à chaque démarrage** — il réintroduit exactement ce piège. Son seul usage
légitime est la migration unique depuis l'ancien `auth-1` statique. La rotation elle-même n'exige
aucun pin : on remplace la paire de clés, on publie l'ancienne clé publique via
`AUTH_PUBLIC_KEY_PREVIOUS` (vérification seule, `AUTH_KEY_ID_PREVIOUS` optionnel) le temps que les
tokens en vol s'écoulent, puis on la retire. Deux `kid` identiques sont refusés au démarrage (une
rotation exige deux `kid` distincts).

### Claims de l'access token

| Claim                    | Valeurs                         | Signification                                                                                         |
| ------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `sub`                    | ObjectId                        | Identifiant utilisateur                                                                               |
| `email`                  | string                          | Email de l'utilisateur                                                                                |
| `firstName` / `lastName` | string                          | Nom d'affichage porté dans le token                                                                   |
| `role`                   | `user` · `admin` · `superAdmin` | RBAC à portée quartier. (`service` n'est pas un rôle : c'est le token interne `aud: "api:internal"`.) |
| `adminDistrictId`        | ObjectId · `null`               | L'unique quartier administré (`admin` seulement). `superAdmin` est global ; `user` vaut `null`.       |

Pour renseigner `adminDistrictId`, l'auth-service lit la relation administrateur de quartier
(`district_admins`) au login **et à chaque refresh** — voir **Base de données**.

L'autorité étant scellée dans le token, **une promotion/rétrogradation ne prend effet qu'au refresh
suivant (≤15 min)**. Le user-front **force donc un refresh immédiat** après création/promotion de
quartier en self-service, pour débloquer l'outillage admin sans délai. En revanche le quartier
**actif** n'est délibérément **pas** un claim : l'api lit `activeDistrictId` sur le document
utilisateur à chaque requête, si bien que changer de quartier actif est instantané et ne demande pas
de nouveau token.

Le token step-up porte ses propres claims (`StepUpClaims`) : `amr: ["otp"]` et `auth_time` (seconde
Unix de la vérification du second facteur) — voir **Step-up**.

---

## Flux de connexion (MFA / enrôlement)

`POST /auth/login` ne se termine pas toujours par une session. Après validation des identifiants,
le cas d'usage renvoie une union discriminée que le router traduit en codes HTTP :

| Situation                             | Statut | Corps                                         | Suite côté client                         |
| ------------------------------------- | ------ | --------------------------------------------- | ----------------------------------------- |
| Identifiants OK, TOTP désactivé (dev) | `200`  | `access_token`, `csrf_token`, `user`          | Session établie                           |
| Identifiants OK, TOTP activé          | `202`  | `{ mfa_required: true, mfa_token }`           | `POST /auth/login/mfa` (mfa_token + code) |
| Identifiants OK, sans TOTP (prod)     | `202`  | `{ enrollment_required: true, enroll_token }` | Cérémonie `POST /auth/login/enroll/*`     |
| Email non vérifié                     | `403`  | `{ code: "email_not_verified" }`              | Renvoyer la vérification                  |
| Compte banni                          | `403`  | message                                       | —                                         |
| Identifiants invalides                | `401`  | message                                       | —                                         |

Contre l'énumération d'utilisateurs par mesure du temps, un email inconnu déclenche quand même une
vérification argon2 factice (hash bidon mis en cache) pour égaliser la latence.

**Le MFA est obligatoire en production.** Un utilisateur sans TOTP ne reçoit **aucun** token tant
qu'il ne s'est pas enrôlé : le login renvoie un ticket `enroll` court. En développement
(`NODE_ENV !== "production"`), cette branche est sautée — le TOTP reste totalement optionnel en local.

```
Login MFA (utilisateur déjà enrôlé)          Enrôlement obligatoire (prod, sans TOTP)
─────────────────────────────────           ────────────────────────────────────────
POST /auth/login  (email, mot de passe)      POST /auth/login  (email, mot de passe)
   → 202 { mfa_token }                          → 202 { enroll_token }
                                                     │
POST /auth/login/mfa                          POST /auth/login/enroll/start (enroll_token)
   (mfa_token + code TOTP)                        → { otpauth_url, secret }   (QR code)
   → 200 access_token + cookies                     │
                                              POST /auth/login/enroll/confirm
                                                 (enroll_token + premier code)
                                                 → active totpEnabled, puis
                                                   200 access_token + cookies
```

Les deux chemins terminent par `issueTokensForUser` — un utilisateur fraîchement enrôlé est
authentifié exactement comme via `/auth/login/mfa`. Chaque code TOTP est **anti-rejeu** : le pas de
temps consommé est marqué (`consumeTotpStep`), un même code ne passe pas deux fois dans sa fenêtre.

---

## MFA / TOTP et step-up

Deux entrées vers le TOTP :

- **Enrôlement obligatoire au login** (prod) — piloté par le ticket `enroll` ci-dessus, sans jamais
  requérir un access token `aud: "api"` que l'utilisateur ne peut pas encore obtenir.
- **Enrôlement volontaire depuis le profil** — `POST /auth/totp/enroll` (Bearer) renvoie l'URL
  otpauth + le secret ; `POST /auth/totp/confirm` vérifie le premier code et passe `totpEnabled`.

Désactivation : `POST /auth/totp/disable` exige la **confirmation du mot de passe** (argon2) **et,
en production, un step-up frais** — c'est le downgrade de sécurité le plus sensible, donc un access
token volé seul ne suffit pas.

### Step-up (ré-authentification pour une opération sensible)

Certaines opérations api exigent une preuve que l'appelant a **ressaisi un code TOTP à l'instant**,
pas seulement qu'il détient un access token vivant. Le flux :

1. le client appelle `POST /auth/step-up` (Bearer) avec un code TOTP frais ;
2. l'auth-service le vérifie (anti-rejeu inclus) et émet un `step_up_token` (`aud: "step-up"`, 5 min,
   `amr: ["otp"]`, `auth_time`), signé avec la même clé que l'access token ;
3. le client rejoue l'opération sensible en ajoutant l'en-tête `X-Step-Up-Token: <token>` ;
4. côté api, le middleware `requireStepUp` valide ce token **contre le même JWKS** (audience
   `step-up`, `sub` = celui de l'appelant).

La politique est **déclarative**, portée par `metadata.auth.stepUp` du contrat (`getAuthPolicy`) :

- `stepUp: { always: true }` — step-up systématique. Actuellement : `POST /transactions` (crédit/débit
  de points) et `DELETE /users/:id` (suppression de compte RGPD).
- `stepUp: { whenBodyTouches: [...] }` — step-up seulement si le corps modifie un champ listé.
  Actuellement : `PATCH /users/:id` pour `email`, `address`, `newPassword`.

Comme le MFA, le step-up est **prod-only** : hors production, `requireStepUp` court-circuite (les
endpoints existent mais n'exigent rien). Échec ⇒ `401 { code: "step_up_required" }`.

---

## Endpoints de l'auth-service

Toutes les routes `/auth/*` sont définies dans `packages/contracts/src/auth.contract.ts` (source de
vérité ts-rest, visible dans l'OpenAPI). « Bearer » = access token requis ; « CSRF » = `X-CSRF-Token`
requis ; « public » = aucun token.

| Méthode | Chemin                         | Garde   | Description                                                                            |
| ------- | ------------------------------ | ------- | -------------------------------------------------------------------------------------- |
| `GET`   | `/login`                       | public  | Sert la page HTML de connexion (vanilla, sans build React)                             |
| `POST`  | `/auth/login`                  | public  | Valide les identifiants. `200` tokens · `202` MFA/enrôlement · `403` email             |
| `POST`  | `/auth/login/mfa`              | public  | Étape 2 MFA : `mfa_token` + code TOTP → tokens                                         |
| `POST`  | `/auth/login/enroll/start`     | public  | Enrôlement obligatoire : `enroll_token` → `otpauth_url` + `secret`                     |
| `POST`  | `/auth/login/enroll/confirm`   | public  | Enrôlement obligatoire : `enroll_token` + premier code → tokens                        |
| `POST`  | `/auth/refresh`                | CSRF    | Fait tourner le refresh token, émet un nouvel access token + `csrf_token`              |
| `POST`  | `/auth/logout`                 | CSRF    | Révoque le refresh token, efface les cookies (idempotent)                              |
| `GET`   | `/auth/csrf`                   | public  | Renvoie le `csrf_token` du cookie (bootstrap SPA cross-origin)                         |
| `GET`   | `/auth/userinfo`               | Bearer  | Renvoie les claims de l'utilisateur (style OIDC userinfo)                              |
| `POST`  | `/auth/register`               | public  | Crée le compte + envoie l'email de vérification (`202`, pas de token)                  |
| `GET`   | `/auth/verify`                 | public  | Marque l'email vérifié via le token du lien                                            |
| `POST`  | `/auth/resend-verification`    | public  | Renvoie l'email de vérification (toujours `200`, pas d'énumération)                    |
| `POST`  | `/auth/forgot-password`        | public  | Envoie un lien de reset à usage unique (toujours `200`)                                |
| `POST`  | `/auth/reset-password`         | public  | Définit un nouveau mot de passe via le token du lien ; **révoque toutes les sessions** |
| `GET`   | `/auth/sessions`               | Bearer  | Liste les sessions actives ; la session courante est marquée (`current`)               |
| `POST`  | `/auth/sessions/:id/revoke`    | Bearer  | Révoque une de ses propres sessions par id                                             |
| `POST`  | `/auth/sessions/revoke-others` | Bearer  | Révoque toutes les sessions sauf la courante                                           |
| `POST`  | `/auth/totp/enroll`            | Bearer  | Enrôlement TOTP volontaire → `otpauth_url` + `secret` (`409` si déjà actif)            |
| `POST`  | `/auth/totp/confirm`           | Bearer  | Confirme le premier code, passe `totpEnabled=true`                                     |
| `POST`  | `/auth/totp/disable`           | Bearer  | Désactive le TOTP (mot de passe + step-up en prod)                                     |
| `POST`  | `/auth/step-up`                | Bearer  | Vérifie un code TOTP frais → `step_up_token` (`X-Step-Up-Token`)                       |
| `GET`   | `/.well-known/jwks.json`       | public  | Clé(s) publique(s) RSA en JWK (consommé par api + desktop)                             |
| `GET`   | `/auth/desktop/authorize`      | session | SSO desktop : session → code à usage unique (admins uniquement)                        |
| `POST`  | `/auth/desktop/token`          | public  | SSO desktop : code + PKCE verifier → access token                                      |

Le préfixe `/auth/login` est **rate-limité** et couvre par préfixe `/auth/login`, `/auth/login/mfa`
et `/auth/login/enroll/*` — avec MFA obligatoire, une seule connexion consomme plusieurs appels.

---

## Flux d'inscription

`POST /auth/register` s'exécute **dans l'auth-service** mais ne crée pas l'utilisateur lui-même : il
appelle `POST API_URL/users` avec un **token de service** court (`aud: "api:internal"`, 30 s) qu'il
signe. Aucun token de session n'est émis avant vérification de l'email — le compte reçoit un lien, et
`POST /auth/login` refuse tant que `emailVerified` est faux (`403 email_not_verified`). La langue de
l'email suit l'en-tête `Accept-Language`. Réponse `202` neutre (pas d'énumération), sauf collision
explicite (`409`).

---

## Intégration JavaFX (`admin-desktop`)

Le client desktop JavaFX est un client OAuth **public** — livré en jar, tout secret embarqué serait
lisible. Il utilise donc le flux natif RFC 8252 : authorization code + PKCE **S256 obligatoire**, sans
client secret. Réservé **admin/superAdmin, imposé côté serveur**.

```
admin-desktop                    auth-service                     navigateur
     |                                |                              |
     |-- bind 127.0.0.1:0 ------------|                              |
     |-- ouvre le navigateur -------------------------------------->|
     |                                |<-- GET /auth/desktop/authorize
     |                                |    response_type=code
     |                                |    client_id=admin-desktop
     |                                |    redirect_uri=http://127.0.0.1:<port>/callback
     |                                |    state=<csrf> code_challenge=<S256>
     |                                |
     |                                |  pas de session ? -> /login puis retour ici
     |                                |  pas admin ?       -> ?error=access_denied
     |                                |
     |<-- GET /callback?code=&state= -------------------------------|
     |                                |
     |-- POST /auth/desktop/token --->|   (canal arrière, sans navigateur)
     |   code, code_verifier,         |
     |   client_id, redirect_uri      |
     |<-- { access_token, expires_in }|
```

Règles que le client doit tenir :

- **Vérifier `state`** au retour avant d'utiliser le code — c'est le garde-fou CSRF.
- **Vérifier le token** contre le JWKS (`iss: "auth-service"`, `aud: "api"`, RS256) plutôt que de
  faire confiance à ce qui arrive.
- **Contrôler le claim `role`** (`admin`/`superAdmin`) — défense en profondeur, le serveur refuse
  déjà les autres.
- **Mettre en cache les clés JWKS avec un TTL** — un cache par `kid` sans TTL ne verrait jamais une
  rotation avant redémarrage.

Le token émis est le token first-party ordinaire (`aud: "api"`), donc le jar continue d'appeler
`apps/api` et `/auth/userinfo` sans changement d'audience. **Aucun refresh token** : le client garde
l'access token en mémoire et rouvre le navigateur à l'expiration (le cookie httpOnly `/auth` rend
l'opération silencieuse). Un client public assis sur un refresh token longue durée serait un passif
sans contrepartie.

> L'ancien flux — `/login?redirect_uri=<loopback>` répondant `?access_token=` dans la query string —
> a **disparu**. Il exposait le JWT brut dans l'historique et les logs de proxy, et acceptait
> n'importe quel port loopback. Les anciens jars reçoivent un callback sans token et doivent être
> mis à jour.

Détails du back-channel : `POST /auth/desktop/token` attend un corps `application/x-www-form-urlencoded`.
Le code est à **usage unique**, claimé par un compare-and-swap atomique sur `usedAt` (deux échanges
concurrents ne peuvent redéemer le même code) ; le `codeHash` (sha256) empêche qu'une lecture en base
soit rejouée sur `/token` ; le `redirectUri` est **comparé octet à octet**, jamais re-parsé.

---

## Base de données

L'auth-service partage l'instance MongoDB existante — aucun conteneur dédié.

```
mongodb (conteneur partagé)
  └── app_db
        ├── users               ← api lit/écrit · auth-service lit seulement (identifiants + TOTP + claim admin)
        ├── district_admins     ← api lit/écrit · auth-service lit seulement (pour dériver adminDistrictId)
        ├── refresh_tokens      ← auth-service lit/écrit uniquement
        └── authorization_codes ← auth-service lit/écrit uniquement (SSO desktop)
```

**Règle de frontière :** l'auth-service n'**écrit** jamais `users` par les chemins de session — il le
**lit** (validation des identifiants, `totpSecret` / `totpEnabled` / `emailVerified` / `banned`) et met
à jour le secret TOTP via le repository. La création d'utilisateur passe par l'api (token de service).
L'api ne lit ni n'écrit `refresh_tokens`.

Les champs TOTP vivent sur le document `users` (partagé, `@repo/shared`) : `totpSecret`, `totpEnabled`
et le suivi anti-rejeu du dernier pas consommé (`consumeTotpStep`).

### Collection `refresh_tokens`

Adosse les « sessions » exposées par `/auth/sessions`. Purge automatique par index TTL sur la Date
BSON `expiresAtDate` (`expireAfterSeconds: 0`) — le moniteur TTL ignore la chaîne ISO `expiresAt`.

```
REFRESH_TOKENS {
  _id           ObjectId PK
  userId        ObjectId FK → users
  tokenHash     string       (sha256, jamais en clair)
  sessionId     string       (« famille » de session, stable à travers les rotations)
  expiresAt     string       (ISO)
  expiresAtDate Date         (index TTL)
  revokedAt     string|null  (null si active)
  createdAt     string
  lastUsedAt    string|null  (dernier refresh)
  userAgent     string|null  (capturé au login)
  ip            string|null  (capturée au login)
}
```

`sessionId` est une famille stable : l'id du token change à chaque rotation, mais révoquer une session
(ou « révoquer les autres ») agit sur la famille, pas sur un token isolé. `userAgent`/`ip` alimentent
la vue « appareils actifs ».

### Collection `authorization_codes`

Codes à usage unique du SSO desktop. TTL de 60 s via index sur `expiresAtDate` ; claimés par
compare-and-swap atomique sur `usedAt`.

```
AUTHORIZATION_CODES {
  _id            ObjectId PK
  codeHash       string      (sha256 — une lecture en base n'est pas rejouable sur /token)
  clientId       string
  userId         ObjectId FK → users
  redirectUri    string      (comparé octet à octet à l'échange, jamais re-parsé)
  codeChallenge  string      (PKCE S256, obligatoire)
  expiresAt      timestamp
  expiresAtDate  Date        (index TTL)
  usedAt         timestamp   (null jusqu'au claim)
  createdAt      timestamp
}
```

---

## Vérification côté api

`apps/api/src/middleware/auth.middleware.ts` :

- récupère le JWKS depuis `AUTH_JWKS_URL` (défaut `http://localhost:3001/.well-known/jwks.json` ;
  docker : `http://auth-service:3001/...`), mis en cache et re-fetché à la rotation de `kid` ;
- `requireAuth` vérifie le Bearer sur chaque route protégée : signature, `iss: "auth-service"`,
  `aud ∈ { "api", "api:internal" }`, `alg: "RS256"` ; renseigne `req.user` (`sub`, `role`,
  `adminDistrictId`, …) ;
- bannissement à effet immédiat : pour un token `role: "user"`, un lookup vérifie que le compte n'a
  pas été banni depuis l'émission (`403 Account suspended`) ; le trafic admin/service n'est pas touché ;
- l'autorisation (rôles, propriété, quartier) est portée par le middleware `authorize` piloté par les
  métadonnées du contrat ; `requireStepUp` ajoute l'exigence de step-up là où le contrat la déclare.

---

## Dépendances et clés

```
jose    — signature/vérification JWT (RS256), génération du JWKS
argon2  — hachage des mots de passe
otplib  — génération de secret TOTP et URI otpauth (QR code)
```

Les clés sont injectées en production via `AUTH_PRIVATE_KEY` / `AUTH_PUBLIC_KEY` (PEM inline **ou**
`AUTH_*_KEY_FILE` pour un fichier monté). En développement, à défaut de PEM, une paire éphémère est
générée au démarrage et journalisée une fois. **En production, l'absence de PEM est une erreur
fatale** : des clés éphémères invalideraient toutes les sessions à chaque redémarrage et casseraient
la vérification JWKS entre instances.
