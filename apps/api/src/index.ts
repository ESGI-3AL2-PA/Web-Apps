import "./load-env.js"; // must be first: loads .env before any module reads process.env
import express, { type Application, type RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

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
import { voiceMessageHandler, audioStreamHandler } from "./routes/conversations/voice-message.handler.js";
import { imageUploadHandler, imageStreamHandler } from "./routes/listings/image-upload.handler.js";
import { recommendationsRouter } from "./routes/recommendations/recommendations.router.js";
import { errorHandler, NotFoundError } from "./middleware/error-handler.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { authorize } from "./middleware/authorize.middleware.js";
import { connectDB, closeDB } from "./repositories/mongodb.connector.js";
import { connectNeo4j, closeNeo4j } from "./repositories/neo4j.connector.js";
import { connectSatan, closeSatan } from "./repositories/satan.connector.js";
import type { SatanClient } from "@repo/satan";
import { setupGracefulShutdown } from "./shutdown.js";
import { initContainer } from "./repositories/container.js";
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

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:4000,http://localhost:5000,http://localhost:7000")
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

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

// Documenso posts signing events here. It authenticates with a shared secret
// (verified inside the handler), not our JWT, so it must sit ABOVE requireAuth.
app.post("/contracts/webhook", documensoWebhookHandler);

// Listing images are public-read (keys are unguessable UUIDs) so plain <img src>
// tags can load them without an Authorization header. Sits ABOVE requireAuth.
app.get("/uploads/images/:key", imageStreamHandler);

// Everything below /health, /openapi.json and /docs requires a valid access token.
// requireAuth verifies the JWT (iss/aud) and sets req.user.
app.use(requireAuth);
app.get("/users/public/search", userSearchHandler);
app.get("/users/:id/public", userPublicHandler);
app.post("/conversations/:id/messages/voice", voiceMessageHandler);
app.get("/messages/:id/audio", audioStreamHandler);

// Rate limiting (per client IP; req.ip honours the TRUST_PROXY setting above).
// Mirrors the auth-service limiter — 1-minute window, draft-7 headers. A generous
// global cap protects every authenticated route; the two endpoints that trigger
// external work (Documenso/email on create, an S3 fetch on the PDF proxy) get
// tighter caps below. NOTE: in-memory store — fine single-instance, move to a
// shared store (Redis) before scaling the api horizontally.
const rateLimitMessage = { message: "Too many requests — try again later" };
const makeLimiter = (limit: number) =>
  rateLimit({ windowMs: 60_000, limit, standardHeaders: "draft-7", legacyHeaders: false, message: rateLimitMessage });
app.use(makeLimiter(120));

// Binary passthrough for the signed contract PDF (proxied from Documenso so the
// front never talks to Documenso/S3 directly). Raw handler — does its own party/
// admin authorization. Registered before the ts-rest contract routes.
app.get("/contracts/:id/pdf", makeLimiter(30), contractPdfHandler);

// Listing image upload (base64 → MinIO). Tighter cap: writes to object storage.
// The matching public GET stream is registered above requireAuth.
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
    console.warn("😈 SATAN repositories disabled (SATAN_REPOS=false) — using Mongo repositories");
    return undefined;
  }
  try {
    const client = await connectSatan();
    console.warn("😈 SATAN repositories active");
    return client;
  } catch (err) {
    console.error("😈 SATAN worker unavailable — falling back to Mongo repositories:", (err as Error).message);
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
      const localUrl = `http://localhost:${port}`;

      console.warn("");
      console.warn(" 🚀  API Server Running !");
      console.warn("");
      console.warn(` ➜  Local:   \x1b[36m${localUrl}\x1b[0m`);
      console.warn(` ➜  Socket:  \x1b[36mws://localhost:${port}\x1b[0m`);
      console.warn("");
      console.warn(`\x1b[33m⚡ Ready to accept connections\x1b[0m`);
    });
    setupGracefulShutdown(
      httpServer,
      async () => {
        await Promise.all([closeDB(), closeNeo4j(), closeSatan()]);
      },
      closeSocketIo,
    );
  })
  .catch((err) => {
    console.error("Failed to connect to databases:", err);
    process.exit(1);
  });
