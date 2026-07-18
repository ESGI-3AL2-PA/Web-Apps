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
auth-service:3001/login?redirect_uri=<app-url>
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

### Signing key id (`kid`)

The `kid` stamped on tokens and published in the JWKS is the key's **RFC 7638 JWK
thumbprint** — derived from the key material, not configured.

This is load-bearing, not cosmetic. Consumers cache the JWKS _by kid_, and jose's
`createRemoteJWKSet` only refetches when a kid is **absent** (`JWKSNoMatchingKey`);
a signature failure on a kid it already holds triggers nothing. So publishing new
key material under a reused kid silently 401s every request until the 10-minute
`cacheMaxAge` lapses — and the desktop client's key cache has no TTL at all, so it
would stay broken until users relaunch the app. A thumbprint kid makes that state
unreachable: new material always means a new kid, which is the path consumers
recover from (≤30s, bounded by `cooldownDuration`).

`AUTH_KEY_ID` still overrides it, but a pin that doesn't match its key's thumbprint
warns on every boot — it reintroduces exactly that footgun. Its one legitimate use
is the one-time migration off the historical static `auth-1`; `.env.dist` documents
the alias procedure. Rotation itself needs no pin: swap the keypair, publish the old
public key via `AUTH_PUBLIC_KEY_PREVIOUS` until in-flight tokens drain, then drop it.

### Access-token claims (v2)

| Claim             | Values                          | Meaning                                                                                             |
| ----------------- | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `role`            | `user` · `admin` · `superAdmin` | District-scoped RBAC. (`service` is a separate internal short-lived token, **not** a user role.)    |
| `adminDistrictId` | ObjectId · `null`               | The single district this user administers (`admin` only). `superAdmin` is global; `user` is `null`. |

To mint `adminDistrictId`, the auth-service reads the district-admin relationship (`district_admins`) at login and on every refresh — see **Database** below.

Because authority is baked into the token, **promotion/demotion only takes effect on the next refresh (≤15 min)**. The user-front therefore **forces a refresh immediately after self-service district creation/promotion**, so admin tooling unlocks at once. Active-district **scoping** is deliberately **not** a claim: the api reads `activeDistrictId` from the user record per request, so switching the active district is instant and needs no new token. See `ROADMAP.md` §2A.

---

## Auth Service Endpoints

| Method | Path                      | Description                                               |
| ------ | ------------------------- | --------------------------------------------------------- |
| `GET`  | `/login`                  | Serves the login HTML page                                |
| `POST` | `/auth/login`             | Validates credentials, issues tokens, sets refresh cookie |
| `POST` | `/auth/refresh`           | Rotates refresh token, issues new access token            |
| `POST` | `/auth/logout`            | Revokes refresh token, clears cookie                      |
| `GET`  | `/auth/userinfo`          | Returns user claims from Bearer access token              |
| `GET`  | `/.well-known/jwks.json`  | RSA public key in JWK format (used by all consumers)      |
| `GET`  | `/auth/desktop/authorize` | Desktop SSO: session → one-shot code (admins only)        |
| `POST` | `/auth/desktop/token`     | Desktop SSO: code + PKCE verifier → access token          |

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

- Fetches JWKS from `auth-service:3001/.well-known/jwks.json` (cached, refreshed on key rotation)
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

### 5. Java App Integration (`admin-desktop`)

The JavaFX desktop client is a **public** OAuth client — it ships as a jar, so any
secret baked into it is readable by anyone holding the artifact. It therefore uses
the RFC 8252 native-app flow: authorization code + PKCE, no client secret.

```
admin-desktop                    auth-service                     browser
     |                                |                              |
     |-- bind 127.0.0.1:0 ------------|                              |
     |-- open browser --------------------------------------------->|
     |                                |<-- GET /auth/desktop/authorize
     |                                |    response_type=code
     |                                |    client_id=admin-desktop
     |                                |    redirect_uri=http://127.0.0.1:<port>/callback
     |                                |    state=<csrf> code_challenge=<S256>
     |                                |
     |                                |  no session? -> /login, then back here
     |                                |  not an admin? -> ?error=access_denied
     |                                |
     |<-- GET /callback?code=&state= -------------------------------|
     |                                |
     |-- POST /auth/desktop/token --->|   (back channel, no browser)
     |   code, code_verifier,         |
     |   client_id, redirect_uri      |
     |<-- { access_token, expires_in }|
```

Rules the client must hold up:

- **Verify `state`** on the callback before using the code — it is the CSRF guard.
- **Verify the token** against the JWKS (`iss: "auth-service"`, `aud: "api"`, RS256)
  rather than trusting what arrived on the wire.
- **Check the `role` claim** is `admin`/`superAdmin`. The server already refuses
  everyone else, so this is defense in depth, not the gate.
- **Cache JWKS keys with a TTL.** Caching by `kid` forever means a rotated key is
  never picked up until the process restarts.

The token is the ordinary first-party token: same issuer, same `aud: "api"`, so the
same jar keeps calling `apps/api` and `/auth/userinfo` with no audience changes.

Deliberately absent: no refresh token. The client holds the access token in memory
and reopens the browser when it expires — the httpOnly `/auth` refresh cookie makes
that silent. A public client sitting on a long-lived refresh token is a liability
with no offsetting benefit here.

> The old flow — `/login?redirect_uri=<loopback>` answering with `?access_token=` in
> the query string — is **gone**. It put the raw JWT in browser history and proxy
> logs, and accepted any loopback port as a redirect target. Old jars will receive a
> callback with no token and must be updated.

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

### `authorization_codes` collection

One-shot codes for the desktop SSO flow. 60-second TTL, reaped by a TTL index on
`expiresAtDate`; claimed via an atomic compare-and-swap on `usedAt` so two
concurrent exchanges cannot both redeem one code.

```
AUTHORIZATION_CODES {
  _id            ObjectId PK
  codeHash       string      (sha256 — a DB read can't be replayed at /token)
  clientId       string
  userId         ObjectId FK → users
  redirectUri    string      (byte-compared at exchange, never re-parsed)
  codeChallenge  string      (PKCE S256, required)
  expiresAt      timestamp
  expiresAtDate  Date        (TTL index)
  usedAt         timestamp   (null until claimed)
  createdAt      timestamp
}
```
