# Synchronisation hors-ligne (H2 ↔ MongoDB) — intégrée à `apps/api`

> ## État : implémentée dans `apps/api`
>
> Le serveur (`apps/api`) porte l'ensemble de la fonctionnalité : les routes `/sync/*`, le watcher basé
> sur les Change Streams, le seed du flux au premier démarrage et le magasin de conflits. Le client
> associé est l'app desktop JavaFX `admin-desktop` (dépôt séparé), qui pousse et rejoue les changements.
>
> C'est le **document de conception faisant référence** pour la fonctionnalité de synchronisation
> hors-ligne, qui fait le pont entre la base **H2** embarquée de l'app desktop et le **MongoDB** de la
> plateforme. Elle remplace l'ancienne proposition « sync-gateway » (un service Node autonome). **Il n'y a
> pas de service `sync-gateway` distinct** — ses endpoints, le watcher Change Streams et le magasin de
> conflits sont **repliés dans `apps/api`**.
>
> Le nom de fichier reste `sync-gateway.md` pour préserver les liens entrants (ROADMAP, getting-started) ;
> la « gateway » est désormais un ensemble de routes internes à l'api.
>
> **À ne pas confondre** avec la projection live Mongo → Neo4j de
> `apps/api/src/repositories/Graph/graph.sync.ts` (un miroir de graphe unidirectionnel). Cette
> fonctionnalité-ci est un pont **bidirectionnel** vers la base H2 de l'app desktop.

---

## 1. Pourquoi ce choix (justification de l'intégration)

Le serveur est **intégré à `apps/api`** plutôt que déployé comme service autonome, parce que :

- L'api possède déjà les collections `users` / `incidents` et leur schéma (`@repo/shared`
  `userDocumentSchema`, `apps/api/src/entities/incident.entity.ts`). Un writer séparé, avec sa propre
  copie de ces règles, serait un risque de dérive permanent — l'intégration permet à la sync de
  **dériver son modèle d'écriture de `@repo/shared`** (source unique de vérité).
- L'api dispose déjà de l'auth JWT (`requireAuth` + le middleware déclaratif `authorize`), d'un
  container DI, d'un arrêt gracieux et d'un client Mongo partagé — tout ce que la gateway
  réimplémentait.
- Un seul process, un seul déploiement, un seul modèle d'auth.

---

## 2. Topologie & flux de données

```
                          apps/api  (Express + ts-rest, :3000)
 instance JavaFX A ─┐        │
 instance JavaFX B ─┼─POST /sync/ingest─▶ cas d'usage ingest ──▶ users / incidents (Mongo, _id = UUID)
 instance JavaFX N ─┘        │                                       │  (écritures estampillées _sync)
        ▲                    │                                       ▼
        │                    │                              watcher Change Streams
        └── GET /sync/changes ◀┴── sync_changes (append-only, `index` monotone) ◀── ajoute chaque changement
            ?since=<cursor>                                                          (origine api + origine sync)

 instance JavaFX X ── GET /sync/conflicts?mine · POST /sync/conflicts/:id/resolve ──▶ cas d'usage conflicts ──▶ sync_conflicts
```

Chaque instance JavaFX est toujours à l'initiative :

1. Elle vide sa table locale **`pending_changes` (une ligne par enregistrement)** et **pousse**
   (`POST /sync/ingest`).
2. Elle **interroge** `GET /sync/changes?since=<cursor>` et applique à H2 les changements d'origine Mongo.
3. Elle résout, dans l'UI desktop, les conflits que **ses propres** push ont levés (§6.5).

Un **watcher Change Streams** en arrière-plan dans l'api observe les collections synchronisées et ajoute
chaque changement à `sync_changes` — le flux ordonné que les clients interrogent. Les conflits sont mis
en quarantaine dans `sync_conflicts` et **résolus par l'opérateur dans l'app desktop** — il n'y a pas de
surface de conflit dans l'admin-front (§6).

---

## 3. Modèle d'authentification

`/sync/ingest`, `/sync/changes` et `/sync/conflicts*` sont des **routes api authentifiées** — protégées
par le `requireAuth` existant de l'api (JWT RS256 vérifié contre le JWKS de l'auth-service) + le
middleware déclaratif `authorize` piloté par le `metadata.auth({...})` de chaque route. Il n'y a **pas de
secret partagé** (l'ancienne gateway en utilisait un) ; l'app desktop envoie le **vrai JWT utilisateur de
son opérateur**.

| Routes                          | Politique                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `/sync/ingest`, `/sync/changes` | `auth({ audience: "api", roles: ["admin","superAdmin"] })` + **scoping par quartier** (§5.5) — voir Décision D1                   |
| `/sync/conflicts*`              | `auth({ audience: "api", roles: ["admin","superAdmin"] })` — consommées uniquement par l'app desktop (aucune surface admin-front) |

### Cycle de vie du token côté client (réalité SSO navigateur)

Le client `admin-desktop` s'authentifie via un login loopback navigateur (RFC-8252, autorisation +
PKCE S256) qui place un **access token RS256 en mémoire** ; le **refresh token opaque est un cookie
HttpOnly détenu par le navigateur** sur l'origine de l'auth-service. **Le process Java ne voit jamais le
refresh token**, il n'y a donc pas de refresh silencieux in-process. Conséquences que la conception
client doit gérer (voir §9) :

- Le fournisseur de token lève une erreur d'indisponibilité quand le token en mémoire est expiré.
- Un cycle de sync qui rencontre ce cas (ou reçoit un `401`) passe à l'état `AUTH_REQUIRED`, ce qui
  déclenche une re-connexion navigateur ; l'ordonnanceur continue de tourner et reprend dès qu'un token
  frais est en mémoire.

> ### Décision D2 — auth non surveillée _(provisoire : accepter la re-connexion interactive)_
>
> Avec un refresh par cookie navigateur, un poste non surveillé se fige à `AUTH_REQUIRED` quand le cookie
> de refresh du navigateur expire, jusqu'à ce qu'un opérateur complète une connexion navigateur.
> **Défaut : accepter ce comportement** (poste opérateur surveillé ; aucune nouvelle surface d'auth).
> **Alternative :** ajouter un flux email+mot de passe in-process (`POST /auth/login` +
> `POST /auth/refresh`) pour un vrai fonctionnement headless — une nouvelle surface de credentials à
> sécuriser. Hors périmètre du premier jet sauf confirmation.

---

## 4. API réseau

Les contrats vivent dans `packages/contracts` (`sync.contract.ts`, `conflicts.contract.ts` ; DTO dans
`src/DTO/sync.dto.ts`, `src/DTO/conflict.dto.ts`). Toutes les formes sont zod.

> **Toutes les routes de sync sont préfixées par `/sync`** — `POST /sync/ingest`, `GET /sync/changes`,
> `GET /sync/conflicts`, `GET /sync/conflicts/:id`, `POST /sync/conflicts/:id/resolve`. L'api héberge de
> nombreuses ressources : les chemins racines `/changes` et `/conflicts` sont trop génériques. Les titres
> de section ci-dessous omettent le préfixe par concision ; le client doit utiliser le chemin complet.

### 4.1 `POST /sync/ingest`

Applique un lot d'événements locaux (max **100**, `INGEST_BATCH_MAX`). Le client envoie l'en-tête
`X-Sync-Instance: <install-uuid>` (obligatoire, `SyncInstanceHeaderSchema`).

**Requête** — `IngestBatchDto` (`IngestEventDto[]`) :

```json
[
  {
    "id": 42,
    "entity": "incident",
    "operation": "INSERT",
    "mongoId": null,
    "data": { "category": "voirie", "description": "…", "districtId": "d1", "reporterId": "u1" },
    "occurredAt": "2026-07-18T10:00:00.000Z"
  },
  {
    "id": 43,
    "entity": "user",
    "operation": "UPDATE",
    "mongoId": "0f8c…",
    "data": { "phone": "+33…" },
    "occurredAt": "2026-07-18T10:00:01.000Z",
    "baseUpdatedAt": "2026-07-17T09:00:00.000Z"
  }
]
```

`IngestEventDto` : `id:int` (l'identifiant de corrélation stable, par enregistrement, côté client),
`entity` (`user|incident|district`), `operation` (`INSERT|UPDATE|DELETE`), `mongoId:string|null`,
`data:Record<string,unknown>|null` (null pour DELETE), `occurredAt:datetime`, `baseUpdatedAt?:datetime`
(token de concurrence optimiste pour UPDATE/DELETE).

**Réponse** — `IngestResultDto` :

```json
{
  "applied": [
    { "id": 42, "mongoId": "6610…", "operation": "INSERT", "updatedAt": "2026-07-18T10:00:00.123Z" },
    { "id": 43, "mongoId": "0f8c…", "operation": "UPDATE", "updatedAt": "2026-07-18T10:00:01.456Z" }
  ],
  "conflicts": [{ "id": 71, "mongoId": "ab12…", "conflictId": "c-uuid" }],
  "rejected": [{ "id": 88, "reason": "out-of-district" }]
}
```

`rejected[]` porte les événements que le serveur a refusés d'emblée. Motifs (`IngestRejectionReason`) :
`out-of-district` (§5.5), `read-only-entity` (un push `district`, §5.3) et `unprocessable`
(structurellement impossible — ex. un UPDATE/DELETE avec `mongoId: null`, sans cible serveur, ou tout
événement qui n'a emprunté aucun chemin d'écriture). Ce ne sont **pas** des conflits : le client doit
**abandonner la ligne en attente** et remonter l'échec plutôt que de réessayer, un réessai ne pouvant
jamais aboutir.

> **Invariant de comptabilité totale.** Chaque `id` d'événement de la requête apparaît dans **exactement
> un** des tableaux `applied`, `conflicts` ou `rejected` — jamais zéro, jamais deux. Le client pilote le
> cycle de vie de ses lignes en attente là-dessus (applied → purge + avance du token ; conflict →
> conserve ; rejected → abandonne). Un événement silencieusement absent des trois laisserait sa ligne
> orpheline pour toujours, réessayée à chaque cycle. Côté serveur, tout événement qui échapperait aux
> chemins normaux est tout de même émis en `rejected` avec `unprocessable` (logué en `error`).

> **Point clé du protocole :** l'ack **renvoie l'`updatedAt` post-écriture par événement appliqué**
> (`updatedAt` vaut `null` pour un DELETE appliqué). Le client peut ainsi avancer son token de concurrence
> optimiste (`base_updated_at`) **de façon synchrone depuis l'ack**, sans attendre de voir sa propre
> écriture revenir en écho par le flux de changements. L'`updatedAt` renvoyé **est la valeur exacte
> persistée** (pas une relecture), de sorte qu'il coïncide avec ce que le watcher publiera plus tard aux
> autres instances.

Le traitement par événement est défini au §6 (modèle de conflit).

### 4.2 `GET /sync/changes?since=<cursor>&limit=<n>`

Renvoie les changements d'origine Mongo que le client doit appliquer à H2. L'en-tête `X-Sync-Instance`
est requis ; le router s'en sert pour renseigner l'`excludeInstance` (echo-skip) — le client **n'a pas** à
le passer en query.

| Param             | Type | Défaut | Notes                                                                                                    |
| ----------------- | ---- | ------ | -------------------------------------------------------------------------------------------------------- |
| `since`           | int  | `0`    | Dernier `index` traité. `since=0` est un snapshot complet (voir §5.2).                                   |
| `limit`           | int  | `100`  | Max 500 (`CHANGES_LIMIT_MAX`).                                                                           |
| `excludeInstance` | str  | —      | Ignore les entrées émises par cette instance (echo-skip). Le router le remplit depuis `X-Sync-Instance`. |

**Réponse** — `ChangeEntryDto[]`, par `index` croissant :

```json
[ { "index": 152, "entity": "user", "operation": "UPDATE", "mongoId": "0f8c…",
    "data": { "…doc serveur expurgé…" }, "occurredAt": "…" } ]
```

`data` vaut `null` pour un DELETE et est **expurgé** des champs réservés au serveur (§5.3), avec `_id`
remappé en `id`.

### 4.3 `/sync/conflicts*` — consommées uniquement par l'app desktop

L'UI de conflit vit dans l'app JavaFX (§6.5) ; il n'y a pas de surface admin-front. L'opérateur envoie le
même JWT + `X-Sync-Instance` que pour la sync.

- **`GET /sync/conflicts`** — query `{ status=pending, entity?, mine=true, limit=100 (max 200) }` →
  `ConflictDto[]`. Avec `mine=true` (défaut) le serveur ne renvoie que les conflits dont
  l'`originInstanceId` correspond au `X-Sync-Instance` de l'appelant — ceux que **les propres push de cet
  opérateur** ont levés. `mine=false` n'est autorisé qu'au `superAdmin` (vue globale) : sinon le serveur
  renvoie `403` (voir §6.5, note sur les conflits orphelins).
- **`GET /sync/conflicts/:id`** → `ConflictDto` ou `404`.
- **`POST /sync/conflicts/:id/resolve`** — corps `{ resolution, data? }` où `resolution` vaut `local`,
  `server` ou `merged` (`data` requis quand `merged`, via un `refine` du DTO) →
  `{ id, status:"resolved", resolution }`, sinon `400` (déjà résolu / `data` manquant) ou `404`.

`ConflictDto` : `id, entity, mongoId, type` (`update` ou `duplicate`)`, originInstanceId, localData,
serverData, baseUpdatedAt?, status` (`pending` ou `resolved`)`, detectedAt, resolvedAt?, resolvedBy?,
resolution?`. Les champs réservés au serveur sont expurgés de `serverData`.

---

## 5. Internes serveur

### 5.1 Collections

| Collection           | Rôle                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`, `incidents` | Les vraies collections métier (possédées par l'api). Les écritures de sync y vont, filtrées par allowlist (§5.3).                                                                                                          |
| `sync_changes`       | Flux sortant append-only. Champs : `_id` (uuid), `index` (int, unique), `entity`, `operation`, `mongoId`, `data` (ou null), `occurredAt`, `origin` (`api`/`sync`), `originInstanceId?`, `districtId?` (dénormalisé, §5.5). |
| `sync_state`         | Document `watcher` unique : resume token des Change Streams + le drapeau one-shot `seeded` (`seededAt`).                                                                                                                   |
| `sync_conflicts`     | Conflits en quarantaine (§6) ; chacun porte `originInstanceId` (l'instance dont le push l'a levé) pour le filtre `mine` du desktop.                                                                                        |
| `counters`           | `{ _id:"sync_changes", seq:int }` — un `$inc` atomique distribue l'`index` monotone du flux.                                                                                                                               |

L'`index` du flux est un entier strictement croissant issu d'un `$inc` atomique sur un document unique
(atomique dans Mongo sans transaction). Les lecteurs utilisent `index > since` par ordre croissant : un
trou de crash entre `next()` et l'insertion dans `sync_changes` est sans conséquence (ne bloque jamais).
Index posés sur `sync_changes` : `{ index }` unique, `{ index, districtId }` (parcours filtré par
quartier), `{ mongoId, index:-1 }` (héritage de quartier pour un DELETE, §5.5).

### 5.2 Seeding du flux au premier démarrage (chemin de pull unique)

Au premier démarrage, `seedExistingDocs(db, syncChanges, syncState)` (idempotent, gardé par le drapeau
`sync_state.seeded`) parcourt tout document existant de **chaque collection synchronisée** (`users`,
`incidents`, `districts`) et ajoute à `sync_changes` un `INSERT` synthétique (`origin:"api"`, `data`
expurgée). `GET /sync/changes?since=0` devient ainsi **un snapshot complet**, et le client a **un seul
chemin de pull** — plus de bootstrap REST distinct. Le même `counter` sous-tend seed et flux live, les
indices restent donc monotones de part et d'autre. Tout le seed partage un unique `occurredAt`.

### 5.3 Modèle d'écriture dérivé de `@repo/shared` (pas de carte d'entités dupliquée)

`apps/api/src/sync/sync-entity-config.ts` **dérive** les règles de sync des schémas canoniques au lieu de
les redéclarer :

- **`writableFields`** = clés du schéma **moins** un ensemble `SERVER_OWNED`, calculé via `.shape` pour
  qu'un nouveau champ partagé se propage automatiquement :
  - `user` → `email, firstName, lastName, phone, address, districtId`
  - `incident` → `reporterId, districtId, category, description, photoUrl, status, history, assignedTo`
- **`defaultsOnInsert`** (champs faisant autorité côté serveur, jamais fournis par H2, appliqués à
  l'INSERT seulement — en `$setOnInsert`, et seulement si le payload ne les fournit pas déjà) :
  - `user` → `passwordHash:"!sync-imported-no-login"`, `role:"user"`, `balance:0`, `banned:false`,
    `emailVerified:false`, `totpSecret:null`, `totpEnabled:false` — un utilisateur vu pour la première
    fois depuis H2 a un **mot de passe inutilisable** (connexion désactivée tant qu'il n'est pas
    provisionné via l'auth-service).
  - `incident` → `status:"open"`, `history:[]`.
- **`REDACTED_FIELDS`** = `passwordHash, totpSecret, lastTotpStep, _sync` — retirés de toute `data` qui
  quitte le serveur (flux de changements + payloads de conflit). `redactServerDoc` remappe aussi `_id` →
  `id` au passage. Respecte la posture GDPR sur la PII.

Toute écriture d'origine H2 passe par `pickWritable` (l'allowlist), de sorte que les champs réservés au
serveur (`role`, `balance`, `banned`, `passwordHash`, `totpSecret`, `lang`, …) **ne peuvent jamais être
positionnés depuis un snapshot H2 non fiable**.

**Entités en lecture seule (unidirectionnelles).** `district` (collection `districts`) est une entité
synchronisée mais **serveur → client uniquement** : les quartiers sont créés/gérés sur le web et le
desktop se contente de les lire (liste déroulante + noms lisibles). Sa config porte `ingestAllowed:
false` : le watcher observe `districts`, le flux/seed transportent les changements de quartier, mais le
cas d'usage d'ingestion **rejette tout événement `district`** (`rejected` avec `read-only-entity`, logué

- ignoré, jamais écrit). `writableFields` est vide et aucun `defaultsOnInsert` ne s'applique.

### 5.4 Estampille de provenance (`_sync`)

Toute écriture d'origine sync estampille `_sync: { origin:"sync", occurredAt, instanceId }` sur le
document (type `SyncProvenance` de `@repo/shared`). Le watcher le lit pour taguer les entrées
`sync_changes` avec `origin` + `originInstanceId` (ce qui alimente `excludeInstance`). `_sync` est
**modélisé explicitement** comme champ interne optionnel sur les schémas partagés user/incident
(`syncProvenanceSchema.optional()`, hors des schémas de DTO) et **retiré à la lecture** par les mappers /
`redactServerDoc`, de sorte qu'il ne fuite jamais dans les réponses API ni dans la projection graphe.

### 5.5 Scoping par quartier (D1)

La surface de sync ne doit pas être plus large que les routes interactives qu'elle reflète (voir D1 /
PR #151). Les deux directions sont limitées au **quartier de l'appelant** ; `superAdmin` (et le rôle
`service`) passent sans contrainte (voient/écrivent tout).

**Résolution du scope de l'appelant.** Une couche dédiée, `apps/api/src/sync/sync-scope.ts`, expose
`resolveSyncScope(user, userRepo)`. Elle réutilise `resolveCallerListDistrict` (le même helper que les
routes de liste incident/annonce/vote — même source de vérité) mais le réduit à un résultat à trois cas,
`SyncScope`, sur lequel les cas d'usage branchent sans connaître les rôles :

- `{ all: true }` → appelant non contraint (`superAdmin` / `service`).
- `{ districtId }` → administrateur de quartier, borné à ce quartier.
- `{ empty: true }` → appelant sans quartier rattaché : ne voit que les données de référence `district`
  et ne peut rien écrire (fail-closed).

Le router résout le scope à chaque appel (`ingest` comme `getChanges`) et le passe au cas d'usage.

**`sync_changes` porte un `districtId` dénormalisé.** Le filtre du flux ne peut pas le lire dans `data`,
car une entrée DELETE a `data: null`. `append()` dénormalise donc `districtId` sur le document de
changement lui-même (`resolveDistrictId`) :

- `user` / `incident` → le `districtId` du document.
- **DELETE** → le document complet est indisponible sur un événement de suppression, donc on hérite du
  `districtId` de l'entrée `sync_changes` la plus récente pour le même `mongoId` (le log append-only en a
  toujours une, l'enregistrement ayant forcément été créé/modifié par le flux auparavant). Si aucune
  n'est trouvée, l'entrée est enregistrée avec `districtId: null` et n'est visible **que** par un scope
  non contraint (fail-closed).
- `district` → l'`_id` propre du quartier.

**`GET /sync/changes`** applique, en plus du filtre `index > since`, un filtre par scope
(`sync-changes.repository.mongo.ts` → `list`) :

- scope `{ districtId }` → `$or: [{ entity: "district" }, { districtId }]` — les quartiers étant des
  **données de référence** (nom, `geoJson`, `startingPoints` ; pas de PII), toutes les entrées `district`
  partent vers tout appelant, quel que soit son quartier, pour que le client affiche des noms lisibles
  hors-ligne. Les entrées d'autres quartiers (et les entrées `districtId: null`) ne sont **pas** visibles.
- scope `{ empty }` → seules les entrées `entity: "district"` sont visibles.
- scope `{ all }` → aucun filtre de quartier ajouté (voit tout, y compris `districtId: null`).

**`POST /sync/ingest`** vérifie l'autorisation de chaque événement avant de l'appliquer via
`scopeAllowsDistrict(scope, targetDistrict)`. Le `districtId` visé provient du **doc serveur** pour un
UPDATE/DELETE (et du payload pour un INSERT) : un client ne peut donc pas faire passer en fraude un
enregistrement d'un autre quartier en réétiquetant son payload. Un écart est **rejeté**, pas mis en
quarantaine — c'est un échec d'autorisation, pas un conflit de données, il ne doit donc jamais apparaître
dans la file de conflits. Il est reporté dans `rejected[]` (motif `out-of-district`) pour que le client
remonte et abandonne la ligne au lieu de boucler.

**Conséquences.** Le client H2 ne détient que les utilisateurs + signalements de son quartier ; les
statistiques calculées localement (§9.5) sont donc des statistiques de quartier — cohérentes avec ce que
cet administrateur voit dans l'app web. `mine=true` sur `/conflicts` filtre toujours par
`originInstanceId` ; le scoping par quartier s'applique par-dessus.

---

## 6. Modèle de conflit

### 6.1 Dédoublonnage au premier INSERT (clé métier)

Sur un INSERT avec `mongoId = null`, le serveur cherche un document existant par la **clé métier** de
l'entité (`businessKey`) avant d'insérer :

- **`user`** → clé = `email` (adossée à un index unique ; une course E11000 est aiguillée vers le même
  chemin). Une correspondance n'est **pas** dupliquée — elle lève un **conflit** `duplicate` reliant la
  ligne H2 à l'`_id` existant, `_id` renvoyé pour que les deux lignes convergent.
- **`incident`** → **pas de clé métier naturelle** ; le dédoublonnage inter-côtés est hors périmètre
  (deux signalements indépendants peuvent légitimement coexister). Insertion systématique.

Un INSERT réessayé portant un `mongoId` connu est un upsert idempotent par `_id`.

### 6.2 Concurrence optimiste sur UPDATE / DELETE (`baseUpdatedAt`)

Le client envoie comme `baseUpdatedAt` l'`updatedAt` qu'il a synchronisé en dernier. Si l'`updatedAt`
courant du doc serveur diffère, c'est que le serveur a changé sous le client → l'événement est mis en
**quarantaine** dans `sync_conflicts` (rien n'est écrasé silencieusement). Le conflit enregistre
l'instance à l'origine (`originInstanceId`, depuis `X-Sync-Instance`) pour que l'opérateur qui l'a causé
puisse le retrouver (§6.5). L'événement est tout de même **acké** avec un `conflictId` (l'`/ingest` le
reporte donc dans `conflicts[]`), mais — contrairement à un événement appliqué — le client **conserve** sa
ligne en attente (§6.5). Cas particuliers : UPDATE d'un doc supprimé à distance → recréé
(last-write-wins, rien contre quoi entrer en conflit) ; DELETE-vs-édition → l'intention de suppression est
mise en quarantaine. Un enregistrement porteur d'un conflit **pending** **met en attente** les ingestions
suivantes (le snapshot local capté est rafraîchi via `refreshLocalData`, aucune nouvelle ligne de
conflit).

### 6.3 Résolution

L'opérateur résout via `POST /sync/conflicts/:id/resolve` (depuis l'UI desktop, §6.5) :

- `local` → applique le snapshot capté du client (upsert allowlisté).
- `server` → garde le doc serveur ; le `touch` pour le re-propager à toutes les instances.
- `merged` → applique la `data` fournie par l'opérateur (requise — la fusion champ à champ de l'UI).

La résolution enregistre `resolvedBy` (`req.user.sub`), `resolvedAt`, `resolution`, et marque le conflit
résolu. L'écriture résultante ressort par le watcher → `sync_changes` → toutes les instances.

> **Les écritures de résolution effacent `_sync` (elles ne portent pas d'instanceId).** Les trois chemins
> (`local`, `server`/`touch`, `merged`) persistent le doc avec `_sync` effacé (`sync = null` → `$unset`),
> la modification étant donc publiée en `origin:"api"` sans `originInstanceId`. C'est nécessaire : si une
> résolution portait l'id de l'instance à l'origine, `excludeInstance` (§7) masquerait l'état résolu à
> **exactement l'instance qui en a besoin** pour se réconcilier et vider sa ligne en attente (§6.5).
> L'effacer rend la résolution visible de **toutes** les instances, y compris l'émettrice.
>
> **Revendiquer avant d'appliquer.** La double résolution est gardée par un basculement atomique
> `markResolved`, et ce basculement **doit précéder l'écriture**, pas la suivre. Si la résolution était
> appliquée d'abord et le conflit revendiqué ensuite, une seconde résolution concurrente écraserait la
> décision du premier opérateur _puis_ signalerait `already-resolved` — perdant silencieusement la
> décision gagnante. Revendiquer d'abord fait du basculement le garde : le perdant échoue la revendication
> (`markResolved` gardé sur `status:"pending"` ne matche rien) et ne touche jamais aux données. Le premier
> à résoudre gagne.

### 6.4 Table de référence

| Direction  | Opération                       | Comportement                                                                                                                                                                           |
| ---------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H2 → Mongo | INSERT (`mongoId` null)         | dédoublonnage par clé métier → insert **ou** conflit `duplicate` ; renvoie `mongoId` + `updatedAt`                                                                                     |
| H2 → Mongo | INSERT réessayé (`mongoId` set) | upsert idempotent par `_id`                                                                                                                                                            |
| H2 → Mongo | UPDATE (base concordante)       | `$set` allowlisté par `_id` ; renvoie le nouvel `updatedAt`                                                                                                                            |
| H2 → Mongo | UPDATE (base périmée)           | **quarantaine** (conflit `update`) ; acké, non appliqué                                                                                                                                |
| H2 → Mongo | UPDATE (doc absent)             | recréé (last-write-wins)                                                                                                                                                               |
| H2 → Mongo | UPDATE/DELETE, `mongoId` null   | **rejeté** `unprocessable` — pas de cible serveur. Ne DOIT PAS retomber sur un INSERT : cela créerait un doublon au lieu de mettre à jour. Le collapse client (§9.1) l'évite en amont. |
| H2 → Mongo | DELETE (base concordante)       | suppression par `_id`                                                                                                                                                                  |
| H2 → Mongo | DELETE (base périmée)           | **quarantaine** (suppression-vs-édition) ; acké, non appliqué                                                                                                                          |
| H2 → Mongo | DELETE (doc déjà absent)        | acké idempotent (`updatedAt: null`), rien à supprimer                                                                                                                                  |
| Mongo → H2 | INSERT/UPDATE                   | le client upsert par `mongo_id` ; pose `base_updated_at` depuis `data.updatedAt`                                                                                                       |
| Mongo → H2 | DELETE                          | le client supprime par `mongo_id` ; ignore si absent                                                                                                                                   |

### 6.5 UI de conflit desktop (seule surface de résolution)

Les conflits sont exposés et résolus **dans l'app JavaFX** — il n'y a pas d'écran admin-front.

- **Découverte.** Quand `push()` reçoit une entrée `conflicts[]`, le client marque l'enregistrement et
  lève un badge/panneau. Le panneau charge `GET /sync/conflicts?mine=true` — l'opérateur voit **les
  conflits que sa propre instance a levés**, avec `localData` (ce qu'il a édité hors-ligne) à côté de la
  `serverData` expurgée.
- **Résolution.** L'opérateur choisit `local` / `server` / `merged` (l'éditeur de fusion produit `data`)
  → `POST /sync/conflicts/:id/resolve`.
- **Cycle de vie de la ligne en attente.** Le client conserve la ligne `pending_changes` tant que le
  conflit n'est pas résolu (l'édition locale n'est jamais perdue et le badge persiste). Après résolution,
  l'état serveur résolu arrive au prochain `GET /sync/changes` ; le client l'applique (upsert par
  `mongo_id`, rafraîchit `base_updated_at`) et **vide la ligne en attente** de cet enregistrement. Pas de
  re-push de l'édition locale périmée.
- **Conflits orphelins.** Comme la résolution est desktop-only et scopée à l'instance à l'origine, un
  conflit levé par une instance qui ne revient jamais en ligne n'est **jamais résolu** — la valeur serveur
  reste simplement en place, et cela ne bloque que l'édition hors-ligne de ce seul enregistrement (jamais
  d'autres enregistrements ni d'autres instances). Un `superAdmin` peut utiliser
  `GET /sync/conflicts?mine=false` depuis une app desktop comme porte de sortie. C'est le compromis de
  l'abandon de la surface admin-front.

---

## 7. Watcher Change Streams

`apps/api/src/watcher/change-stream.watcher.ts` fait tourner un unique
`db.watch(SYNCED_COLLECTIONS, { fullDocument:"updateLookup", resumeAfter })` (filtre serveur
`$match: { "ns.coll": { $in: SYNCED_COLLECTIONS } }`). Un seul flux ordonné ⇒ les indices `sync_changes`
restent monotones. Par événement il mappe le type d'op (`insert|replace`→INSERT, `update`→UPDATE,
`delete`→DELETE), lit `_sync.origin/instanceId` sur le document complet, et ajoute une entrée expurgée à
`sync_changes`. Le resume token est persisté dans `sync_state` après chaque événement traité ; sur
`ChangeStreamHistoryLost` (code 286) il rouvre sans token (après avoir effacé le token) et journalise le
trou en `error`. Une erreur transitoire rouvre après un délai (`REOPEN_DELAY_MS`, 5 s) ; un arrêt
volontaire (`stopWatcher`) empêche toute réouverture.

**Cycle de vie** — démarré dans le bloc de boot de l'api après `initContainer` et après
`httpServer.listen` : `seedExistingDocs(db, …)` s'exécute d'abord, puis `startWatcher(db, …)` (les deux
enchaînés, best-effort : une erreur — Mongo standalone, replica set absent — est loguée et le reste de
l'api continue de servir, seul le flux de sync du desktop se fige). `stopWatcher()` est ajouté au
`cleanup` de l'arrêt gracieux.

**Nécessite un replica set** (§10) — `db.watch()` lève sur un mongod standalone.

### Echo-skip & pourquoi l'ack compte

Le watcher enregistre **chaque** changement, y compris ceux d'origine sync. Une instance en polling ignore
ses **propres** écritures via `excludeInstance` (`originInstanceId: { $ne }`). Comme le client a déjà
appris son nouvel `updatedAt` par l'ack de l'`/ingest` (§4.1), il n'a jamais besoin de voir son propre
écho — l'ignorer empêche aussi qu'un écho périmé n'écrase une édition locale tout juste poussée, et évite
une ré-application redondante. Le client avance quand même son curseur au `index` max qu'il reçoit.

---

## 8. Stratégie d'identifiants

- **MongoDB** : `users` / `incidents` utilisent un **`_id` string UUID** (`randomUUID()`) — conforme à la
  convention de l'api (`@repo/shared` `toEntity`/`toDoc` mappent `_id ↔ id`). **Pas** un ObjectId.
- **H2** : chaque table synchronisée porte `mongo_id VARCHAR(36) UNIQUE`, `NULL` jusqu'à ce que le serveur
  l'assigne et que l'ack le renvoie.

---

## 9. Conception client (JavaFX)

### 9.1 Table `pending_changes` à clé (remplace l'OUTBOX append-only + `compact()`)

Une ligne **par enregistrement modifié** — la table _est_ l'état compacté, l'ancienne passe `compact()`
côté client est donc supprimée.

```sql
CREATE TABLE pending_changes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity          VARCHAR(64)  NOT NULL,
  record_id       VARCHAR(36)  NOT NULL,
  operation       VARCHAR(8)   NOT NULL,      -- INSERT | UPDATE | DELETE
  mongo_id        VARCHAR(36),
  payload         CLOB,                       -- snapshot JSON ; NULL pour DELETE
  base_updated_at VARCHAR(40),
  occurred_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_pending UNIQUE (entity, record_id)
);
```

Plus les migrations sur les tables synchronisées : `mongo_id VARCHAR(36) UNIQUE`, `base_updated_at
VARCHAR(40)` (le booléen `synced` existant reste pour la comptabilité locale).

`PendingChangesRepository` :

- `upsert(entity, recordId, op, mongoId, payload, baseUpdatedAt)` → `MERGE … KEY(entity, record_id)`,
  bump de `occurred_at`. Collapse inline (le seul reliquat de `compact()`) : un `INSERT` non synchronisé +
  un nouvel `UPDATE` reste `INSERT` avec le nouveau payload ; un `INSERT` + `DELETE` encore non
  synchronisé supprime la ligne (créé-puis-supprimé hors-ligne s'annule).
- `findBatch(limit)` → `ORDER BY occurred_at, id` (déjà une ligne par enregistrement).
- `setRecordMongoId(entity, recordId, mongoId)` → écrit `mongo_id` (+`synced=TRUE`) sur la ligne
  d'entité et la ligne en attente.
- `advanceBaseAndClear(entity, recordId, mongoId, updatedAt, sentOccurredAt)` → pose le `base_updated_at`
  de l'entité, puis `DELETE FROM pending_changes WHERE … AND occurred_at <= sentOccurredAt` (la garde
  préserve une ligne re-salie en cours de vol).

Les écritures UI locales dans `UserRepository` / `IncidentRepository` appellent `pending.upsert(...)`.

### 9.2 Réécriture de `SyncService`

- **Ordonnanceur :** `ScheduledExecutorService` mono-thread (`scheduleWithFixedDelay(cycle, 0, 30s)` ;
  `stop()` → `shutdownNow()`) + `AtomicBoolean running` gardé par `compareAndSet(false, true)` — ferme la
  fenêtre check-then-set de l'ancien `Timer`/`volatile boolean` où `syncNow()` et un tick pouvaient
  tourner ensemble. `syncNow()` → `executor.execute(cycle)` (pas de `Thread` brut).
- **push() :** `findBatch(100)` → `POST /sync/ingest` (sans compaction). Par événement appliqué :
  `setRecordMongoId` (si nouveau) + `advanceBaseAndClear(...)` — avance `base_updated_at` **depuis
  l'ack**. Par conflit : conserver la ligne en attente et remonter à l'UI de conflit.
- **pull() :** `GET /sync/changes?since=cursor&limit=200` avec `X-Sync-Instance` ; dispatch par `entity` —
  `user`/`incident` upsert dans leurs tables, `district` upsert dans la table H2 `districts`
  (serveur→client uniquement ; le client ne pousse jamais de quartiers). Pose `base_updated_at` depuis
  `data.updatedAt` ; avance le curseur. Pas de bootstrap (`since=0` est le snapshot).
- **Gestion de l'auth :** `catch` indisponibilité du token → `AUTH_REQUIRED` ; `catch` erreur api où le
  code est `401` → `AUTH_REQUIRED` (sinon `ERROR`). Un listener `AUTH_REQUIRED` déclenche la connexion
  navigateur ; l'ordonnanceur continue de tourner et reprend au cycle suivant.

### 9.3 Client HTTP, config, DTO

- Client HTTP ciblant l'**api** (:3000) ; bearer SSO sur **tous** les appels ; envoie `X-Sync-Instance` ;
  lève sur non-2xx.
- Config trimée à `instanceId` (UUID persistant par installation) + `cursor` — supprime `baseUrl` /
  `sharedSecret` / `bootstrapped`.
- DTO `sync/*` : `IngestEvent`, `IngestResult` (`applied[]` + `conflicts[]` + `rejected[]`),
  `ChangeEntry`, `Conflict`, `ResolveConflictRequest`.

### 9.4 UI de conflit (résolution desktop-only)

`ConflictService` / `ConflictController` / `conflicts.fxml` (fusion champ à champ), câblés au client HTTP :

- `ConflictService` → `GET /sync/conflicts?mine=true`, `POST /sync/conflicts/:id/resolve`.
- `SyncService` lève un badge/compteur quand `push()` renvoie `conflicts[]` ; l'ouverture du panneau
  charge les conflits propres à l'opérateur (§6.5).
- À la résolution, **ne pas** vider la ligne en attente directement — laisser le prochain `pull()`
  ramener l'état serveur résolu et la vider (§6.5), pour un unique chemin de réconciliation de H2.

C'est la **seule** surface de conflit — aucun écran admin-front n'est construit.

### 9.5 Quartiers & statistiques (dérivés des données synchronisées)

- **Quartiers** : entité synchronisée unidirectionnelle (§5.3). Le client les upsert dans sa table H2
  `districts` par `mongo_id`. La liste déroulante du formulaire de signalement et la résolution de nom
  lisible lisent depuis **H2 local**, pas un `/districts` live — elles fonctionnent donc hors-ligne.
- **Statistiques** : **calculées localement**. Tous les signalements (+utilisateurs) synchronisant dans
  H2, les cartes de stats du tableau de bord dérivent leurs valeurs des tables locales plutôt que d'une
  agrégation serveur. Offline-first et toujours cohérent avec ce que voit l'opérateur ; l'ancien fetch de
  stats direct-api est abandonné.

---

## 10. Déploiement (replica set)

Les Change Streams **exigent** un replica set ; le Mongo de dev est par défaut un `mongo:8` standalone.
Dans `docker-compose.yml` comme `docker-compose.deploy.yml` :

- `mongodb` : `command: ["--replSet","rs0","--bind_ip_all"]`.
- Ajouter un sidecar one-shot idempotent `mongo-init` (`restart:"no"`) : si `rs.status().ok` alors sortir,
  sinon `rs.initiate({ _id:"rs0", members:[{ _id:0, host:"mongodb:27017" }] })`.
- Ajouter `?replicaSet=rs0` à chaque `MONGODB_URL` **in-container** (api, auth-service, seeds ; le deploy
  garde ses credentials fournis par SOPS).
- Faire attendre les dépendants sur `mongo-init` (`service_completed_successfully`).

**Un keyFile est obligatoire** dès que l'autorisation et la réplication sont toutes deux activées — y
compris pour un set à membre unique. Sans lui mongod refuse de démarrer :
`BadValue: security.keyFile is required when authorization is enabled with replica sets`.

Le keyfile est bind-monté puis copié en `0400`/`mongodb` au démarrage du conteneur, car un fichier
bind-monté suivi par git ne peut pas porter le mode/propriétaire requis :

```yaml
command:
  - bash
  - -c
  - |
    install -m 400 -o mongodb -g mongodb /etc/mongo/keyfile /tmp/mongo-keyfile
    exec docker-entrypoint.sh mongod --replSet rs0 --bind_ip_all --keyFile /tmp/mongo-keyfile
```

Le dev utilise le `./docker/mongo-keyfile` commité (matériel local, même niveau de confiance que les
credentials `root:root` déjà présents dans le compose). **La prod doit fournir le sien** via
`MONGO_KEYFILE_PATH` depuis l'env SOPS — jamais le keyfile de dev commité. Le replica set débloque aussi
les transactions multi-documents de l'api.

---

## 11. Décisions & suites connues

> ### Décision D1 — portée du flux : **PAR QUARTIER** (résolue)
>
> `/changes` et `/ingest` sont limités au quartier de l'appelant pour les appelants non-`superAdmin` ;
> `superAdmin` voit tout. Voir §5.5 pour la mécanique.
>
> **Pourquoi :** la PR #151 (_« scoper les signalements à leur auteur et fermer la classe d'IDOR
> environnante »_) force `reporterId = req.user.sub` pour les non-admins sur les routes de liste + stats
> des signalements, et ajoute `resolveCallerListDistrict` / `callerCanReadDistrict` pour qu'un résident ne
> puisse ni passer un `districtId` arbitraire ni l'omettre pour une liste globale. La posture de l'api est
> désormais explicitement **aucun appelant n'obtient de liste globale non scopée**. Un flux de sync global
> livrant tout utilisateur + signalement à n'importe quel `admin` rouvrirait exactement cette classe par
> une autre porte — un admin de quartier répliquerait tous les quartiers. Le scoping par quartier maintient
> la surface de sync cohérente avec les routes interactives qu'elle reflète.

> ### Décision D2 — auth non surveillée — voir §3 _(provisoire : accepter la re-connexion navigateur)_

**Implémenté depuis la conception initiale :**

- **Projection graphe des écritures de sync.** Le writer de sync écrit Mongo directement, court-circuitant
  les cas d'usage incident/user qui maintiennent normalement la projection Neo4j. `projectSyncWrite`
  (`apps/api/src/sync/graph-projection.ts`) est désormais appelé après chaque événement appliqué à
  l'ingestion **et** après chaque résolution de conflit, en best-effort via `syncGraph` (loggé, Mongo
  restant la source de vérité) — les recommandations ne dérivent donc plus. Les quartiers ne sont jamais
  projetés par la sync.
- **Modélisation de `_sync`.** Ajouté comme champ interne optionnel sur les schémas partagés
  (`syncProvenanceSchema.optional()` sur `userDocumentSchema` et `IncidentSchema`, §5.4).

**Différé (pas dans le premier jet) :**

- **Rétention du flux** — `sync_changes` est append-only et croît sans borne. Suite : TTL / compaction par
  snapshot + un curseur plancher avec « client passé sous le plancher → re-bootstrap ».
- **Rafraîchissement live de l'UI (socket).** Les émissions Socket.IO ne se déclenchent toujours **pas**
  pour les écritures d'origine sync. Recommandation : piloter le refresh UI live depuis le **watcher**
  (point d'étranglement unique), pas depuis le writer. Flaggable.

---

## 12. Vérification

1. `docker compose up -d mongodb mongo-init` ; `mongosh --eval "rs.status().ok"` → `1`.
2. Monter api + auth-service ; logs : `initContainer → listen → seedExistingDocs(N) → startWatcher (flux
ouvert)` ; `/readyz` → 200.
3. JWT admin → `GET /sync/changes?since=0&limit=500` = snapshot complet users+incidents(+districts) avec
   `passwordHash` / `totpSecret` / `lastTotpStep` / `_sync` **absents** (expurgation) et `_id` remappé en
   `id`.
4. `POST /sync/ingest` INSERT (`X-Sync-Instance: it-1`) → `applied:[{ …, operation:"INSERT", updatedAt }]` ;
   le doc Mongo porte `_sync.origin:"sync"`, `instanceId:"it-1"`.
5. Echo-skip : `GET /sync/changes` **avec** `X-Sync-Instance: it-1` omet l'insert ; une autre instance le
   voit.
6. Conflit : UPDATE avec un `baseUpdatedAt` périmé → `conflicts[…]`, aucune écriture ;
   `GET /sync/conflicts` le montre ; une seconde ingestion périmée pour cet enregistrement est **mise en
   attente** (pas de nouveau conflit ; `localData` rafraîchi).
7. Résoudre `server` / `local` / `merged` → 200 ; le watcher ré-émet ; une autre instance le voit.
8. Scoping : un `admin` de quartier A ne voit pas dans `/changes` les signalements du quartier B ; un push
   étiqueté quartier B est `rejected` avec `out-of-district`. Les entrées `district` sont visibles quel que
   soit le scope.
9. `rejected` : un push `district` → `read-only-entity` ; un UPDATE/DELETE `mongoId:null` →
   `unprocessable`.
10. Client piloté : login (admin), édition hors-ligne → une ligne `pending_changes` par enregistrement ;
    reconnexion → push, l'ack avance `base_updated_at`, la ligne est vidée ; une 2e instance le voit via
    `/changes` ; forcer l'expiration du token → `AUTH_REQUIRED` → re-login → reprise ; deux `syncNow()`
    rapprochés → `compareAndSet` bloque le cycle concurrent.
11. Typecheck/tests `apps/api` (dont `ingest.use-case.test.ts`, `resolve-conflict.use-case.test.ts`) +
    tests client.

---

## 13. Implémentations de référence (lecture seule, branches historiques)

- Logique serveur — ancien service `sync-gateway` (`apps/sync-gateway/**`). Son
  `mongodb.connector.ts` / `shutdown.ts` / `load-env.ts` / `container.ts` sont **obsolètes** — l'infra
  `@repo/shared` de l'api les remplace.
- Logique client — `Client-Java` @ `feat/sync-gateway-flow` (`SyncService`, `OutboxRepository`,
  `SyncGatewayClient`, `sync/*`).
