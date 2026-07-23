// DTO (couche contracts) : schéma zod de l'export de données personnelles d'un
// utilisateur (RGPD art. 15 « accès » + art. 20 « portabilité »). Un seul appel
// authentifié, limité à soi-même, renvoie TOUTES les catégories de données que la
// plateforme détient sur l'utilisateur, dans un unique document JSON portable.
import { z } from "../zod";

// Chaque ligne est volontairement en passthrough (`z.record`) plutôt que le DTO de
// réponse du domaine concerné : l'export est un dump fidèle de ce qui est stocké, il
// ne doit donc ni écarter en silence des champs qu'un schéma plus strict omettrait,
// ni échouer à la validation si une ligne stockée précède un changement de schéma.
// Seuls les secrets (hash du mot de passe, secret TOTP) sont retirés, et cela se fait
// dans le cas d'usage avant sérialisation.
const Row = z.record(z.string(), z.unknown());

/** Document d'export RGPD : agrège toutes les catégories de données personnelles de l'utilisateur (profil, annonces, contrats, points, événements, votes, signalements, messagerie, notifications, sessions, graphe Neo4j). */
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
