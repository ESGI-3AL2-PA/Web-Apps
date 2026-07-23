# Architecture

Ce document décrit l'architecture technique du monorepo. Il vise la documentation **durable**
(comment le système est structuré, pourquoi ces choix) ; l'état d'avancement et l'analyse critique
relèvent de `documentation/synthese-projet.md`.

---

## 1. Vue d'ensemble

Le projet est un **monorepo Turborepo** intégralement en TypeScript, structuré autour d'un parti pris
**contract-first** : chaque endpoint est déclaré une seule fois dans un package de contrats partagé,
consommé à la fois par le backend et par les frontends. Aucune des applications ne redéfinit une forme
de donnée — toutes la dérivent, ce qui rend la classe entière des désynchronisations front/back
détectable à la compilation.

```
.
├── apps/
│   ├── api/            # Express + ts-rest, resource server            : port 3000
│   ├── auth-service/   # Express + ts-rest, émission de tokens         : port 3001
│   ├── admin-front/    # React 19 + Vite + Tailwind 4 + FlyonUI        : port 4000
│   ├── user-front/     # React 19 + Vite + Tailwind 4 + FlyonUI        : port 5000
│   └── landing/        # React 19 + Vite + Tailwind 4 + FlyonUI (vitrine) : port 6060
├── packages/
│   ├── contracts/         # Contrats ts-rest + DTO Zod (source unique de vérité)
│   ├── shared/            # Infrastructure backend commune (Mongo, container DI, erreurs, tokens…)
│   ├── hooks/             # Auth React partagée (AuthProvider, ProtectedRoute, useAuth)
│   ├── theme/             # Design system FlyonUI partagé (theme.css : couleurs, typo, clair/sombre)
│   ├── config/            # Configuration runtime partagée des frontends (URLs de services)
│   ├── satan/             # SATAN QL — langage de requêtes MongoDB (client TS + worker Python)
│   ├── types/             # Quelques types partagés (répertoire sans package.json)
│   ├── eslint-config/     # Règles ESLint 9 flat-config partagées
│   └── typescript-config/ # Bases tsconfig partagées
├── documentation/               # Documentation technique (ce document, MCD, auth, Documenso…)
├── docker-compose.yml           # Stack dev (build depuis les sources, hot-reload par bind mount)
└── docker-compose.deploy.yml    # Stack prod (images GHCR, reverse proxy Caddy + TLS)
```

Cinq applications déployables et huit packages `@repo/*` (plus le répertoire `types/`, sans
`package.json` propre).

---

## 2. Système de build — Turborepo

Turborepo orchestre les tâches sur l'ensemble des workspaces npm. Propriétés principales du pipeline :

| Tâche               | Cache | Persistante | Notes                                                         |
| ------------------- | ----- | ----------- | ------------------------------------------------------------- |
| `build`             | oui   | non         | Dépend de `^build` (les dépendances sont construites d'abord) |
| `dev`               | non   | oui         | Hot-reload de toutes les apps en parallèle                    |
| `lint` / `lint:fix` | oui   | non         | ESLint par workspace                                          |
| `test`              | —     | non         | Vitest (~25 fichiers `*.test.ts` : api, auth-service, hooks)  |
| `start`             | oui   | non         | Exécute la sortie compilée                                    |
| `format`            | oui   | non         | Prettier sur tous les workspaces                              |

`npm run dev` lance toutes les apps en hot-reload ; la stack peut aussi être montée entièrement via
Docker Compose (§8).

---

## 3. Package de contrats (`@repo/contracts`)

Le package de contrats est le **cœur architectural** du projet et la source unique de vérité pour :

- les chemins et méthodes HTTP des endpoints ;
- les schémas de requête (query, path, body) ;
- les schémas de réponse (codes de statut et formes de corps) ;
- les types DTO TypeScript ;
- la documentation OpenAPI ;
- **la politique d'autorisation de chaque route**, déclarée en métadonnées (`metadata.auth`) plutôt que
  réécrite dans chaque handler.

### Technologies

- **ts-rest** (`@ts-rest/core`) — définit des routeurs typés ; consommés côté serveur par
  `@ts-rest/express` et directement par les clients.
- **Zod** — schémas de validation runtime et inférence des types TypeScript.

### Modules de contrat

Seize modules de contrat cohabitent — quinze servis par l'api, plus `auth.contract.ts` servi par
l'auth-service :

| Contrat                       | Servi par    | Routes |
| ----------------------------- | ------------ | :----: |
| `auth.contract.ts`            | auth-service |   20   |
| `users.contract.ts`           | api          |   10   |
| `conversations.contract.ts`   | api          |   9    |
| `events.contract.ts`          | api          |   9    |
| `contracts.contract.ts`       | api          |   7    |
| `votes.contract.ts`           | api          |   7    |
| `incidents.contract.ts`       | api          |   6    |
| `listings.contract.ts`        | api          |   6    |
| `districts.contract.ts`       | api          |   5    |
| `notifications.contract.ts`   | api          |   5    |
| `tags.contract.ts`            | api          |   5    |
| `district-admins.contract.ts` | api          |   4    |
| `transactions.contract.ts`    | api          |   4    |
| `conflicts.contract.ts`       | api          |   3    |
| `sync.contract.ts`            | api          |   2    |
| `recommendations.contract.ts` | api          |   1    |

Soit une centaine d'endpoints au total (~83 côté api, 20 côté auth-service). Le document de synthèse
retient le cadrage de **13 domaines métier** : les treize ci-dessus hors `sync` et `conflicts`, qui
relèvent de l'infrastructure de synchronisation hors-ligne, et hors `auth`, porté par le service dédié.

---

## 4. Application api (`apps/api`)

L'api suit une architecture en couches inspirée du DDD et de l'architecture hexagonale. Le chemin
d'ajout d'une fonctionnalité est unique :

```
contrat (DTO + route)  →  entité  →  repository  →  use-case  →  handler
```

### 4.1 Couches

- **Routes** (`src/routes/`) — contrôleurs fins ; un handler résout ses dépendances via `resolve("name")`
  et délègue au use-case.
- **Use-cases** (`src/use-cases/`) — fonctions recevant leurs repositories en argument et renvoyant des
  données brutes ; c'est là que vit la logique métier. Granularité fine : un fichier par opération
  (`create-contract`, `resolve-dispute`, `mark-interest`…).
- **Repositories** (`src/repositories/`) — chaque domaine déclare une **interface** (port) décrivant le
  besoin métier indépendamment du stockage ; les implémentations concrètes (Mongo, SATAN, Neo4j) sont
  enregistrées dans un container d'injection de dépendances au démarrage.
- **Entités** (`src/entities/`) — schémas de validation Zod décrivant la forme d'un objet ; elles ne
  portent aucun comportement.

### 4.2 Domaines et container de repositories

`repositories/container.ts` construit et enregistre chaque repository, puis expose `resolve(name)`.
Treize repositories de domaine sont câblés :

- Douze repositories Mongo — `user`, `listing`, `contract`, `event`, `incident`, `district`,
  `districtAdmin`, `tag`, `vote`, `conversation`, `notification`, `transaction` — chacun **enveloppable
  à l'exécution** par son homologue SATAN QL (voir §4.5).
- Un repository Neo4j — `graph` — projection en graphe qui alimente la recommandation.

S'ajoutent cinq repositories d'infrastructure pour la synchronisation hors-ligne (`syncCounter`,
`syncState`, `syncChanges`, `syncConflicts`, `syncWriter`) — sans variante SATAN, car ce n'est pas de
la requête métier. À l'initialisation, le container garantit aussi de façon idempotente la création des
index Mongo requis (non bloquant au boot).

### 4.3 Point d'entrée (`src/index.ts`)

- Charge d'abord `@repo/shared/load-env`, puis monte Express avec **helmet** (en-têtes de sécurité, CSP
  désactivée pour l'UI Scalar), **CORS** (origines depuis `CORS_ORIGINS`, défaut
  `http://localhost:4000,http://localhost:5000`) et **rate limiting** par IP (`express-rate-limit`,
  fenêtre d'une minute, plafonds plus stricts sur création de contrat, upload et proxy PDF).
- Journalisation par requête via `pino-http`, avec **redaction** des en-têtes sensibles (Authorization,
  Cookie, IP) pour la conformité.
- Expose deux sondes : `GET /health` (liveness statique) et `GET /readyz` (readiness — ping Mongo requis
  → 503 si HS, Neo4j optionnel → 200 « degraded »).
- Génère le schéma OpenAPI depuis les contrats et sert l'UI **Scalar** sur `GET /docs` ; désactivés en
  production sauf `ENABLE_API_DOCS=true`.
- Enregistre chaque routeur ts-rest via `createExpressEndpoints`, avec un middleware global unique
  `[authorize, requireStepUp]` (voir §4.4).
- Démarre un `http.Server` manuel pour y attacher **Socket.io** (messagerie temps réel), puis connecte
  les datastores avec backoff (`withRetry`), amorce le worker SATAN de façon best-effort, et lance le
  flux de synchronisation hors-ligne.

### 4.4 Autorisation

L'api est un **resource server** : elle vérifie les access tokens RS256 entrants contre le JWKS de
l'auth-service (`createRemoteJWKSet`) via le middleware `requireAuth`, qui renseigne `req.user`.

L'autorisation proprement dite est **déclarative** : chaque route porte sa politique dans le
`metadata.auth` de son contrat, appliquée par une **barrière unique** — le middleware global
`authorize` — qui lit la route ts-rest courante, charge au besoin les enregistrements concernés et
applique les vérifications d'audience, de rôle, de propriété et de cloisonnement par quartier. Pas de
`requireRole(...)` répété par handler. Un troisième middleware, `requireStepUp`, exige une preuve de MFA
fraîche (rejouée via l'en-tête `X-Step-Up-Token` après un `401 step_up_required`) sur les opérations
sensibles.

Quelques handlers bruts restent hors du pipeline ts-rest : le webhook Documenso (`POST /contracts/webhook`,
authentifié par secret partagé, monté **au-dessus** de `requireAuth`), le proxy binaire du PDF de
contrat, les flux média (audio/image de messages, images d'annonces) et la recherche/profil public.

### 4.5 SATAN QL

Les implémentations SATAN enveloppent les implémentations Mongo derrière la **même interface** de
repository : elles répondent aux requêtes exprimables via `@repo/satan` et délèguent le reste au repo
Mongo qu'elles enveloppent. Le container choisit à l'exécution : l'enveloppe SATAN n'est active que si
un client est fourni et que `SATAN_REPOS` n'est pas `"false"`. Si le worker Python ne démarre pas, l'api
log l'incident et retombe sur les repositories Mongo plutôt que de refuser de booter.

### 4.6 Synchronisation hors-ligne

L'api tail les **Change Streams** MongoDB (via un watcher démarré au boot) pour alimenter un flux de
changements consommé par le client desktop JavaFX (`admin-desktop`, dépôt séparé). Cela requiert que
Mongo tourne en **replica set** — d'où la configuration `rs0` à un membre (§8). Sur un `mongod`
standalone, `db.watch()` échoue : le flux est donc best-effort et le reste de l'api continue de servir.

### 4.7 Persistance

L'api lit et écrit les données de domaine dans **MongoDB** et projette le graphe social/quartier dans
**Neo4j**. Elle stocke aussi les médias (images d'annonces, notes vocales, images de messages) dans
**MinIO** (S3), et appelle **Documenso** en HTTP pour la signature électronique des contrats.

---

## 5. Service d'authentification (`apps/auth-service`)

Service Express + ts-rest dédié (port **3001**) qui possède l'authentification et émet les tokens ;
l'api ne voit jamais les mots de passe.

- Émet des **access tokens RS256** courts, signés avec `AUTH_PRIVATE_KEY`, et publie la clé publique
  correspondante sur `GET /.well-known/jwks.json` pour que l'api vérifie sans secret partagé. Le `kid`
  du JWKS est le thumbprint RFC 7638 de la clé : il ne change qu'avec le matériel cryptographique.
- Émet des **refresh tokens opaques** (64 octets hex, stockés en sha256 dans Mongo) dans un cookie
  httpOnly scopé à `/auth`, avec rotation et détection de réutilisation.
- Hache les mots de passe avec **argon2** ; gère la **2FA TOTP**, la réinitialisation de mot de passe et
  la vérification d'adresse e-mail (envoi via Resend, ou SMTP → mailpit en dev).
- Le **register** s'exécute ici mais crée l'utilisateur via `POST API_URL/users`, authentifié par un JWT
  `role: "service"` court auto-signé.
- Un flux **SSO/desktop** (`/auth/desktop/authorize` + `/auth/desktop/token`) permet au client JavaFX de
  se connecter en authorization code + PKCE S256 obligatoire (client public, sans secret ; admin /
  superAdmin uniquement, imposé côté serveur).

Le service suit le même découpage en couches que l'api (`entities/`, `repositories/`, `use-cases/`,
`routes/`, `services/`). Voir `documentation/auth-service.md` pour le détail des flux.

---

## 6. Frontends

Trois frontends React 19 + Vite, stylés avec **Tailwind CSS 4** et les composants **FlyonUI**.
`admin-front` et `user-front` partagent la même structure de base — clients typés par contrat et auth
via `@repo/hooks` — tandis que `landing` est une vitrine autonome sans surface authentifiée.

| App           | Port | Rôle                                                               |
| ------------- | ---- | ------------------------------------------------------------------ |
| `admin-front` | 4000 | Console d'administration (quartiers, modération, gestion métier)   |
| `user-front`  | 5000 | Application résident (annonces, contrats, événements, messagerie…) |
| `landing`     | 6060 | Site vitrine marketing + parcours d'entrée vers l'inscription      |

Chaque app résout son port hôte depuis une variable d'environnement (`ADMIN_PORT` / `USER_PORT` /
`LANDING_PORT`), avec les défauts ci-dessus. Les URLs de services proviennent des variables
`VITE_AUTH_SERVICE_URL` (défaut `http://localhost:3001`) et `VITE_API_URL` (défaut `http://localhost:3000`,
user-front). Le thème graphique commun est importé depuis `packages/theme/theme.css`. Le dark mode est
piloté par l'attribut `[data-theme]` sur `<html>` (les tokens `base-*` basculent automatiquement).

---

## 7. Packages partagés

### 7.1 `@repo/shared` — infrastructure backend commune

Factorisation de l'infrastructure jadis dupliquée entre les deux backends. Expose notamment :
connecteur Mongo (`createMongoConnector`), container d'injection de dépendances (`createContainer`),
gestion d'erreurs (`AppError`, `NotFoundError`, `errorHandler`), arrêt gracieux
(`setupGracefulShutdown`), retry avec backoff (`withRetry`), logger (`createLogger`), helpers d'ID Mongo
(`toEntity`/`toDoc`), chargement d'environnement (`./load-env`, importé en premier), schémas de
document partagés (`userDocumentSchema`, `districtAdminDocumentSchema`) et tokens de service internes.

### 7.2 `@repo/hooks` — auth React partagée

`AuthProvider`, `ProtectedRoute`, `useAuth`, `isTokenExpiringSoon` — consommés par `admin-front` et
`user-front`.

### 7.3 `@repo/theme` — design system

`theme.css` : source unique de vérité des couleurs de marque, de la typographie et des tokens clair /
sombre `[data-theme]`. Chaque front l'importe depuis son `style.css` racine. Enregistre aussi les icônes
Tabler via Iconify.

### 7.4 `@repo/config`

Configuration runtime partagée des frontends (résolution des URLs de services).

### 7.5 `@repo/satan` — SATAN QL

Langage de requêtes MongoDB développé pour le projet. Deux parties dans le même package : un **client
TypeScript** (`SatanClient.ts`) et un **worker Python** exécuté en processus séparé
(`python/` : lexer, parser, translator, executor, worker). Interposé par défaut devant les accès en
lecture (§4.5).

### 7.6 `@repo/typescript-config`

Bases tsconfig partagées :

| Fichier              | Utilisé par | Réglages notables                                       |
| -------------------- | ----------- | ------------------------------------------------------- |
| `base.json`          | Tous        | Mode strict, ESNext, `isolatedModules`, déclarations    |
| `node.json`          | backends    | Résolution NodeNext, pas de returns/override implicites |
| `vite.json`          | frontends   | Module ESNext, lib DOM, `useDefineForClassFields`, maps |
| `react-library.json` | libs React  | Étend base, JSX `react-jsx`                             |

### 7.7 `@repo/eslint-config`

Règles ESLint 9 flat-config, composées par environnement :

| Config     | Utilisé par | Règles clés                                                                |
| ---------- | ----------- | -------------------------------------------------------------------------- |
| `base.js`  | Tous        | `consistent-type-imports`, unused vars préfixées `_`, console warn/error   |
| `node.js`  | backends    | Étend base + `no-floating-promises` (error)                                |
| `react.js` | frontends   | Étend base + rules-of-hooks (error), exhaustive-deps (warn), react-refresh |

---

## 8. Infrastructure et bases de données

La stack est orchestrée par Docker Compose, sans profils : `docker compose up` démarre l'ensemble
(services applicatifs + datastores + fronts + les services de signature Documenso). Deux fichiers
partagent la même topologie et diffèrent d'intention.

- **`docker-compose.yml`** (dev, défaut) — build la cible `dev` du Dockerfile avec bind mount des
  sources pour le hot-reload, identifiants locaux zéro-config, versions d'images épinglées. Les apps
  peuvent aussi tourner directement sur l'hôte via `npm run dev`.
- **`docker-compose.deploy.yml`** (prod) — aucun `build:` ; chaque app tourne depuis l'image
  `ghcr.io/esgi-3al2-pa/web-apps/<app>:latest` construite par la CD (dist compilé servi par nginx
  durci). Un reverse proxy **Caddy** (`caddy:2-alpine`, seul point d'entrée sur `:80`/`:443`) termine le
  TLS automatiquement et route les sous-domaines vers les conteneurs ; datastores et Documenso n'ont
  aucun port hôte exposé. Secrets et URLs proviennent d'un env déchiffré (SOPS) au déploiement.

### 8.1 Datastores et services d'infrastructure

| Service                | Image                         | Port(s) (dev)             | Rôle                                                                                                                                                                                  |
| ---------------------- | ----------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MongoDB**            | `mongo:8`                     | 27017                     | Store documentaire principal (données de domaine) — tourne en **replica set `rs0`** à un membre, requis pour les Change Streams (sync hors-ligne) et les transactions multi-documents |
| **mongo-init**         | `mongo:8`                     | —                         | One-shot idempotent : initialise `rs0` puis s'arrête                                                                                                                                  |
| **mongo-express**      | `mongo-express:1.0.2`         | 8081                      | UI d'admin MongoDB (dev ; auth basic en prod)                                                                                                                                         |
| **Neo4j**              | `neo4j:5`                     | 7474 (HTTP), 7687 (Bolt)  | Graphe des relations de voisinage — alimente la recommandation ; projection best-effort (Mongo fait foi)                                                                              |
| **documenso-db**       | `postgres:15`                 | 5432                      | Base Postgres dédiée à Documenso                                                                                                                                                      |
| **Documenso**          | `documenso/documenso:v2.15.0` | 3030 (web/API)            | Signature électronique auto-hébergée des contrats (voir `documentation/documenso-integration.md`)                                                                                     |
| **MinIO**              | `minio/minio`                 | 9000 (S3), 9001 (console) | Stockage objet S3 — buckets `documenso`, `messages` (notes vocales/images) et `listings` (images d'annonces)                                                                          |
| **minio-createbucket** | `minio/mc`                    | —                         | One-shot : crée les buckets puis s'arrête                                                                                                                                             |
| **mailpit**            | `axllent/mailpit:v1.20.0`     | 8025 (UI), 1025 (SMTP)    | Puits SMTP local pour inspecter les mails sortants en dev (invitations à signer, vérifications)                                                                                       |

Deux services one-shot de peuplement complètent la stack : **api-seed** (seed MongoDB + Neo4j avec des
données d'exemple, `SEED_SCENARIO`) et **auth-seed** (création/promotion du compte superAdmin, exécuté
après api-seed qui drop la collection `users`).

### 8.2 Propriété des données

- L'**api** lit/écrit MongoDB (domaine) et Neo4j (graphe social/quartier), et stocke les médias dans
  MinIO.
- L'**auth-service** stocke identifiants et refresh tokens dans MongoDB (même base).
- **Documenso** est une intégration externe appelée en HTTP (`DOCUMENSO_URL`) ; il possède son propre
  Postgres et son bucket MinIO. Ses webhooks de signature atteignent l'api sur `POST /contracts/webhook`.

### 8.3 Topologie runtime (dev)

```
                       ┌─────────────┐
   navigateur  ───────▶│ landing:6060│
                       ├─────────────┤        ┌──────────────────┐
                       │ user-front  │───────▶│  api:3000        │──▶ MongoDB (rs0) :27017
                       │   :5000     │  REST  │  (resource srv)  │──▶ Neo4j :7474/7687
                       ├─────────────┤  + WS  │  Socket.io       │──▶ MinIO :9000
                       │ admin-front │───────▶│                  │──▶ Documenso :3030 ──▶ Postgres :5432
                       │   :4000     │        └────────┬─────────┘        │           └──▶ MinIO
                       └──────┬──────┘                 │ vérifie JWT      │ webhook
                              │                        │ (JWKS)           ▼
                              │  login / refresh       ▼            (retour /contracts/webhook)
                              └───────────────▶┌──────────────────┐
                                               │ auth-service:3001│──▶ MongoDB (même base)
                                               │ (émet les tokens)│──▶ mailpit :1025/:8025
                                               └──────────────────┘
```

En production, Caddy se place devant les cinq applications et termine le TLS ; les datastores et
Documenso restent sur le réseau interne, sans port hôte.
