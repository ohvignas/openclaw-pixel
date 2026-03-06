import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

export function setupWsProxy(server: Server): void {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL ?? "ws://localhost:18789";
  const token = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (clientWs, req) => {
    console.log("[ws-proxy] client connected", {
      origin: req.headers.origin ?? null,
      gatewayUrl,
      tokenConfigured: Boolean(token),
    });
    // Origin à déclarer au gateway — doit être dans gateway.controlUi.allowedOrigins
    const gatewayOrigin = req.headers.origin ?? process.env.PIXEL_UI_ORIGIN ?? "http://localhost:3333";
    const gatewayWs = new WebSocket(gatewayUrl, {
      headers: { Origin: gatewayOrigin },
    });

    gatewayWs.on("open", () => {
      console.log("[ws-proxy] upstream gateway open", { gatewayUrl, gatewayOrigin });
      clientWs.on("message", (data, isBinary) => {
        if (gatewayWs.readyState !== WebSocket.OPEN) return;
        // Injecter le token dans le message "connect" du handshake
        if (token && !isBinary) {
          try {
            const msg = JSON.parse(data.toString()) as Record<string, unknown>;
            if (msg.method === "connect") {
              console.log("[ws-proxy] injecting gateway token into connect handshake");
              const params = (msg.params ?? {}) as Record<string, unknown>;
              params.auth = { token };
              msg.params = params;
              gatewayWs.send(JSON.stringify(msg));
              return;
            }
          } catch {
            // message non-JSON, passer tel quel
          }
        }
        gatewayWs.send(data, { binary: isBinary });
      });
    });

    gatewayWs.on("message", (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    const cleanup = () => {
      if (gatewayWs.readyState !== WebSocket.CLOSED) gatewayWs.close();
      if (clientWs.readyState !== WebSocket.CLOSED) clientWs.close();
    };
    clientWs.on("close", (code, reason) => {
      console.log("[ws-proxy] client closed", { code, reason: reason.toString() });
      cleanup();
    });
    gatewayWs.on("close", (code, reason) => {
      console.log("[ws-proxy] upstream gateway closed", { code, reason: reason.toString() });
      cleanup();
    });
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
