/**
 * Redirect-URI policy for the desktop app's authorization-code flow (RFC 8252).
 *
 * This is the open-redirect boundary: whatever passes here is a URL the authorize
 * endpoint will send the browser to, carrying an authorization code. It is a
 * whitelist of shapes, not a blacklist.
 *
 * The port is deliberately unconstrained. A native app cannot reserve a fixed port
 * (it may already be taken), so RFC 8252 §7.3 requires accepting any port on the
 * loopback interface — CallbackServer binds 127.0.0.1:0 and takes whatever the OS
 * gives it. An exact-match allowlist of URIs, the usual OAuth answer, cannot work here.
 *
 * Residual risk, inherent to the pattern: any local process can bind a loopback port,
 * so a hostile app on the same machine can register itself as the callback and race
 * for the code. PKCE is what makes an intercepted code useless — which is why the
 * challenge is mandatory rather than optional in this flow.
 */

/** The one path the desktop callback server serves (CallbackServer.java). */
export const CALLBACK_PATH = "/callback";

/**
 * `URL.hostname` returns IPv6 literals *with* brackets, so the v6 loopback must be
 * matched as "[::1]" — a bare "::1" comparison silently never matches, which is the
 * bug the old login-page `isLoopback` shipped with.
 *
 * `localhost` is deliberately absent. RFC 8252 §8.3 prefers literal IPs because
 * `localhost` goes through name resolution and can be repointed by hosts-file or
 * DNS tampering on a compromised machine. The Java client already emits 127.0.0.1,
 * so refusing `localhost` costs it nothing.
 */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "[::1]"]);

/** Bounds the work done on an attacker-supplied string before it is parsed. */
const MAX_LENGTH = 512;

export const isAllowedLoopbackRedirect = (raw: string): boolean => {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  // Plain http only: loopback is exempt from TLS, and we never issue an https callback.
  if (url.protocol !== "http:") return false;

  // Parsed, not raw — the URL parser normalises octal/decimal IP spellings
  // (0177.0.0.1 -> 127.0.0.1), so obfuscated forms cannot smuggle a different host past this.
  if (!LOOPBACK_HOSTS.has(url.hostname)) return false;

  // Fixed path, exact match — no prefix matching, no traversal.
  if (url.pathname !== CALLBACK_PATH) return false;

  // No pre-seeded query/fragment (they would collide with the code/state we append),
  // and no userinfo (the "http://evil.com@127.0.0.1/" confusion trick).
  if (url.search !== "" || url.hash !== "" || url.username !== "" || url.password !== "") return false;

  // Any port, including none (implicit :80). URL rejects out-of-range ports at parse
  // time, so reaching here means the port is either absent or a valid 1-65535.
  return true;
};
