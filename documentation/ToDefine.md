# À définir

## Tranché (voir `ROADMAP.md`)

- **Autorisation** — RBAC scopé par quartier. Rôles `user | admin | superAdmin` (plus un claim machine interne `service`). L'autorité est portée par le JWT (`role`, `adminDistrictId`) ; l'api applique la propriété + le scope quartier. → ROADMAP §2A / P0-1.
- **Login de l'app** — géré par les pages `/login` + `/register` hébergées par l'auth-service (flux de redirection). → `auth-service.md`.
- **Inférence adresse → quartier** — géocoder l'adresse en `{lng,lat}` (cartes.gouv.fr : https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/), puis point-in-polygon (`@turf/boolean-point-in-polygon`) sur toutes les frontières de quartier. Les quartiers peuvent se chevaucher, d'où un **ensemble éligible** ; l'utilisateur en choisit un comme quartier **actif**. → ROADMAP §2A / P0-2.
- **Création de comptes admin** — les `admin`s de quartier sont créés par création/promotion en self-service, ou par ajout en tant que co-admin (un quartier par admin, plusieurs admins par quartier). Les `superAdmin`s sont des employés de l'entreprise, seedés. → ROADMAP §2A / P3-2.

## Encore à définir

- **Rate limits** — aucun pour l'instant ; prioriser les endpoints d'auth (login, forgot-password, TOTP, register). → ROADMAP P4-2.
- **CI / CD** (GitHub workflows). → ROADMAP P4-3.
- **Notifications email** — au-delà de la vérification/reset (qui fonctionnent déjà via Resend).
- **Visibilité des informations sensibles** — les utilisateurs doivent contrôler qui voit leurs données sensibles (adresse, téléphone, email) ; par défaut, rien ne doit être exposé. → ROADMAP P4-1.
- **Conformité RGPD** — les utilisateurs ont le droit d'accéder à leurs données, de les modifier, de les supprimer et de s'opposer à leur traitement ; la politique de confidentialité doit détailler comment et pourquoi les données sont collectées, stockées et partagées. → ROADMAP P4-1.
