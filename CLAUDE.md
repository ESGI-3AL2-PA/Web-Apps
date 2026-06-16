# Connected Neighbours — Notes Claude

Projet annuel ESGI 3AL. Plateforme collaborative de quartier (services, événements, messagerie, votes, signatures). Contraintes imposées par `Sujet du PA.pdf` et les MCD dans `documentation/MCD/`.

## Monorepo (npm workspaces + Turbo)

- `apps/api` — Node/Express + ts-rest (port 3000)
- `apps/auth-service` — service auth séparé (port 3001), mint JWT RS256
- `apps/user-front` — React + Vite + Tailwind/FlyonUI (port 5000)
- `apps/admin-front` — React + Vite (port 4000)
- `packages/contracts` — ts-rest contracts + Zod DTOs, **build via `tsc`** (vérifier `dist/` à jour quand on modif les sources)
- `packages/hooks` — `useAuth`, `AuthProvider`, `ProtectedRoute`, `isTokenExpiringSoon`
- `packages/config` — `config.apiUrl`, `config.authServiceUrl` (lit `VITE_*` env)
- `packages/ui` — composants React partagés

## Architecture dual-DB (POINT CLÉ)

**Mongo = source de vérité** pour tous les documents métier. Collections : `users`, `districts`, `district_admins`, `listings`, `contracts`, `events`, `incidents`, `votes`, `vote_responses`, `conversations`, `messages`, `notifications`, `refresh_tokens`, `transactions`, `tags`. Voir `documentation/MCD/mongo.md`.

**Neo4j = projection graphe** (nœuds + relations) pour le moteur de reco et le graphe social. Nodes : User, District, Event, Listing, Service, Vote, Incident, Tag. Voir `documentation/MCD/neo4j.md`.

**Double écriture** : chaque mutation Mongo est mirrorée vers Neo4j via `IGraphRepository` (`apps/api/src/repositories/Graph/graph.repository{,.neo4j}.ts`). Les use-cases reçoivent les 2 repos et utilisent `syncGraph(label, fn)` (best-effort, log + swallow) pour ne pas bloquer Mongo si Neo4j tombe.

## Pattern par feature X (users, listings, …)

- Contract ts-rest : `packages/contracts/src/X.contract.ts` (avec `metadata: auth({...})` pour la policy d'accès)
- DTOs Zod : `packages/contracts/src/DTO/X.dto.ts`
- Entity Zod : `apps/api/src/entities/X.entity.ts`
- Repo : `apps/api/src/repositories/X/X.repository{,.mongo}.ts`
- Use-cases : un fichier par opération dans `apps/api/src/use-cases/X/`
- Router : `apps/api/src/routes/X/X.router.ts`
- Câblage dans `container.ts` (resolve par clé string) + `index.ts` (createExpressEndpoints + generateOpenApi)

Mutation : `useCase(resolve("X"), resolve("graph"))(input)`.

## Auth & autorisation

- `auth-service` mint JWT RS256, expose JWKS sur `/.well-known/jwks.json`
- `requireAuth` (`auth.middleware.ts`) — global, vérifie JWT, set `req.user = { sub, email, role, aud, adminDistrictId }`
- `authorize` (`authorize.middleware.ts`) — global, lit `route.metadata.auth` du contract ts-rest, applique role/owner/district checks via loaders + scope (selfParam, ownerField, districtField, bypassRoles, notFoundOnDeny)
- Dev bypass dans `.env` : `AUTH_DEV_SKIP_EMAIL_VERIFICATION=true`, `AUTH_DEV_SKIP_TOTP=true` (ignoré si `NODE_ENV=production`)

## Front : récupérer l'utilisateur connecté

```tsx
import { useAuth } from "@repo/hooks";
const { user, isAuthenticated, isLoading, login, logout, getAccessToken, refresh } = useAuth();
```

`<AuthProvider authServiceUrl={config.authServiceUrl}>` enveloppe l'app dans `main.tsx`.

## Pièges récurrents

1. **Neo4j ParameterMissing** — chaque `$param` du Cypher doit être dans l'objet params, même `null`. Pour champs optionnels : `{ ...node, optional: node.optional ?? null }`.
2. **`@repo/contracts` types périmés** — après modif de sources dans `packages/contracts/src/`, `npm run build` (ou `tsc --watch`) dans ce package pour régénérer `dist/*.d.ts`. Sinon VSCode montre des types stales.
3. **Workspace symlinks manquants** — si un import `@repo/X` est introuvable alors que le package existe : `npm install` à la racine `Web-Apps/` pour recréer `node_modules/@repo/X`.
4. **Zod password** — `register` exige ≥1 majuscule + ≥1 symbole + ≥8 chars. Sinon `ZodError` côté front.
5. **Front qui n'envoie pas le Bearer** — il faut appeler `setupInterceptors(getAccessToken, refresh)` dans un effet sous `<AuthProvider>`.
6. **Mongo `$regex` injection / ReDoS** — escape user-controlled search avant insertion en regex.
7. **`balance` peut devenir négatif** — `adjustBalance` n'a pas de garde, ajouter `{ balance: { $gte: -delta } }` au filter.

## URLs runtime

- API REST : http://localhost:3000
- Swagger UI : http://localhost:3000/docs (Scalar)
- OpenAPI JSON : http://localhost:3000/openapi.json
- Auth : http://localhost:3001
- User front : http://localhost:5000
- Admin front : http://localhost:4000

## Commandes utiles

- `npm install` (racine Web-Apps) — install + crée symlinks workspace
- `npm run dev` (racine) — lance tout via turbo
- `npm run build -w @repo/contracts` — régénère les `dist/` des contracts
- `npm run seed -w api` — peuple Mongo + Neo4j (Alice/Bob/Charlie/Diana, 2 districts, 8 tags, listings/events/votes/incidents). Idempotent (MERGE + deleteMany).

## Env requis

Voir `.env.dist`. Variables principales :
- `MONGODB_URL`, `MONGODB_DB`
- `NEO4J_URL`, `NEO4J_USER`, `NEO4J_PASSWORD`
- `AUTH_JWKS_URL` (côté api)
- `AUTH_PRIVATE_KEY`/`AUTH_PUBLIC_KEY` (côté auth-service, PEM)
- `RESEND_API_KEY` (mailing, optionnel en dev)
- `VITE_API_URL`, `VITE_AUTH_SERVICE_URL` (front)

## Reste à faire (haut niveau)

- Endpoints recommandations Neo4j (`/recommendations/events`, `/recommendations/neighbors`, …)
- Sync gateway pour client Java desktop (`/sync/changes`, `/sync/push`)
- Module signatures PDF via OpenSign (DTO+contract+router, doc dans `documentation/opensign-integration.md`)
- Audit RGPD : export/delete user en cascade
- Rate limiting + Helmet CSP en prod (déjà configuré sans CSP à cause de Scalar /docs)
