// Dev-only auth bypasses, driven by env. Hard-gated to non-production: even if a
// flag is set, it has no effect when NODE_ENV === "production". Read lazily so a
// .env loaded at startup (see load-env.ts) is always picked up.
const truthy = (value: string | undefined): boolean => value === "true" || value === "1";

const devOnly = (): boolean => process.env.NODE_ENV !== "production";

/** Skip the "email not verified" gate at login and auto-verify new registrations. */
export const skipEmailVerification = (): boolean => devOnly() && truthy(process.env.AUTH_DEV_SKIP_EMAIL_VERIFICATION);

/** Skip the TOTP/MFA challenge at login even for users who enabled it. */
export const skipTotp = (): boolean => devOnly() && truthy(process.env.AUTH_DEV_SKIP_TOTP);
