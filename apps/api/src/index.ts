import express from "express";
import { createExpressEndpoints } from "@ts-rest/express";
import { usersContract } from "@repo/contracts";
import { usersRouter } from "./routes/users/users.router";

const app = express();
const port = 3000;

app.use(express.json());

createExpressEndpoints(usersContract, usersRouter, app);

app.listen(port, () => {
  const localUrl = `http://localhost:${port}`;

  console.log("");
  console.log(" 🚀  API Server Running !");
  console.log("");
  console.log(` ➜  Local:   \x1b[36m${localUrl}\x1b[0m`);
  console.log("");
  console.log(`\x1b[33m⚡ Ready to accept connections\x1b[0m`);
});
