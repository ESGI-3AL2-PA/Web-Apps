# playwright_testbook

Harness E2E pour l'API. **C'est actuellement un stub — aucun spec exécutable pour
l'instant.**

## Pourquoi c'est vide

L'ancien `tests/users.spec.ts` était écrit contre une version antérieure et non
authentifiée de l'API `/users` et était devenu une relique non exécutable :

- Il tapait `GET /users` et `POST/PATCH/DELETE /users/:id` **sans header
  `Authorization`**, en attendant des `200/201/204`.
- Sous la politique actuelle (voir `packages/contracts/src/users.contract.ts`), chacune
  de ces requêtes renvoie désormais `401/403` :
  - `getUsers` — requiert `admin` / `superAdmin`
  - `createUser` — requiert un service token interne (`audience: "api:internal"`,
    `role: "service"`)
  - `getUserById` / `updateUser` / `deleteUser` — scopés self-ou-`superAdmin`
- Son `playwright.config.ts` n'avait pas de `webServer` : il supposait donc
  silencieusement que quelque chose écoutait déjà sur `:3000`.

Plutôt que de garder un test qui échoue toujours (un mensonge sur la couverture), le spec
périmé a été supprimé. Ce README documente ce qu'un vrai harness nécessite.

## Ce qu'exige un vrai E2E

1. **La stack Compose démarrée.** Depuis la racine du dépôt :

   ```bash
   docker compose up
   ```

   Ceci démarre `api` (:3000), `auth-service` (:3001), les fronts, Mongo et Neo4j.

2. **Un `webServer` (ou une stack externe documentée) + un `baseURL`** dans
   `playwright.config.ts`. Aujourd'hui la config ne fixe que
   `baseURL: http://localhost:3000` et suppose la stack déjà lancée — ajoutez un bloc
   `webServer` (ou continuez de vous appuyer sur la stack Compose, mais documentez-le)
   avant d'ajouter des specs.

3. **De vrais tokens d'auth.** Il n'existe aucun chemin non authentifié vers les
   endpoints user. Un spec correct doit obtenir un access token auprès de
   l'**auth-service** (register/login contre `:3001`) et l'envoyer en
   `Authorization: Bearer <token>`. Les flux admin-only et service-token requièrent des
   users privilégiés seedés ou un service JWT signé.

4. **Des fixtures uniques et isolées.** L'ancien spec codait en dur un unique email non
   unique (`test-email@example.com`) ; de vrais specs doivent générer des données
   uniques par run et nettoyer derrière eux.

## État

Stub, en attente du travail E2E / CI planifié (voir `documentation/ROADMAP.md` —
expansion testing & CI/CD, P0-1). `package.json`, `playwright.config.ts` et
`tsconfig.json` sont conservés pour qu'on puisse déposer des specs dans `tests/` une
fois ce qui précède en place.
