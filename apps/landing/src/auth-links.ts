import { config } from "@repo/config";

// The auth-service serves the /login and /register HTML pages and honours a
// ?redirect_uri that it validates against its allowlist. We send freshly
// authenticated visitors straight into the product (user-front), which is
// already an allowlisted origin — so no auth-service config change is needed.
const redirect = encodeURIComponent(config.appUrl);

export const loginUrl = `${config.authServiceUrl}/login?redirect_uri=${redirect}`;
export const registerUrl = `${config.authServiceUrl}/register?redirect_uri=${redirect}`;
