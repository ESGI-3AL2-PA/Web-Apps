# To Define

## Decided (see `ROADMAP.md`)

- **Authorization** — district-scoped RBAC. Roles `user | admin | superAdmin` (plus an internal `service` machine-token claim). Authority carried in the JWT (`role`, `adminDistrictId`); the api enforces ownership + district scope. → ROADMAP §2A / P0-1.
- **App login** — handled by the auth-service hosted `/login` + `/register` pages (redirect flow). → `auth-service.md`.
- **Address → district inference** — geocode the address to `{lng,lat}` (cartes.gouv.fr: https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/), then point-in-polygon (`@turf/boolean-point-in-polygon`) over all district boundaries. Districts may overlap, so this yields an **eligible set**; the user picks one **active** district. → ROADMAP §2A / P0-2.
- **Admin account creation** — district `admin`s are created by self-service district creation/promotion, or by being added as a co-admin (one district per admin, many admins per district). `superAdmin`s are seeded company employees. → ROADMAP §2A / P3-2.

## Still to define

- **Rate limits** — none yet; prioritize auth endpoints (login, forgot-password, TOTP, register). → ROADMAP P4-2.
- **CI / CD** (GitHub workflows). → ROADMAP P4-3.
- **Email notifications** — beyond verification/reset (which already work via Resend).
- **Sensitive-information visibility** — users must control who can see their sensitive data (address, phone, email); we don't want it exposed to anyone by default. → ROADMAP P4-1.
- **GDPR compliance** — users have the right to access, modify, delete, and object to processing of their data; the privacy policy must detail how and why data is collected, stored, and shared. → ROADMAP P4-1.
