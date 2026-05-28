import express, { type Application, type RequestHandler } from "express";
import cors from "cors";

import { createExpressEndpoints } from "@ts-rest/express";
import {
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
import { incidentsRouter } from "./routes/incidents/incidents.router.js";
import { districtsRouter } from "./routes/districts/districts.router.js";
import { tagsRouter } from "./routes/tags/tags.router.js";
import { votesRouter } from "./routes/votes/votes.router.js";
import { conversationsRouter } from "./routes/conversations/conversations.router.js";
import { notificationsRouter } from "./routes/notifications/notifications.router.js";
import { transactionsRouter } from "./routes/transactions/transactions.router.js";
import { errorHandler, NotFoundError } from "./middleware/error-handler.js";
import { connectDB } from "./repositories/mongodb.connector.js";
import { initContainer } from "./repositories/container.js";
import { generateOpenApi } from "@ts-rest/open-api";
import { apiReference } from "@scalar/express-api-reference";

const app: Application = express();
const port = 3000;

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
);

app.use(
  cors({
    // We should get ports from env probably
    origin: ["http://localhost:4000", "http://localhost:5000"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

createExpressEndpoints({ ...usersContract }, { ...usersRouter }, app);
createExpressEndpoints({ ...listingsContract }, { ...listingsRouter }, app);
createExpressEndpoints({ ...eventsContract }, { ...eventsRouter }, app);
createExpressEndpoints({ ...contractsContract }, { ...contractsRouter }, app);
createExpressEndpoints({ ...incidentsContract }, { ...incidentsRouter }, app);
createExpressEndpoints({ ...districtsContract }, { ...districtsRouter }, app);
createExpressEndpoints({ ...tagsContract }, { ...tagsRouter }, app);
createExpressEndpoints({ ...votesContract }, { ...votesRouter }, app);
createExpressEndpoints({ ...conversationsContract }, { ...conversationsRouter }, app);
createExpressEndpoints({ ...notificationsContract }, { ...notificationsRouter }, app);
createExpressEndpoints({ ...transactionsContract }, { ...transactionsRouter }, app);

app.use((_req, _res, next) => {
  next(new NotFoundError());
});

app.use(errorHandler);

connectDB()
  .then((db) => {
    initContainer(db);
    app.listen(port, () => {
      const localUrl = `http://localhost:${port}`;

      console.log("");
      console.log(" 🚀  API Server Running !");
      console.log("");
      console.log(` ➜  Local:   \x1b[36m${localUrl}\x1b[0m`);
      console.log("");
      console.log(`\x1b[33m⚡ Ready to accept connections\x1b[0m`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
