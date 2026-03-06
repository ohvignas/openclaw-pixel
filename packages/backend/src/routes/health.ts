import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Config publique pour le frontend.
// L'instance par défaut passe par le proxy backend, pas par le port gateway direct.
healthRouter.get("/config", (_req, res) => {
  res.json({
    gatewayWsUrl: "/ws",
    gatewayToken: "",
    gatewayTokenConfigured: Boolean(process.env.OPENCLAW_GATEWAY_TOKEN),
    gatewayProxyTarget: process.env.OPENCLAW_GATEWAY_URL ?? "ws://localhost:18789",
  });
});
