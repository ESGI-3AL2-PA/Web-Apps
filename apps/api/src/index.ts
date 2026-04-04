import express, { type Application, type RequestHandler } from "express";
import cors from "cors";

import { createExpressEndpoints } from "@ts-rest/express";
import { usersContract } from "@repo/contracts";

import { usersRouter } from "./routes/users/users.router.js";
import { errorHandler, AppError } from "./middleware/error-handler.js";
import { generateOpenApi } from "@ts-rest/open-api";
import { apiReference } from "@scalar/express-api-reference";

const app: Application = express();
const port = 3000;

const contracts = { ...usersContract };
const routers = { ...usersRouter };

const openApiDocument = generateOpenApi(contracts, {
  info: {
    title: "API",
    version: "0.0.0",
  },
});

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
  }) as unknown as RequestHandler, // Ugly as hell but it works ¯\_(ツ)_/¯
);

createExpressEndpoints(contracts, routers, app);

app.use((_req, _res, next) => {
  next(new AppError(404, "Not found"));
});

app.use(errorHandler);

app.listen(port, () => {
  const localUrl = `http://localhost:${port}`;

  console.log("");
  console.log(" 🚀  API Server Running !");
  console.log("");
  console.log(` ➜  Local:   \x1b[36m${localUrl}\x1b[0m`);
  console.log("");
  console.log(`\x1b[33m⚡ Ready to accept connections\x1b[0m`);
});
