# Data Breach Response Runbook (Art. 33 / 34) — Connected NeighBours

> **⚠️ DRAFT — REQUIRES LEGAL REVIEW.** Internal operational runbook. Fill in the contact names and the
> supervisory-authority portal link before this is usable in an incident. Not legal advice.

## Purpose

Define how Connected NeighBours detects, assesses, contains and notifies a **personal-data breach** — a
breach of security leading to accidental or unlawful destruction, loss, alteration, unauthorised
disclosure of, or access to personal data. The GDPR clock is **72 hours** from the moment we become
**aware** of a breach (Art. 33).

## Contacts (fill in)

| Role                           | Name                       | Contact                                                         |
| ------------------------------ | -------------------------- | --------------------------------------------------------------- |
| Security lead / on-call        | [PLACEHOLDER]              | [PLACEHOLDER]                                                   |
| Data controller decision-maker | [PLACEHOLDER]              | [PLACEHOLDER]                                                   |
| DPO / privacy contact          | [PLACEHOLDER: DPO_CONTACT] | —                                                               |
| Supervisory authority (France) | CNIL                       | Notification portal: [PLACEHOLDER — notifications.cnil.fr link] |

## Step 1 — Detect & record (immediately)

- Log the moment of discovery (this starts the 72-hour clock).
- Open an incident ticket. Capture: what was observed, systems affected (MongoDB, Neo4j, MinIO,
  Documenso, Resend, auth-service, api), and who is involved.

## Step 2 — Contain (hours 0–4)

- Stop the bleeding: revoke compromised credentials/keys, invalidate sessions (refresh-token families),
  rotate secrets (JWT keys, API keys), isolate affected services.
- Preserve evidence/logs before making changes where possible.

## Step 3 — Assess risk (hours 0–24)

Determine the categories and volume of data involved and the risk to individuals. High-sensitivity data
in this app includes: **password hashes, TOTP secrets, IP/User-Agent session logs, message content and
media, home addresses, and signed contract PDFs (name/address/price)**.

Decide two things:

1. **Notify the CNIL?** Required unless the breach is **unlikely to result in a risk** to individuals
   (Art. 33). When in doubt, notify.
2. **Notify individuals?** Required if the breach is likely to result in a **high risk** (Art. 34).

## Step 4 — Notify the CNIL (within 72 hours)

If notifiable, submit via the CNIL portal within 72 hours of awareness (a partial/phased notification is
allowed if full details are not yet available). Include: nature of the breach, categories and approximate
number of individuals/records, likely consequences, measures taken/proposed, and the DPO contact.

## Step 5 — Notify affected individuals (if high risk)

Communicate in clear language, without undue delay: what happened, likely consequences, measures taken,
and what they should do (e.g. reset password, review sessions). Coordinate wording with counsel.

## Step 6 — Record & learn (always)

- Record **every** breach in an internal register (even non-notifiable ones) — Art. 33(5) requires it.
- Post-incident review: root cause, remediation, and preventive actions.

## Internal breach register (template)

| Date discovered | Description | Data affected | Risk assessment | CNIL notified? (date) | Individuals notified? (date) | Remediation |
| --------------- | ----------- | ------------- | --------------- | --------------------- | ---------------------------- | ----------- |
|                 |             |               |                 |                       |                              |             |
