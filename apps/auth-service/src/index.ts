import "./load-env.js"; // must be first: loads .env before any module reads process.env
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express, { type Application, type RequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createExpressEndpoints } from "@ts-rest/express";
import { authContract } from "@repo/contracts";

import { authRouter } from "./routes/auth/auth.router.js";
import { jwksHandler } from "./routes/jwks.route.js";
import { errorHandler, NotFoundError } from "./middleware/error-handler.js";
import { connectDB, closeDB } from "./repositories/mongodb.connector.js";
import { initContainer } from "./repositories/container.js";
import { initKeys } from "./keys.js";
import { setupGracefulShutdown } from "./shutdown.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:4000,http://localhost:5000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app: Application = express();
const port = Number(process.env.PORT) || 3001;

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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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

    const server = app.listen(port, () => {
      const localUrl = `http://localhost:${port}`;

      console.log("");
      console.log(" 🔐  Auth Service Running !");
      console.log("");
      console.log(` ➜  Local:   \x1b[36m${localUrl}\x1b[0m`);
      console.log(` ➜  Login:   \x1b[36m${localUrl}/login\x1b[0m`);
      console.log(` ➜  Register:\x1b[36m${localUrl}/register\x1b[0m`);
      console.log(` ➜  JWKS:    \x1b[36m${localUrl}/.well-known/jwks.json\x1b[0m`);
      console.log("");
      console.log(`\x1b[33m⚡ Ready to accept connections\x1b[0m`);
    });
    setupGracefulShutdown(server, closeDB);
  })
  .catch((err) => {
    console.error("Failed to start auth-service:", err);
    process.exit(1);
  });
