# Auth Service — Centralized Authentication

## Architecture

A dedicated `auth-service` acts as the single identity authority for all apps. It hosts the login UI and issues JWTs. Consumers (api, frontends, Java app) validate tokens locally using the auth-service public key.

```
User browser
  │  unauthenticated request
  ▼
admin-front / user-front
  │  redirect to auth-service login page
  ▼
auth-service:6000/login?redirect_uri=<app-url>
  │  POST credentials → validate → set session cookie → redirect back with tokens
  ▼
app receives access_token + refresh_token
  │  Bearer token on every API call
  ▼
apps/api  ──  validates JWT via JWKS endpoint (no auth-service call)

Java App
  │  redirect to auth-service login (same flow)
  ▼
validates JWT via JWKS endpoint
```

---

## Token Strategy

| Token                     | Lifetime   | Storage              |
| ------------------------- | ---------- | -------------------- |
| Access token (JWT, RS256) | 15 minutes | Memory (JS variable) |
| Refresh token             | 7 days     | HttpOnly cookie      |

- Access tokens are **never stored in localStorage** (XSS risk)
- Refresh tokens are **HttpOnly cookies**
- On access token expiry, the frontend silently calls `POST /auth/refresh` (cookie sent automatically)

### Access-token claims (v2)

| Claim             | Values                          | Meaning                                                                                             |
| ----------------- | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `role`            | `user` · `admin` · `superAdmin` | District-scoped RBAC. (`service` is a separate internal short-lived token, **not** a user role.)    |
| `adminDistrictId` | ObjectId · `null`               | The single district this user administers (`admin` only). `superAdmin` is global; `user` is `null`. |

To mint `adminDistrictId`, the auth-service reads the district-admin relationship (`district_admins`) at login and on every refresh — see **Database** below.

Because authority is baked into the token, **promotion/demotion only takes effect on the next refresh (≤15 min)**. The user-front therefore **forces a refresh immediately after self-service district creation/promotion**, so admin tooling unlocks at once. Active-district **scoping** is deliberately **not** a claim: the api reads `activeDistrictId` from the user record per request, so switching the active district is instant and needs no new token. See `ROADMAP.md` §2A.

---

## Auth Service Endpoints

| Method | Path                     | Description                                               |
| ------ | ------------------------ | --------------------------------------------------------- |
| `GET`  | `/login`                 | Serves the login HTML page                                |
| `POST` | `/auth/login`            | Validates credentials, issues tokens, sets refresh cookie |
| `POST` | `/auth/refresh`          | Rotates refresh token, issues new access token            |
| `POST` | `/auth/logout`           | Revokes refresh token, clears cookie                      |
| `GET`  | `/auth/userinfo`         | Returns user claims from Bearer access token              |
| `GET`  | `/.well-known/jwks.json` | RSA public key in JWK format (used by all consumers)      |

---

## Implementation Steps

### 1. Auth Service (`apps/auth-service/`)

**Dependencies:**

```
jose          — JWT signing/verification (RS256), JWKS generation
argon2        — password hashing
```

**Keys** are injected via environment variables (`AUTH_PRIVATE_KEY`, `AUTH_PUBLIC_KEY`) in production. In development, generated at startup and logged once.

**Login page** (`login-page/index.html`): vanilla HTML form, no framework dependency. Submits to `POST /auth/login`, receives redirect. Kept minimal — no React build step required.

---

### 2. Contracts (`packages/contracts/`)

`auth.contract` with ts-rest definitions for:

- `POST /auth/login` — `{ email, password }` → `{ access_token, user }`
- `POST /auth/refresh` — `{}` → `{ access_token }`
- `POST /auth/logout` — `{}` → `{ success }`
- `GET /auth/userinfo` — `{}` → `UserResponseDto`

Both frontends import from `@repo/contracts` for type-safe API calls — same pattern as the existing user contract.

---

### 3. API Auth Middleware (`apps/api/`)

`auth.middleware`:

- Fetches JWKS from `auth-service:6000/.well-known/jwks.json` (cached, refreshed on key rotation)
- Validates Bearer token on every protected route
- Attaches `req.user` with claims (`role`, `adminDistrictId`)
- Returns `401` if missing/invalid, `403` if insufficient role **or district mismatch** (an `admin` acting outside their `adminDistrictId`); `superAdmin` bypasses district checks

---

### 4. Frontend Integration (`apps/admin-front/`, `apps/user-front/`)

- Add auth context: stores access token in memory, exposes `login()` / `logout()` / `user`
- `ProtectedRoute` component: checks for valid token, redirects to auth-service login if absent; supports district-aware role gating
- Axios/fetch interceptor: attaches `Authorization: Bearer <token>`, calls `/auth/refresh` on 401
- After self-service district creation/promotion, **force a `/auth/refresh`** to load the new `adminDistrictId` claim

---

### 5. Java App Integration

No custom auth code needed. Configure the OIDC resource server to validate JWTs:

`com.auth0:java-jwt`:

```java
JwkProvider provider = new UrlJwkProvider("http://auth-service:6000/.well-known/jwks.json");
DecodedJWT jwt = JWT.decode(token);
Jwk jwk = provider.get(jwt.getKeyId());
Algorithm algorithm = Algorithm.RSA256((RSAPublicKey) jwk.getPublicKey(), null);
JWT.require(algorithm).build().verify(token);
```

---

## Database

Auth-service shares the existing MongoDB instance — no new container needed.

```
mongodb (shared container)
  └── app_db
        ├── users              ← api reads/writes · auth-service reads only (credentials + admin claim)
        ├── district_admins    ← api reads/writes · auth-service reads only (to derive adminDistrictId)
        └── refresh_tokens     ← auth-service reads/writes only
```

**Boundary rule:** auth-service never **writes** `users`; it **reads** `users` (credential validation) and `district_admins` (to derive the `adminDistrictId` claim). The api never reads or writes `refresh_tokens`.

### `refresh_tokens` collection

```
REFRESH_TOKENS {
  _id         ObjectId PK
  userId      ObjectId FK → users
  tokenHash   string        (stored hashed, never plain)
  expiresAt   timestamp
  revokedAt   timestamp     (null if active)
  createdAt   timestamp
}
```
