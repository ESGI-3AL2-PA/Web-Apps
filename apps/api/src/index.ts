import "@repo/shared/load-env"; // must be first: loads .env before any module reads process.env
import express, { type Application, type RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { logger } from "./logger.js";

import { createExpressEndpoints } from "@ts-rest/express";
import {
  getAuthPolicy,
  usersContract,
  districtsContract,
  districtAdminsContract,
  listingsContract,
  eventsContract,
  contractsContract,
  incidentsContract,
  tagsContract,
  votesContract,
  conversationsContract,
  notificationsContract,
  transactionsContract,
  recommendationsContract,
  syncContract,
  conflictsContract,
} from "@repo/contracts";

import { usersRouter } from "./routes/users/users.router.js";
import { userPublicHandler } from "./routes/users/users-public.handler.js";
import { userSearchHandler } from "./routes/users/users-search.handler.js";
import { listingsRouter } from "./routes/listings/listings.router.js";
import { eventsRouter } from "./routes/events/events.router.js";
import { contractsRouter } from "./routes/contracts/contracts.router.js";
import { documensoWebhookHandler } from "./routes/contracts/documenso-webhook.handler.js";
import { contractPdfHandler } from "./routes/contracts/contract-pdf.handler.js";
import { incidentsRouter } from "./routes/incidents/incidents.router.js";
import { districtsRouter } from "./routes/districts/districts.router.js";
import { districtAdminsRouter } from "./routes/district-admins/district-admins.router.js";
import { tagsRouter } from "./routes/tags/tags.router.js";
import { votesRouter } from "./routes/votes/votes.router.js";
import { conversationsRouter } from "./routes/conversations/conversations.router.js";
import { notificationsRouter } from "./routes/notifications/notifications.router.js";
import { transactionsRouter } from "./routes/transactions/transactions.router.js";
import { createServer } from "http";
import { setupSocketIo, closeSocketIo } from "./sockets/io.js";
import { audioStreamHandler } from "./routes/conversations/voice-message.handler.js";
import { imageMessageStreamHandler } from "./routes/conversations/image-message.handler.js";
import { imageUploadHandler, imageStreamHandler } from "./routes/listings/image-upload.handler.js";
import { recommendationsRouter } from "./routes/recommendations/recommendations.router.js";
import { syncRouter } from "./routes/sync/sync.router.js";
import { conflictsRouter } from "./routes/sync/conflicts.router.js";
import { startWatcher, stopWatcher } from "./watcher/change-stream.watcher.js";
import { seedExistingDocs } from "./watcher/seed-existing-docs.js";
import { errorHandler, NotFoundError } from "./middleware/error-handler.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { authorize } from "./middleware/authorize.middleware.js";
import { connectDB, closeDB, pingDB } from "./repositories/mongodb.connector.js";
import { connectNeo4j, closeNeo4j, pingNeo4j } from "./repositories/neo4j.connector.js";
import { connectSatan, closeSatan } from "./repositories/satan.connector.js";
import type { SatanClient } from "@repo/satan";
import { setupGracefulShutdown } from "@repo/shared";
import { initContainer, resolve } from "./repositories/container.js";
import { generateOpenApi } from "@ts-rest/open-api";
import { apiReference } from "@scalar/express-api-reference";

const app: Application = express();
const port = Number(process.env.API_PORT ?? process.env.PORT) || 3000;

// Behind a reverse proxy/LB, set TRUST_PROXY (e.g. "1") so req.ip reflects the
// real client. Unset by default to avoid trusting spoofed X-Forwarded-For.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === "true" ? true : trustProxy);
}

// Per-request access logging + correlation id (req.id, exposed as req.log child
// logger). Mounted first so every request — including /health and /docs — is logged.
app.use(
  pinoHttp({
    logger,
    // Strip PII from request logs (GDPR Art. 32): the default serializer would otherwise
    // record the client IP and the Cookie / Authorization (Bearer) headers on every request.
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

// Security headers. CSP is disabled because the Scalar /docs UI loads its own
// assets; the rest (X-Frame-Options, HSTS, X-Content-Type-Options, …) still apply.
app.use(helmet({ contentSecurityPolicy: false }));

const openApiDocument = generateOpenApi(
  {
    Users: usersContract,
    Districts: districtsContract,
    DistrictAdmins: districtAdminsContract,
    Listings: listingsContract,
    Events: eventsContract,
    Contracts: contractsContract,
    Incidents: incidentsContract,
    Tags: tagsContract,
    Votes: votesContract,
    Conversations: conversationsContract,
    Notifications: notificationsContract,
    Transactions: transactionsContract,
    Recommendations: recommendationsContract,
    Sync: syncContract,
    SyncConflicts: conflictsContract,
  },
  {
    info: {
      title: "API",
      version: "0.0.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    tags: [
      { name: "Users" },
      { name: "Districts" },
      { name: "DistrictAdmins" },
      { name: "Listings" },
      { name: "Events" },
      { name: "Contracts" },
      { name: "Incidents" },
      { name: "Tags" },
      { name: "Votes" },
      { name: "Conversations" },
      { name: "Notifications" },
      { name: "Transactions" },
      { name: "Recommendations" },
      { name: "Sync" },
      { name: "SyncConflicts" },
    ],
  },
  {
    // Reflect each route's contract `metadata.auth` policy in the generated docs.
    operationMapper: (operation, appRoute) => {
      const policy = getAuthPolicy(appRoute);
      if (!policy || policy.public) return operation;
      const bits: string[] = [];
      if (policy.audience) bits.push(`audience ${policy.audience}`);
      if (policy.roles?.length) bits.push(`roles ${policy.roles.join(", ")}`);
      if (policy.scope?.selfParam) bits.push("self or admin");
      else if (policy.scope) bits.push("owner or district-admin");
      const base = operation.description ? `${operation.description}\n\n` : "";
      return {
        ...operation,
        security: [{ bearerAuth: [] }],
        description: bits.length ? `${base}**Access:** ${bits.join("; ")}` : operation.description,
      };
    },
  },
);

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:4000,http://localhost:5000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
// Limite augmentée pour accepter les uploads audio inline en base64 (~5MB max).
app.use(express.json({ limit: "10mb" }));

// Liveness: cheap, dependency-free. Answers "is the process up?" — used to decide
// whether to restart the container. Must stay static so a slow/down DB never trips it.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness: "can this instance serve traffic?" — pings dependencies so the LB can
// pull a node with a dead DB out of rotation. Mongo is required (down → 503). Neo4j
// is a projection (Mongo is source of truth, graph writes are best-effort), so its
// failure degrades recommendations but the instance stays in rotation (200 "degraded").
app.get("/readyz", async (_req, res) => {
  const [mongo, neo] = await Promise.allSettled([pingDB(), pingNeo4j()]);
  const mongoOk = mongo.status === "fulfilled";
  const neo4jOk = neo.status === "fulfilled";
  const checks = { mongo: mongoOk ? "ok" : "down", neo4j: neo4jOk ? "ok" : "down" };
  const status = !mongoOk ? "unavailable" : neo4jOk ? "ok" : "degraded";
  res.status(mongoOk ? 200 : 503).json({ status, checks, timestamp: new Date().toISOString() });
});

// The OpenAPI schema + Scalar UI expose the full endpoint catalogue, so they must
// not be public in production. Off by default in prod unless ENABLE_API_DOCS=true.
const docsEnabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_API_DOCS === "true";
if (docsEnabled) {
  app.get("/openapi.json", (req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    "/docs",
    apiReference({
      url: "/openapi.json",
      theme: "moon",
    }) as unknown as RequestHandler, // Ugly but it works ¯\_(ツ)_/¯
  );
}

// Rate limiting (per client IP; req.ip honours the TRUST_PROXY setting above).
// Defined up-front so even the pre-auth Documenso webhook can be throttled. Mirrors
// the auth-service limiter — 1-minute window, draft-7 headers. Endpoints that trigger
// external work (Documenso/email on create, an S3 fetch on the PDF proxy) get tighter
// caps below. NOTE: in-memory store — fine single-instance, move to a shared store
// (Redis) before scaling the api horizontally.
const rateLimitMessage = { message: "Too many requests — try again later" };
const makeLimiter = (limit: number) =>
  rateLimit({ windowMs: 60_000, limit, standardHeaders: "draft-7", legacyHeaders: false, message: rateLimitMessage });

// Documenso posts signing events here. It authenticates with a shared secret
// (verified inside the handler), not our JWT, so it must sit ABOVE requireAuth — which
// also puts it above the global limiter. It settles/refunds escrow, so it carries a
// tight limiter of its own to blunt online brute-forcing of the shared secret.
app.post("/contracts/webhook", makeLimiter(30), documensoWebhookHandler);

// Everything below /health, /openapi.json and /docs requires a valid access token.
// requireAuth verifies the JWT (iss/aud) and sets req.user.
app.use(requireAuth);
// Global cap first, so it also covers the raw handlers below (public search, public
// profile, media streams) — not only the ts-rest contract routes.
app.use(makeLimiter(120));
app.get("/users/public/search", userSearchHandler);
app.get("/users/:id/public", userPublicHandler);
// The voice/image message POSTs are ts-rest contract routes (conversationsContract).
// Only the binary media streams stay raw handlers. Unlike public listing images
// (/uploads/images/:key, above requireAuth), these sit BELOW requireAuth and do their
// own participant check — a photo/voice note in a conversation is participant-private.
app.get("/messages/:id/audio", audioStreamHandler);
app.get("/messages/:id/image", imageMessageStreamHandler);

// Binary passthrough for the signed contract PDF (proxied from Documenso so the
// front never talks to Documenso/S3 directly). Raw handler — does its own party/
// admin authorization. Registered before the ts-rest contract routes.
app.get("/contracts/:id/pdf", makeLimiter(30), contractPdfHandler);

// Listing images: serve + upload (MinIO). Both now sit BELOW requireAuth — a valid
// token is required to fetch (no per-listing authz), so a leaked image URL is useless
// without a session, and the global limiter above rate-limits the read. Upload gets a
// tighter cap (writes to object storage). Images are blob-fetched by the front
// (AuthedImage), so no cross-origin <img> embedding / CORP needed.
app.get("/uploads/images/:key", imageStreamHandler);
app.post("/uploads/images", makeLimiter(30), imageUploadHandler);

// Authorization is declared per-route in the contract `metadata.auth` and enforced
// by this single global middleware (reads req.tsRestRoute, loads records for
// ownership/district checks). No per-resource path mounting needed.
// Register every contract with the same metadata-driven global authorization
// middleware. Typed `any` so it doesn't perturb each call's TRouter inference
// (the contract's generic flows from args 1-2); `authorize` is a valid Express handler.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const endpointOptions: any = { globalMiddleware: [authorize] };

// Tighter cap on contract creation — each call fans out to Documenso (document
// generation + invitation emails) and escrows funds. Registered before the ts-rest
// contracts router so it runs first, then falls through to the handler.
app.post("/contracts", makeLimiter(10));

createExpressEndpoints(usersContract, usersRouter, app, endpointOptions);
createExpressEndpoints(listingsContract, listingsRouter, app, endpointOptions);
createExpressEndpoints(eventsContract, eventsRouter, app, endpointOptions);
createExpressEndpoints(contractsContract, contractsRouter, app, endpointOptions);
createExpressEndpoints(incidentsContract, incidentsRouter, app, endpointOptions);
createExpressEndpoints(districtsContract, districtsRouter, app, endpointOptions);
createExpressEndpoints(districtAdminsContract, districtAdminsRouter, app, endpointOptions);
createExpressEndpoints(tagsContract, tagsRouter, app, endpointOptions);
createExpressEndpoints(votesContract, votesRouter, app, endpointOptions);
createExpressEndpoints(conversationsContract, conversationsRouter, app, endpointOptions);
createExpressEndpoints(notificationsContract, notificationsRouter, app, endpointOptions);
createExpressEndpoints(transactionsContract, transactionsRouter, app, endpointOptions);
createExpressEndpoints(recommendationsContract, recommendationsRouter, app, endpointOptions);
createExpressEndpoints(syncContract, syncRouter, app, endpointOptions);
createExpressEndpoints(conflictsContract, conflictsRouter, app, endpointOptions);

app.use((_req, _res, next) => {
  next(new NotFoundError());
});

app.use(errorHandler);

// Best-effort: bring up the SATAN QL worker so the container can resolve the
// SATAN-backed repositories. If it can't start (e.g. python/`ply` missing) we
// log and fall back to the Mongo repos rather than refusing to boot. Skip
// entirely when SATAN_REPOS=false.
const maybeConnectSatan = async (): Promise<SatanClient | undefined> => {
  if (process.env.SATAN_REPOS === "false") {
    logger.warn("SATAN repositories disabled (SATAN_REPOS=false) — using Mongo repositories");
    return undefined;
  }
  try {
    const client = await connectSatan();
    logger.info("SATAN repositories active");
    return client;
  } catch (err) {
    logger.warn({ err }, "SATAN worker unavailable — falling back to Mongo repositories");
    return undefined;
  }
};

Promise.all([connectDB(), connectNeo4j()])
  .then(async ([db, neo4jDriver]) => {
    const satan = await maybeConnectSatan();
    initContainer(db, neo4jDriver, satan);

    // Création d'un http.Server manuel pour pouvoir y attacher Socket.io.
    const httpServer = createServer(app);
    setupSocketIo(httpServer);

    httpServer.listen(port, () => {
      logger.info(
        { port, url: `http://localhost:${port}`, socket: `ws://localhost:${port}` },
        "API server running — ready to accept connections",
      );
    });
    // Offline sync: seed the change feed on first boot (making ?since=0 a full
    // snapshot), then tail the collections. Both need a replica set — on a standalone
    // mongod `db.watch()` throws, so this is best-effort: the rest of the api still
    // serves, only the desktop sync feed goes stale.
    const syncChanges = resolve("syncChanges");
    const syncState = resolve("syncState");
    void seedExistingDocs(db, syncChanges, syncState)
      .then(() => startWatcher(db, syncChanges, syncState))
      .catch((err) => logger.error({ err }, "Offline sync unavailable — is Mongo running as a replica set?"));

    setupGracefulShutdown(
      httpServer,
      async () => {
        await stopWatcher();
        await Promise.all([closeDB(), closeNeo4j(), closeSatan()]);
      },
      closeSocketIo,
    );
  })
  .catch((err) => {
    logger.fatal({ err }, "Failed to connect to databases");
    process.exit(1);
  });
