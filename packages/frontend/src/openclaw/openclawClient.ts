import type { OpenClawEvent } from "./types.ts";

type EventHandler = (event: OpenClawEvent) => void;
type StatusHandler = (status: "connecting" | "connected" | "disconnected") => void;

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private eventHandlers: Set<EventHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  constructor(private readonly wsUrl: string) {}

  connect(): void {
    this.shouldReconnect = true;
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

    this._notifyStatus("connecting");
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this._notifyStatus("connected");
    };

    this.ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as OpenClawEvent;
        this.eventHandlers.forEach((h) => h(event));
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onclose = () => {
      this._notifyStatus("disconnected");
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this._connect(), 3000);
      }
    };

    this.ws.onerror = () => {
      // onclose fires after onerror — let it handle reconnect
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this._notifyStatus("disconnected");
  }

  send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private _notifyStatus(status: "connecting" | "connected" | "disconnected"): void {
    this.statusHandlers.forEach((h) => h(status));
  }
}

export const gatewayClient = new OpenClawClient("/ws");
