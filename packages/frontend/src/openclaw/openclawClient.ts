import type { OpenClawEvent } from "./types.ts";

type EventHandler = (event: OpenClawEvent) => void;
type StatusHandler = (status: "connecting" | "connected" | "disconnected") => void;
type DebugHandler = (state: GatewayDebugState) => void;

type GatewayPhase =
  | "idle"
  | "opening_socket"
  | "socket_open"
  | "waiting_challenge"
  | "sending_connect"
  | "waiting_hello"
  | "connected"
  | "disconnected";

export interface GatewayDebugState {
  attempt: number;
  url: string;
  resolvedUrl: string;
  phase: GatewayPhase;
  lastError: string | null;
  lastCloseCode: number | null;
  lastCloseReason: string | null;
  lastMessage: string | null;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

// Open Claw gateway WebSocket protocol (v3)
// Handshake: gateway sends connect.challenge → client sends connect → gateway sends hello-ok
const PROTOCOL_VERSION = 3;

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private eventHandlers: Set<EventHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private debugHandlers: Set<DebugHandler> = new Set();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private handshakeDone = false;
  private attempt = 0;
  private debugState: GatewayDebugState = {
    attempt: 0,
    url: "",
    resolvedUrl: "",
    phase: "idle",
    lastError: null,
    lastCloseCode: null,
    lastCloseReason: null,
    lastMessage: null,
  };

  constructor(
    private wsUrl: string,
    private token: string = "",
  ) {}

  setConfig(wsUrl: string, token: string): void {
    if (wsUrl) this.wsUrl = wsUrl;
    this.token = token;
    this._updateDebug({
      url: this.wsUrl,
      resolvedUrl: this._resolveWsUrl(this.wsUrl),
    });
  }

  connect(): void {
    this.shouldReconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._connect();
  }

  private _connect(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
    }

    this.handshakeDone = false;
    this._rejectPendingRequests("Connexion gateway interrompue.");
    this.attempt += 1;
    const resolvedUrl = this._resolveWsUrl(this.wsUrl);
    this._clearHandshakeTimer();
    this._updateDebug({
      attempt: this.attempt,
      url: this.wsUrl,
      resolvedUrl,
      phase: "opening_socket",
      lastError: null,
      lastCloseCode: null,
      lastCloseReason: null,
      lastMessage: null,
    });
    console.info("[openclaw] connecting", {
      attempt: this.attempt,
      url: this.wsUrl,
      resolvedUrl,
      tokenConfigured: Boolean(this.token),
    });
    this._notifyStatus("connecting");
    try {
      this.ws = new WebSocket(resolvedUrl);
      this.ws.binaryType = "arraybuffer";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[openclaw] websocket creation failed", {
        url: this.wsUrl,
        resolvedUrl,
        message,
      });
      this._updateDebug({
        phase: "disconnected",
        lastError: `Impossible d'ouvrir le WebSocket: ${message}`,
      });
      this._notifyStatus("disconnected");
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this._connect(), 3000);
      }
      return;
    }

    this.ws.onopen = () => {
      console.info("[openclaw] websocket open", { resolvedUrl });
      this._updateDebug({
        phase: "waiting_challenge",
      });
      this._startHandshakeTimer();
    };

    this.ws.onmessage = async (e: MessageEvent<string | ArrayBuffer | Blob>) => {
      const raw = await this._readMessageData(e.data);
      if (raw === null) {
        this._updateDebug({
          lastMessage: "[binary]",
        });
        console.warn("[openclaw] unsupported binary frame");
        return;
      }

      try {
        const msg = JSON.parse(raw) as Record<string, unknown>;
        this._updateDebug({
          lastMessage: this._summarizeMessage(msg),
        });
        console.info("[openclaw] message", this._summarizeMessage(msg));

        // Step 1: gateway sends connect.challenge → we send connect
        if (
          !this.handshakeDone &&
          msg.type === "event" &&
          msg.event === "connect.challenge"
        ) {
          this._updateDebug({
            phase: "sending_connect",
          });
          this._sendConnect();
          this._updateDebug({
            phase: "waiting_hello",
          });
          return;
        }

        if (
          !this.handshakeDone &&
          msg.type === "res" &&
          (msg as { ok?: boolean }).ok === false
        ) {
          const errorMessage = this._extractErrorMessage(msg);
          console.error("[openclaw] handshake rejected", errorMessage);
          this._updateDebug({
            phase: "disconnected",
            lastError: errorMessage,
          });
          this.ws?.close();
          return;
        }

        // Step 2: gateway sends hello-ok → handshake complete
        if (
          !this.handshakeDone &&
          msg.type === "res" &&
          (msg as { ok?: boolean }).ok === true &&
          (msg as { payload?: { type?: string } }).payload?.type === "hello-ok"
        ) {
          this.handshakeDone = true;
          this._clearHandshakeTimer();
          this._updateDebug({
            phase: "connected",
            lastError: null,
          });
          console.info("[openclaw] handshake complete");
          this._notifyStatus("connected");
          return;
        }

        if (msg.type === "res" && typeof msg.id === "string") {
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            this.pendingRequests.delete(msg.id);
            if ((msg as { ok?: boolean }).ok === true) {
              pending.resolve((msg as { payload?: unknown }).payload);
            } else {
              pending.reject(new Error(this._extractErrorMessage(msg)));
            }
            return;
          }
        }

        // Forward all other events to handlers
        if (this.handshakeDone) {
          this.eventHandlers.forEach((h) => h(msg as unknown as OpenClawEvent));
        }
      } catch {
        this._updateDebug({
          lastMessage: raw.slice(0, 200),
        });
        console.warn("[openclaw] malformed frame", raw.slice(0, 200));
      }
    };

    this.ws.onclose = (event) => {
      this.handshakeDone = false;
      this._clearHandshakeTimer();
      this._rejectPendingRequests("Connexion gateway fermee.");
      this._updateDebug({
        phase: "disconnected",
        lastCloseCode: event.code,
        lastCloseReason: event.reason || null,
      });
      console.warn("[openclaw] websocket closed", {
        code: event.code,
        reason: event.reason,
        shouldReconnect: this.shouldReconnect,
      });
      this._notifyStatus("disconnected");
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this._connect(), 3000);
      }
    };

    this.ws.onerror = () => {
      console.error("[openclaw] websocket error");
      this._updateDebug({
        lastError: "Erreur WebSocket. Regarde les details ci-dessous ou les logs console.",
      });
      // onclose fires after onerror — let it handle reconnect
    };
  }

  private _sendConnect(): void {
    const reqId = Math.random().toString(36).slice(2);
    const connectMsg = {
      type: "req",
      id: reqId,
      method: "connect",
      params: {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: "openclaw-control-ui",
          version: "0.1.0",
          platform: "web",
          mode: "webchat",
        },
        role: "operator",
        scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
        caps: [],
        commands: [],
        permissions: {},
        auth: this.token ? { token: this.token } : {},
        locale: navigator.language ?? "en",
        userAgent: "openclaw-pixel-ui/0.1.0",
      },
    };
    this.ws?.send(JSON.stringify(connectMsg));
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._clearHandshakeTimer();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.handshakeDone = false;
    this._rejectPendingRequests("Deconnexion manuelle.");
    this._updateDebug({
      phase: "disconnected",
      lastError: null,
    });
    console.info("[openclaw] manual disconnect");
    this._notifyStatus("disconnected");
  }

  send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.handshakeDone) {
      this.ws.send(JSON.stringify(data));
    }
  }

  request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    if (!(this.ws?.readyState === WebSocket.OPEN) || !this.handshakeDone) {
      return Promise.reject(new Error("Gateway non connecte."));
    }

    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.ws?.send(JSON.stringify({
        type: "req",
        id,
        method,
        params,
      }));
    });
  }

  on(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  onDebug(handler: DebugHandler): () => void {
    this.debugHandlers.add(handler);
    handler(this.debugState);
    return () => this.debugHandlers.delete(handler);
  }

  get connected(): boolean {
    return this.handshakeDone && this.ws?.readyState === WebSocket.OPEN;
  }

  getDebugState(): GatewayDebugState {
    return this.debugState;
  }

  private _notifyStatus(status: "connecting" | "connected" | "disconnected"): void {
    this.statusHandlers.forEach((h) => h(status));
  }

  private _resolveWsUrl(url: string): string {
    if (!url) return "";
    if (url.startsWith("ws://") || url.startsWith("wss://")) return url;
    const base = new URL(window.location.href);
    const resolved = new URL(url, base);
    resolved.protocol = resolved.protocol === "https:" ? "wss:" : "ws:";
    return resolved.toString();
  }

  private _extractErrorMessage(msg: Record<string, unknown>): string {
    const err = msg.error as { message?: string; code?: string } | undefined;
    if (err?.message && err?.code) return `${err.code}: ${err.message}`;
    if (err?.message) return err.message;
    if (err?.code) return err.code;
    return "Le gateway a rejete la connexion.";
  }

  private _summarizeMessage(msg: Record<string, unknown>): string {
    if (msg.type === "event" && typeof msg.event === "string") {
      return `event:${msg.event}`;
    }
    if (msg.type === "res") {
      const payloadType = (msg.payload as { type?: string } | undefined)?.type;
      const ok = (msg as { ok?: boolean }).ok === true ? "ok" : "error";
      return payloadType ? `res:${ok}:${payloadType}` : `res:${ok}`;
    }
    if (typeof msg.type === "string") return msg.type;
    return "message";
  }

  private async _readMessageData(data: string | ArrayBuffer | Blob): Promise<string | null> {
    if (typeof data === "string") return data;
    if (data instanceof ArrayBuffer) {
      return new TextDecoder().decode(new Uint8Array(data));
    }
    if (typeof Blob !== "undefined" && data instanceof Blob) {
      return await data.text();
    }
    return null;
  }

  private _startHandshakeTimer(): void {
    this._clearHandshakeTimer();
    this.handshakeTimer = setTimeout(() => {
      if (this.handshakeDone) return;
      const message = "Timeout: aucun handshake complet recu du gateway.";
      console.error("[openclaw] handshake timeout");
      this._updateDebug({
        phase: "disconnected",
        lastError: message,
      });
      this.ws?.close();
    }, 5000);
  }

  private _clearHandshakeTimer(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }

  private _rejectPendingRequests(message: string): void {
    if (this.pendingRequests.size === 0) return;
    const error = new Error(message);
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private _updateDebug(partial: Partial<GatewayDebugState>): void {
    this.debugState = {
      ...this.debugState,
      ...partial,
    };
    this.debugHandlers.forEach((handler) => handler(this.debugState));
  }
}

// L'instance par défaut passe par le proxy backend (/ws).
// Les instances distantes personnalisées remplacent ensuite cette config.
const gatewayToken = (window as unknown as { __OPENCLAW_TOKEN__?: string }).__OPENCLAW_TOKEN__ ?? "";
const gatewayWsUrl = (window as unknown as { __OPENCLAW_GATEWAY_URL__?: string }).__OPENCLAW_GATEWAY_URL__
  ?? "/ws";

export const gatewayClient = new OpenClawClient(gatewayWsUrl, gatewayToken);
