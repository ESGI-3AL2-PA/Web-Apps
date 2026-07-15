# Data Retention Schedule — Connected NeighBours

> **⚠️ DRAFT — REQUIRES LEGAL REVIEW.** All durations below are **proposals** aligned with common CNIL
> guidance and French legal obligations. Confirm each one — especially the accounting/legal-obligation
> carve-outs — with counsel before enforcing them in code (TTL indexes, purge jobs).

| Dataset                                                       | Proposed retention                                    | Basis / trigger                                                    | Notes                                                                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Active account (identity, profile)                            | Life of the account                                   | Contract                                                           | Erased on account deletion, subject to carve-outs below.                                                |
| Account after deletion request                                | **30-day** grace, then erasure                        | Contract / good practice                                           | Grace window to allow recovery / abuse handling. `[confirm]`                                            |
| Inactive account                                              | Erasure/anonymisation after **3 years** of inactivity | CNIL guidance                                                      | Requires an inactivity definition + reminder email. `[confirm]`                                         |
| Password hash (argon2)                                        | With the account                                      | Contract                                                           | Never stored in clear; irreversible hash.                                                               |
| TOTP secret                                                   | Until 2FA disabled or account deleted                 | Security                                                           | —                                                                                                       |
| **Session logs (refresh tokens: IP, User-Agent, timestamps)** | **12 months**                                         | CNIL security-log guidance                                         | Mongo TTL already exists on token expiry; add a separate purge for the security-log fields. `[confirm]` |
| Messages & media (image/audio/file)                           | Until account or content deletion                     | Contract                                                           | Media in MinIO must be purged alongside the DB rows.                                                    |
| Listings & listing images                                     | Until deleted/expired + `[confirm]`                   | Contract                                                           | Expired listings: define an archival/erasure delay.                                                     |
| Events & registrant lists                                     | Until event completion + `[confirm]`                  | Contract / legit-int                                               | —                                                                                                       |
| Votes / poll responses                                        | Until poll closed + `[confirm]`                       | Contract / legit-int                                               | Confirm whether responses are anonymised after closing.                                                 |
| Incidents & photos                                            | Until resolution + `[confirm]`                        | Contract / legit-int                                               | Status history is part of the record.                                                                   |
| Notifications                                                 | Rolling window `[confirm]`                            | Legit-int                                                          | Low value long-term; propose 6–12 months.                                                               |
| **Completed contracts + signed PDFs**                         | **10 years**                                          | **Legal obligation (accounting/commercial), Art. 17(3) carve-out** | See M4 note below. `[confirm exact obligation + duration]`                                              |
| **Points transaction ledger**                                 | **10 years**                                          | **Legal obligation (accounting)**                                  | Kept even after account deletion. `[confirm]`                                                           |
| Backups                                                       | Rolling **[PLACEHOLDER]** days                        | Security / continuity                                              | Define max backup age; document that erasure propagates on the next backup cycle.                       |

## M4 — Retention basis for completed contracts & Documenso PDFs

A completed contract and its **signed PDF** are commercial/accounting records. Under French law they are
kept to satisfy a **legal obligation** (commercial documents / accounting supporting documents — commonly
**10 years**; the exact article and duration must be confirmed by counsel). This is the **Art. 17(3)(b)
GDPR exception** to the right to erasure: we may refuse to erase these documents for the duration of the
obligation.

**Residual PII in PDFs:** signed PDFs generated by Documenso embed **name, address and price**. This
PII therefore persists for the full retention period even if the underlying account is deleted, and
lives in both Documenso and MinIO. Implications to document/act on:

- The privacy policy and erasure-request handling must state that these PDFs are **retained** despite an
  erasure request, with the legal-obligation justification.
- Access to archived PDFs must be **restricted** (they are no longer needed for active service, only for
  the legal obligation).
- When the obligation period lapses, PDFs must be **erased from both Documenso and MinIO**.

`[confirm: exact legal obligation, duration, and the erasure job that runs at end-of-period]`
