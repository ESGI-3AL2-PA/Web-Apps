# Algorithme de recommandation — Événements

## Vue d'ensemble

Le moteur de recommandation suggère des **événements** à l'utilisateur authentifié. Il repose
entièrement sur la projection en graphe **Neo4j** et applique un **filtrage collaboratif** (traversée
de relations) plutôt qu'un score composite pondéré : on cherche des utilisateurs aux goûts proches,
puis on remonte les événements qu'ils ont aimés.

Neo4j n'est qu'une **projection** : Mongo reste la source de vérité pour les documents complets. La
synchro est en dual-write best-effort (voir `graph.sync.ts`) et une tâche de réconciliation
(`rebuildGraphUseCase`) peut reconstruire intégralement le graphe depuis Mongo.

Le pipeline complet vit dans `get-event-recommendations.use-case.ts` :

1. Neo4j renvoie une liste d'IDs d'événements **classés par pertinence** (`getRecommendedEventIds`).
2. Les documents correspondants sont récupérés en un seul fetch groupé Mongo (`getEventsByIds`).
3. Les résultats sont re-triés dans l'ordre Neo4j (un `find($in)` ne garantit pas l'ordre), leur
   statut est recalculé à partir de `eventDate`, puis on **filtre pour ne garder que les événements
   `upcoming` ou `ongoing`**.

> **À noter :** le filtrage par date se fait **après** le `LIMIT` de la requête Cypher. Le nombre
> d'événements renvoyés peut donc être **inférieur** à `limit` si certains candidats les mieux classés
> sont déjà passés ou annulés. Il n'y a **aucun filtre par quartier** dans la recommandation.

---

## Signal d'intérêt

Le graphe de recommandation est alimenté par une seule relation : `INTERESTED_IN_EVENT`, portée par
un score.

| Élément          | Valeur                                                                        |
| ---------------- | ----------------------------------------------------------------------------- |
| Endpoint         | `POST /events/:id/interest`                                                   |
| Corps (`rating`) | `1` (intérêt, 👍) ou `-1` (désintérêt, 👎) — union stricte des deux littéraux |
| Relation graphe  | `(:User)-[:INTERESTED_IN_EVENT {score, updatedAt}]->(:Event)`                 |

Le cas d'usage `markInterestUseCase` :

1. renvoie `false` (→ `404`) si l'événement n'existe pas, pour ne pas écrire d'arête orpheline ;
2. persiste d'abord dans Mongo via `recordInterest` — **une seule ligne par `(eventId, userId, kind="interest")`**,
   dont le champ `score` est **écrasé** (`$set`) à chaque appel ;
3. réplique ensuite l'arête dans Neo4j via `syncGraph(...)` (best-effort : un Neo4j dégradé ne fait pas
   échouer l'action utilisateur).

Côté Neo4j, `linkUserInterestedInEvent` **accumule** le score sur le hot-path :

```cypher
MERGE (u:User {userId: $userId})
MERGE (e:Event {eventId: $eventId})
MERGE (u)-[r:INTERESTED_IN_EVENT]->(e)
ON CREATE SET r.score = $scoreDelta, r.updatedAt = $updatedAt
ON MATCH  SET r.score = coalesce(r.score, 0) + $scoreDelta, r.updatedAt = $updatedAt
```

Le `MERGE` (plutôt qu'un `MATCH`) sur `User` et `Event` crée un node stub si l'entité n'a pas encore
été synchronisée, pour que la relation ne soit jamais perdue silencieusement.

> **Divergence Mongo/Neo4j :** Mongo **écrase** le score (dernier `rating` reçu), tandis que le
> hot-path Neo4j **cumule** les deltas successifs. La reconstruction (`rebuildGraphUseCase`) réaligne
> Neo4j sur Mongo via `setUserInterestedInEvent` (SET absolu), ce qui peut **réinitialiser** un score
> Neo4j accumulé à la dernière valeur enregistrée dans Mongo.

D'autres relations d'engagement existent et servent à **exclure** les événements déjà connus de
l'utilisateur : `REGISTERED_FOR` (inscription) et `ATTENDED` (participation, avec `rating` optionnel).

---

## Requête de recommandation (Cypher)

`getRecommendedEventIds(userId, limit)` réalise un filtrage collaboratif en trois sauts :

```cypher
MATCH (u:User {userId: $userId})-[r1:INTERESTED_IN_EVENT]->(common:Event)
WHERE r1.score > 0
MATCH (common)<-[r2:INTERESTED_IN_EVENT]-(other:User)
WHERE other.userId <> $userId AND r2.score > 0
MATCH (other)-[r3:INTERESTED_IN_EVENT]->(reco:Event)
WHERE reco.eventId <> common.eventId AND r3.score > 0
  AND NOT (u)-[:INTERESTED_IN_EVENT|REGISTERED_FOR|ATTENDED]->(reco)
WITH reco.eventId AS eventId, sum(r3.score) AS relevance
ORDER BY relevance DESC
LIMIT $limit
RETURN eventId
```

Lecture des sauts :

1. **`common`** — les événements que l'utilisateur a aimés (`score > 0`).
2. **`other`** — les autres utilisateurs ayant aimé ces mêmes événements (goûts similaires).
3. **`reco`** — les événements que ces utilisateurs ont aussi aimés, à l'exclusion des `common`.

La clause `NOT (u)-[:INTERESTED_IN_EVENT|REGISTERED_FOR|ATTENDED]->(reco)` écarte tout ce que
l'utilisateur a déjà engagé. La **pertinence** d'un événement candidat est la **somme** des scores
d'intérêt (`sum(r3.score)`) que lui portent les utilisateurs similaires ; le classement est décroissant
sur cette somme. Il n'y a **ni pondération de récence, ni décroissance temporelle, ni facteur social
distinct** — un seul signal (l'intérêt cumulé des voisins de goût) gouverne le tri.

`limit` est converti en entier Neo4j (`neo4j.int(limit)`) avant exécution.

---

## Endpoints

| Méthode | Chemin                    | Rôle                                                                   |
| ------- | ------------------------- | ---------------------------------------------------------------------- |
| `GET`   | `/recommendations/events` | Événements recommandés pour l'appelant, triés par pertinence           |
| `POST`  | `/events/:id/interest`    | Enregistre un signal d'intérêt (👍 `1` / 👎 `-1`) — alimente le moteur |

La query de `/recommendations/events` accepte un `limit` optionnel (`1..50`, défaut `10`). Les deux
endpoints exigent un token `aud: "api"`. La réponse de recommandation est `{ data: Event[] }`, déjà
ordonnée côté serveur (pertinence puis filtrage statut).

---

## Cas limites

| Situation                                           | Comportement                                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Utilisateur sans aucun intérêt (`score > 0`)        | Le premier `MATCH` est vide → aucune recommandation (liste vide). Il n'y a **pas** de repli récence. |
| Aucun utilisateur aux goûts similaires              | Sauts 2/3 vides → liste vide.                                                                        |
| Tous les candidats déjà engagés                     | Écartés par la clause `NOT (...)` → liste possiblement vide.                                         |
| Les mieux classés sont passés / annulés             | Filtrés après coup par statut → moins de `limit` résultats (voire zéro).                             |
| Neo4j indisponible à l'écriture du signal d'intérêt | `syncGraph` log l'erreur et continue ; Mongo a déjà persisté le signal, rejoué au prochain rebuild.  |
