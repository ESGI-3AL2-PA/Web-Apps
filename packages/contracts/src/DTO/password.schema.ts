import { z } from "../zod";

// Min 12 chars with at least one lowercase, uppercase, digit, and symbol.
// Login uses a looser min(8) so existing accounts can still authenticate.
export const StrongPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .refine((v) => /[a-z]/.test(v), "Password must contain a lowercase letter")
  .refine((v) => /[A-Z]/.test(v), "Password must contain an uppercase letter")
  .refine((v) => /\d/.test(v), "Password must contain a digit")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Password must contain a symbol");
