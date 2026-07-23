// DTO (couche contracts) : schémas zod de l'utilisateur. Expose la vue de réponse
// (profil + rôle + quartier + solde + flags de sécurité), la création, la mise à jour
// (avec confirmation de mot de passe), le bannissement, la résolution de quartier par
// géocodage et les schémas de listing/params.
import { z } from "../zod";
import { StrongPasswordSchema } from "./password.schema";

/** Rôles applicatifs. `admin` = administrateur d'un quartier ; `superAdmin` = accès global. */
export const UserRoleSchema = z.enum(["user", "admin", "superAdmin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

/** Langue de préférence (emails transactionnels), fr par défaut. */
export const LangSchema = z.enum(["fr", "en"]);
export type Lang = z.infer<typeof LangSchema>;

/** Utilisateur renvoyé par l'API. `adminDistrictId` n'est peuplé (au login/userinfo) que pour un admin de quartier ; `balance` est le solde de points. */
export const UserResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique user identifier" }),
    email: z.string().email().openapi({ description: "User's email address", example: "john.doe@example.com" }),
    firstName: z.string().openapi({ description: "User's first name", example: "John" }),
    lastName: z.string().openapi({ description: "User's last name", example: "Doe" }),
    phone: z.string().optional().openapi({ description: "User's phone number", example: "0612345678" }),
    role: UserRoleSchema.openapi({ description: "Role in the system" }),
    address: z.string().optional().openapi({ description: "User's address" }),
    districtId: z.string().optional().openapi({ description: "ID of the district the user belongs to" }),
    adminDistrictId: z
      .string()
      .nullable()
      .optional()
      .openapi({ description: "District this user administers (admin role only). Populated on login/userinfo." }),
    balance: z.number().int().openapi({ description: "User balance in tokens" }),
    banned: z.boolean().optional().openapi({ description: "Whether the account is banned (blocked from logging in)" }),
    emailVerified: z.boolean().openapi({ description: "Whether the email has been verified" }),
    totpEnabled: z.boolean().openapi({ description: "Whether the user has TOTP MFA enabled" }),
    lang: LangSchema.optional().openapi({
      description: "Preferred language for transactional emails (defaults to fr)",
    }),
    createdAt: z.string().datetime().openapi({ description: "Creation timestamp" }),
    updatedAt: z.string().datetime().openapi({ description: "Last update timestamp" }),
  })
  .openapi({ title: "UserResponse" });
export type UserResponseDto = z.infer<typeof UserResponseDtoSchema>;

/** Corps d'inscription : identité, email, mot de passe fort (min 12 car. maj/min/chiffre/symbole) et adresse (servant à rattacher un quartier). */
export const CreateUserDtoSchema = z
  .object({
    firstName: z.string().min(1).max(100).openapi({ description: "User's first name", example: "John" }),
    lastName: z.string().min(1).max(100).openapi({ description: "User's last name", example: "Doe" }),
    email: z.string().email().openapi({ description: "User's email address", example: "john.doe@example.com" }),
    phone: z.string().optional().openapi({ description: "User's phone number", example: "0612345678" }),
    password: StrongPasswordSchema.openapi({
      description: "Min 12 chars with upper, lower, digit, and symbol",
    }),
    address: z.string().openapi({ description: "User's address", example: "12 Rue de la Paix, Paris" }),
    lang: LangSchema.optional().openapi({
      description: "Preferred language for transactional emails (defaults to fr)",
    }),
  })
  .openapi({ title: "CreateUser" });
export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>;

/** Corps de mise à jour partielle du profil ; `currentPassword` requis dès qu'on définit `newPassword` (voir le refine plus bas). */
export const UpdateUserDtoSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional().openapi({ description: "User's first name", example: "John" }),
    lastName: z.string().min(1).max(100).optional().openapi({ description: "User's last name", example: "Doe" }),
    email: z
      .string()
      .email()
      .optional()
      .openapi({ description: "User's email address", example: "john.doe@example.com" }),
    phone: z.string().optional().openapi({ description: "User's phone number", example: "0612345678" }),
    currentPassword: z
      .string()
      .optional()
      .openapi({ description: "Current password — required only when changing newPassword" }),
    newPassword: StrongPasswordSchema.optional().openapi({
      description: "New password — min 12 chars with upper, lower, digit, and symbol",
    }),
    address: z.string().optional().openapi({ description: "User's address", example: "12 Rue de la Paix, Paris" }),
    lang: LangSchema.optional().openapi({ description: "Preferred language for transactional emails" }),
  })
  // Changer le mot de passe exige de fournir l'actuel : `newPassword` sans
  // `currentPassword` échoue la validation, l'erreur étant rattachée à ce champ.
  .refine((data) => !data.newPassword || !!data.currentPassword, {
    message: "currentPassword is required when setting newPassword",
    path: ["currentPassword"],
  })
  .openapi({ title: "UpdateUser" });
export type UpdateUserDto = z.infer<typeof UpdateUserDtoSchema>;

/** Corps de bannissement : `banned` true bloque la connexion, false lève le ban. */
export const BanUserDtoSchema = z
  .object({
    banned: z.boolean().openapi({ description: "true to ban (block login), false to lift the ban" }),
  })
  .openapi({ title: "BanUser" });
export type BanUserDto = z.infer<typeof BanUserDtoSchema>;

// Quartier choisi (optionnel) — envoyé lorsque l'adresse de l'appelant tombe dans
// plusieurs quartiers qui se chevauchent et qu'il désigne lequel rejoindre.
/** Corps de résolution de quartier : `districtId` optionnel pour départager plusieurs quartiers couvrant l'adresse. */
export const ResolveDistrictRequestDtoSchema = z
  .object({
    districtId: z.string().optional().openapi({ description: "District to join when several contain the address" }),
  })
  .openapi({ title: "ResolveDistrictRequest" });
export type ResolveDistrictRequestDto = z.infer<typeof ResolveDistrictRequestDtoSchema>;

// Re-géocodage de l'adresse stockée de l'appelant puis rattachement au quartier qui
// la contient.
// - resolved:true  => rattaché (le client réhydrate son utilisateur via /auth/userinfo)
// - resolved:false avec candidates.length > 1 => l'adresse est dans plusieurs quartiers ;
//   l'appelant doit rappeler en fournissant un districtId choisi
// - resolved:false avec candidates vide => aucun quartier ne couvre encore l'adresse
// candidates a volontairement une forme minimale {id,name} : imbriquer ici le
// DistrictResponse (qui a un `title`) déclenche le contrôle de titres dupliqués de
// @ts-rest/open-api.
/** Réponse de résolution de quartier : `resolved` indique si un rattachement a eu lieu, `candidates` liste les quartiers à départager sinon. */
export const ResolveDistrictResponseDtoSchema = z
  .object({
    resolved: z.boolean().openapi({ description: "Whether a district was found and joined" }),
    candidates: z
      .array(z.object({ id: z.string(), name: z.string() }))
      .openapi({ description: "Districts containing the address when a choice is required" }),
  })
  .openapi({ title: "ResolveDistrictResponse" });
export type ResolveDistrictResponseDto = z.infer<typeof ResolveDistrictResponseDtoSchema>;

/** Param de route : identifiant de l'utilisateur ciblé. */
export const UserParamsDtoSchema = z
  .object({
    id: z.string(),
  })
  .openapi({ title: "UserParams" });
export type UserParamsDto = z.infer<typeof UserParamsDtoSchema>;

/** Query de listing des utilisateurs : pagination, recherche texte et filtres par quartier de résidence et par rôle. */
export const UserQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional(),
    districtId: z.string().optional().openapi({ description: "Filter users by their residence district" }),
    role: z.enum(["user", "admin", "superAdmin"]).optional().openapi({ description: "Filter users by role" }),
  })
  .openapi({ title: "UserQuery" });
export type UserQueryDto = z.infer<typeof UserQueryDtoSchema>;
