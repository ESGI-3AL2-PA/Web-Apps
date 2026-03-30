import express, { type Application } from "express";
import { createExpressEndpoints } from "@ts-rest/express";
import { usersContract } from "@repo/contracts";
import { usersRouter } from "./routes/users/users.router";
import { errorHandler, AppError } from "./middleware/error-handler";

const app: Application = express();
const port = 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

createExpressEndpoints(usersContract, usersRouter, app);

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
