import { z } from "../zod";

// GDPR Art. 15 (access) + Art. 20 (portability): the canonical, server-side data
// export. One authenticated self-scoped call returns EVERY category of personal data
// the platform holds for the user, in a single portable JSON document.
//
// Rows are intentionally passthrough (`z.record`) rather than each domain's response
// DTO: the export is a faithful dump of what is stored, so it must not silently drop
// fields a stricter response schema would omit, and it must not fail validation if a
// stored row predates a schema change. Secrets (password hash, TOTP secret) are the
// only fields stripped, and that happens in the use-case before serialization.
const Row = z.record(z.string(), z.unknown());

export const UserDataExportResponseDtoSchema = z
  .object({
    exportedAt: z.string().datetime().openapi({ description: "When this export was generated" }),
    user: Row.nullable().openapi({ description: "The user record (PII), minus password hash and TOTP secret" }),
    listings: z.array(Row).openapi({ description: "Listings the user authored" }),
    contractsAsProvider: z.array(Row).openapi({ description: "Contracts where the user is the provider" }),
    contractsAsBeneficiary: z.array(Row).openapi({ description: "Contracts where the user is the beneficiary" }),
    transactions: z.array(Row).openapi({ description: "Escrow / point ledger entries for the user" }),
    events: z.array(Row).openapi({ description: "Events the user created" }),
    votes: z.array(Row).openapi({ description: "Votes the user created" }),
    incidents: z.array(Row).openapi({ description: "Incidents the user reported" }),
    conversations: z.array(Row).openapi({ description: "Conversations the user participates in" }),
    messages: z.array(Row).openapi({ description: "Messages in the user's conversations (free text + media URLs)" }),
    notifications: z.array(Row).openapi({ description: "Notifications addressed to the user" }),
    sessions: z
      .array(Row)
      .openapi({ description: "Refresh-token session history (IP / User-Agent / timestamps), from auth-service" }),
    graph: z
      .object({
        nodes: z.array(Row),
        relationships: z.array(Row),
      })
      .nullable()
      .openapi({ description: "Neo4j graph edges touching the user (LIVES_IN address, social KNOWS, domain edges)" }),
  })
  .openapi({ title: "UserDataExportResponse" });
export type UserDataExportResponseDto = z.infer<typeof UserDataExportResponseDtoSchema>;
