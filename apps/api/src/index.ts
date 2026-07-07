import "./load-env.js"; // must be first: loads .env before any module reads process.env
import express, { type Application, type RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";

import { createExpressEndpoints } from "@ts-rest/express";
import {
  getAuthPolicy,
  usersContract,
  districtsContract,
  listingsContract,
  eventsContract,
  contractsContract,
  incidentsContract,
  tagsContract,
  votesContract,
  conversationsContract,
  notificationsContract,
  transactionsContract,
} from "@repo/contracts";

import { usersRouter } from "./routes/users/users.router.js";
import { listingsRouter } from "./routes/listings/listings.router.js";
import { eventsRouter } from "./routes/events/events.router.js";
import { contractsRouter } from "./routes/contracts/contracts.router.js";
import { documensoWebhookHandler } from "./routes/contracts/documenso-webhook.handler.js";
import { incidentsRouter } from "./routes/incidents/incidents.router.js";
import { districtsRouter } from "./routes/districts/districts.router.js";
import { tagsRouter } from "./routes/tags/tags.router.js";
import { votesRouter } from "./routes/votes/votes.router.js";
import { conversationsRouter } from "./routes/conversations/conversations.router.js";
import { notificationsRouter } from "./routes/notifications/notifications.router.js";
import { transactionsRouter } from "./routes/transactions/transactions.router.js";
import { errorHandler, NotFoundError } from "./middleware/error-handler.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { authorize } from "./middleware/authorize.middleware.js";
import { connectDB, closeDB } from "./repositories/mongodb.connector.js";
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
    Listings: listingsContract,
    Events: eventsContract,
    Contracts: contractsContract,
    Incidents: incidentsContract,
    Tags: tagsContract,
    Votes: votesContract,
    Conversations: conversationsContract,
    Notifications: notificationsContract,
    Transactions: transactionsContract,
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
      { name: "Listings" },
      { name: "Events" },
      { name: "Contracts" },
      { name: "Incidents" },
      { name: "Tags" },
      { name: "Votes" },
      { name: "Conversations" },
      { name: "Notifications" },
      { name: "Transactions" },
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
app.use(express.json());

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

// Everything below /health, /openapi.json and /docs requires a valid access token.
// requireAuth verifies the JWT (iss/aud) and sets req.user.
app.use(requireAuth);

// Authorization is declared per-route in the contract `metadata.auth` and enforced
// by this single global middleware (reads req.tsRestRoute, loads records for
// ownership/district checks). No per-resource path mounting needed.
// Register every contract with the same metadata-driven global authorization
// middleware. Typed `any` so it doesn't perturb each call's TRouter inference
// (the contract's generic flows from args 1-2); `authorize` is a valid Express handler.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const endpointOptions: any = { globalMiddleware: [authorize] };

createExpressEndpoints(usersContract, usersRouter, app, endpointOptions);
createExpressEndpoints(listingsContract, listingsRouter, app, endpointOptions);
createExpressEndpoints(eventsContract, eventsRouter, app, endpointOptions);
createExpressEndpoints(contractsContract, contractsRouter, app, endpointOptions);
createExpressEndpoints(incidentsContract, incidentsRouter, app, endpointOptions);
createExpressEndpoints(districtsContract, districtsRouter, app, endpointOptions);
createExpressEndpoints(tagsContract, tagsRouter, app, endpointOptions);
createExpressEndpoints(votesContract, votesRouter, app, endpointOptions);
createExpressEndpoints(conversationsContract, conversationsRouter, app, endpointOptions);
createExpressEndpoints(notificationsContract, notificationsRouter, app, endpointOptions);
createExpressEndpoints(transactionsContract, transactionsRouter, app, endpointOptions);

app.use((_req, _res, next) => {
  next(new NotFoundError());
});

app.use(errorHandler);

connectDB()
  .then((db) => {
    initContainer(db);
    const server = app.listen(port, () => {
      const localUrl = `http://localhost:${port}`;

      console.log("");
      console.log(" 🚀  API Server Running !");
      console.log("");
      console.log(` ➜  Local:   \x1b[36m${localUrl}\x1b[0m`);
      console.log("");
      console.log(`\x1b[33m⚡ Ready to accept connections\x1b[0m`);
    });
    setupGracefulShutdown(server, closeDB);
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
