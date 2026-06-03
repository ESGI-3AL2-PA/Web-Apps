import { authenticator } from "otplib";

// otplib's authenticator default time step (seconds). `authenticator.options.step` is only set if
// it has been explicitly customised, so fall back to the library default of 30.
const TOTP_STEP_SECONDS = authenticator.options.step ?? 30;

/**
 * Verify a TOTP code and return the absolute time-step it corresponds to (the TOTP counter),
 * or null if the code is invalid. The step lets callers reject replay of an already-consumed code
 * within its validity window: `checkDelta` returns how many steps the matching code is offset from
 * "now" (0 for the current window, ±1 if a look-around window is configured).
 */
export const verifyTotpStep = (code: string, secret: string): number | null => {
  const delta = authenticator.checkDelta(code, secret);
  if (delta === null) return null;
  return Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS) + delta;
};
