# TODO — variables d'env avant déploiement

Les défauts de dev conviennent pour `npm run dev` / `docker compose up`. Positionnez ces
variables avant tout environnement non local.

## auth-service (`apps/auth-service`)

| Var                      | Requise             | Défaut                                | Notes                                                                                                                            |
| ------------------------ | ------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                   | non                 | `3001`                                | Port d'écoute.                                                                                                                   |
| `MONGODB_URL`            | oui (non local)     | `mongodb://root:root@localhost:27017` | Partagée avec l'api.                                                                                                             |
| `MONGODB_DB`             | oui (non local)     | `db`                                  |                                                                                                                                  |
| `API_URL`                | oui (en docker)     | `http://localhost:3000`               | Où le register POST le nouvel user. En docker compose : `http://api:3000`.                                                       |
| `INTERNAL_SERVICE_TOKEN` | **oui (prod)**      | `dev-internal-service-token`          | Secret partagé des appels internes api↔auth-service (`X-Internal-Token`). Doit être identique des deux côtés.                    |
| `AUTH_PRIVATE_KEY`       | **oui (prod)**      | générée éphémère au boot              | PEM RS256. Sans elle, chaque redémarrage invalide les tokens en cours. Alternative : `AUTH_PRIVATE_KEY_FILE`.                    |
| `AUTH_PUBLIC_KEY`        | **oui (prod)**      | générée éphémère au boot              | Doit correspondre à la clé privée. Alternative : `AUTH_PUBLIC_KEY_FILE`.                                                         |
| `AUTH_PUBLIC_URL`        | **oui (prod)**      | `http://localhost:3001`               | URL publique servie par l'auth-service. Sert à construire les liens de vérification + reset.                                     |
| `CORS_ORIGINS`           | **oui (non local)** | `http://localhost:3000,4000,5000`     | Séparées par des virgules. Sert aussi d'allowlist des `redirect_uri` sur login/register.                                         |
| `RESEND_API_KEY`         | **oui (prod)**      | _(aucune)_                            | Transport email : SMTP (dev) → Resend (prod) → fallback console. Sans SMTP ni Resend, les emails ne sont qu'affichés sur stdout. |
| `FROM_EMAIL`             | **oui (prod)**      | `no-reply@example.com`                | Doit être sur un domaine vérifié dans Resend.                                                                                    |
| `APP_NAME`               | non                 | `Connected-Neighboors`                | Utilisé dans le sujet/corps des emails.                                                                                          |
| `TOTP_ISSUER`            | non                 | `Connected-Neighboors`                | Nom de compte affiché dans l'app d'authentification de l'utilisateur.                                                            |
| `NODE_ENV`               | oui (prod)          | _(aucune)_                            | `production` passe les cookies refresh + csrf en `secure: true`.                                                                 |

## api (`apps/api`)

| Var                                                                          | Requise             | Défaut                                        | Notes                                                                                                         |
| ---------------------------------------------------------------------------- | ------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URL`                                                                | oui (non local)     | `mongodb://root:root@localhost:27017`         |                                                                                                               |
| `MONGODB_DB`                                                                 | oui (non local)     | `db`                                          |                                                                                                               |
| `AUTH_JWKS_URL`                                                              | **oui (non local)** | `http://localhost:3001/.well-known/jwks.json` | Doit pointer sur le JWKS de l'auth-service. En docker : `http://auth-service:3001/...`.                       |
| `AUTH_SERVICE_URL`                                                           | **oui (prod)**      | `http://localhost:3001`                       | Base que l'api appelle pour purger les sessions auth-service à la suppression de compte (effacement RGPD).    |
| `INTERNAL_SERVICE_TOKEN`                                                     | **oui (prod)**      | `dev-internal-service-token`                  | Même secret que côté auth-service (voir ci-dessus).                                                           |
| `CORS_ORIGINS`                                                               | **oui (non local)** | `http://localhost:4000,5000`                  | Origines frontend, séparées par des virgules.                                                                 |
| `MESSAGES_MINIO_ACCESS_KEY` / `MESSAGES_MINIO_SECRET_KEY`                    | **oui (prod)**      | _(vides)_                                     | Identifiants MinIO pour les messages vocaux + images d'annonces (fallback des buckets `listings`).            |
| `DOCUMENSO_API_TOKEN` / `DOCUMENSO_TEMPLATE_ID` / `DOCUMENSO_WEBHOOK_SECRET` | **oui (prod)**      | _(vides)_                                     | Signature électronique des contrats (voir `.env.dist`).                                                       |
| `TRUST_PROXY`                                                                | selon infra         | _(non défini)_                                | Derrière un reverse proxy/LB, nombre de hops de confiance (ex. `1`) pour que `req.ip` reflète le vrai client. |

## user-front (`apps/user-front`)

Variables Vite — doivent être préfixées `VITE_` pour être exposées au navigateur.

| Var                     | Requise         | Défaut                  | Notes                                                                                               |
| ----------------------- | --------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| `VITE_AUTH_SERVICE_URL` | oui (non local) | `http://localhost:3001` | URL publique de l'auth-service.                                                                     |
| `VITE_API_URL`          | oui (non local) | `http://localhost:3000` | URL publique de l'api.                                                                              |
| `VITE_APP_URL`          | oui (non local) | `http://localhost:5000` | URL publique du user-front (l'auth-service la lit aussi pour rediriger après vérification / reset). |
| `VITE_ADMIN_URL`        | oui (non local) | `http://localhost:4000` | URL publique de la console admin (les superAdmins y sont redirigés depuis le user-front).           |

## admin-front (`apps/admin-front`)

| Var                     | Requise         | Défaut                  | Notes |
| ----------------------- | --------------- | ----------------------- | ----- |
| `VITE_AUTH_SERVICE_URL` | oui (non local) | `http://localhost:3001` |       |

## Génération des clés RS256 pour la prod

Le plus simple est le script dédié, qui écrit `private.pem` (600) et `public.pem` (644)
dans `docker/auth` (monté en lecture seule par la stack compose de prod via
`AUTH_*_KEY_FILE`) :

```sh
scripts/gen-auth-keys.sh          # défaut : docker/auth
```

Alternative manuelle si vous injectez les PEM inline dans un secret store
(`AUTH_PRIVATE_KEY` / `AUTH_PUBLIC_KEY` reçoivent la chaîne PEM complète, sauts de ligne
compris) :

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out auth-private.pem
openssl rsa -in auth-private.pem -pubout -out auth-public.pem
```

## Durcissement sécurité (backlog)

### H5 — Limitation du brute-force MFA par compte

`POST /auth/login/mfa` n'est rate-limité que par IP (5/min, `apps/auth-service/src/index.ts`).
Un TOTP à 6 chiffres, c'est 1M de combinaisons, et le `mfa_token` vit 5 min : un
attaquant qui alterne les IP n'a aucun plafond par compte, et les échecs n'invalident ni
le `mfa_token` ni le secret. Le rejeu est déjà géré (H4 : `lastTotpStep` /
`consumeTotpStep`), mais pas le throttling.

L'approche reste indécise — un compteur par user en Mongo a été écarté. Pistes :

- `express-rate-limit` clé sur le `sub` du `mfa_token` plutôt que sur l'IP (aucune infra
  nouvelle, remis à zéro au redémarrage, non multi-instance sans store partagé).
- Invalider le `mfa_token` après N échecs (compte les tentatives contre le token
  court-vécu lui-même).
- Store partagé (Redis) clé par user — durable + multi-instance, mais ajoute une infra
  non exploitée actuellement.

Envisager aussi d'exiger un code TOTP courant (pas seulement le mot de passe) pour
`disable-totp`.

## Migration de données ponctuelle

Les documents user existants sont antérieurs à `emailVerified` / `totpSecret` /
`totpEnabled`. Sans ceci, chaque compte existant serait verrouillé au prochain login.

```js
db.users.updateMany(
  { emailVerified: { $exists: false } },
  { $set: { emailVerified: true, totpSecret: null, totpEnabled: false } },
);
```
