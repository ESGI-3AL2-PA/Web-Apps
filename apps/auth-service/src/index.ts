/**
 * Point d'entrée de l'auth-service (Express + ts-rest, port 3001).
 *
 * Assemble et démarre le serveur : logging pino, en-têtes de sécurité (helmet/CSP),
 * CORS, health/readiness, pages HTML servies (login/register/verify/reset), endpoints
 * internes service-à-service (purge/export de sessions), rate limits par route, SSO
 * desktop (PKCE), puis les handlers ts-rest du contrat auth. Au boot : connexion Mongo,
 * init des clés RS256, création best-effort des index TTL, écoute et arrêt gracieux.
 */
import "@repo/shared/load-env"; // doit être en premier : charge .env avant que tout module lise process.env
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
import { pinoHttp } from "pino-http";
import { authContract } from "@repo/contracts";
import { logger } from "./logger.js";

import { authRouter } from "./routes/auth/auth.router.js";
import { jwksHandler } from "./routes/jwks.router.js";
import { desktopSsoRouter } from "./routes/desktop-sso.router.js";
import { errorHandler, NotFoundError } from "./middleware/error-handler.js";
import { connectDB, closeDB, pingDB } from "./repositories/mongodb.connector.js";
import { initContainer, resolve } from "./repositories/container.js";
import { MongoRefreshTokenRepository } from "./repositories/RefreshToken/refresh-token.repository.mongo.js";
import { MongoAuthorizationCodeRepository } from "./repositories/AuthorizationCode/authorization-code.repository.mongo.js";
import type { IRefreshTokenRepository } from "./repositories/RefreshToken/refresh-token.repository.js";
import { initKeys } from "./keys.js";
import { setupGracefulShutdown } from "@repo/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:4000,http://localhost:5000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// URL de base du user-front — où sont redirigés les utilisateurs vérifiés (via /login?redirect_uri=…).
const appUrl = process.env.VITE_APP_URL ?? "http://localhost:5000";

const app: Application = express();
const port = Number(process.env.AUTH_PORT ?? process.env.PORT) || 3001;

// Derrière un reverse proxy / load balancer, définir TRUST_PROXY (ex. "1" pour un saut)
// pour qu'express-rate-limit se base sur la vraie IP client. Non défini par défaut afin
// qu'une instance exposée directement ne soit pas trompée par des X-Forwarded-For falsifiés.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === "true" ? true : trustProxy);
}

// Log d'accès par requête + identifiant de corrélation (req.id, exposé via le logger
// enfant req.log). Monté en premier pour que chaque requête soit journalisée.
app.use(
  pinoHttp({
    logger,
    // Purge les données personnelles des logs de requête (RGPD art. 32) : sans ça, le
    // sérialiseur par défaut enregistrerait l'IP client et les en-têtes Cookie /
    // Authorization (Bearer) à chaque requête.
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.remoteAddress",
        "req.remotePort",
        'res.headers["set-cookie"]',
      ],
      censor: "[redacted]",
    },
  }),
);

// En-têtes de sécurité. La CSP autorise le script/style inline des pages login &
// register plus l'appel d'autocomplétion d'adresse de la page register vers la BAN
// française (api-adresse.data.gouv.fr), tout en interdisant le framing (clickjacking)
// et les plugins.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "https://api-adresse.data.gouv.fr"],
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
    // X-Step-Up-Token est rejoué lors de la désactivation TOTP (le front appelle l'auth-service directement).
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Step-Up-Token"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser() as RequestHandler);

// Liveness : peu coûteux, sans dépendance. Répond « le process tourne-t-il ? » — sert à
// décider s'il faut redémarrer le conteneur. Doit rester statique pour qu'une DB lente
// ou HS ne le fasse jamais échouer.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness : « cette instance peut-elle servir du trafic ? » — ping Mongo pour que le
// load balancer sorte de rotation un nœud à DB morte. Mongo est requise pour tout flux
// d'auth, donc son échec renvoie 503.
app.get("/readyz", async (_req, res) => {
  let mongoOk = true;
  try {
    await pingDB();
  } catch (err) {
    mongoOk = false;
    logger.error({ err }, "[readyz] mongo ping failed");
  }
  res.status(mongoOk ? 200 : 503).json({
    status: mongoOk ? "ok" : "unavailable",
    checks: { mongo: mongoOk ? "ok" : "down" },
    timestamp: new Date().toISOString(),
  });
});

// Pages login & register — injecte dans la page l'allowlist des origines de redirection de confiance.
const renderPage = (pagePath: string) => {
  const html = fs.readFileSync(pagePath, "utf-8");
  return html
    .replace("__ALLOWED_REDIRECT_ORIGINS__", JSON.stringify(allowedOrigins))
    .replace("__APP_URL__", JSON.stringify(appUrl));
};
const loginHtml = renderPage(path.join(__dirname, "login-page", "index.html"));
const registerHtml = renderPage(path.join(__dirname, "register-page", "index.html"));
const verifyHtml = renderPage(path.join(__dirname, "verify-page", "index.html"));
const resetPasswordHtml = renderPage(path.join(__dirname, "reset-password-page", "index.html"));

app.get("/login", (_req, res) => {
  res.type("html").send(loginHtml);
});
app.get("/register", (_req, res) => {
  res.type("html").send(registerHtml);
});
app.get("/reset-password", (_req, res) => {
  res.type("html").send(resetPasswordHtml);
});

// L'email de vérification pointe directement vers GET /auth/verify?token=…. Une
// navigation navigateur (Accept: text/html) reçoit cette page conviviale, qui rappelle
// ensuite le même endpoint en Accept: application/json pour lancer la vérification
// réelle. Les appelants JSON/API tombent sur le handler ts-rest monté plus bas.
app.get("/auth/verify", (req, res, next) => {
  if (req.accepts(["json", "html"]) === "html") {
    res.type("html").send(verifyHtml);
    return;
  }
  next();
});

// Endpoint JWKS (clés publiques de vérification des access tokens)
app.get("/.well-known/jwks.json", jwksHandler);

// Endpoint interne service-à-service (hors contrat ts-rest, hors auth utilisateur).
// Protégé par un secret partagé dans X-Internal-Token. L'api l'appelle après la
// suppression d'un utilisateur pour effacer ses lignes de refresh token (historique
// IP/User-Agent inclus).
const internalTokenValid = (provided: string | undefined): boolean => {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual lève une exception si les longueurs diffèrent — d'où le contrôle de
  // longueur d'abord ; reste à temps constant pour des entrées de même longueur (le seul
  // cas qu'un attaquant contrôle une fois passé ce garde).
  return a.length === b.length && timingSafeEqual(a, b);
};

app.post(
  "/internal/sessions/purge",
  // Protégé par secret partagé, sans auth utilisateur — throttle pour freiner le
  // brute-force en ligne du token interne. Les appelants légitimes (l'api, suppressions
  // rares) restent bien en dessous de ce plafond.
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many requests — try again later" },
  }),
  (req, res) => {
    if (!internalTokenValid(req.header("x-internal-token"))) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const userId = (req.body as { userId?: unknown } | undefined)?.userId;
    if (typeof userId !== "string" || userId.length === 0) {
      res.status(400).json({ message: "userId is required" });
      return;
    }
    // Annoté comme l'interface pour que le résultat (jamais typé) de resolve() soit appelable.
    const refreshTokenRepo: IRefreshTokenRepository = resolve("refreshToken");
    refreshTokenRepo
      .deleteAllForUser(userId)
      .then(() => res.status(204).end())
      .catch((err) => {
        req.log.error({ err, userId }, "Failed to purge sessions for user");
        res.status(500).json({ message: "Failed to purge sessions" });
      });
  },
);

// Pendant « export » de la purge ci-dessus (RGPD art. 15/20) : l'api agrège l'export
// complet des données d'un utilisateur et appelle ceci pour y intégrer l'historique de
// sessions des refresh tokens (IP / User-Agent / horodatages) qu'elle ne détient pas.
// Même garde par secret partagé. Les hash de tokens sont retirés — ce sont des secrets,
// jamais des données personnelles de la personne concernée.
app.post(
  "/internal/sessions/export",
  // Même garde par secret partagé que la purge — throttle aussi (lecture de PII).
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many requests — try again later" },
  }),
  (req, res) => {
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
        logger.error({ err }, "Failed to export sessions for user");
        res.status(500).json({ message: "Failed to export sessions" });
      });
  },
);

// Rate limits — montés avant les handlers ts-rest pour s'exécuter en premier.
// Store en mémoire : suffisant en mono-instance, à remplacer par Redis en cas de scaling.
const limiterMessage = { message: "Too many requests — try again later" };
app.use(
  "/auth/login",
  // Correspond par préfixe à /auth/login ET à ses sous-étapes (/login/mfa,
  // /login/enroll/*) ; avec MFA obligatoire, une seule connexion consomme plusieurs
  // requêtes ici (mot de passe → mfa ou enrôlement start+confirm) plus les retries en cas
  // de code erroné/expiré. À garder bien au-dessus de ce total.
  rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/register",
  rateLimit({ windowMs: 60_000, limit: 3, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/refresh",
  rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
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
  rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/totp",
  rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/step-up",
  // Un appel par opération sensible + retries de code erroné/expiré ; l'utilisateur peut enchaîner plusieurs opérations.
  rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);
app.use(
  "/auth/sessions",
  rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);

app.use(
  "/auth/desktop",
  rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false, message: limiterMessage }),
);

// SSO app desktop (authorization code + PKCE). Le parsing urlencoded est limité à
// l'endpoint token — OAuth y exige l'encodage form, alors que le reste de ce service est
// en JSON. Monté avant les handlers ts-rest pour que le rate limit ci-dessus s'applique.
app.use("/auth/desktop/token", express.urlencoded({ extended: false }));
app.use(desktopSsoRouter);

// Endpoints d'auth (ts-rest)
createExpressEndpoints({ ...authContract }, { ...authRouter }, app);

app.use((_req, _res, next) => {
  next(new NotFoundError());
});

app.use(errorHandler);

connectDB()
  .then(async (db) => {
    initContainer(db);
    await initKeys();

    // Best-effort : garantir l'existence de l'index TTL des refresh tokens pour que les
    // sessions expirées se purgent seules, puis backfiller `expiresAtDate` sur les
    // anciennes lignes antérieures à ce champ (limitation de conservation RGPD, finding
    // gdpr-H3) pour que le TTL les moissonne réellement. Ne jamais bloquer le boot sur
    // l'un ou l'autre — logger et continuer en cas d'échec. Construit directement depuis
    // `db` (pas via resolve) car le repo est un wrapper sans état.
    const refreshTokenRepo = new MongoRefreshTokenRepository(db);
    await refreshTokenRepo
      .ensureIndexes()
      .then(() => refreshTokenRepo.backfillMissingExpiresAtDate())
      .then((backfilled) => {
        if (backfilled > 0) logger.info({ backfilled }, "Backfilled expiresAtDate on legacy refresh-token rows");
      })
      .catch((err) => logger.error({ err }, "Failed to ensure/backfill refresh-token indexes"));

    // Même traitement best-effort pour les codes d'autorisation du SSO desktop : l'index
    // TTL moissonne les codes à 60 secondes, l'index unique garantit l'usage unique.
    await new MongoAuthorizationCodeRepository(db)
      .ensureIndexes()
      .catch((err) => logger.error({ err }, "Failed to ensure authorization-code indexes"));

    const server = app.listen(port, () => {
      const localUrl = `http://localhost:${port}`;
      logger.info(
        {
          port,
          url: localUrl,
          login: `${localUrl}/login`,
          register: `${localUrl}/register`,
          jwks: `${localUrl}/.well-known/jwks.json`,
        },
        "Auth service running — ready to accept connections",
      );
    });
    setupGracefulShutdown(server, closeDB);
  })
  .catch((err) => {
    logger.fatal({ err }, "Failed to start auth-service");
    process.exit(1);
  });
