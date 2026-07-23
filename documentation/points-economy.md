# Économie de points

Les résidents publient des annonces de services et se règlent en **points** plutôt qu'en argent.
Les points sont la monnaie interne de la plateforme et le mécanisme central du produit : aucune
somme réelle ne transite, et il n'existe pas de passerelle de paiement. Ce document décrit ce que
le code de `apps/api` implémente réellement — le modèle de registre (ledger), le mouvement atomique
des soldes, le séquestre lié aux contrats, la dotation à l'adhésion, les octrois par l'administration,
les règles de visibilité et le départ d'un quartier — ainsi que les écarts entre l'intention et
l'implémentation, relevés honnêtement.

> Terminologie. **quartier** = district ; **annonce** = listing ; **point** = token dans le code
> (les DTO nomment le montant `tokens`) ; **séquestre** = escrow (points bloqués le temps d'un
> contrat). Les identifiants, types, valeurs d'enum et chemins d'endpoint restent sous leur forme
> d'origine.

## 1. Les points comme monnaie

- Une **annonce** (`listing`) porte un `price` entier exprimé en points (`Price in tokens`, `min(0)`).
  Le tri des annonces accepte `price_asc` / `price_desc`.
- Un **contrat** matérialise la réservation d'une annonce : le `price` de l'annonce est prélevé sur
  le solde du bénéficiaire (le payeur) et bloqué en séquestre, puis versé au prestataire à la
  signature complète, ou remboursé en cas de rejet / suppression / litige.
- Il n'y a **pas de conversion vers une monnaie réelle**. Les points ne peuvent être créés (`mint`)
  ou détruits (`burn`) que par le système ou un superAdmin ; entre résidents, ils ne font que circuler.

## 2. Le registre (ledger) et le solde

Deux structures Mongo distinctes, tenues par `MongoTransactionRepository`
(`apps/api/src/repositories/Transaction/transaction.repository.mongo.ts`) :

| Structure                   | Rôle                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| collection `transactions`   | Lignes de registre **immuables**, une par jambe de mouvement. Insérées en lot, horodatées, jamais mises à jour (sauf pseudonymisation RGPD). |
| champ `balance` des `users` | Solde courant, **compteur stocké** et dénormalisé, muté par `$inc`.                                                                          |

### 2.1 Solde : stocké, pas recalculé

Conceptuellement, le solde d'un utilisateur est la somme de ses lignes de registre — c'est ainsi que
les DTO le décrivent (« le solde d'un utilisateur en est la somme »). **En pratique, l'implémentation
ne recalcule jamais cette somme** : `getBalance` lit directement le champ `balance` du document `users`
(`findOne … projection { balance: 1 }`), et chaque mouvement met à jour ce compteur via `adjustBalance`
(`$inc`) ou `tryDebit`. Le registre et le compteur sont donc deux sources qu'on maintient cohérentes
en les écrivant ensemble (cf. §3), et non une source dérivée de l'autre. Un nouvel inscrit démarre à
`balance: 0` (`create-user.use-case.ts`).

### 2.2 Types de mouvement

L'entité `transaction.entity.ts` définit deux enum :

**`TransactionType`** — sens du mouvement (le `amount` de la ligne est signé selon l'effet sur le
solde de son `userId`) :

| Valeur         | Sens                                                                                              | `amount` |
| -------------- | ------------------------------------------------------------------------------------------------- | -------- |
| `credit`       | Crédit simple, sans contrepartie (mint système, points de départ, jambe entrante d'un mint admin) | positif  |
| `debit`        | Débit simple, sans contrepartie (burn)                                                            | négatif  |
| `transfer_out` | Jambe sortante d'un transfert entre utilisateurs / blocage de séquestre côté payeur               | négatif  |
| `transfer_in`  | Jambe entrante d'un transfert / versement du séquestre au bénéficiaire                            | positif  |

Un transfert entre deux utilisateurs écrit **deux lignes** (`transfer_out` chez la source,
`transfer_in` chez la destination), qui peuvent appartenir à des `districtId` différents (le
`districtId` de chaque ligne est dérivé côté serveur de l'utilisateur concerné).

**`TransactionRefType`** — origine du mouvement (optionnelle, avec un `refId` optionnel désignant la
ressource) :

| Valeur     | Origine                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| `contract` | Blocage / versement / remboursement de séquestre lié à un contrat             |
| `listing`  | Réservé (aucune écriture directe dans le code actuel)                         |
| `event`    | Réservé (aucune écriture directe dans le code actuel)                         |
| `manual`   | Geste manuel d'un administrateur                                              |
| `system`   | Mouvement automatique du système (points de départ, redistribution au départ) |

## 3. Création de mouvements — `POST /transactions`

Le contrat `transactions.contract.ts` expose la création via `POST /transactions`, avec **step-up TOTP
systématique** (`stepUp: { always: true }`). Le corps (`CreateTransactionDto`) porte un `amount`
toujours **positif** ; le sens se déduit des extrémités :

- `fromUserId` seul → **débit / burn** (destruction de valeur) ;
- `toUserId` seul → **crédit / mint** (création de valeur) ;
- les deux → **transfert** (le serveur écrit alors les deux jambes).

Toute la logique d'autorisation vit dans `createTransactionUseCase`
(`use-cases/transactions/create-transaction.use-case.ts`), pour être couverte par les tests unitaires :

- **Utilisateur ordinaire** : la source est forcée à l'appelant (`fromUserId = actor.sub`) ; il ne peut
  déplacer que ses propres points et ne peut ni usurper un émetteur ni créer de la valeur.
- **Administrateur de quartier** (`role: "admin"`) : ne peut que **déplacer** des points entre deux
  utilisateurs **de son propre quartier** (`fromUser.districtId === toUser.districtId === adminDistrictId`).
  Le mint (sans source) et le burn (sans destination) lui sont interdits (`forbidden`).
- **superAdmin** : seul autorisé au mint et au burn.

Résultats métier typés : `insufficient-funds` (400), `sender-not-found` (400), `recipient-not-found`
(400), `forbidden` (403). Tout mouvement initié par un admin ou superAdmin est tracé par une ligne de
log structurée (`audit: "transaction.create"`) — il **n'existe pas encore de collection d'audit dédiée**.

## 4. Atomicité du mouvement de solde

Le mouvement de solde et l'écriture de registre doivent être indissociables, pour qu'un échec ne laisse
jamais des points déplacés sans trace, ni l'inverse. Deux briques :

- `tryDebit(userId, amount, session)` — **débit conditionnel atomique** : la garde `{ balance: { $gte: amount } }`
  et le `$inc: { balance: -amount }` s'exécutent comme une seule mise à jour de document, fermant la
  course « vérifier puis écrire ». Deux débits concurrents ne peuvent pas passer tous deux le contrôle
  de solde. Renvoie `false` si les fonds sont insuffisants.
- `runInTransaction(fn)` (`repositories/tx.ts`) — enveloppe le débit, le crédit et l'écriture de registre
  dans une **transaction Mongo multi-documents** lorsque le serveur la supporte.

### 4.1 Écart connu : mode dégradé silencieux

`runInTransaction` sonde une seule fois la capacité du serveur. Sur un Mongo **standalone** (sans replica
set), l'ouverture d'une transaction échoue ; le wrapper détecte l'erreur, mémorise le repli, émet un
`logger.warn("Mongo transactions unavailable (standalone server) — using sequential writes")`, et
ré-exécute `fn(undefined)` en **écritures séquentielles best-effort**. Les cas d'usage compensent alors
à la main (p. ex. `create-transaction` rembourse un débit orphelin, les écritures de registre de
séquestre passent en `.catch(log)`).

Ce repli est important à connaître : la synthèse projet (§4.2) relève que **la base n'est configurée
pour supporter les transactions dans aucun environnement — ni en développement, ni en production** — et
que le code retombe donc **systématiquement** sur ce mode dégradé. Le mécanisme atomique est correctement
écrit mais ne s'exécute pas comme prévu ; les tests simulant le mode dégradé validaient fidèlement le
comportement réel tout en masquant l'écart avec l'intention. En pratique, les mouvements de points
reposent aujourd'hui sur l'atomicité par-document de `tryDebit`/`$inc` (réelle) plutôt que sur des
transactions multi-documents (non actives).

## 5. Séquestre (escrow) et cycle de vie du contrat

Les règles de séquestre ne sont pas portées par un agrégat « Contrat » ; elles sont **réparties entre
plusieurs cas d'usage** de `use-cases/contracts/`, chacun devant respecter l'invariant « les points
bloqués doivent toujours être retrouvables » (limite d'architecture relevée en synthèse §2.2).

### 5.1 Blocage à la création — `create-contract.use-case.ts`

L'appelant est le **bénéficiaire** (payeur). Le `price` et le `districtId` sont dérivés côté serveur
depuis l'annonce (jamais du client), après vérification des invariants de réservation (annonce active,
deux parties distinctes, `providerId` = auteur de l'annonce, pas de contrat actif en double). Puis, si
`price > 0` :

1. `tryDebit(beneficiaryId, price)` bloque le prix côté bénéficiaire **avant tout travail externe** ;
   échec → `InsufficientFundsError`.
2. Génération du document Documenso, puis persistance du contrat (`signatureStatus: "pending"`). Si
   l'une échoue, le blocage est **annulé** (`adjustBalance(beneficiaryId, price)` en best-effort).
3. Une fois le contrat persisté, écriture de la ligne de registre du blocage : `transfer_out`,
   `amount: -price`, `refType: "contract"`, `refId: contract.id`. Un échec de cette écriture ne
   rembourse rien (le contrat est vivant, l'argent correctement bloqué) — il est journalisé pour
   réconciliation.

### 5.2 Signature — `handle-documenso-webhook.use-case.ts`

Le webhook Documenso pilote les transitions, de façon **idempotente** (gardes atomiques de transition,
séquestre versé/remboursé au plus une fois même en cas de re-livraison) :

- `completed` (les deux parties ont signé) → transition atomique + **versement** du séquestre au
  **prestataire** : `adjustBalance(providerId, +price)` + ligne `transfer_in`.
- `rejected` (une partie refuse) → transition atomique + **remboursement** au **bénéficiaire** :
  `adjustBalance(beneficiaryId, +price)` + ligne `transfer_in`.
- transition non terminale (pending/draft) → appliquée seulement tant que le contrat n'est pas terminal
  (un événement tardif ne peut pas ramener un contrat terminé à `pending`).

### 5.3 Suppression — `delete-contract.use-case.ts`

Supprime le contrat atomiquement ; **si le séquestre était encore bloqué** (statut `pending`/`draft`)
et `price > 0`, rembourse le bénéficiaire (`transfer_in`). Si le contrat était déjà terminal
(`completed`/`rejected`), l'argent a déjà bougé — aucun mouvement.

### 5.4 Litige — `dispute-contract.use-case.ts` / `resolve-dispute.use-case.ts`

- Ouverture : écriture unique gardée par l'état ; seul un contrat `pending` ou `completed` est
  contestable (`InvalidDisputeStateError` sinon). Un contrat contesté est gelé (le webhook ne peut plus
  le compléter).
- Résolution par un administrateur, dans `runInTransaction` :
  - `release` → verse le séquestre au **prestataire** (statut terminal `completed`) ;
  - `refund` → rembourse le **bénéficiaire** (statut terminal `rejected`).
  - Le versement n'a lieu que si le séquestre était **encore bloqué** au moment du litige
    (`pending`/`draft`). Un `refund` sur un contrat **déjà réglé** (`completed`) est refusé
    (`UnsettleableDisputeError`) : reprendre des fonds déjà versés au prestataire sort du chemin
    transactionnel contenu — c'est laissé à un traitement manuel.

## 6. Points de départ à l'adhésion

Chaque quartier porte un champ `startingPoints` (« Tokens granted to a new member when they join »).
Le crédit passe par le registre — un `credit` de `refType: "system"` — pour être **auditable** plutôt
qu'un ajustement de solde silencieux :

```
grantStartingPoints(transactionRepository, userId, districtId, amount)   // district-membership.use-case.ts
  → runInTransaction: adjustBalance(userId, +amount) + createTransactions([{ type: "credit", refType: "system" }])
```

Ce crédit est déclenché aux moments d'entrée dans un quartier :

- **Inscription** (`create-user.use-case.ts`) : si le géocodage de l'adresse résout **exactement un**
  quartier, l'utilisateur y est rattaché et reçoit ses `startingPoints`. Zéro (hors couverture) ou
  plusieurs quartiers (chevauchement) → l'utilisateur reste **sans quartier et à 0 point**.
- **Adhésion / déménagement** (`joinDistrict`, `moveUserDistrict`) : crédite les `startingPoints` du
  quartier rejoint.
- **Auto-création d'un quartier** (`create-own-district.use-case.ts`) : le fondateur reçoit
  `FOUNDER_STARTING_POINTS = 100` via `createDistrictAdminUseCase` → `joinDistrict` (le quartier est
  créé avec `startingPoints: 100`).
- **Promotion en admin** (`create-district-admin.use-case.ts`) : un promu sans quartier y est rattaché
  et reçoit les points de départ ; un résident déjà rattaché ou un superAdmin n'est pas re-crédité.

> Écart produit relevé en synthèse §4 : la monnaie est interne, mais **un nouvel inscrit démarre le plus
> souvent à zéro point** (rattachement automatique conditionné à un unique quartier couvrant l'adresse)
> et ne peut alors rien réserver tant qu'il n'a pas rendu un service — alors que recevoir un service est
> la raison la plus courante de s'inscrire. Le modèle d'usage (dotation initiale, expression d'une
> demande) reste à trancher.

## 7. Octrois par l'administration

Dans l'état de cette branche, il n'existe **pas d'endpoint d'octroi dédié**. Les octrois administratifs
passent par le mécanisme générique `POST /transactions` (§3) :

- un **superAdmin** peut **mint** (créditer sans source) ou **burn** (débiter sans destination)
  n'importe quel utilisateur ;
- un **administrateur de quartier** peut **déplacer** des points entre deux membres de son quartier
  (jamais créer ni détruire de valeur).

Chaque geste admin est tracé par la ligne de log `audit: "transaction.create"`.

> Note d'évolution : la branche `feat/district-and-user-point-grants` introduit des octrois dédiés
> (crédit en masse à tous les membres d'un quartier, et octroi à un utilisateur unique, exposés comme
> actions d'administration). Ces endpoints **ne sont pas présents sur la branche documentée ici**
> (`docs/french-inline`) et ne sont donc pas décrits dans le détail.

## 8. Visibilité des soldes et relevés

Trois endpoints de consultation (`transactions.contract.ts`) :

| Endpoint                      | Accès                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /transactions`           | Liste paginée. Un **non-admin** ne voit que son propre registre (le router force `userId = sub`). Un **admin** voit le registre de son quartier (`districtId` résolu par `resolveListDistrictScope`) ; un **superAdmin**, tout. |
| `GET /users/:id/transactions` | Relevé d'un utilisateur : **lui-même**, l'**admin de son quartier**, ou le **superAdmin**.                                                                                                                                      |
| `GET /users/:id/balance`      | Solde courant d'un utilisateur : mêmes règles. `404` si l'utilisateur est absent.                                                                                                                                               |

Le contrôle self-vs-admin des deux endpoints par utilisateur est appliqué par le middleware de métadonnées
de contrat : `scope: { resource: "user", ownerField: "id", districtField: "districtId", bypassRoles: ["superAdmin"] }`.
Ce `districtField` — introduit par le correctif **#171** — est ce qui autorise un **administrateur de
quartier à consulter le solde et le relevé d'un membre de son quartier** (on n'utilise pas `selfParam`,
qui court-circuiterait en 403 avant le contrôle de quartier et exclurait les admins).

## 9. Départ d'un quartier

`leaveDistrict` (`district-membership.use-case.ts`) traite le solde du partant avant de vider son
`districtId`. **Comportement de cette branche : redistribution, pas destruction pure.**

- S'il **reste des membres**, le solde du partant est **redistribué à parts égales** entre eux, selon la
  règle du **plus fort reste** : part de base `Math.floor(balance / n)`, puis `+1` aux `remainder`
  membres les plus anciens (tri par `createdAt`), de sorte que le total soit conservé au point près.
  Chaque bénéficiaire reçoit une ligne `transfer_in` (`refType: "system"`), et le partant une ligne
  `transfer_out` de `-balance`.
- S'il est le **seul membre**, il n'y a aucun destinataire : son solde est simplement **brûlé** (ligne
  `debit` de `-balance`, `logger.warn(… "sole member left — balance burned")`).

Le tout dans `runInTransaction`, le débit du partant utilisant `tryDebit` (atomique) sur son solde exact.
`kickFromDistrictUseCase` (exclusion d'un membre par un admin, réservée aux comptes `role: "user"`)
réutilise `leaveDistrict` et suit donc la même redistribution.

> Écart avec l'intention en cours. Un refactor ultérieur (`refactor(api): burn a leaver's balance instead
of redistributing it`, sur `feat/district-and-user-point-grants`) remplace cette redistribution par une
> **destruction (burn) systématique** du solde du partant. Ce changement **n'est pas présent sur la
> branche documentée ici** : le code décrit ci-dessus redistribue, et ne brûle que faute de destinataire.

## 10. RGPD — pseudonymisation

À la suppression d'un compte, les lignes de registre sont **conservées** (rétention comptable, exception
art. 17(3) du RGPD) mais le lien d'identité est rompu : `pseudonymiseUser` remplace le `userId` des
transactions par `"[deleted]"`. Les montants et l'historique financier restent, l'identité disparaît.

## 11. Limites connues (synthèse honnête)

- **Transactions Mongo non actives** : le mécanisme atomique multi-documents existe mais la base n'est
  configurée pour le supporter dans aucun environnement ; le code retombe systématiquement sur des
  écritures séquentielles best-effort (§4.1). L'atomicité effective repose sur `tryDebit`/`$inc`
  par-document.
- **Invariants de séquestre dispersés** : répartis entre création de contrat, webhook et résolution de
  litige, sans agrégat propriétaire qui les garantirait par construction (synthèse §2.2).
- **Pas de collection d'audit dédiée** : les gestes admin sont seulement journalisés.
- **Dotation initiale à zéro** : un nouvel inscrit démarre le plus souvent à 0 point et ne peut rien
  réserver ; le modèle d'usage reste à trancher (synthèse §4).
- **Cloisonnement par quartier incomplet** ailleurs dans l'app (relevé en synthèse §4.2) ; côté points,
  la lecture des relevés/soldes est bien scopée (§8).
