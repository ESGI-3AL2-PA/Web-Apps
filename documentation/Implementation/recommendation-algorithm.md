# Recommendation Algorithm — Listing Feed

## Overview

The listing feed ranks listings so users see the most relevant ones first. District is a **hard filter**: only listings in the same district as the authenticated user are ever returned. Within that pool, listings are scored and sorted using signals pulled from the Neo4j graph.

---

## Scoring Signals

Each listing receives a composite relevance score from three signals:

| Signal | Weight | Description |
|---|---|---|
| Tag affinity | 50 % | How closely the listing's tags match the user's accumulated interests |
| Social | 30 % | Whether the listing was published by someone the user is connected with |
| Recency | 20 % | How recently the listing was posted — older listings score lower |

### Tag affinity and interest tracking

Neo4j stores one `INTERESTED_IN` relationship **per interaction event** between a user and a tag. Each event carries its own score delta and timestamp. This means a user who viewed a listing two months ago and responded to another one yesterday will have two separate events for the same tag — each decayed independently at query time.

| Action | Score delta per tag |
|---|---|
| Viewing a listing | Small delta |
| Responding to a listing | Large delta |

At query time each event's delta is decayed based on its own age, then all contributions for the same tag are summed. This way recent activity always carries more weight than old activity, even if both were recorded under the same tag.

### Social signal

A listing scores the full social bonus if its author is someone the authenticated user is connected with directly in the graph. This surfaces content from the user's neighbourhood network.

### Recency

All else equal, a listing posted today outranks one posted last week. The recency signal decays so listings older than a few weeks contribute very little to the final score.

---

## Scoring Algorithm

```
FUNCTION score(listing, user):

  // --- Tag affinity (50%) ---
  tagScore ← 0
  FOR EACH tag IN listing.tags:
    FOR EACH event IN user.INTERESTED_IN events for tag:   // one entry per past interaction
      ageInDays ← days since event.createdAt
      tagScore  ← tagScore + event.delta × exp(-ageInDays / 30)   // decay each event independently
  tagScore ← min(tagScore / 5, 1)   // normalise: cap at 5 accumulated points → score of 1

  // --- Social signal (30%) ---
  IF listing.author is CONNECTED_TO user:
    socialScore ← 1
  ELSE:
    socialScore ← 0

  // --- Recency (20%) ---
  ageInDays   ← days since listing.createdAt
  recencyScore ← exp(-ageInDays / 7)   // 7-day half-life decay

  // --- Composite ---
  RETURN 0.5 × tagScore + 0.3 × socialScore + 0.2 × recencyScore

FUNCTION rankFeed(listings, user):
  FOR EACH listing IN listings:
    listing.score ← score(listing, user)
  RETURN listings SORTED BY score DESCENDING
```

---

## Request Flow

When a client calls `GET /listings/feed`:

1. The API reads the authenticated user's identity from the JWT.
2. MongoDB returns a pool of candidate listings — active, non-expired, and strictly limited to that district.
3. A single Neo4j query retrieves all scoring context for those candidates: the user's interest profile, the tags on each listing, and which listings were published by social connections.
4. Each candidate is scored in application code and the results are sorted.
5. The full listing for the current page window are fetched from MongoDB in sorted order.
6. The paginated result is returned to the client.

---

## Interest Tracking

Interest tracking is a fire-and-forget side-effect triggered by user actions. It does not block the response. The relevant triggers are:

- **Viewing a listing** — the client calls a dedicated view endpoint; the API upserts the user's interest scores for that listing's tags in Neo4j.
- **Responding to a listing** — the respond use-case upserts interest scores with a higher delta after persisting the reply.

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/listings/feed` | Ranked, paginated feed for the authenticated user |
| `POST` | `/listings/:id/view` | Signal that the user viewed a listing (triggers interest update) |
| `GET` | `/listings/:id` | Single listing by ID |
| `POST` | `/listings` | Publish a new listing |
| `PATCH` | `/listings/:id` | Update a listing |
| `DELETE` | `/listings/:id` | Remove a listing |

---

## Edge Cases

| Situation | Behaviour |
|---|---|
| New user with no interaction history | Tag affinity is zero; Social signal is zero; feed is ranked by recency |
| User with no social connections | Social signal is zero; feed is ranked by tag affinity and recency |
| Listing has no tags | That listing receives zero tag-affinity contribution and ranks on social + recency alone |
