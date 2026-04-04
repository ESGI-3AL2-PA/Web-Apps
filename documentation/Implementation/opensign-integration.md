# OpenSign Integration

## Overview

OpenSign is an open-source electronic signature service that runs as a Docker container alongside the existing stack. Its sole responsibility in this system is the signing process, collecting signatures, sending notifications, and producing a signed certificate.

All document management (listing, viewing, status tracking) is owned by our API and frontend. Users never need to visit OpenSign directly.

OpenSign shares the existing MongoDB instance using its own database prefix, requiring no additional database infrastructure.

---

## Architecture

The API acts as the orchestrator between the frontend and OpenSign. When a contract is created, the API generates the document in OpenSign, stores the resulting PDF URL and document ID in our database, then serves all document data to the frontend from that point on — without further calls to OpenSign.

OpenSign is only invoked again when a user actively proceeds to sign, at which point they are redirected to the OpenSign signing page. Once all parties have signed, OpenSign notifies the API via webhook so the contract status can be updated.

**Contract creation path:** Frontend triggers contract creation → API calls OpenSign → PDF URL and signing URLs stored in our DB → frontend reads everything from our API

**Signing path:** User chooses to sign → frontend redirects to their OpenSign signing URL

**Completion path:** Signer completes signing on OpenSign → OpenSign sends webhook → API updates contract status in DB

---

## Components to Build

### OpenSign Service

A thin client in the API that wraps the OpenSign REST API. It handles document creation (from a pre-configured template), signer assignment, and status retrieval. Widget placement on PDFs (signature fields, date fields, etc.) can be positioned visually using the OpenSign debug tool and then configured programmatically.

Called only at contract creation time and when resending signing emails.

### Webhook Handler

A dedicated API endpoint that receives real-time event notifications from OpenSign. Every incoming request must be verified before processing. The handler responds to three events:

| Event | What Happened | Our Response |
|-------|--------------|--------------|
| Document completed | All parties signed | Mark contract as completed |
| Document declined | A signer declined | Mark as declined, flag as disputed |
| Document signed | One party signed | No action — OpenSign manages sequencing |

### API Endpoints

| Action | Description |
|--------|-------------|
| Create contract | Validates the underlying listing, calls OpenSign, persists the contract with the PDF URL and signing URLs, returns the contract record |
| List contracts | Returns all contracts for the authenticated user — served entirely from our DB, no OpenSign call |
| Get contract | Returns a single contract including PDF URL and current status — served from our DB |
| Resend signing email | Delegates to OpenSign to re-send the signing invitation to a signer |

### Repository

A contracts repository following the same interface pattern as the users repository. Registered in the dependency injection container. The contract record stores the PDF URL, OpenSign document ID, per-signer signing URLs, and current status — everything needed to serve the frontend without calling OpenSign at read time.

### Frontend: Documents List Page

A dedicated route listing all contracts belonging to the authenticated user. Each entry shows the contract name, parties involved, current status, and a link to view the contract detail. Data comes entirely from our API.

### Frontend: Contract Detail / Signing Page

A dedicated route that presents the contract in two steps:

1. **Document preview** — the contract PDF is rendered inline using `react-pdf`. The user can read the full document at their own pace. No OpenSign interaction occurs here.
2. **Proceed to sign** — if the user is a pending signer, a call-to-action redirects them to their OpenSign signing URL.

---

## Signing Flow

1. A listing is accepted, triggering a `POST /contracts` request
2. The API validates the listing state, then calls OpenSign to generate a document with both signers assigned
3. OpenSign returns a PDF URL and a unique signing URL per signer
4. The API persists the contract record with those URLs and status `pending`
5. The frontend lists the contract on the user's documents page
6. The user opens the contract and reads the PDF preview in-app
7. The user clicks to sign and is redirected to their OpenSign signing URL
8. OpenSign enforces signing order and, once all parties have signed, fires a `document.completed` webhook
9. The webhook handler updates the contract status to `completed`
10. The frontend reflects the updated status on the documents list and detail pages

---

## Responsibility Split

| Concern | Owner |
|---------|-------|
| Signing UI, email notifications, audit trail, certificate | OpenSign |
| Sequential signing enforcement | OpenSign |
| Document listing and viewing | Our frontend + API |
| Contract business logic (listing → parties → price) | Our API |
| Authorization (who can access/sign) | Our API |
| Disputed/litigation flag | Our API |

---

## Environment Configuration

Four environment variables are required:

| Variable | Where | Purpose |
|----------|-------|---------|
| `OPENSIGN_API_URL` | `apps/api/.env` | Base URL for the OpenSign REST API |
| `OPENSIGN_API_TOKEN` | `apps/api/.env` | Authentication token for OpenSign API calls |
| `OPENSIGN_WEBHOOK_KEY` | `apps/api/.env` | Secret used to verify incoming webhook signatures |
| `OPENSIGN_MASTER_KEY` | Root `.env` | 12-character master key for the OpenSign Docker service |

The webhook URL also needs to be registered manually in the OpenSign admin panel under **Settings → Webhook**.

---

## Verification Checklist

1. OpenSign Docker service starts and is accessible on its configured port
2. Creating a contract stores the PDF URL and signing URLs in the DB
3. The documents list page shows all contracts for the authenticated user without any OpenSign calls
4. The contract detail page renders the PDF inline via `react-pdf`
5. Clicking to sign redirects to the correct OpenSign URL for that user
6. Completing signing triggers the webhook and updates the contract status in the DB
7. The updated status is reflected on both the list and detail pages
