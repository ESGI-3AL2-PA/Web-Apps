import "./load-env.js"; // must be first: loads .env before any module reads process.env
import path from "path";
import fs from "fs";
import { timingSafeEqual } from "crypto";
import { fileURLToPath } from "url";
import express, { type Application, type RequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createExpressEndpoints } from "@ts-rest/express";
import { authContract } from "@repo/contracts";

import { authRouter } from "./routes/auth/auth.router.js";
import { jwksHandler } from "./routes/jwks.router.js";
import { errorHandler, NotFoundError } from "./middleware/error-handler.js";
import { connectDB, closeDB, pingDB } from "./repositories/mongodb.connector.js";
import { initContainer, resolve } from "./repositories/container.js";
import { MongoRefreshTokenRepository } from "./repositories/RefreshToken/refresh-token.repository.mongo.js";
import type { IRefreshTokenRepository } from "./repositories/RefreshToken/refresh-token.repository.js";
import { initKeys } from "./keys.js";
import { setupGracefulShutdown } from "./shutdown.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:4000,http://localhost:5000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app: Application = express();
const port = Number(process.env.AUTH_PORT ?? process.env.PORT) || 3001;

// Behind a reverse proxy/LB, set TRUST_PROXY (e.g. "1" for one hop) so
// express-rate-limit keys on the real client IP. Left unset by default so a
// directly-exposed instance can't be fooled by spoofed X-Forwarded-For headers.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === "true" ? true : trustProxy);
}

// Security headers. CSP allows the inline script/style on the login & register
// pages while forbidding framing (clickjacking) and plugins.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
  }),
);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser() as RequestHandler);

// Liveness: cheap, dependency-free. Answers "is the process up?" — used to decide
// whether to restart the container. Must stay static so a slow/down DB never trips it.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness: "can this instance serve traffic?" — pings Mongo so the LB can pull a
// node with a dead DB out of rotation. Mongo is required for every auth flow, so its
// failure returns 503.
app.get("/readyz", async (_req, res) => {
  let mongoOk = true;
  try {
    await pingDB();
  } catch (err) {
    mongoOk = false;
    console.error("[readyz] mongo ping failed:", err);
  }
  res.status(mongoOk ? 200 : 503).json({
    status: mongoOk ? "ok" : "unavailable",
    checks: { mongo: mongoOk ? "ok" : "down" },
    timestamp: new Date().toISOString(),
  });
});

// Login & register pages — inject the trusted-redirect-origin allowlist into the page
const renderPage = (pagePath: string) => {
  const html = fs.readFileSync(pagePath, "utf-8");
  return html.replace("__ALLOWED_REDIRECT_ORIGINS__", JSON.stringify(allowedOrigins));
};
const loginHtml = renderPage(path.join(__dirname, "login-page", "index.html"));
const registerHtml = renderPage(path.join(__dirname, "register-page", "index.html"));

app.get("/login", (_req, res) => {
  res.type("html").send(loginHtml);
});
app.get("/register", (_req, res) => {
  res.type("html").send(registerHtml);
});

// JWKS endpoint
app.get("/.well-known/jwks.json", jwksHandler);

// Internal service-to-service endpoint (not part of the ts-rest contract, not behind
// user auth). Guarded by a shared secret in X-Internal-Token. The api calls this after
// deleting a user so their refresh-token rows (incl. IP/User-Agent history) are erased.
const internalTokenValid = (provided: string | undefined): boolean => {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch — length-check first, still constant-time
  // for equal-length inputs (the only case an attacker controls once past this guard).
  return a.length === b.length && timingSafeEqual(a, b);
};

app.post("/internal/sessions/purge", (req, res) => {
  if (!internalTokenValid(req.header("x-internal-token"))) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const userId = (req.body as { userId?: unknown } | undefined)?.userId;
  if (typeof userId !== "string" || userId.length === 0) {
    res.status(400).json({ message: "userId is required" });
    return;
  }
  // Annotate as the interface so the (never-typed) resolve() result is callable.
  const refreshTokenRepo: IRefreshTokenRepository = resolve("refreshToken");
  refreshTokenRepo
    .deleteAllForUser(userId)
    .then(() => res.status(204).end())
    .catch((err) => {
      console.error("Failed to purge sessions for user:", err);
      res.status(500).json({ message: "Failed to purge sessions" });
    });
});

// GDPR Art. 15/20 export counterpart to the purge above: the api aggregates a user's
// full data export and calls this to fold in the refresh-token session history (IP /
// User-Agent / timestamps) it doesn't own. Same shared-secret guard. Token hashes are
// stripped — they're secrets, never part of the subject's personal data.
app.post("/internal/sessions/export", (req, res) => {
  if (!internalTokenValid(req.header("x-internal-token"))) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const userId = (req.body as { userId?: unknown } | undefined)?.userId;
  if (typeof userId !== "string" || userId.length === 0) {
    res.status(400).json({ message: "userId is required" });
    return;
  }
  const refreshTokenRepo: IRefreshTokenRepository = resolve("refreshToken");
  refreshTokenRepo
    .listAllForUser(userId)
    .then((sessions) => {
      const sanitized = sessions.map(({ tokenHash: _tokenHash, ...rest }) => rest);
      res.status(200).json({ sessions: sanitized });
    })
    .catch((err) => {
      console.error("Failed to export sessions for user:", err);
      res.status(500).json({ message: "Failed to export sessions" });
    });
});

// Rate limits — mounted before the ts-rest handlers so they run first.
// In-memory store: fine for single-instance, swap for Redis if scaled.
const limiterMessage = { message: "Too many requests — try again later" };
app.use(
  "/auth/login",
  rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/register",
  rateLimit({ windowMs: 60_000, limit: 3, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/refresh",
  rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/resend-verification",
  rateLimit({ windowMs: 60_000, limit: 3, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/verify",
  rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/forgot-password",
  rateLimit({ windowMs: 60_000, limit: 3, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/reset-password",
  rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/login/mfa",
  rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/totp",
  rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/sessions",
  rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);

// Auth endpoints (ts-rest)
createExpressEndpoints({ ...authContract }, { ...authRouter }, app);

app.use((_req, _res, next) => {
  next(new NotFoundError());
});

app.use(errorHandler);

connectDB()
  .then(async (db) => {
    initContainer(db);
    await initKeys();

    // Best-effort: ensure the refresh-token TTL index exists so expired sessions
    // self-purge, then backfill `expiresAtDate` on legacy rows that predate the field
    // (GDPR storage-limitation, finding gdpr-H3) so the TTL actually reaps them. Never
    // block boot on either — log and continue if they fail. Built directly from `db`
    // (not via resolve) since the repo is a stateless wrapper.
    const refreshTokenRepo = new MongoRefreshTokenRepository(db);
    await refreshTokenRepo
      .ensureIndexes()
      .then(() => refreshTokenRepo.backfillMissingExpiresAtDate())
      .then((backfilled) => {
        if (backfilled > 0) console.warn(`Backfilled expiresAtDate on ${backfilled} legacy refresh-token row(s).`);
      })
      .catch((err) => console.error("Failed to ensure/backfill refresh-token indexes:", err));

    const server = app.listen(port, () => {
      const localUrl = `http://localhost:${port}`;

      console.warn("");
      console.warn(" 🔐  Auth Service Running !");
      console.warn("");
      console.warn(` ➜  Local:   \x1b[36m${localUrl}\x1b[0m`);
      console.warn(` ➜  Login:   \x1b[36m${localUrl}/login\x1b[0m`);
      console.warn(` ➜  Register:\x1b[36m${localUrl}/register\x1b[0m`);
      console.warn(` ➜  JWKS:    \x1b[36m${localUrl}/.well-known/jwks.json\x1b[0m`);
      console.warn("");
      console.warn(`\x1b[33m⚡ Ready to accept connections\x1b[0m`);
    });
    setupGracefulShutdown(server, closeDB);
  })
  .catch((err) => {
    console.error("Failed to start auth-service:", err);
    process.exit(1);
  });
