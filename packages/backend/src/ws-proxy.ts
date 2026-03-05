import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

export function setupWsProxy(server: Server): void {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL ?? "ws://localhost:18789";
  const token = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (clientWs) => {
    const gatewayWs = new WebSocket(gatewayUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    gatewayWs.on("open", () => {
      clientWs.on("message", (data) => {
        if (gatewayWs.readyState === WebSocket.OPEN) {
          gatewayWs.send(data);
        }
      });
    });

    gatewayWs.on("message", (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    const cleanup = () => {
      if (gatewayWs.readyState !== WebSocket.CLOSED) gatewayWs.close();
      if (clientWs.readyState !== WebSocket.CLOSED) clientWs.close();
    };
    clientWs.on("close", cleanup);
    gatewayWs.on("close", cleanup);
    gatewayWs.on("error", (err) => {
      console.error("[ws-proxy] Gateway error:", err.message);
      cleanup();
    });
    clientWs.on("error", (err) => {
      console.error("[ws-proxy] Client error:", err.message);
      cleanup();
    });
  });
}
