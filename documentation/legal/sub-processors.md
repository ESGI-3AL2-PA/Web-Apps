# Sub-processors & International Transfers (Art. 28 / 44) — Connected NeighBours

> **⚠️ DRAFT — REQUIRES LEGAL REVIEW.** Provisional list from a code audit. Every processor needs a signed
> **Data Processing Agreement (Art. 28)**, and every non-EU transfer needs a documented **transfer
> mechanism (Art. 44+)**. Confirm hosting regions marked `[FLAG]`.

## Sub-processors

| Processor     | Service                                                              | Data processed                                  | Location                                              | Transfer mechanism                      | DPA                       | Status                    |
| ------------- | -------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- | --------------------------------------- | ------------------------- | ------------------------- |
| **Resend**    | Transactional email (verification, notifications)                    | Recipient email, email content                  | **United States**                                     | **Required — SCCs / adequacy** `[FLAG]` | `[PLACEHOLDER — DPA ref]` | ⚠️ US transfer to resolve |
| **Documenso** | E-signature                                                          | Contract data, signer name/address, signed PDFs | Self-hosted `[FLAG — confirm EU/EEA region]`          | N/A if EU-hosted                        | Self-hosted (internal)    | Confirm region            |
| **MinIO**     | Object storage (message media, listing/incident images, signed PDFs) | Media files, PDFs (may contain PII)             | Self-hosted `[FLAG — confirm EU/EEA region]`          | N/A if EU-hosted                        | Self-hosted (internal)    | Confirm region            |
| **MongoDB**   | Primary datastore                                                    | All account & content data                      | Self-hosted `[FLAG — confirm region / whether Atlas]` | N/A if EU-hosted                        | Confirm if managed        | Confirm                   |
| **Neo4j**     | Recommendation graph                                                 | Derived member relationships                    | Self-hosted `[FLAG — confirm region / whether Aura]`  | N/A if EU-hosted                        | Confirm if managed        | Confirm                   |

## International-transfer note (Art. 44+)

- **Resend (US):** email delivery is a transfer to the United States. This requires an appropriate
  safeguard — **Standard Contractual Clauses** and/or reliance on the processor's certification under the
  EU–US Data Privacy Framework. **[FLAG]** Record the exact mechanism and Resend's DPA reference, and add
  a transfer-impact assessment if relying on SCCs.
- **Self-hosted services (Documenso, MinIO, MongoDB, Neo4j):** no transfer occurs **provided they are
  hosted in the EU/EEA**. Confirm and document the hosting region for each. If any is hosted (or backed
  up) outside the EEA, treat it as a transfer and apply the same analysis as Resend.

## Actions

- [ ] Sign/record an Art. 28 DPA with Resend; capture SCC/DPF transfer basis. `[FLAG]`
- [ ] Confirm and document EU/EEA hosting for Documenso, MinIO, MongoDB, Neo4j. `[FLAG]`
- [ ] Re-audit this list whenever a new third-party service is integrated.
