# La couche de contracts (`packages/contracts`)

> Source unique de vérité des échanges client/serveur. Ce document décrit le package
> `@repo/contracts` : sa raison d'être _contract-first_, sa structure, la politique
> d'autorisation déclarative, la génération OpenAPI, et la façon dont l'api et les fronts
> le consomment. Pour le cadrage stratégique de ce choix, voir `synthese-projet.md` §2.1.

---

## 1. Pourquoi le contract-first

Le package `packages/contracts` est la **source unique de vérité** de tous les échanges entre
client et serveur. Chaque endpoint y est déclaré **une seule fois** — méthode HTTP, chemin,
paramètres, corps de requête, formes de réponse par code de statut — au moyen de contracts
[ts-rest](https://ts-rest.com/) dont chaque champ est un schéma [zod](https://zod.dev/).
Aucune des cinq applications ne redéfinit une forme de donnée : toutes la **dérivent** du
package partagé.

Ce choix a une conséquence décisive à l'échelle du projet — trois développeurs, cinq
applications, une centaine d'endpoints. Il supprime la classe entière des désynchronisations
entre front et back : quand un contract change, la **compilation casse immédiatement** partout
où c'est nécessaire, dans l'api comme dans les fronts. Une équipe de cette taille n'aurait pas
pu maintenir cette cohérence par la seule communication.

Deux propriétés en découlent :

- **Sûreté au moment de la compilation, transversale aux applications.** Un DTO renommé ou un
  champ rendu obligatoire fait échouer `tsc` chez tous les consommateurs. Le monorepo garantit
  qu'un changement de contract voyage dans le **même commit** que ses consommateurs.
- **Validation runtime gratuite côté serveur.** Les schémas zod ne servent pas qu'au typage :
  côté api, ts-rest les exécute réellement sur chaque requête entrante (rejet 400 si le corps
  ou la query ne valide pas), sans code de validation à écrire à la main.

Le même principe a été étendu à l'**autorisation** : la politique d'accès de chaque route est
déclarée en métadonnées du contract (`metadata.auth`) et appliquée par une **barrière unique**,
plutôt que réécrite dans chaque handler (§5).

---

## 2. Structure du package

```
packages/contracts/
├── index.ts                     # baril racine : point d'entrée @repo/contracts
└── src/
    ├── zod.ts                   # instance zod étendue avec .openapi() — à importer partout
    ├── auth-meta.ts             # types + helper de la politique d'autorisation (metadata.auth)
    ├── <domaine>.contract.ts    # 16 contracts ts-rest (un par domaine)
    └── DTO/
        ├── index.ts             # baril des DTO
        └── <domaine>.dto.ts     # schémas zod + types inférés
```

### 2.1 Le wrapper zod partagé (`src/zod.ts`)

Tous les DTO et contracts importent `z` depuis `./zod`, **jamais depuis `zod` directement** :

```ts
import { z } from "zod";
import { extendZodWithOpenApi } from "@anatine/zod-openapi";

extendZodWithOpenApi(z);
export { z };
```

`extendZodWithOpenApi` greffe la méthode `.openapi()` sur l'instance zod. Importer `zod`
directement contournerait cette extension et perdrait les métadonnées OpenAPI (§6). Le baril
racine `index.ts` exécute `import "./src/zod"` **en premier**, avant tout schéma qui appelle
`.openapi()`.

### 2.2 Les DTO (`src/DTO/`)

Un fichier `<domaine>.dto.ts` par domaine. Chaque fichier définit des schémas zod et exporte
le **type inféré** correspondant via `z.infer<...>` :

```ts
export const ListingResponseDtoSchema = z
  .object({
    /* … */
  })
  .openapi({ title: "ListingResponse" });
export type ListingResponseDto = z.infer<typeof ListingResponseDtoSchema>;
```

Le schéma est la seule définition ; le type TypeScript en est dérivé, donc jamais désynchronisé.
Les DTO transverses (`errors.dto.ts`, `paginatedResponse.dto.ts`, `query.dto.ts`,
`geoJson.dto.ts`, `password.schema.ts`) sont réutilisés par plusieurs domaines. `DTO/index.ts`
réexporte l'ensemble pour un import unique.

### 2.3 Les contracts (`src/*.contract.ts`)

Un contract ts-rest par domaine, construit avec `initContract().router({...})`. Chaque route y
associe méthode, chemin, schémas de paramètres/corps/query, table des réponses par code de
statut, `summary`, et sa politique `metadata.auth`. Le baril racine `index.ts` réexporte tous
les contracts et tous les DTO sous le nom de package `@repo/contracts`.

---

## 3. Anatomie d'une route

Une route de contract associe chaque partie de l'échange HTTP à un schéma zod :

```ts
getListings: {
  method: "GET",
  path: "/listings",
  query: ListingQueryDtoSchema,                              // validé à l'entrée
  responses: {
    200: PaginatedResponseDtoSchema(ListingResponseDtoSchema), // forme de sortie typée
  },
  summary: "Get a paginated list of listings",
  metadata: auth({ audience: "api" }),                       // politique d'accès (§5)
},
```

- `method` / `path` — verbe et gabarit d'URL (`:id` pour un paramètre de chemin).
- `pathParams` / `query` / `body` — schémas zod validés côté serveur ; côté client, ils typent
  les arguments d'appel.
- `responses` — une entrée par code de statut, chacune un schéma. Le handler serveur est
  **contraint de retourner** l'une de ces formes ; le client les reçoit typées.
- `metadata: auth({...})` — politique d'autorisation, lue par le middleware `authorize` (§5) et
  reportée dans la doc OpenAPI (§6).

---

## 4. Le flux en couches

Le contract est le point d'entrée d'un chemin d'ajout de fonctionnalité **unique et respecté
sans exception** dans l'api (voir `synthese-projet.md` §2.2) :

```
contract (DTO + route)  →  entité  →  repository  →  cas d'usage  →  handler
```

| Couche          | Emplacement                                   | Rôle                                                                          |
| --------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| **contract**    | `packages/contracts/src/`                     | Forme de l'échange (DTO zod + route). Partagé, source de vérité.              |
| **entité**      | `apps/api/src/entities/`                      | Schéma zod de la forme persistée. Aucune logique (formes de données).         |
| **repository**  | `apps/api/src/repositories/<Domaine>/`        | Interface (`I…Repository`) + implémentation(s). Un port vers le stockage.     |
| **cas d'usage** | `apps/api/src/use-cases/`                     | Fonction recevant ses repositories en argument ; retourne des données brutes. |
| **handler**     | `apps/api/src/routes/.../<domaine>.router.ts` | Résout ses dépendances via `resolve("…")` et appelle le cas d'usage.          |

Le handler est mince : il n'exécute aucune logique métier et ne connaît pas le stockage. Il lie
la route du contract au cas d'usage, résout ses repositories depuis le conteneur d'injection, et
renvoie l'une des formes de réponse déclarées. Cette régularité rend le produit découvrable :
la liste des cas d'usage d'un domaine est la liste de ce qu'il sait faire.

---

## 5. L'autorisation déclarative

L'autorisation n'est **pas** écrite dans les handlers. La politique d'accès de chaque route est
déclarée en métadonnées du contract via le helper `auth(...)` de `auth-meta.ts`, et appliquée
par un **middleware générique unique**, `authorize`
(`apps/api/src/middleware/authorize.middleware.ts`), enregistré comme `globalMiddleware` sur
chaque jeu d'endpoints ts-rest.

### 5.1 La politique (`AuthPolicy`)

```ts
metadata: auth({
  audience: "api",
  scope: {
    resource: "listing",
    ownerField: "authorId",
    districtField: "districtId",
    bypassRoles: ["superAdmin"],
  },
});
```

Champs disponibles :

- **`public`** — route sans authentification.
- **`audience`** — claim `aud` requis sur le token : `"api"` (clients publics : fronts, desktop)
  ou `"api:internal"` (usage interne machine-à-machine). Seul le service token éphémère émis par
  l'auth-service porte `api:internal` — c'est l'audience de `POST /users`, l'endpoint que le flux
  d'inscription appelle pour créer l'utilisateur (`roles: ["service"]`).
- **`roles`** — rôles autorisés parmi `user | admin | superAdmin | service`. Omis ⇒ tout rôle
  authentifié compatible avec l'`audience`.
- **`readBypassesRoles`** — un `GET` reste permis à tout utilisateur final même si `roles` est
  défini (lecture ouverte, écriture réservée).
- **`scope`** — enforcement au **niveau enregistrement**, dépendant des données (voir 5.2).
- **`stepUp`** — exige une preuve MFA récente (voir 5.3).

### 5.2 Le `scope` : propriété et quartier

Quand une route porte un `scope`, `authorize` **charge l'enregistrement cible** (via un loader
qui résout le repository correspondant dans le conteneur) et vérifie l'accès avant d'exécuter le
handler. Les critères :

- **Propriété** — `ownerField` (« l'appelant est-il `authorId` ? »), `ownerFields` (OU de
  plusieurs champs, ex. `providerId`/`beneficiaryId` d'un contract), ou `ownerArrayField`
  (appartenance à un tableau d'ids, ex. `participants` d'une conversation).
- **Quartier** — `districtField` / `districtArrayField` : accès accordé à un administrateur du
  quartier de l'enregistrement (comparaison avec le claim `adminDistrictId` de l'appelant). C'est
  le vecteur de la **modération de quartier** : un admin agit sur un enregistrement qu'il ne
  possède pas mais qui relève de son quartier.
- **`bypassRoles`** — rôles qui court-circuitent entièrement le contrôle (typiquement
  `superAdmin`).
- **`selfParam`** — le paramètre d'id du chemin _est_ un id utilisateur et doit égaler
  `req.user.sub` ; aucun enregistrement n'est chargé. Utilisé par la famille `/users/:id`.
- **`notFoundOnDeny`** — répondre `404` plutôt que `403` pour ne pas divulguer l'existence d'un
  enregistrement voisin.

L'enregistrement chargé est transmis au handler (`req.authRecord`) pour éviter un second fetch.
Le `404` précède toujours le `403`.

> **Séparation des responsabilités.** `requireAuth` (`auth.middleware.ts`) fait
> l'**authentification** seule — il vérifie le Bearer JWT contre le JWKS de l'auth-service et
> renseigne `req.user`. `authorize` fait l'**autorisation** à partir de `metadata.auth`. Les deux
> sont montés globalement dans `apps/api/src/index.ts` ; aucun chemin par ressource à câbler.

### 5.3 Step-up (MFA récent)

`stepUp` exige une preuve TOTP fraîche pour une opération sensible, appliquée par le middleware
`requireStepUp` **en production uniquement** (le dev reste sans friction). L'appelant rejoue un
en-tête `X-Step-Up-Token` (émis par `/auth/step-up`). Deux formes :

- `stepUp: { always: true }` — toujours requis (ex. suppression de compte, transfert de points).
- `stepUp: { whenBodyTouches: ["email", "address", "newPassword"] }` — requis seulement si le
  corps du `PATCH` touche l'un de ces champs.

---

## 6. Génération OpenAPI

La documentation OpenAPI n'est pas maintenue à part : elle est **générée depuis les contracts**.
Chaque schéma porte des métadonnées via `.openapi({ description, example, title })`, et
`apps/api/src/index.ts` appelle `generateOpenApi(...)` sur l'ensemble des contracts pour produire
le document servi sur `/openapi.json` et l'UI Scalar sur `/docs` (désactivés en production sauf
`ENABLE_API_DOCS=true`).

Un `operationMapper` reporte en plus la politique `metadata.auth` de chaque route dans la
description générée (« **Access:** audience api; roles admin, superAdmin »), si bien que la doc
reflète l'autorisation réelle sans double saisie.

---

## 7. Comment les applications consomment le contract

Le même package est consommé de deux façons, toutes deux typées par les contracts partagés :

**Côté api — serveur ts-rest (validation runtime).** Un router `initServer().router(contract, {…})`
implémente chaque route du contract ; TypeScript vérifie que chaque handler accepte les
paramètres déclarés et retourne l'une des réponses déclarées. `createExpressEndpoints` monte le
router sur Express avec `globalMiddleware: [authorize, requireStepUp]`. ts-rest **valide les
requêtes entrantes** contre les schémas zod (rejet 400 automatique).

**Côté fronts — types partagés (sûreté compile-time).** Les fronts appellent l'api via un client
axios (`api-service/*.service.ts`) et importent les **types de DTO** depuis `@repo/contracts`
pour typer arguments et réponses :

```ts
import type { CreateListingDto, ListingResponseDto } from "@repo/contracts";
import api from "./api";

export async function createListing(data: CreateListingDto): Promise<ListingResponseDto> {
  const res = await api.post<ListingResponseDto>("/listings", data);
  return res.data;
}
```

Un changement de la forme d'un DTO se répercute donc immédiatement, à la compilation, sur les
services front qui l'utilisent — c'est exactement la garantie recherchée.

---

## 8. Exemple complet : le domaine `listings` (annonces)

Réunion des trois fichiers d'un même domaine.

**DTO** — `src/DTO/listing.dto.ts` (extrait) :

```ts
export const ListingResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique listing identifier" }),
    authorId: z.string().openapi({ description: "ID of the user who created the listing" }),
    districtId: z.string().openapi({ description: "ID of the district this listing belongs to" }),
    title: z.string().openapi({ example: "Plumber available for small repairs" }),
    price: z.number().int().openapi({ description: "Price in tokens", example: 10 }),
    status: ListingStatusSchema,
    // …
  })
  .openapi({ title: "ListingResponse" });
export type ListingResponseDto = z.infer<typeof ListingResponseDtoSchema>;
```

**Contract** — `src/listings.contract.ts` (extrait). Lectures ouvertes à tout utilisateur
authentifié ; mise à jour et suppression réservées à l'auteur ou à un admin du quartier de
l'annonce (bypass `superAdmin`) :

```ts
updateListing: {
  method: "PATCH",
  path: "/listings/:id",
  pathParams: ListingParamsDtoSchema,
  body: UpdateListingDtoSchema,
  responses: {
    200: ListingResponseDtoSchema,
    403: ForbiddenErrorSchema,
    404: NotFoundErrorSchema,
  },
  summary: "Partially update a listing (owner or admin)",
  metadata: auth({
    audience: "api",
    scope: { resource: "listing", ownerField: "authorId", districtField: "districtId", bypassRoles: ["superAdmin"] },
  }),
},
```

**Handler** — `apps/api/src/routes/listings/listings.router.ts` (extrait). Aucune vérification
d'autorisation ici : elle a déjà été faite par `authorize` à partir du `scope` ci-dessus. Le
handler délègue au cas d'usage, qui reçoit son repository résolu depuis le conteneur :

```ts
updateListing: async ({ params: { id }, body }) => {
  const listing = await updateListingUseCase(resolve("listing"))(id, body);
  if (!listing) return { status: 404, body: { message: "Listing not found" } };
  return { status: 200, body: listing };
},
```

Pour `POST /listings`, `authorId` et `districtId` sont **dérivés côté serveur** de l'utilisateur
appelant, jamais lus depuis le client — le contract ne les expose pas dans `CreateListingDto`.

---

## 9. Vue d'ensemble des contracts

Seize contracts. Les quinze premiers sont montés par l'api ; `auth.contract` est servi par
l'**auth-service** (émission de tokens, MFA, sessions, SSO desktop). Nombre de routes par
contract (indicatif) :

| Contract                | Routes | Domaine                                              |
| ----------------------- | :----: | ---------------------------------------------------- |
| `users`                 |   10   | Comptes, profils, bannissement, export RGPD          |
| `districts`             |   5    | Quartiers, découpage géographique                    |
| `district-admins`       |   4    | Attribution des droits d'admin de quartier           |
| `listings`              |   6    | Annonces de services                                 |
| `events`                |   9    | Événements de quartier                               |
| `contracts`             |   7    | Contrats entre voisins (escrow de points, signature) |
| `incidents`             |   6    | Signalements                                         |
| `tags`                  |   5    | Tags d'annonces                                      |
| `votes`                 |   7    | Sondages                                             |
| `conversations`         |   9    | Messagerie (texte, voix, image)                      |
| `notifications`         |   5    | Notifications                                        |
| `transactions`          |   4    | Mouvements de points                                 |
| `recommendations`       |   1    | Recommandation (Neo4j)                               |
| `sync`                  |   2    | Flux de sync offline (client desktop)                |
| `conflicts`             |   3    | Résolution de conflits de sync                       |
| `auth` _(auth-service)_ |   20   | Login, refresh, MFA, sessions, reset, SSO desktop    |

> Le document de synthèse retient le chiffre produit de **92 endpoints sur 13 domaines métier**
> (`synthese-projet.md` §1.3) : ce total regroupe et cadre les mêmes routes côté produit ; le
> tableau ci-dessus est une lecture fichier-par-fichier du package.

---

## 10. Ajouter un endpoint (contract-first)

Toujours travailler **du contract vers l'intérieur** :

1. **DTO** — ajouter le schéma zod dans `packages/contracts/src/DTO/<domaine>.dto.ts` (avec
   `.openapi()` sur les champs), exporter le type inféré, et le réexporter depuis `DTO/index.ts`.
2. **Route** — ajouter la route au contract concerné (`packages/contracts/src/<domaine>.contract.ts`) :
   `method`, `path`, `body`/`query`/`pathParams`, `responses`, `summary`, et la politique
   `metadata: auth({...})`.
3. **Entité** — si une nouvelle collection est en jeu, définir l'entité dans
   `apps/api/src/entities/`.
4. **Repository** — définir l'interface + l'implémentation Mongo sous
   `apps/api/src/repositories/<Domaine>/`, puis l'enregistrer dans `repositories/container.ts`.
5. **Cas d'usage** — écrire le cas d'usage dans `apps/api/src/use-cases/` : il reçoit ses
   repositories en argument et retourne des données brutes.
6. **Handler** — câbler la route dans `apps/api/src/routes/.../<domaine>.router.ts` : il résout
   ses dépendances via `resolve("…")` et appelle le cas d'usage.

L'autorisation n'apparaît qu'à l'étape 2 (le `metadata.auth`) : le middleware `authorize`
l'applique automatiquement, sans code dans le handler. Côté front, la consommation se limite à
importer le nouveau type de DTO depuis `@repo/contracts` dans le service concerné.

---

_Voir aussi : `synthese-projet.md` §2.1 (le pari contract-first) et §2.2 (l'architecture en
couches de l'api), `auth-service.md` (émission des tokens et JWKS)._
