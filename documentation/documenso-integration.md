# Documenso Integration (Contracts e-signature)

## Overview

[Documenso](https://documenso.com) is an open-source (AGPL-3.0) electronic-signature
service. It runs as a **separate self-hosted container** alongside the stack and owns
the signing experience: collecting signatures, sending invitation/completion emails,
enforcing signing order, and producing the signed certificate.

Everything else — the contract business logic (listing → parties → price), document
listing/viewing, authorization, and the disputed flag — stays in our API and frontend.
Users never manage documents inside Documenso directly; they only land on a Documenso
**signing page** via a per-recipient signing URL and are redirected back afterwards.

Documenso is Next.js + **PostgreSQL**; it does not share our Mongo. It is a standalone
service reached only over HTTP, so its framework is irrelevant to our React/Vite fronts.

> Chosen over OpenSign because OpenSign's REST API and webhooks are a **paid** self-host
> feature, whereas Documenso's REST API + webhooks ship in the free Community Edition.

---

## Architecture

The API is the orchestrator. On contract creation it calls Documenso to generate a
document **from a pre-configured template**, stores the returned document id and the
per-party signing URLs, and from then on serves everything from our DB. Documenso is
only called again to re-send invitations. When signing completes (or is declined),
Documenso calls our webhook so we can update the contract status.

- **Creation:** `POST /contracts` → API calls Documenso `generate-document` → stores
  `documensoDocumentId` + signing URLs → returns the contract.
- **Signing:** user clicks to sign → frontend redirects to _their_ Documenso signing URL.
- **Completion:** Documenso fires a webhook → API updates `signatureStatus`.

### Why "database" upload transport forces the template flow

Our local/default deployment uses `NEXT_PUBLIC_UPLOAD_TRANSPORT=database` (PDFs stored in
Postgres, no S3). With that transport the **direct document-upload API is disabled**
("Create document is not available without S3 transport"). The template
`generate-document` endpoint does **not** require an upload, so contracts are always
created from a single pre-built template rather than by uploading a PDF per contract.

---

## Components

### `apps/api/src/services/documenso.service.ts`

Thin client over the Documenso **v1 REST API** (`Authorization: api_…` header):

- `generateContractDocument()` — resolves the template's two `SIGNER` placeholders
  (ordered by `signingOrder`, then id: index 0 = provider, 1 = beneficiary), calls
  `POST /api/v1/templates/{templateId}/generate-document` with `distributionMethod:
"EMAIL"`, and matches the returned signing URLs back to each party by email.
- `resendDocument()` — `POST /api/v1/documents/{id}/resend`.
- `verifyWebhookSecret()` — constant-time compare of the inbound `X-Documenso-Secret`.

Reads config from env; when `DOCUMENSO_URL` / `DOCUMENSO_API_TOKEN` /
`DOCUMENSO_TEMPLATE_ID` are unset it becomes a disabled stand-in whose calls throw, so a
contract is never persisted without a signable document.

### Webhook handler — `POST /contracts/webhook`

Raw Express handler (`routes/contracts/documenso-webhook.handler.ts`) mounted **above**
`requireAuth` in `index.ts`, because Documenso authenticates with the shared secret, not
our JWT. It verifies `X-Documenso-Secret`, then maps the event to a status update
(`DOCUMENT_COMPLETED` → `completed`, `DOCUMENT_REJECTED` → `rejected` + `disputed`). The
update is idempotent and looked up by `documensoDocumentId` (unique, sparse index).

### Contract model

`documensoDocumentId`, `signatureStatus` (`draft|pending|completed|rejected`), and the
two per-party signing URLs are stored server-side. The API response exposes only the
**authenticated caller's** `signingUrl` — a signing URL embeds a token that authorizes
signing _as that recipient_, so the other party's URL is never returned.

---

## Signing flow

1. A listing is accepted → `POST /contracts`.
2. API validates the listing, derives `districtId` from it, resolves both parties'
   emails, and calls Documenso `generate-document` (provider = signer 1, beneficiary = 2).
3. Documenso returns a document id and a signing URL per recipient; the API persists them
   with `signatureStatus: "pending"` and emails each party a signing invitation.
4. The frontend lists the contract and renders the PDF preview (`react-pdf`).
5. The caller clicks to sign and is redirected to _their_ signing URL.
6. Once all parties sign, Documenso fires `DOCUMENT_COMPLETED` → the webhook sets
   `signatureStatus: "completed"` and clears the signing URLs.

---

## Environment

| Variable                      | Purpose                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| `DOCUMENSO_URL`               | Base URL of the Documenso instance (dev: `http://localhost:3030`).          |
| `DOCUMENSO_API_TOKEN`         | Per-user API token (`api_…`), created in Documenso → Settings → API Tokens. |
| `DOCUMENSO_TEMPLATE_ID`       | Numeric v1 template id with two `SIGNER` placeholders + signature fields.   |
| `DOCUMENSO_WEBHOOK_SECRET`    | Shared secret set on the Documenso webhook; verifies inbound requests.      |
| `DOCUMENSO_SIGNING_LANGUAGE`  | Signing UI language (default `fr`).                                         |
| `CONTRACTS_SIGN_REDIRECT_URL` | Where Documenso returns the user after signing (optional).                  |

In production, point Documenso's own SMTP at Resend (`smtp.resend.com`, user `resend`,
pass = `RESEND_API_KEY`) — no second email provider needed.

---

## Local development

`docker-compose.local.yml` brings up `documenso` + `documenso-db` (Postgres) + `mailpit`
(SMTP sink; read signing emails at http://localhost:8025). Steps:

1. Generate a dev signing certificate: `./scripts/gen-documenso-cert.sh` (writes the
   git-ignored `docker/documenso/cert.p12`). Documenso refuses to sign without one.
2. `docker compose -f docker-compose.local.yml up -d documenso-db mailpit documenso`.
3. In the Documenso UI (http://localhost:3030): sign up, confirm the email via mailpit,
   create an **API token**, and build a **template** with two signer placeholders and a
   signature field for each. Put the token + numeric template id in `.env`.
4. Set up a **webhook** (Settings → Webhooks) for at least `DOCUMENT_COMPLETED` /
   `DOCUMENT_REJECTED`, pointing at `http://api:3000/contracts/webhook` (the api runs
   in-network in the dev compose; use `http://host.docker.internal:3000/...` if you run
   the api on the host via `npm run dev`), with the same secret as `DOCUMENSO_WEBHOOK_SECRET`.

> **SSRF note:** Documenso blocks webhooks to private/loopback hosts. The dev compose sets
> `NEXT_PRIVATE_WEBHOOK_SSRF_BYPASS_HOSTS=api,host.docker.internal,localhost` so it can
> reach the api — **dev only**. In production the SSRF guard stays armed except for the
> in-network `api` host.

---

## Responsibility split

| Concern                                                                          | Owner              |
| -------------------------------------------------------------------------------- | ------------------ |
| Signing UI, invitation/completion emails, certificate, signing-order enforcement | Documenso          |
| Document listing & PDF preview                                                   | Our frontend + API |
| Contract business logic (listing → parties → price)                              | Our API            |
| Authorization (who can access/sign/resend)                                       | Our API            |
| Disputed / litigation flag                                                       | Our API            |
