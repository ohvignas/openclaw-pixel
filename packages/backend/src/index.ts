import express from "express";
import cors from "cors";
import { createServer } from "http";
import path from "path";
import { healthRouter } from "./routes/health.js";
import { filesRouter } from "./routes/files.js";
import { clawhubRouter } from "./routes/clawhub.js";
import { cliRouter } from "./routes/cli.js";
import { economyRouter } from "./routes/economy.js";
import { setupWsProxy } from "./ws-proxy.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", healthRouter);
app.use("/api/files", filesRouter);
app.use("/api/clawhub", clawhubRouter);
app.use("/api/cli", cliRouter);
app.use("/api/economy", economyRouter);

// Servir le build frontend en production
if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(process.cwd(), "../../public");
  app.use(express.static(publicPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
}

const server = createServer(app);
setupWsProxy(server);

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`[pixel-ui] Server running on port ${port}`);
});
