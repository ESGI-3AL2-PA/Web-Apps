# playwright_testbook

E2E harness for the API. **This is currently a stub — there are no runnable specs yet.**

## Why it's empty

The previous `tests/users.spec.ts` was written against an earlier, unauthenticated
version of the `/users` API and had become a non-runnable relic:

- It hit `GET /users` and `POST/PATCH/DELETE /users/:id` with **no `Authorization`
  header**, expecting `200/201/204`.
- Under the current policy (see `packages/contracts/src/users.contract.ts`) every one
  of those requests now returns `401/403`:
  - `getUsers` — requires `admin` / `superAdmin`
  - `createUser` — requires an internal service token (`audience: "api:internal"`, `role: "service"`)
  - `getUserById` / `updateUser` / `deleteUser` — self-or-`superAdmin` scoped
- Its `playwright.config.ts` had no `webServer`, so it silently assumed something was
  already listening on `:3000`.

Rather than keep a test that always fails (a lie about coverage), the stale spec was
removed. This README documents what a real harness needs.

## What real E2E requires

1. **The Compose stack up.** From the repo root:

   ```bash
   docker compose up
   ```

   This brings up `api` (:3000), `auth-service` (:3001), the fronts, Mongo and Neo4j.

2. **A `webServer` (or documented external stack) + `baseURL`** in
   `playwright.config.ts`. Today the config only sets `baseURL: http://localhost:3000`
   and assumes the stack is already running — add a `webServer` block (or keep relying
   on the Compose stack, but document it) before adding specs.

3. **Real auth tokens.** There is no unauthenticated path into the user endpoints. A
   correct spec must obtain an access token from the **auth-service** (register/login
   against `:3001`) and send it as `Authorization: Bearer <token>`. Admin-only and
   service-token flows need seeded privileged users or a signed service JWT.

4. **Unique, isolated fixtures.** The old spec hardcoded a single non-unique email
   (`test-email@example.com`); real specs must generate unique data per run and clean up.

## Status

Stub, pending the planned E2E / CI work (see `documentation/ROADMAP.md` — testing &
CI/CD expansion, P0-1). `package.json`, `playwright.config.ts` and `tsconfig.json` are
kept so specs can be dropped into `tests/` once the above is in place.
