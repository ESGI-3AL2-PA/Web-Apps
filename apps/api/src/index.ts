// Point d'entrée de l'api : monte Express (helmet, cors, rate limiting, logs), génère la doc
// OpenAPI/Scalar, enregistre les routes ts-rest derrière requireAuth + authorize + requireStepUp,
// puis connecte les datastores (Mongo/Neo4j/SATAN), démarre Socket.io et le flux de sync offline.
import "@repo/shared/load-env"; // doit être en premier : charge .env avant qu'un module ne lise process.env
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
import { requireStepUp } from "./middleware/requireStepUp.js";
import { connectDB, closeDB, pingDB } from "./repositories/mongodb.connector.js";
import { connectNeo4j, closeNeo4j, pingNeo4j } from "./repositories/neo4j.connector.js";
import { connectSatan, closeSatan } from "./repositories/satan.connector.js";
import type { SatanClient } from "@repo/satan";
import { setupGracefulShutdown, withRetry } from "@repo/shared";
import { initContainer, resolve } from "./repositories/container.js";
import { generateOpenApi } from "@ts-rest/open-api";
import { apiReference } from "@scalar/express-api-reference";

const app: Application = express();
const port = Number(process.env.API_PORT ?? process.env.PORT) || 3000;

// Derrière un reverse proxy / load balancer, définir TRUST_PROXY (ex. "1") pour que req.ip
// reflète le vrai client. Non défini par défaut pour ne pas faire confiance à un X-Forwarded-For usurpé.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === "true" ? true : trustProxy);
}

// Log d'accès par requête + identifiant de corrélation (req.id, exposé via le logger enfant
// req.log). Monté en premier pour que chaque requête — y compris /health et /docs — soit journalisée.
app.use(
  pinoHttp({
    logger,
    // Retire les données personnelles des logs (RGPD art. 32) : sinon le sérialiseur par défaut
    // enregistrerait l'IP client et les en-têtes Cookie / Authorization (Bearer) à chaque requête.
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

// En-têtes de sécurité. La CSP est désactivée car l'UI Scalar /docs charge ses propres
// assets ; le reste (X-Frame-Options, HSTS, X-Content-Type-Options, …) s'applique toujours.
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
    // Reporte la politique `metadata.auth` de chaque route du contrat dans la doc générée.
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
    // X-Step-Up-Token porte la preuve de MFA fraîche que le front rejoue sur une opération
    // sensible après un 401 step_up_required ; sans lui ici, le preflight du navigateur bloque le retry.
    allowedHeaders: ["Content-Type", "Authorization", "X-Step-Up-Token"],
    credentials: true,
  }),
);
// Limite augmentée pour accepter les uploads audio inline en base64 (~5MB max).
app.use(express.json({ limit: "10mb" }));

// Liveness : peu coûteux, sans dépendance. Répond « le process tourne-t-il ? » — sert à décider
// s'il faut redémarrer le conteneur. Doit rester statique pour qu'une base lente/HS ne le fasse jamais échouer.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness : « cette instance peut-elle servir du trafic ? » — ping les dépendances pour que
// le load balancer sorte de la rotation un nœud dont la base est morte. Mongo est requis (HS → 503).
// Neo4j est une projection (Mongo fait foi, les écritures graphe sont best-effort) : sa panne
// dégrade les recommandations mais l'instance reste en rotation (200 « degraded »).
app.get("/readyz", async (_req, res) => {
  const [mongo, neo] = await Promise.allSettled([pingDB(), pingNeo4j()]);
  const mongoOk = mongo.status === "fulfilled";
  const neo4jOk = neo.status === "fulfilled";
  const checks = { mongo: mongoOk ? "ok" : "down", neo4j: neo4jOk ? "ok" : "down" };
  const status = !mongoOk ? "unavailable" : neo4jOk ? "ok" : "degraded";
  res.status(mongoOk ? 200 : 503).json({ status, checks, timestamp: new Date().toISOString() });
});

// Le schéma OpenAPI + l'UI Scalar exposent tout le catalogue d'endpoints : ils ne doivent
// donc pas être publics en production. Désactivés par défaut en prod sauf si ENABLE_API_DOCS=true.
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
    }) as unknown as RequestHandler, // Moche mais ça marche ¯\_(ツ)_/¯
  );
}

// Rate limiting (par IP client ; req.ip respecte le réglage TRUST_PROXY ci-dessus).
// Défini en amont pour que même le webhook Documenso pré-auth puisse être throttlé. Reprend
// le limiteur de l'auth-service — fenêtre d'1 minute, en-têtes draft-7. Les endpoints qui
// déclenchent du travail externe (Documenso/email à la création, fetch S3 sur le proxy PDF)
// ont des plafonds plus stricts plus bas. NOTE : store en mémoire — OK en instance unique,
// passer à un store partagé (Redis) avant de scaler l'api horizontalement.
const rateLimitMessage = { message: "Too many requests — try again later" };
const makeLimiter = (limit: number) =>
  rateLimit({ windowMs: 60_000, limit, standardHeaders: "draft-7", legacyHeaders: false, message: rateLimitMessage });

// Documenso poste ici ses événements de signature. Il s'authentifie via un secret partagé
// (vérifié dans le handler), pas notre JWT : il doit donc être AU-DESSUS de requireAuth — ce qui
// le place aussi au-dessus du limiteur global. Il solde/rembourse l'escrow, d'où son propre
// limiteur strict pour freiner un brute-force en ligne du secret partagé.
app.post("/contracts/webhook", makeLimiter(30), documensoWebhookHandler);

// Tout ce qui suit /health, /openapi.json et /docs exige un access token valide.
// requireAuth vérifie le JWT (iss/aud) et renseigne req.user.
app.use(requireAuth);
// Plafond global d'abord, pour qu'il couvre aussi les handlers bruts ci-dessous (recherche
// publique, profil public, flux média) — pas seulement les routes de contrat ts-rest.
app.use(makeLimiter(120));
app.get("/users/public/search", userSearchHandler);
app.get("/users/:id/public", userPublicHandler);
// Les POST de messages voix/image sont des routes de contrat ts-rest (conversationsContract).
// Seuls les flux média binaires restent des handlers bruts. Contrairement aux images publiques
// d'annonces (/uploads/images/:key, au-dessus de requireAuth), ceux-ci sont SOUS requireAuth et
// font leur propre vérification de participant — une photo/note vocale d'une conversation est privée.
app.get("/messages/:id/audio", audioStreamHandler);
app.get("/messages/:id/image", imageMessageStreamHandler);

// Passthrough binaire du PDF de contrat signé (proxifié depuis Documenso pour que le
// front ne parle jamais directement à Documenso/S3). Handler brut — fait sa propre
// autorisation partie/admin. Enregistré avant les routes de contrat ts-rest.
app.get("/contracts/:id/pdf", makeLimiter(30), contractPdfHandler);

// Images d'annonces : lecture + upload (MinIO). Les deux sont maintenant SOUS requireAuth — un
// token valide est requis pour lire (pas d'autz par annonce), donc une URL d'image fuitée est
// inutile sans session, et le limiteur global ci-dessus rate-limite la lecture. L'upload a un
// plafond plus strict (écrit dans le stockage objet). Les images sont récupérées en blob par le
// front (AuthedImage), donc pas besoin d'embed <img> cross-origin ni de CORP.
app.get("/uploads/images/:key", imageStreamHandler);
app.post("/uploads/images", makeLimiter(30), imageUploadHandler);

// L'autorisation est déclarée par route dans le `metadata.auth` du contrat et appliquée par
// ce middleware global unique (lit req.tsRestRoute, charge les enregistrements pour les
// vérifications de propriété/quartier). Pas besoin de monter un chemin par ressource.
// Enregistre chaque contrat avec le même middleware d'autorisation global piloté par les
// métadonnées. Typé `any` pour ne pas perturber l'inférence TRouter de chaque appel (le
// générique du contrat vient des args 1-2) ; `authorize` est un handler Express valide.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const endpointOptions: any = { globalMiddleware: [authorize, requireStepUp] };

// Plafond plus strict sur la création de contrat — chaque appel fan-out vers Documenso
// (génération du document + emails d'invitation) et met des fonds sous escrow. Enregistré avant
// le routeur de contrats ts-rest pour s'exécuter en premier, puis passer la main au handler.
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

// Best-effort : démarre le worker SATAN QL pour que le conteneur puisse résoudre les
// repositories adossés à SATAN. S'il ne démarre pas (ex. python/`ply` manquant), on log et
// on retombe sur les repos Mongo plutôt que de refuser de booter. Totalement ignoré
// quand SATAN_REPOS=false.
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

// Réessaie les connexions initiales aux datastores avec backoff : `depends_on:
// service_healthy` ne gouverne que le premier boot, et tsx --watch ne relance pas
// l'entrypoint après un exit fatal — un aléa transitoire Mongo/Neo4j au (re)démarrage
// bloquerait sinon le process jusqu'à ce qu'un fichier change.
withRetry(() => Promise.all([connectDB(), connectNeo4j()]), { label: "database connection" })
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
    // Sync offline : amorce le flux de changements au premier boot (rendant ?since=0 un
    // snapshot complet), puis tail les collections. Les deux exigent un replica set — sur un
    // mongod standalone `db.watch()` lève une erreur, donc c'est best-effort : le reste de
    // l'api continue de servir, seul le flux de sync du client desktop se fige.
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
    logger.fatal({ err }, "Failed to connect to databases after retries");
    process.exit(1);
  });
