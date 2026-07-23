# Éditeur de frontière de quartier

Un acteur autorisé dessine, modifie et enregistre la frontière d'un quartier (district) sur une carte
interactive. Les frontières sont stockées en GeoJSON (Polygon ou MultiPolygon) dans la collection
`districts` et servent, à l'échelle de la plateforme, à cloisonner annonces, événements, votes et
signalements par quartier.

L'éditeur cartographique lui-même vit **uniquement dans l'app admin** (`apps/admin-front`). L'app
résident (`apps/user-front`) ne dessine aucun polygone : elle ne propose qu'une auto-création de
quartier « en un clic » à partir de l'adresse de l'utilisateur, décrite plus bas.

---

## Deux acteurs, deux parcours

### superAdmin et admin de quartier — via l'app admin

La page Quartiers (`DistrictPage.tsx`) affiche le quartier **en scope** : son nom, ses points de
départ (`startingPoints`) et sa frontière, éditables sur place et enregistrés d'un seul bouton.

- **`superAdmin`** — bascule d'un quartier à l'autre via le sélecteur de la barre supérieure
  (`DistrictScopeProvider`) et peut en **créer** un nouveau via une modale (`NewDistrictModal`) qui
  exige nom + tracé obligatoire.
- **`admin`** de quartier — limité à **son** quartier (`adminDistrictId`) ; il en modifie le nom, le
  tracé et les points de départ, mais ne peut ni créer ni supprimer de quartier.

L'enregistrement envoie `name`, `geoJson` et `startingPoints` en un seul `PATCH`.

### Utilisateur sans quartier — auto-création, sans dessin

Un utilisateur ordinaire dont l'adresse ne tombe dans aucun quartier atterrit sur l'écran
`NoDistrict.tsx` (posé par `DistrictGuard`). Trois issues :

1. **Re-résoudre** son quartier (« vérifier à nouveau ») — re-géocode l'adresse enregistrée et
   rejoint le quartier qui la contient.
2. **Choisir** — si plusieurs quartiers recouvrent l'adresse, l'écran présente les candidats et
   l'utilisateur en sélectionne un.
3. **Créer son propre quartier** — un seul clic (`POST /users/me/district`). Le serveur géocode
   l'adresse, crée un quartier **actif** initialisé avec une **boîte englobante provisoire** autour
   du point (petit carré fermé, demi-côté ≈ 0,001° soit ~110 m) et un **nom temporaire**
   (`«  prénom  »'s district`), puis **promeut** l'appelant administrateur de ce quartier. Il n'y a
   donc **aucun tracé côté résident** : le client redirige ensuite vers l'app admin (`/districts`),
   où le nouvel admin **affine** la frontière avec le véritable éditeur. La redirection vers l'app
   admin y déclenche un rafraîchissement du token, qui fait apparaître le rôle `admin` et le claim
   `adminDistrictId`.

L'auto-création crédite aussi le fondateur des points de départ du quartier (`startingPoints`, 100 par
défaut pour un quartier auto-créé) et l'y fait adhérer, via `createDistrictAdminUseCase`.

---

## Modèle de données

Un quartier (`DistrictSchema` / `DistrictResponseDto`) porte :

- `id` — identifiant unique.
- `name` — 1 à 200 caractères. **Pas de contrainte d'unicité** : deux quartiers peuvent porter le
  même nom, ils sont identifiés par leur `id`.
- `geoJson` — la frontière, en géométrie GeoJSON `Polygon` ou `MultiPolygon`, **facultative** (un
  quartier peut exister sans frontière tracée).
- `startingPoints` — capital de points (`token`) crédité à tout nouveau membre à son adhésion.

Le rattachement d'un administrateur à un quartier ne vit **pas** sur l'entité quartier mais dans la
relation `district_admins` (voir `create-district-admin.use-case.ts`).

Le champ `geoJson` porte un index géospatial MongoDB **2dsphere** (créé par le repository Mongo). Il
sous-tend `findDistrictsContaining(point)`, une requête `$geoIntersects` qui, à partir d'un point
géocodé, renvoie **tous les quartiers dont le polygone contient ce point**. Les frontières pouvant se
chevaucher, ce résultat est un **ensemble** (les quartiers _éligibles_ de l'utilisateur), pas un
unique match ; l'utilisateur choisit alors le quartier qu'il rejoint.

---

## API

Le cycle de vie du quartier passe par cinq endpoints du contrat `districtsContract`, plus l'endpoint
d'auto-création côté `usersContract` :

| Méthode  | Chemin               | Rôles                           | Description                                                     |
| -------- | -------------------- | ------------------------------- | --------------------------------------------------------------- |
| `GET`    | `/districts`         | authentifié                     | Liste **paginée** des quartiers (`page`, `limit`, `search`)     |
| `GET`    | `/districts/:id`     | authentifié                     | Un quartier par son id                                          |
| `POST`   | `/districts`         | `superAdmin`                    | Crée un quartier                                                |
| `PATCH`  | `/districts/:id`     | `admin` (le sien), `superAdmin` | Met à jour nom, frontière et/ou `startingPoints`                |
| `DELETE` | `/districts/:id`     | `superAdmin`                    | Supprime un quartier                                            |
| `POST`   | `/users/me/district` | authentifié (soi-même)          | Auto-crée son quartier depuis son adresse et en devient l'admin |

Notes de comportement :

- `GET /districts` est **paginé** (`page` ≥ 1, `limit` 20 par défaut plafonné à 100, `search` par nom
  facultative) — la réponse est enveloppée dans `PaginatedResponseDto`, pas une liste brute.
- `POST /districts` est réservé au **`superAdmin`** ; le créateur ne devient **pas** automatiquement
  admin. La création qui promeut l'appelant admin est l'endpoint séparé `POST /users/me/district`.
- `PATCH /districts/:id` est ouvert à l'`admin` de quartier **restreint au sien**
  (`scope.districtField: "id"`, l'id de l'enregistrement devant égaler l'`adminDistrictId` de
  l'appelant) et au `superAdmin` (bypass sur n'importe quel quartier).
- `DELETE /districts/:id` est réservé au `superAdmin`.

Les contrats sont définis dans `@repo/contracts` (ts-rest) et consommés par le router de l'API comme
par les clients des deux fronts.

---

## Validation

### Forme du GeoJSON (400 en amont)

Les corps de création/mise à jour valident la frontière contre `GeoJsonInputSchema` (schéma strict),
**avant** persistance :

- La géométrie doit être un `Polygon` **ou** un `MultiPolygon` (union discriminée sur `type`) — un
  point, une ligne ou tout autre type est rejeté.
- Chaque anneau linéaire doit compter **au moins 4 positions** et être **fermé** (première position
  identique à la dernière), conformément à la spec GeoJSON.
- Chaque position doit être dans les bornes valides : longitude ∈ [-180, 180], latitude ∈ [-90, 90].

Cette validation stricte en entrée existe pour renvoyer un **400** sur une frontière malformée plutôt
que de laisser l'index 2dsphere de Mongo échouer en **500**. La forme de **réponse** (`GeoJsonSchema`)
reste volontairement lâche (`type` + `coordinates` non typées) — la donnée stockée est de confiance.

> Le chevauchement entre quartiers est **autorisé** : aucun contrôle d'overlap n'est effectué, et
> c'est ce qui permet à un point de tomber dans plusieurs quartiers éligibles.

### Garde-fou de containment des membres (409)

Contrainte spécifique et distincte de l'overlap : **une frontière ne peut pas laisser un membre actuel
du quartier au-dehors**. À chaque création (si un `geoJson` est fourni) et à chaque mise à jour de
frontière, `checkMembersWithinPolygon` :

1. liste les membres du quartier (`findUsersByDistrict`) ;
2. géocode l'adresse de chacun ;
3. teste l'appartenance du point au polygone candidat.

Si un ou plusieurs membres tombent hors du polygone, la mutation est **rejetée en 409** avec un message
du type _« N member(s) fall outside this boundary — kick or reassign them first. »_. À la création,
l'insertion déjà écrite est annulée (rollback). Un membre dont l'adresse ne peut **pas** être géocodée
est **ignoré** (et loggé), plutôt que compté hors zone, pour qu'une panne transitoire du géocodeur ne
bloque pas à tort une modification légitime.

Ce test d'appartenance est fait **en mémoire** (`point-in-polygon.ts`, algorithme de lancer de rayon
sur les anneaux, trous compris), sans aller-retour à l'index géo de Mongo — le polygone candidat
n'étant pas encore persisté au moment de la validation.

Sur `PATCH`, `geoJson: null` **efface** explicitement la frontière (plus rien à valider) ; `geoJson`
omis la laisse inchangée.

---

## Frontend — l'éditeur (app admin uniquement)

Le composant `DistrictMapEditor` (`apps/admin-front/src/pages/districts/DistrictMapEditor.tsx`) est un
éditeur cartographique non contrôlé : sa prop `value` sert de **géométrie initiale** seulement, puis il
gère son état en interne et **émet** la géométrie GeoJSON (`onChange`) à chaque modification.

### Bibliothèques

- **Leaflet** piloté impérativement (`L.map(...)`, pas de `react-leaflet`).
- **Leaflet-Geoman** (`@geoman-io/leaflet-geoman-free`) pour les outils de dessin/édition.
- Fond de carte **OpenStreetMap** (tuiles publiques, aucune clé API).

### Comportement

- Seul le **polygone** est proposé au dessin (marqueur, ligne, rectangle, cercle, texte désactivés) —
  un quartier est une zone. Sont activés : dessin, édition de sommets, déplacement (drag), suppression
  et découpe (cut).
- **Un seul polygone à la fois** : dessiner un nouveau polygone efface le précédent.
- À l'hydratation depuis `value` : un `Polygon` devient éditable et la carte se cadre dessus ; un
  `MultiPolygon` est affiché **en lecture seule** avec un avertissement (non éditable ici) ; tout autre
  type, ou un GeoJSON invalide, affiche un avertissement.
- Supprimer le polygone émet `null` (frontière effacée).

Côté page, `isValidPolygon` sert de garde de type avant envoi : géométrie `Polygon` dont chaque anneau
compte au moins 4 positions. L'éditeur ne produisant que des `Polygon` simples, la création et
l'édition « fines » d'un `MultiPolygon` ne se font pas depuis cet éditeur.

---

## Géocodage

Le géocodage d'adresse (`address.service.ts`, `getCoordinatesFromAddress`) s'appuie sur l'API publique
de la **Géoplateforme** (IGN, `data.geopf.fr/geocodage/search`), avec un timeout de 5 s. Il convertit
une adresse textuelle en géométrie GeoJSON, exploitée à la fois par l'auto-création de quartier, la
résolution du quartier d'un utilisateur (`resolveMyDistrictUseCase`) et le garde-fou de containment des
membres.
