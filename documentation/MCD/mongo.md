# MongoDB — Collections

> **v2 (feature change).** `users.districtId` (single) is replaced by `users.activeDistrictId` + a geocoded `users.location`; districts **may overlap** and their **names are not unique**; district-admin is modeled as the `DISTRICT_ADMINS` relationship (one district per admin, many admins per district). See `ROADMAP.md` §2A.

```mermaid
erDiagram

  USERS {
    ObjectId _id PK
    string email
    string passwordHash
    string firstName
    string lastName
    string address
    object location
    string phone
    string role
    ObjectId activeDistrictId FK
    int balance
    timestamp createdAt
    timestamp updatedAt
  }

  DISTRICTS {
    ObjectId _id PK
    string name
    object geoJson
    timestamp createdAt
    timestamp updatedAt
  }

  DISTRICT_ADMINS {
    ObjectId _id PK
    ObjectId districtId FK
    ObjectId userId FK
    timestamp createdAt
  }

  LISTINGS {
    ObjectId _id PK
    ObjectId authorId FK
    ObjectId districtId FK
    string title
    string description
    string type
    string category
    int price
    string status
    array TAGS
    timestamp createdAt
    timestamp expiresAt
  }

  TAGS {
    ObjectId _id PK
    string name
    string description
  }

  CONTRACTS {
    ObjectId _id PK
    ObjectId listingId FK
    ObjectId districtId FK
    ObjectId providerId FK
    ObjectId beneficiaryId FK
    int price
    int documensoDocumentId
    string signatureStatus
    string providerSigningUrl
    string beneficiarySigningUrl
    boolean disputed
    timestamp createdAt
  }

  EVENTS {
    ObjectId _id PK
    ObjectId creatorId FK
    ObjectId districtId FK
    string title
    string description
    string location
    int totalSeats
    int remainingSeats
    string status
    array registrants
    timestamp eventDate
    timestamp createdAt
  }

  VOTES {
    ObjectId _id PK
    ObjectId creatorId FK
    array districtIds FK
    string question
    array options
    string voteType
    string status
    array results
    timestamp startDate
    timestamp endDate
  }

  VOTE_RESPONSES {
    ObjectId _id PK
    ObjectId voteId FK
    ObjectId userId FK
    string chosenOption
    timestamp votedAt
  }

  INCIDENTS {
    ObjectId _id PK
    ObjectId reporterId FK
    ObjectId districtId FK
    string category
    string description
    string photoUrl
    string status
    array history
    ObjectId assignedTo FK
    timestamp createdAt
    timestamp updatedAt
  }

  CONVERSATIONS {
    ObjectId _id PK
    array participants FK
    string type
    string name
    timestamp lastMessageAt
    timestamp createdAt
  }

  MESSAGES {
    ObjectId _id PK
    ObjectId senderId FK
    ObjectId conversationId FK
    string type
    string content
    string mediaUrl
    boolean read
    timestamp createdAt
  }

  NOTIFICATIONS {
    ObjectId _id PK
    ObjectId recipientId FK
    string type
    string title
    string message
    ObjectId refId
    string refType
    boolean read
    timestamp createdAt
  }

  REFRESH_TOKENS {
    ObjectId _id PK
    ObjectId userId FK
    string tokenHash
    timestamp expiresAt
    timestamp revokedAt
    timestamp createdAt
  }

  TRANSACTIONS {
    ObjectId _id PK
    ObjectId userId FK
    string type
    int amount
    ObjectId refId
    string refType
    timestamp createdAt
  }

  USERS               }o--||  DISTRICTS           : "active in"
  DISTRICT_ADMINS     }o--||  DISTRICTS           : "administers"
  DISTRICT_ADMINS     }o--||  USERS               : "is admin"
  LISTINGS            }o--||  USERS               : "published by"
  LISTINGS            }o--||  DISTRICTS           : "in"
  CONTRACTS           ||--||  LISTINGS            : "generated for"
  CONTRACTS           }o--||  USERS               : "provider"
  CONTRACTS           }o--||  USERS               : "beneficiary"
  EVENTS              }o--||  USERS               : "created by"
  EVENTS              }o--||  DISTRICTS           : "in"
  VOTES               }o--||  USERS               : "created by"
  VOTE_RESPONSES      }o--||  VOTES               : "for"
  VOTE_RESPONSES      }o--||  USERS               : "by"
  INCIDENTS           }o--||  USERS               : "reported by"
  INCIDENTS           }o--||  DISTRICTS           : "in"
  MESSAGES            }o--||  USERS               : "sent by"
  MESSAGES            }o--||  CONVERSATIONS       : "in"
  NOTIFICATIONS       }o--||  USERS               : "recipient"
  TRANSACTIONS        }o--||  USERS               : "belongs to"
  REFRESH_TOKENS      }o--||  USERS               : "belongs to"
```

## Notes & indexes (v2)

- `users.location` — GeoJSON `Point` (`[lng, lat]`) geocoded from `address`; drives the eligible-district lookup. `users.role` ∈ `user | admin | superAdmin`.
- `users.activeDistrictId` — the single district that scopes the user's feed/listings/events/incidents; mutable (switching is server-side, no token change).
- `districts.geoJson` — GeoJSON `Polygon` with a **2dsphere** index; districts **may overlap** and **names are not unique** (identify by `_id`). The eligible set is computed via point-in-polygon over all boundaries.
- `district_admins` — unique index on `userId` enforces **one district per admin**; a district may have **many** admins. Read by the auth-service to mint the `adminDistrictId` JWT claim.
