# Prise en main

Ce guide couvre la mise en place d'un environnement de développement local complet pour le projet.

## Prérequis

| Outil   | Version   | Remarques                                                                         |
| ------- | --------- | --------------------------------------------------------------------------------- |
| Node.js | 20+ (LTS) | Aucune contrainte imposée (pas de champ `engines`) ; une LTS récente est attendue |
| npm     | 11+       | Le dépôt épingle `npm@11.12.1` via `packageManager`                               |
| Docker  | Récente   | Requis pour les bases de données et l'ensemble des services conteneurisés         |
| Git     | Toute     | —                                                                                 |

Le monorepo est géré avec **Turborepo** et les **npm workspaces** : une seule installation à la racine couvre les cinq applications et les packages partagés.

## 1. Cloner le dépôt

```bash
git clone <repo-url>
cd Web-Apps
```

## 2. Installer les dépendances

```bash
npm install
```

Cette commande installe les dépendances de toutes les applications et de tous les packages du monorepo en une passe.

## 3. Configurer l'environnement (optionnel en dev)

Le compose de développement embarque déjà des valeurs par défaut cohérentes pour la stack locale — un simple `docker compose up` fonctionne sans fichier `.env`. Pour surcharger un port qui entre en conflit ou fournir un secret (token Documenso, clé Resend…), copiez le template :

```bash
cp .env.dist .env
```

`.env.dist` documente chaque variable ; les valeurs indiquées sont les défauts codés en dur, vous n'avez à renseigner que ce qui diffère. Voir la section **Variables d'environnement courantes** plus bas.

## 4. Démarrer la stack

Le compose de développement (`docker-compose.yml`, celui par défaut) n'a **pas de profils** : `docker compose up` démarre l'ensemble de la stack — les cinq applications, les bases de données (MongoDB, Neo4j, PostgreSQL), le stockage objet MinIO, et la brique de signature électronique Documenso (Documenso + mailpit) — plus les one-shots d'initialisation (replica set Mongo, création des buckets MinIO, seed des données).

### Option A — Développement local (recommandé)

`npm run dev` lève la stack Docker puis lance Turborepo en mode watch. La commande est exactement équivalente à :

```bash
docker compose up -d
turbo run dev
```

Les services applicatifs du compose de dev bind-montent le dépôt (`.:/app`), donc le hot-reload fonctionne aussi bien que l'app tourne dans Docker (option B) ou sur l'hôte via `turbo run dev`.

### Option B — Tout dans Docker

Faire tourner l'intégralité de la stack, applications comprises, depuis le compose racine :

```bash
docker compose up
```

Les conteneurs bind-montent la racine du dépôt et surveillent les changements, le live-reload reste donc actif.

## 5. Vérifier que tout tourne

### Applications

| Service                                | URL                            |
| -------------------------------------- | ------------------------------ |
| API                                    | `http://localhost:3000`        |
| API — health check                     | `http://localhost:3000/health` |
| API — docs (Scalar)                    | `http://localhost:3000/docs`   |
| Service d'authentification             | `http://localhost:3001`        |
| Console d'administration (admin-front) | `http://localhost:4000`        |
| Application résident (user-front)      | `http://localhost:5000`        |
| Vitrine (landing)                      | `http://localhost:6060`        |

> La documentation OpenAPI (`/docs` + `/openapi.json`) n'est servie qu'en dev ; en production elle est désactivée sauf si `ENABLE_API_DOCS=true`.

### Infrastructure (dev uniquement)

| Service                | URL / Port              |
| ---------------------- | ----------------------- |
| MongoDB                | `localhost:27017`       |
| Mongo Express (UI)     | `http://localhost:8081` |
| Neo4j Browser (HTTP)   | `http://localhost:7474` |
| Neo4j Bolt             | `localhost:7687`        |
| MinIO (S3)             | `http://localhost:9000` |
| MinIO Console          | `http://localhost:9001` |
| Documenso              | `http://localhost:3030` |
| Mailpit (UI mail)      | `http://localhost:8025` |
| PostgreSQL (Documenso) | `localhost:5432`        |

> En production, aucun de ces datastores n'est exposé à l'hôte : tout passe par le réseau interne de Docker Compose, derrière le reverse proxy Caddy.

## MongoDB en replica set (`rs0`)

MongoDB tourne comme un **replica set à un seul membre** nommé `rs0`, et non en standalone. C'est une exigence, pas un confort :

- Le watcher offline-sync de l'api s'appuie sur les **Change Streams** (`db.watch()`), qui échouent sur un `mongod` standalone.
- Les **transactions multi-documents** (mouvements de points, séquestre) ne sont disponibles que sur un replica set.

Le compose s'en charge automatiquement via deux mécanismes :

- Le conteneur `mongodb` démarre avec `--replSet rs0 --keyFile …` (un keyfile est obligatoire dès qu'auth et réplication sont tous deux actifs, même à un seul membre).
- Un one-shot idempotent **`mongo-init`** exécute `rs.initiate(...)` sur un volume vierge, puis s'arrête. Tous les services qui parlent à Mongo attendent son achèvement, aucune application ne se connecte donc avant que `rs0` n'ait un primaire.

Les URLs de connexion incluent en conséquence `?replicaSet=rs0` (voir `MONGODB_URL`).

## Peuplement de la base (seed)

Deux one-shots peuplent la base au démarrage et sont **inclus dans `docker compose up`** — aucune commande supplémentaire n'est nécessaire en dev :

- **`api-seed`** — remplit MongoDB et Neo4j avec un jeu de données d'exemple (quartiers, résidents, annonces, contrats, événements…). Idempotent (clé sur des IDs déterministes), il se relance sans risque à chaque `up`. Le scénario est choisi par `SEED_SCENARIO` (défaut `demo`), qui sélectionne le fichier `seed-data/<name>.txt` à la racine du dépôt (`demo`, `demo-large`, `minimal`).
- **`auth-seed`** — crée (ou promeut) le compte **superAdmin**. Idempotent (clé sur l'email). Il tourne **après** `api-seed`, car ce dernier vide entièrement la collection `users` et emporterait sinon le superAdmin.

Identifiants du superAdmin par défaut (surchargeables via l'environnement) :

- Email : `superadmin@local.dev` (`SEED_SUPERADMIN_EMAIL`)
- Mot de passe : `ChangeMe!2345` (`SEED_SUPERADMIN_PASSWORD`)

Les comptes de démonstration reçoivent tous le mot de passe `Password123!` (`SEED_PASSWORD`).

### Lancer le seed manuellement

Sur une stack déjà en marche, sans reconstruire les conteneurs :

```bash
npm run seed -w api                       # scénario demo par défaut
npm run seed -w api -- minimal            # ou : SEED_SCENARIO=minimal npm run seed -w api
npm run seed:superadmin -w auth-service   # (re)créer le superAdmin
```

> **Garde-fou production.** Le script de seed vide la collection `users` avant de repeupler. Il **refuse de s'exécuter** si `NODE_ENV=production`, sauf `SEED_ALLOW_PRODUCTION=true` explicite. À ne jamais activer sur une vraie base.

## Structure du projet

```
.
├── apps/
│   ├── api/           # API Express + ts-rest, resource server JWKS (port 3000)
│   ├── auth-service/  # Service d'authentification Express + ts-rest, RS256/JWKS (port 3001)
│   ├── admin-front/   # Console d'administration React + Vite + Tailwind (port 4000)
│   ├── user-front/    # Application résident React + Vite + Tailwind (port 5000)
│   └── landing/       # Vitrine marketing React + Vite (port 6060)
├── packages/
│   ├── contracts/     # Contrats ts-rest + DTO Zod (source unique des formes requête/réponse)
│   ├── hooks/         # Auth React partagée (AuthProvider, ProtectedRoute, useAuth)
│   ├── config/        # Config runtime front centralisée (URLs des services)
│   ├── shared/        # Infrastructure backend commune (api + auth-service)
│   ├── theme/         # Thème FlyonUI partagé (couleurs de marque, tokens clair/sombre)
│   ├── satan/         # SATAN QL — pont vers un worker Python pour des requêtes Mongo SQL-like
│   ├── eslint-config/
│   ├── typescript-config/
│   └── types/         # Dossier workspace sans package.json (ignoré tant qu'il reste tel quel)
├── seed-data/                  # Scénarios de peuplement (demo.txt, demo-large.txt, minimal.txt)
├── documentation/
├── docker-compose.yml          # Stack de dev (hot-reload) — une commande lève tout
└── docker-compose.deploy.yml   # Stack de prod (images GHCR, TLS Caddy)
```

## Variables d'environnement courantes

Les backends lisent `process.env.*`, les fronts `import.meta.env.VITE_*`, avec des défauts localhost dans les deux cas. Le template complet et commenté est `.env.dist` ; les plus utiles :

### Partagées

| Variable                 | Défaut (dev)                          | Rôle                                                            |
| ------------------------ | ------------------------------------- | --------------------------------------------------------------- |
| `MONGODB_URL`            | `mongodb://root:root@localhost:27017` | Connexion Mongo (en Docker : `…@mongodb:27017/?replicaSet=rs0`) |
| `MONGODB_DB`             | `db`                                  | Nom de la base                                                  |
| `NEO4J_URL`              | `bolt://localhost:7687`               | Projection graphe / recommandation                              |
| `NODE_ENV`               | `development`                         | Bascule dev/prod (désactive `/docs`, active le garde-fou seed…) |
| `INTERNAL_SERVICE_TOKEN` | `dev-internal-service-token`          | Secret partagé des appels internes api ↔ auth-service           |

### api (port 3000)

| Variable        | Défaut (dev)                                  | Rôle                                                     |
| --------------- | --------------------------------------------- | -------------------------------------------------------- |
| `AUTH_JWKS_URL` | `http://localhost:3001/.well-known/jwks.json` | JWKS utilisé pour vérifier les access tokens             |
| `CORS_ORIGINS`  | `http://localhost:4000,http://localhost:5000` | Origines autorisées (fronts uniquement)                  |
| `DOCUMENSO_*`   | —                                             | Token, template et secret de webhook Documenso           |
| `SATAN_REPOS`   | activé                                        | `false` pour retomber sur les repositories Mongo directs |

### auth-service (port 3001)

| Variable                               | Défaut (dev)             | Rôle                                                         |
| -------------------------------------- | ------------------------ | ------------------------------------------------------------ |
| `API_URL`                              | `http://localhost:3000`  | L'auth-service y crée les users à l'inscription              |
| `AUTH_PRIVATE_KEY` / `AUTH_PUBLIC_KEY` | — (clés éphémères sinon) | Paire RS256 de signature des tokens (stable requise en prod) |
| `SMTP_HOST` / `RESEND_API_KEY`         | `mailpit` en dev         | Transport email (dev → mailpit ; prod → Resend)              |
| `TOTP_ISSUER`                          | `Connected-Neighboors`   | Libellé affiché dans les apps d'authentification (2FA)       |

### Fronts (Vite)

| Variable                | Défaut                  | Consommateur                      |
| ----------------------- | ----------------------- | --------------------------------- |
| `VITE_AUTH_SERVICE_URL` | `http://localhost:3001` | admin-front, user-front, landing  |
| `VITE_API_URL`          | `http://localhost:3000` | user-front, landing               |
| `VITE_APP_URL`          | `http://localhost:5000` | Base publique de l'app résident   |
| `VITE_ADMIN_URL`        | `http://localhost:4000` | Base publique de la console admin |

## Commandes courantes

Toutes se lancent depuis la racine du dépôt, orchestrées par Turborepo :

```bash
npm run dev       # Lève la stack Docker puis lance toutes les apps en mode watch
npm run build     # Build toutes les apps et packages
npm run lint      # Lint tout le monorepo (ESLint)
npm run format    # Formate .ts/.tsx/.js/.json/.md avec Prettier
npm run test      # Tests unitaires (Vitest) sur api, auth-service et hooks
```

## Déploiement (aperçu)

`docker-compose.deploy.yml` est le **seul** compose de production. Il ne build rien sur l'hôte : il tire les images que la CD a poussées sur GHCR et place un reverse proxy **Caddy** (TLS Let's Encrypt automatique) devant l'ensemble. Chaque secret et chaque URL d'environnement provient d'un fichier chiffré par SOPS déchiffré au déploiement. Il n'est pas destiné à un usage local.

```bash
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d --no-build
```
