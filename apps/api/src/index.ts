import express from "express";
const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  const localUrl = `http://localhost:${port}`;

  console.log("");
  console.log(" 🚀  API Server Running !");
  console.log("");
  console.log(` ➜  Local:   \x1b[36m${localUrl}\x1b[0m`);
  console.log("");
  console.log(`\x1b[33m⚡ Ready to accept connections\x1b[0m`);
});
