# Feuille de route produit

> ⚠️ **Avertissement — instantané de planification, non tenu à jour.**
> Ce document est un **instantané à un instant T** (audit réalisé sur la branche `etienne`), à visée de planification. Il **ne reflète pas nécessairement l'état actuel du code** : il décrit encore comme « non construits » des pans entiers du produit qui tournent aujourd'hui en production. Pour l'analyse de l'état courant faisant foi, se référer à **`documentation/synthese-projet.md`**, qui est le document autoritatif. Les mentions `> ⚠️ Déjà livré (voir le code).` ci-dessous signalent quelques cas manifestes où la feuille de route est en retard sur le code ; elles ne constituent **pas** une réconciliation exhaustive.

> Issu d'un audit complet du code (arbre de travail, branche `etienne`) recoupé avec `documentation/`, `README.md`, `TODO.md` et `ToDefine.md`. L'effort est relatif (S ≈ < 1 jour, M ≈ quelques jours, L ≈ une semaine ou plus pour le groupe). Chaque affirmation ci-dessous est rattachée à un fichier/endpoint pour pouvoir être vérifiée.

---

## 1. État actuel (vérifié)

### 1.1 Ce qui existe et fonctionne

| Domaine                                       | État                                                                                                                                                                                                                                                                                                                | Preuve                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **auth-service** (`apps/auth-service`, :3001) | **Complet** et conforme à `documentation/auth-service.md`. RS256/JWKS, argon2, rotation des refresh (hachés en sha256, cookie httpOnly limité à `/auth`), vérification d'email, réinitialisation de mot de passe, enrôlement·confirmation·désactivation TOTP/MFA, pages HTML `/login` + `/register` auto-hébergées. | `routes/auth/auth.router.ts`, `use-cases/*`, `keys.ts`, `index.ts:73-80`              |
| **api** (`apps/api`, :3000)                   | **CRUD complet** sur 12 domaines, ~70 endpoints. Contract-first ts-rest, découpage en couches propre (route → cas d'usage → repository), conteneur DI. Documentation d'API Scalar en ligne.                                                                                                                         | `routes/**`, `use-cases/**`, `index.ts:115-130` (`/health`, `/openapi.json`, `/docs`) |
| **Auth resource-server JWT**                  | `requireAuth` / `requireRole` vérifient les access token via `createRemoteJWKSet`.                                                                                                                                                                                                                                  | `apps/api/src/middleware/auth.middleware.ts`                                          |
| **Contrats partagés**                         | `packages/contracts` est la véritable source de vérité (ts-rest + zod), consommée par l'api.                                                                                                                                                                                                                        | `packages/contracts/src/*.contract.ts`                                                |
| **Hooks d'auth partagés**                     | `AuthProvider`, `useAuth`, `ProtectedRoute`, refresh proactif + intercepteur de rejeu sur 401.                                                                                                                                                                                                                      | `packages/hooks/*`, `apps/user-front/src/api-service/api.ts`                          |

### 1.2 Vision documentée vs. réalité — les différenciateurs ne sont **pas** construits

| Fonctionnalité documentée                                                                            | Doc                                           | Statut                 | Preuve                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fil de recommandations** (graphe Neo4j, scoring tag/social/récence, suivi d'intérêt vue & réponse) | `recommendation-algorithm.md`, `MCD/neo4j.md` | ❌ **0 %**             | Conteneur Neo4j provisionné (`docker-compose.yml`) mais **aucune dépendance driver, aucun code** — seulement un commentaire dans `use-cases/events/attend-event.use-case.ts`. `GET /listings/feed` et `POST /listings/:id/view` sont documentés mais **absents** de `listings.contract.ts`.                           |
| **Signature électronique Documenso**                                                                 | `documenso-integration.md`                    | ⚠️ **stub cosmétique** | `contract.entity.ts` porte `documensoDocumentId` / `signatureStatus` (enum), mais `sign-contract.use-case.ts` persiste simplement ce que le client envoie — **pas de client Documenso, pas de génération de document, pas de webhook, pas de `react-pdf`, pas de page Documents**. Les signatures sont invérifiables. |
| **Éditeur de limites de quartier** (carte admin Leaflet/geoman)                                      | `district-boundary-editor.md`                 | ❌ **0 % UI**          | API CRUD des quartiers + GeoJSON existent ; l'app admin est vide, aucune dépendance `leaflet`.                                                                                                                                                                                                                        |
| **Inférence adresse → quartier / autocomplétion** (géocodage, point-in-polygon)                      | `ToDefine.md`                                 | ⚠️ **partiel**         | `apps/api/src/services/address.service.ts` existe ; la boucle d'inférence géo n'est pas câblée de bout en bout.                                                                                                                                                                                                       |
| **SATAN QL** (langage de requête Mongo custom, Python PLY, `@repo/satan`)                            | `satan-ql.md`, `architecture.md`              | ❌ **n'existe pas**    | Ni `packages/satan` ni `packages/SATAN`.                                                                                                                                                                                                                                                                              |
| **sync-gateway** (pont H2↔Mongo pour une app Java)                                                   | `sync-gateway.md`                             | ❌ **n'existe pas**    | Pas d'`apps/sync-gateway` ; pas d'app Java dans le repo. La doc est inachevée (la Déduplication se termine par `????`, port « TBD »).                                                                                                                                                                                 |

> ⚠️ Déjà livré (voir le code). La ligne « Fil de recommandations » est en retard sur le code : `neo4j-driver` est désormais une dépendance de `apps/api`, et les cas d'usage `use-cases/graph/rebuild-graph.use-case.ts` et `use-cases/recommendations/get-event-recommendations.use-case.ts` existent (projection Mongo→graphe + recommandations d'événements).

> ⚠️ Déjà livré (voir le code). La ligne « sync-gateway » est en retard sur le code : la logique de synchronisation est livrée **dans `apps/api`** (`use-cases/sync/{ingest,get-changes,get-conflicts,resolve-conflict}.use-case.ts`, avec tests), plus `packages/contracts/src/sync.contract.ts` et `sync.dto.ts` — même si ce n'est pas un `apps/sync-gateway` séparé comme la doc l'imaginait.

### 1.3 Surface produit frontend (user-front)

Seul **1 endpoint sur ~70** est câblé (`getAllAnnonces`). La boucle cœur **n'est pas complétable dans l'UI.**

| Route / page            | Fichier                           | État                                                                                                                                                                               |
| ----------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` Dashboard → Points  | `pages/dashboard/Points.tsx`      | **Données factices en dur** (« 42 points / Donnée 8 / reçu 5 / Echangé 12 ») — non câblé à `GET /users/:id/balance`.                                                               |
| `/service/annonces`     | `pages/service/Annonces.tsx`      | **Liste en lecture seule** (la seule vraie intégration). Pas de détail, pas de création.                                                                                           |
| `/service/mes-annonces` | `pages/service/AnnoncesUser.tsx`  | Stub `<div>`.                                                                                                                                                                      |
| `/service/mes-contrats` | `pages/service/Contrat.tsx`       | Stub `<div>`.                                                                                                                                                                      |
| `/evenement`            | `pages/Evenement.tsx`             | Stub `<div>`.                                                                                                                                                                      |
| `/messagerie`           | `pages/Messagerie.tsx`            | Stub `<div>`.                                                                                                                                                                      |
| `/documents`, `/votes`  | (aucun)                           | **Liens de nav morts** dans `component/Header.tsx` — aucune route.                                                                                                                 |
| Login / Register        | `pages/auth/{Login,Register}.tsx` | **Orphelins** — importent les formulaires `@repo/ui` mais ne sont **pas dans le routeur**. L'auth passe en réalité par une redirection vers les pages hébergées de l'auth-service. |
| **admin-front** (:4000) | `apps/admin-front/src/`           | **Coquille vide** — `main.tsx` + `style.css` seulement (28 LOC). Aucune fonctionnalité admin n'existe.                                                                             |

### 1.4 Problèmes produit relevés à l'audit

| #   | Sévérité    | Problème                                                                                                                                                                                                                                           | Emplacement                                     |
| --- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| A1  | **Élevée**  | **Aucun modèle d'autorisation / d'appartenance appliqué** — les cas d'usage prennent des ids mais les contrôles d'appartenance sont incohérents ; risque IDOR (agir sur la ressource d'un autre utilisateur). Listé non résolu dans `ToDefine.md`. | `apps/api/src/use-cases/**`, `routes/**`        |
| A2  | **Élevée**  | **Signatures falsifiables** — `sign-contract` fait confiance au `signatureStatus`/`documensoDocumentId` fourni par le client.                                                                                                                      | `use-cases/contracts/sign-contract.use-case.ts` |
| A3  | **Élevée**  | **Aucune stratégie de confidentialité / RGPD** — `users` stocke `address`/`phone`/`email` sans contrôle d'accès ni droits d'export/suppression documentés.                                                                                         | `MCD/mongo.md`, `ToDefine.md`                   |
| A4  | **Moyenne** | **Aucun rate limiting** nulle part, y compris sur les endpoints d'auth (login, forgot-password, TOTP) → exposition brute-force / énumération.                                                                                                      | `apps/auth-service`, `ToDefine.md`              |
| A5  | **Moyenne** | **Données factices présentées comme réelles** (carte Points) → démo trompeuse.                                                                                                                                                                     | `pages/dashboard/Points.tsx`                    |
| A6  | **Moyenne** | **Nav morte + pages d'auth orphelines** → UX cassée et pièges de maintenance.                                                                                                                                                                      | `component/Header.tsx`, `pages/auth/*`          |
| A7  | **Faible**  | **Dérive doc** — `architecture.md` référence `docker-compose.prod.yml` et `packages/SATAN` (aucun n'existe) ; `README.md` est du boilerplate Turborepo standard omettant auth-service/contracts ; `sync-gateway.md` inachevé.                      | `documentation/*`, `README.md`                  |
| A8  | **Faible**  | **Tests quasi nuls** — `playwright_testbook` est un stub documenté sans specs exécutables, en attente d'un E2E provisionné par la stack (voir `playwright_testbook/README.md`).                                                                    | `playwright_testbook/`                          |
| A9  | **Info**    | **Gros WIP non commité** sur `etienne` (67 fichiers, +606/−343), câblant largement l'auth à travers routes/use-cases. À réconcilier/committer avant de construire par-dessus.                                                                      | arbre de travail                                |

---

## 2. Stratégie directrice

**Construire la boucle d'échange cœur de bout en bout avec des versions _simples_ des deux fonctionnalités difficiles d'abord, puis les faire évoluer vers les versions documentées.**

- Le fil simple (filtre par quartier + récence) et le contrat simple (acceptation mutuelle in-app) sont démontrables pour une fraction de l'effort du scoring Neo4j et de Documenso.
- Ils génèrent les données dont les versions avancées ont besoin : événements vue/réponse pour le graphe de recommandation, vrais contrats pour Documenso. Construire le scoring Neo4j sur un graphe vide, ou Documenso avant que les contrats ne soient atteignables dans l'UI, est un effort gaspillé.
- **Une tranche verticale complète vaut mieux que douze demi-tranches** pour une démo crédible.

Le travail se scinde en **deux pistes parallèles** qu'un groupe devrait staffer séparément :

- **Piste A — Produit** (Phases 0–4, §3–§7) : l'application côté utilisateur.
- **Piste B — Composants plateforme notés** (§8) : **SATAN QL** et **sync-gateway**. Ce sont des _exigences de notation_, pas des choix produit — elles sont obligatoires, portent leurs propres points et **ne doivent pas être laissées pour la fin**. Elles sont largement indépendantes de la boucle produit (compétences différentes : parseur Python, service de sync) donc elles avancent en parallèle de la Piste A. _(L'**app Java** est un livrable existant dans un dépôt séparé — hors périmètre ici ; sync-gateway doit se conformer au contrat que cette app attend déjà.)_

Ordre des dépendances :

- **Piste A :** Phase 0 (fondations) → Phase 1 (boucle) → Phase 2 (fil) ∥ Phase 3 (confiance+admin) → Phase 4 (gouvernance). Les phases 2 et 3 se parallélisent une fois la Phase 1 posée.
- **Piste B :** B1 (SATAN) est indépendante et peut démarrer immédiatement. B2 (sync-gateway) doit d'abord clore sa spec ouverte (B2-0) **contre le comportement réel outbox/poll de l'app Java existante** — le contrat est fixé par cette app, pas par nous.
- **Prérequis partagé :** sync-gateway réutilise les entités Mongo et l'auth-service du code existant de la Piste A — aucune phase de la Piste A ne bloque la Piste B, mais la Piste B devrait s'accorder sur l'ensemble des collections synchronisées avec celui qui possède les entités.

---

## 2A. Modèle quartier & rôles (v2 — changement de fonctionnalité)

_Remplace les hypothèses mono-quartier de `district-boundary-editor.md`, `MCD/mongo.md` et `auth-service.md`._

**Règles**

- Les quartiers **peuvent se chevaucher**. L'adresse géocodée d'un utilisateur peut tomber dans plusieurs polygones de quartier → un **ensemble éligible**.
- Un utilisateur a **un quartier actif à la fois**, choisi dans l'ensemble éligible, changeable plus tard. Tout le scoping des ressources (fil, annonces, événements, votes, signalements) utilise le quartier **actif**.
- Si l'ensemble éligible est **vide**, l'utilisateur peut **créer un quartier en dessinant son polygone** (même éditeur que les admins) et est **promu admin** de celui-ci.
- **Rôles :** `user` (membre) · `admin` (gouverne exactement **un** quartier ; un quartier peut avoir **plusieurs** admins) · `superAdmin` (employé de l'entreprise ; lecture/gestion de **tous** les quartiers). _(`service` n'est **pas** un rôle utilisateur — c'est une claim de token machine interne, éphémère, utilisée par auth-service→api pour le flux d'inscription.)_
- **L'autorité admin est indépendante du choix de quartier actif** — l'admin de X reste admin de X même après avoir basculé son quartier actif sur Y.

**Changements de modèle de données**

- `users` : supprimer le `districtId` unique ; ajouter `activeDistrictId` (mutable, pilote le scoping) et `location` (géocodé `{lng,lat}`). L'ensemble éligible est **dérivé** par point-in-polygon (ne cacher que si la perf l'exige).
- L'admin-de-quartier est une **relation** (`districtId ↔ userId`) — une collection `districtAdmins` ou `admins: [userId]` sur le quartier ; **un quartier par admin** appliqué à l'écriture, **plusieurs admins par quartier** autorisés.
- `districts` : nom **plus unique** (chevauchement + nombreux quartiers) ; garder l'index géospatial sur la limite.

> ⚠️ Déjà livré (voir le code). La relation admin-de-quartier est livrée : `apps/api/src/use-cases/district-admins/` (create/delete/get/list, avec tests). La branche courante `feat/district-and-user-point-grants` poursuit sur cette lancée.

**Claims JWT** (décision : claims dans le token)

- L'access token porte `role` et `adminDistrictId: string | null` (unique — un quartier par admin) ; `superAdmin` est global.
- L'auth-service lit la relation admin au login/refresh pour forger la claim (extension en lecture seule de son accès `users` actuel).
- **Fraîcheur :** promotion/rétrogradation prend effet au refresh suivant (≤15 min). **Forcer un refresh de token immédiatement après une création/promotion en self-service** pour que l'UI admin se débloque aussitôt. Le _scoping_ du quartier actif reste côté serveur (l'api lit `activeDistrictId`), donc le changement est instantané et ne nécessite aucun refresh.

**Docs à réviser :** `district-boundary-editor.md` (chevauchement, inférence plurielle, nom non unique, création à l'initiative de l'utilisateur), `MCD/mongo.md` (champs user + relation admin), `auth-service.md` (nouvelle claim + lecture admin), `ToDefine.md` (géocodage & autorisation désormais décidés).

---

## 3. Phase 0 — Fondations _(bloque tout)_

_Objectif : l'app est sûre pour un second utilisateur, le géo-scoping fonctionne, aucune surface trompeuse/cassée._

**P0-1 — Modèle d'autorisation (scopé par quartier)** · **L** · corrige A1 · voir §2A

- Implémenter le modèle de rôles de §2A — enum `user | admin | superAdmin` (plus la claim machine interne `service`).
- Appliquer l'appartenance **et le scoping par quartier** dans chaque cas d'usage mutant : un appelant ne peut modifier une ressource que s'il la possède, est `admin` du quartier de cette ressource, ou est `superAdmin`. Les listes/lectures se scopent au quartier **actif** de l'appelant sauf pour `superAdmin`.
- L'autorité vient du JWT (`role`, `adminDistrictId`) ; ajouter un garde conscient du quartier (`requireDistrictAdmin(resourceDistrictId)`) aux côtés de `requireRole`.
- Verrouiller le chemin JWT `role:"service"` (inscription→`POST /users`) au seul auth-service.
- Fichiers : `middleware/auth.middleware.ts`, `apps/api/src/use-cases/**`, `routes/**`, émission de token auth-service.
- **Terminé quand :** un admin du quartier X reçoit `403` en agissant sur le quartier Y ; un membre reçoit `403` sur les ressources d'autrui ; `superAdmin` passe ; couvert par une spec Playwright.

**P0-2 — Géocodage + éligibilité quartier** · **M** · débloque tout le géo-scoping · voir §2A

- Géocoder `users.address` → `location {lng,lat}` (géocodeur cartes.gouv.fr) ; finir `apps/api/src/services/address.service.ts`.
- Point-in-polygon (turf `booleanPointInPolygon`) sur toutes les limites de quartier → ensemble éligible ; persister `activeDistrictId` ; endpoints pour lister les quartiers éligibles et changer le quartier actif.
- **Migration :** les utilisateurs existants ont une chaîne `address` + un `districtId` unique → géocoder vers `location`, définir `activeDistrictId` depuis l'ancien `districtId`.
- **Terminé quand :** l'ensemble éligible d'un nouvel utilisateur est calculé depuis son adresse, il a un `activeDistrictId`, et les requêtes de scoping l'utilisent.

**P0-3 — Hygiène frontend** · **S** · corrige A5, A6

- Câbler `Points.tsx` à `GET /users/:id/balance` + `GET /users/:id/transactions`.
- Retirer la nav morte (`/documents`, `/votes`) de `Header.tsx` (ou stubber de vraies routes).
- Supprimer les `pages/auth/{Login,Register}.tsx` orphelines (la redirection vers l'auth-service fonctionne déjà) — ou s'engager sur l'auth in-app et les câbler ; ne pas garder les deux.
- **Terminé quand :** aucune route ne renvoie 404 depuis la nav ; aucun solde en dur.

**P0-4 — Réconcilier le WIP + hygiène du repo** · **S** · corrige A9, A7

- Relire/committer le diff non commité de `etienne` ; rebaser sur une branche `feat/*` propre.
- Corriger les refs pendantes de `architecture.md` ; réécrire `README.md` pour décrire le vrai produit + les apps (dont auth-service).
- **Terminé quand :** `git status` propre, les docs ne référencent que ce qui existe.

---

## 4. Phase 1 — Boucle d'échange cœur (la démo) _(une tranche verticale complète)_

_Objectif : un utilisateur peut publier un service, être découvert, échanger des messages, contractualiser et transférer des points — de bout en bout dans l'UI._

**P1-0 — Onboarding & changement de quartier** · **M** · voir §2A

- Après le login, si `activeDistrictId` n'est pas défini, montrer les quartiers éligibles (issus de P0-2) et laisser l'utilisateur en choisir un ; persister le choix.
- Sélecteur de quartier dans le header qui re-scope l'app sur le quartier actif choisi.
- **Ensemble éligible vide →** l'utilisateur dessine un polygone (Leaflet/geoman, l'éditeur partagé extrait en P3-2) pour créer un quartier ; à l'enregistrement il est promu admin et le client **force un refresh de token** pour charger la claim `adminDistrictId`.
- **Terminé quand :** un utilisateur sans quartier éligible peut en créer un et voit immédiatement les outils admin ; un utilisateur multi-éligible peut choisir puis changer plus tard.

**P1-1 — UI annonces (CRUD complet)** · **L**

- Liste/fil V1 : `GET /listings` filtré par le quartier **actif** de l'utilisateur + ordonné par récence, paginé.
- Page détail : `GET /listings/:id`.
- Création/édition/suppression (remplir `AnnoncesUser.tsx` « Mes annonces ») : `POST/PATCH/DELETE /listings`.
- Remplacer le `getAllAnnonces` ad-hoc par un client ts-rest typé consommant `@repo/contracts` (élimine la dérive de `type/annonce.ts`).
- **Terminé quand :** un utilisateur peut publier une annonce et un autre utilisateur du même quartier la voit.

**P1-2 — UI messagerie** · **M**

- « Contact » sur une annonce → `POST /conversations` → fil (`GET/POST /conversations/:id/messages`, `PATCH /messages/:id/read`).
- Remplir `Messagerie.tsx`.
- **Terminé quand :** deux utilisateurs échangent des messages depuis une annonce avec accusés de lecture.

**P1-3 — Contrats V1 + transfert de points** · **L** · remplacera A2 plus tard

- Créer un contrat depuis une annonce : `POST /contracts` (prestataire/bénéficiaire/prix issus de l'annonce).
- **Acceptation mutuelle in-app** (reporter Documenso) : les deux parties acceptent → le contrat se conclut.
- À la conclusion, déplacer les points : `POST /transactions` débitant le bénéficiaire / créditant le prestataire ; garantir un solde non négatif de façon atomique.
- Remplir `Contrat.tsx` « Mes contrats ».
- **Terminé quand :** conclure un contrat transfère les points et les deux soldes le reflètent ; la double-conclusion est rejetée.

**P1-4 — UI événements + votes (lecture+participation)** · **M** _(optionnel dans la Phase 1 ; renforce l'angle « communauté »)_

- Événements : liste/détail/inscription/participation (`/events`, `/events/:id/register`, `/attend`) — remplir `Evenement.tsx`.
- Votes : liste/détail/répondre/résultats (`/votes`, `/votes/:id/responses`, `/results`) — ajouter la route `/votes` que la nav pointe déjà.

---

## 5. Phase 2 — Fil de recommandations (différenciateur phare)

_Objectif : le fil classé par graphe documenté, maintenant que la Phase 1 produit de vrais signaux._ Implémente `recommendation-algorithm.md` + `MCD/neo4j.md`.

**P2-1 — Intégration Neo4j** · **M**

- Ajouter le driver ; couche de projection mirroir des écritures Mongo vers nœuds/relations (`User`, `Listing`, `Tag`, `District` ; `LIVES_IN`, `PUBLISHED`, `TAGGED`, `KNOWS`).
- Nouveau repository + enregistrement DI suivant le pattern existant.

> ⚠️ Déjà livré (voir le code). Le driver `neo4j-driver` est présent dans `apps/api` et la projection Mongo→graphe existe : `use-cases/graph/rebuild-graph.use-case.ts`. Le fil classé de bout en bout (P2-3) et le suivi d'intérêt (P2-2) restent à vérifier, mais l'intégration Neo4j n'est plus à « 0 % ».

**P2-2 — Suivi d'intérêt (fire-and-forget)** · **S**

- `POST /listings/:id/view` (petit delta) et le chemin de réponse (grand delta) upsertent `(:User)-[:INTERESTED_IN {score, updatedAt}]->(:Tag)` selon le modèle de décroissance par événement de la doc. Ne doit pas bloquer les réponses.

**P2-3 — Fil classé** · **M**

- `GET /listings/feed` : filtre dur sur le **quartier actif**, puis score composite **tag 50 % / social 30 % / récence 20 %**, paginé. Remplace le fil par récence de la Phase 1.
- **Terminé quand :** le fil d'un utilisateur se réordonne mesurablement après avoir vu/répondu à des annonces portant certains tags ; les nouveaux utilisateurs retombent sur la récence (cas limites de la doc).

---

## 6. Phase 3 — Confiance + exploitabilité _(parallélisable avec la Phase 2)_

**P3-1 — Intégration Documenso** · **L** · corrige A2 · implémente `documenso-integration.md`

- Client Documenso côté API (création de document depuis template, assignation des signataires), persister l'URL du PDF + les URLs de signature par signataire + le statut ; **handler de webhook** (vérifier la signature ; mapper `completed`→conclu, `declined`→litige).
- Remplacer l'acceptation mutuelle de P1-3 par une vraie signature ; déclencher le transfert de points sur `document.completed`.
- Front : liste Documents + page détail/signature (aperçu `react-pdf` → redirection vers l'URL de signature).
- **Terminé quand :** un contrat est signé via Documenso et le webhook (pas le client) pilote le statut + le transfert de points.

**P3-2 — App admin (liée au quartier) + superAdmin** · **L** · voir §2A

- Bootstrapper `admin-front` (actuellement vide) avec auth + gardes conscients du quartier : un `admin` ne voit que son `adminDistrictId` ; un `superAdmin` voit tous les quartiers.
- **Éditeur de limites de quartier** (`district-boundary-editor.md`) : Leaflet + react-leaflet + leaflet-geoman, dessiner/éditer/enregistrer des polygones GeoJSON ; validation côté serveur (Polygon uniquement, anneau fermé, ≥3 points ; **chevauchement autorisé, nom non unique** selon §2A). **Extraire l'éditeur dans `packages/ui`** pour que le flux de création du user-front (P1-0) le réutilise.
- Opérations scopées — modération de signalements + stats (`/incidents`, `/incidents/stats`), litiges de contrats, gestion des votes — toutes filtrées au quartier de l'admin ; `superAdmin` est trans-quartier.
- Provisionnement `superAdmin` : employés seedés (pas de self-service).
- **Terminé quand :** un admin de quartier ne gère que son quartier, un `superAdmin` gère tous, et l'éditeur de limites est le même composant utilisé par le user-front.

---

## 7. Phase 4 — Gouvernance & durcissement _(avant tout utilisateur réel)_

**P4-1 — Confidentialité & RGPD** · **M** · corrige A3

- Contrôles de visibilité par champ pour les données sensibles de l'utilisateur (qui peut voir address/phone/email — `ToDefine.md`).
- Droits RGPD : accès/export, modification, suppression, opposition ; politique de confidentialité. Garantir que la suppression cascade (annonces, messages, transactions, refresh token).

**P4-2 — Durcissement anti-abus** · **S–M** · corrige A4

- Rate limiting (login, forgot-password, TOTP, register d'abord), limites de taille de corps de requête, réponses résistantes à l'énumération de comptes.

**P4-3 — Livraison & qualité** · **M** · corrige A8

- CI/CD (GitHub Actions : lint, build, Playwright) ; étoffer `playwright_testbook` (actuellement un stub documenté en attente d'E2E provisionné par la stack) pour couvrir la boucle de la Phase 1 et l'authz (P0-1).
- Logging/observabilité ; réponses d'erreur structurées (aucune fuite interne).

**P4-4 — Déploiement prod** · **S** · issu de `TODO.md`

- Définir l'env prod : `AUTH_PRIVATE_KEY`/`AUTH_PUBLIC_KEY` (sinon les tokens meurent à chaque redémarrage), `RESEND_API_KEY`/`FROM_EMAIL` (sinon les emails ne font que `console.log`), `NODE_ENV=production` (cookies sécurisés), `CORS_ORIGINS`, `AUTH_JWKS_URL`, `AUTH_PUBLIC_URL`.
- Lancer la migration `users` one-shot (`emailVerified`/`totpSecret`/`totpEnabled`) de `TODO.md`, sinon les comptes existants se verrouillent.
- ~~Rédiger le compose prod~~ — fait : `docker-compose.deploy.yml` (images GHCR + Caddy TLS) piloté par le pipeline `cd.yml`.

---

## 8. Piste B — Composants plateforme notés _(obligatoires, parallèles à la Piste A)_

_Les deux sont des exigences de notation. Ni l'une ni l'autre n'existe dans le code aujourd'hui. Staffer cette piste séparément du travail produit et la démarrer tôt — elle ne dépend pas de la boucle produit._ Specs : `satan-ql.md`, `sync-gateway.md`.

### B1 — SATAN QL (`@repo/satan`)

_Objectif : un DSL type-SQL compilé vers MongoDB à l'exécution, parsé par un processus Python (PLY) longue durée, consommé par l'api à travers le découpage existant repository → cas d'usage → route._

**B1-1 — Package parseur Python** · **L**

- `packages/satan/python/` : PLY `lexer.py` → `parser.py` (grammaire → AST) → `translator.py` (AST → dict de requête Mongo), piloté par `worker.py`.
- Supporter la grammaire documentée : `FIND <collection> WHERE <expr> [SELECT ...] [ORDER BY ... ASC|DESC] [SKIP n] [LIMIT n]` ; opérateurs `=`, comparaison (`>= <= > <`), `LIKE` (avec wildcards `*` → regex), `IN (...)`, `EXISTS`, `AND`/`OR`/`NOT`, parenthèses, chemins de champs imbriqués (`profile.address.city`).
- Protocole : lire du JSON délimité par retour ligne sur stdin (`{id, query}`), écrire `{id, ok, result|error}` sur stdout. Terminer quand stdin se ferme.
- **Terminé quand :** chaque exemple de `satan-ql.md` parse vers le filtre/projection/tri Mongo correct.

**B1-2 — Client Node (`SatanClient`)** · **M**

- `createSatanClient()` lance le worker Python **une fois**, le garde vivant, corrèle requêtes/réponses par `id`, redémarre automatiquement au crash, s'éteint à la sortie de l'api.

**B1-3 — Intégration api + sécurité** · **M**

- Câbler à travers un repository + cas d'usage + route (ex. un chemin de requête admin/recherche) pour que SATAN soit exercé de bout en bout via DI.
- **La sécurité anti-injection est obligatoire :** allowlister les collections et champs interrogeables ; rejeter l'injection d'opérateurs Mongo ; ne jamais interpoler de chaîne utilisateur brute dans la requête traduite. Traiter l'entrée SATAN comme non fiable.
- **Terminé quand :** un endpoint api répond à une requête SATAN sur des données réelles, et une tentative d'injection est rejetée.

### B2 — sync-gateway (`apps/sync-gateway`)

_Objectif : le pont bidirectionnel H2 ↔ MongoDB auquel l'app Java existante parle._ L'app Java est figée (dépôt séparé), donc le contrat ci-dessous est **découvert depuis cette app, pas inventé ici.**

> ⚠️ Déjà livré (voir le code). La logique de synchronisation existe, livrée **dans `apps/api`** (`use-cases/sync/{ingest,get-changes,get-conflicts,resolve-conflict}.use-case.ts` + `packages/contracts/src/sync.contract.ts`), et non comme `apps/sync-gateway` séparé. Les sous-tâches B2-1..B2-3 ci-dessous décrivent une architecture qui a en pratique divergé — à recouper avec le code réel.

**B2-0 — Clore la spec** · **S** _(bloque B2-1+)_

- Résoudre la section **Déduplication** inachevée (`sync-gateway.md` se termine par `????`) : confirmer l'index unique par clé métier par entité et le flux d'adoption INSERT-retry-avec-`mongoId`-null **contre ce que l'app Java envoie réellement**.
- Assigner le **port** (TBD dans la doc ; pris : api 3000, admin 4000, user 5000, auth 3001, neo4j 7474) et l'enregistrer dans `docker-compose*.yml` + `turbo.json`.
- Confirmer que l'ensemble des collections synchronisées et les formes de payload correspondent à l'outbox de l'app Java.

**B2-1 — `POST /ingest`** · **M**

- Événements outbox par lot → Mongo : `INSERT` (générer ObjectId, insérer avec `_id = mongoId`, retourner `{id, mongoId}`), `UPDATE` (`$set` complet par `_id`), `DELETE` (par `_id`) ; taguer les écritures `origin:"sync"` ; sauter+logger les entités inconnues ; imposer une limite de corps de ~5 Mo ; INSERT-retry idempotent selon B2-0.

**B2-2 — Watcher Change Streams** · **M**

- Surveiller Mongo ; sauter `origin == "sync"` ; ajouter à `sync_changes` avec un `index` **incrémenté atomiquement** (collection de compteurs via `findOneAndUpdate`).

**B2-3 — `GET /changes?since=&limit=`** · **S**

- Pagination par curseur sur `sync_changes` (`since` défaut 0, `limit` défaut 100).
- **Terminé quand :** une entité créée dans l'app Java fait l'aller-retour vers Mongo et est visible dans l'api/user-front, et une écriture côté api ressort via `/changes` et atterrit dans le H2 de l'app Java.

### Reporté dans le périmètre

- **Recommandations `RECOMMENDED` / d'événements** (arête Neo4j `RECOMMENDED`) : reporter en post-Phase-2 — le fil d'annonces est la première surface de recommandation à plus forte valeur.

---

## 9. Questions ouvertes (les réponses changent le plan)

1. **Contrat sync-gateway (B2-0)** — l'app Java (dépôt séparé) est la contrepartie figée. Avant de construire, lire le code outbox/poll de cette app pour confirmer l'ensemble des collections synchronisées, les formes de payload et le comportement de dédup que la doc laisse en `????`. Choisir aussi le port de la gateway.
2. **Surface d'intégration SATAN (B1-3)** — quel(s) chemin(s) de requête api passent par SATAN ? En choisir au moins un réel (ex. recherche admin user/annonce) pour qu'il soit démontrablement câblé, pas un jouet.
3. **Direction de l'UI d'auth** — garder les pages hébergées de l'auth-service (chemin actuel qui fonctionne) ou passer login/register en in-app ? Décide P0-3.
4. **Poids monétaire/légal réel sur les contrats ?** Si les signatures doivent être juridiquement contraignantes, P3-1 (Documenso) est non négociable et avance plus tôt ; si « les points sont un jeu », l'acceptation mutuelle de P1-3 peut suffire pour la v1.

---

## Annexe A — Inventaire des endpoints (implémentés)

`auth` (12) : login · login/mfa · refresh · logout · csrf · userinfo · register · verify · resend-verification · forgot-password · reset-password · totp/{enroll,confirm,disable}
`users` (5 + 2) : CRUD · `/users/:id/transactions` · `/users/:id/balance`
`districts` (5) : CRUD · `listings` (5) : CRUD · `tags` (5) : CRUD · `notifications` (5) : list/create/read/read-all/delete
`contracts` (6) : list · get · create · sign · dispute · delete
`events` (8) : CRUD · register · unregister · attend
`votes` (7) : CRUD · responses · results
`incidents` (6) : CRUD · stats
`conversations`/messages (8) : conversations CRUD-ish · messages list/send/read · media
`transactions` (2) : list · create

**Documentés mais manquants :** `GET /listings/feed`, `POST /listings/:id/view` (Phase 2) ; webhook Documenso (Phase 3).

## Annexe B — Récapitulatif d'effort

| Piste / Phase | Thème                                                          | Taille |
| ------------- | -------------------------------------------------------------- | ------ |
| A · 0         | Fondations (authz, quartiers, hygiène)                         | M      |
| A · 1         | Boucle cœur (annonces, messagerie, contrats+points)            | L      |
| A · 2         | Fil de recommandations (Neo4j)                                 | M–L    |
| A · 3         | Confiance + admin (Documenso, app admin)                       | L      |
| A · 4         | Gouvernance & durcissement (RGPD, rate limit, CI, déploiement) | M      |
| B · 1         | SATAN QL (parseur Python PLY + client Node + câblage api)      | L      |
| B · 2         | sync-gateway (ingest + Change Streams + changes)               | M      |

_Les pistes A et B tournent en parallèle ; B est notée et ne doit pas être reléguée à la fin._
</content>
</invoke>
