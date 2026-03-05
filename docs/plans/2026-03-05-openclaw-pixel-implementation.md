# OpenClaw Pixel UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a pixel art web dashboard to manage Open Claw agents visually — chaque agent est un personnage dans un bureau top-down, on clique dessus pour chatter, gérer ses skills, tools, cron, hooks, et modèle.

**Architecture:** Monorepo avec deux packages (`frontend` React/Canvas, `backend` Express). Le frontend rend le monde pixel art via Canvas 2D et les panels UI via React. Le backend proxifie le WebSocket Open Claw et expose une API REST pour les opérations fichiers/CLI (clawhub, openclaw). Tout tourne dans Docker Compose avec l'image officielle Open Claw.

**Tech Stack:** React 19, Vite, TypeScript, Canvas 2D, Zustand, Express.js, Vitest, Tailwind CSS, Docker, nginx, MetroCity tileset

**Design doc:** `docs/plans/2026-03-05-openclaw-pixel-design.md`

---

## Phase 1 — Infrastructure

### Task 1: Scaffolding monorepo + Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `instances.json.example`
- Create: `packages/frontend/package.json`
- Create: `packages/backend/package.json`
- Create: `package.json` (root workspace)

**Step 1: Initialiser le monorepo npm workspace**

```bash
cd /Users/antoinevigneau/TEST
```

Créer `package.json` racine :

```json
{
  "name": "openclaw-pixel",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w packages/backend\" \"npm run dev -w packages/frontend\"",
    "build": "npm run build -w packages/frontend && npm run build -w packages/backend"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

**Step 2: Créer la structure de dossiers**

```bash
mkdir -p packages/frontend/src/{canvas,components,store,openclaw,api}
mkdir -p packages/frontend/public/assets/{tilesets,sprites}
mkdir -p packages/backend/src
mkdir -p config
```

**Step 3: Créer `packages/frontend/package.json`**

```json
{
  "name": "@openclaw-pixel/frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 4: Créer `packages/backend/package.json`**

```json
{
  "name": "@openclaw-pixel/backend",
  "version": "0.1.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.0",
    "@types/express": "^5.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 5: Créer `.env.example`**

```bash
# Clé API Anthropic (obligatoire)
ANTHROPIC_API_KEY=sk-ant-...

# URL interne du gateway Open Claw (ne pas changer en Docker)
OPENCLAW_GATEWAY_URL=ws://openclaw-gateway:18789

# Token d'accès gateway Open Claw
OPENCLAW_GATEWAY_TOKEN=

# Port de l'UI (défaut 3333)
PORT=3333
```

**Step 6: Créer `instances.json.example`**

```json
[
  {
    "id": "local",
    "name": "Mac Mini Local",
    "url": "ws://localhost:18789",
    "token": ""
  },
  {
    "id": "vps",
    "name": "VPS Production",
    "url": "wss://monvps.com:18789",
    "token": ""
  }
]
```

**Step 7: Créer `docker-compose.yml`**

```yaml
version: "3.9"

services:
  openclaw-gateway:
    image: ghcr.io/openclaw/openclaw:latest
    restart: unless-stopped
    volumes:
      - openclaw-data:/home/node/.openclaw
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    networks:
      - internal

  openclaw-cli:
    image: ghcr.io/openclaw/openclaw:latest
    network_mode: "service:openclaw-gateway"
    volumes:
      - openclaw-data:/home/node/.openclaw
    depends_on:
      - openclaw-gateway
    entrypoint: ["tail", "-f", "/dev/null"]

  pixel-ui:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "${PORT:-3333}:3000"
    volumes:
      - openclaw-data:/data/openclaw:ro
    environment:
      - OPENCLAW_GATEWAY_URL=ws://openclaw-gateway:18789
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
    depends_on:
      - openclaw-gateway
    networks:
      - internal

volumes:
  openclaw-data:

networks:
  internal:
    driver: bridge
```

**Step 8: Créer `Dockerfile`**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/backend/package*.json ./packages/backend/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/packages/backend/dist ./backend
COPY --from=builder /app/packages/frontend/dist ./public
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "backend/index.js"]
```

**Step 9: Commit**

```bash
git add .
git commit -m "feat: scaffold monorepo with Docker Compose and Open Claw integration"
```

---

### Task 2: Backend Express — WS proxy + API de base

**Files:**
- Create: `packages/backend/src/index.ts`
- Create: `packages/backend/src/ws-proxy.ts`
- Create: `packages/backend/src/routes/health.ts`
- Create: `packages/backend/tsconfig.json`
- Test: `packages/backend/src/__tests__/health.test.ts`

**Step 1: Créer `packages/backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

**Step 2: Ecrire le test health**

```typescript
// packages/backend/src/__tests__/health.test.ts
import { describe, it, expect } from "vitest";

describe("health endpoint", () => {
  it("returns ok status", async () => {
    const res = await fetch("http://localhost:3001/api/health");
    const data = await res.json();
    expect(data.status).toBe("ok");
  });
});
```

**Step 3: Créer `packages/backend/src/routes/health.ts`**

```typescript
import { Router } from "express";
export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});
```

**Step 4: Créer `packages/backend/src/ws-proxy.ts`**

Ce module proxifie le WebSocket du frontend vers le gateway Open Claw. Il lit `OPENCLAW_GATEWAY_URL` et `OPENCLAW_GATEWAY_TOKEN` depuis les variables d'environnement.

```typescript
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

export function setupWsProxy(server: Server): void {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL ?? "ws://localhost:18789";
  const token = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (clientWs) => {
    const url = token ? `${gatewayUrl}?token=${token}` : gatewayUrl;
    const gatewayWs = new WebSocket(url);

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
      gatewayWs.close();
      clientWs.close();
    };
    clientWs.on("close", cleanup);
    gatewayWs.on("close", cleanup);
    gatewayWs.on("error", () => cleanup());
  });
}
```

**Step 5: Créer `packages/backend/src/index.ts`**

```typescript
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { healthRouter } from "./routes/health.js";
import { setupWsProxy } from "./ws-proxy.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", healthRouter);

// Servir le build frontend en production
if (process.env.NODE_ENV === "production") {
  app.use(express.static("../public"));
  app.get("*", (_req, res) => res.sendFile("../public/index.html"));
}

const server = createServer(app);
setupWsProxy(server);

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`pixel-ui running on :${port}`));
```

**Step 6: Lancer et vérifier**

```bash
cd packages/backend && npx tsx src/index.ts &
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":...}
```

**Step 7: Commit**

```bash
git add packages/backend/
git commit -m "feat: backend Express with WebSocket proxy to Open Claw gateway"
```

---

### Task 3: Backend — API fichiers agents

**Files:**
- Create: `packages/backend/src/routes/files.ts`
- Test: `packages/backend/src/__tests__/files.test.ts`

**Step 1: Ecrire les tests**

```typescript
// packages/backend/src/__tests__/files.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const TEST_DIR = "/tmp/test-openclaw/agents/test-agent/workspace";

describe("files API", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, "AGENTS.md"), "# Test agent");
  });

  it("reads an agent file", async () => {
    process.env.OPENCLAW_DATA_PATH = "/tmp/test-openclaw";
    const res = await fetch("http://localhost:3001/api/files/test-agent/AGENTS.md");
    const data = await res.json();
    expect(data.content).toBe("# Test agent");
  });

  it("rejects files outside agent workspace", async () => {
    const res = await fetch("http://localhost:3001/api/files/test-agent/../../etc/passwd");
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Implémenter `packages/backend/src/routes/files.ts`**

```typescript
import { Router } from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve, normalize } from "path";

export const filesRouter = Router();

const ALLOWED_FILES = ["AGENTS.md", "SOUL.md", "IDENTITY.md", "USER.md", "TOOLS.md"];
const dataPath = process.env.OPENCLAW_DATA_PATH ?? "/data/openclaw";

function agentWorkspace(agentId: string): string {
  return join(dataPath, "agents", agentId, "workspace");
}

filesRouter.get("/:agentId/:filename", (req, res) => {
  const { agentId, filename } = req.params;
  if (!ALLOWED_FILES.includes(filename)) {
    res.status(400).json({ error: "File not allowed" });
    return;
  }
  const workspace = agentWorkspace(agentId);
  const filePath = resolve(join(workspace, filename));
  if (!filePath.startsWith(normalize(workspace))) {
    res.status(400).json({ error: "Path traversal detected" });
    return;
  }
  if (!existsSync(filePath)) {
    res.json({ content: "" });
    return;
  }
  res.json({ content: readFileSync(filePath, "utf-8") });
});

filesRouter.put("/:agentId/:filename", (req, res) => {
  const { agentId, filename } = req.params;
  const { content } = req.body as { content: string };
  if (!ALLOWED_FILES.includes(filename)) {
    res.status(400).json({ error: "File not allowed" });
    return;
  }
  const workspace = agentWorkspace(agentId);
  const filePath = resolve(join(workspace, filename));
  if (!filePath.startsWith(normalize(workspace))) {
    res.status(400).json({ error: "Path traversal detected" });
    return;
  }
  writeFileSync(filePath, content, "utf-8");
  res.json({ ok: true });
});
```

**Step 3: Enregistrer dans index.ts**

```typescript
// Ajouter dans packages/backend/src/index.ts
import { filesRouter } from "./routes/files.js";
app.use("/api/files", filesRouter);
```

**Step 4: Lancer les tests**

```bash
cd packages/backend && npm test
# Expected: PASS
```

**Step 5: Commit**

```bash
git add packages/backend/src/routes/files.ts
git commit -m "feat: backend API for reading/writing agent files (AGENTS.md, SOUL.md, etc.)"
```

---

### Task 4: Backend — API ClawHub + CLI wrapper

**Files:**
- Create: `packages/backend/src/routes/clawhub.ts`
- Create: `packages/backend/src/routes/cli.ts`

**Step 1: Créer `packages/backend/src/routes/clawhub.ts`**

Ce module wrapp le CLI `clawhub` pour search et install. Il utilise `child_process.exec` de manière sécurisée (pas d'interpolation shell directe).

```typescript
import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";

export const clawhubRouter = Router();
const execFileAsync = promisify(execFile);

clawhubRouter.get("/search", async (req, res) => {
  const query = String(req.query.q ?? "");
  try {
    const { stdout } = await execFileAsync("clawhub", ["search", query, "--json"]);
    res.json(JSON.parse(stdout));
  } catch (e) {
    res.status(500).json({ error: "clawhub search failed", detail: String(e) });
  }
});

clawhubRouter.post("/install", async (req, res) => {
  const { slug, agentId } = req.body as { slug: string; agentId: string };
  if (!/^[a-z0-9_-]+\/[a-z0-9_-]+$/.test(slug)) {
    res.status(400).json({ error: "Invalid slug format" });
    return;
  }
  const workdir = `/data/openclaw/agents/${agentId}/workspace`;
  try {
    await execFileAsync("clawhub", ["install", slug, "--workdir", workdir]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "clawhub install failed", detail: String(e) });
  }
});
```

**Step 2: Créer `packages/backend/src/routes/cli.ts`**

Wrapp les commandes `openclaw` CLI (agents list, hooks list/enable/disable, plugins list/install).

```typescript
import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";

export const cliRouter = Router();
const execFileAsync = promisify(execFile);

const ALLOWED_COMMANDS: Record<string, string[]> = {
  "agents:list": ["agents", "list", "--json"],
  "hooks:list": ["hooks", "list", "--json"],
  "plugins:list": ["plugins", "list", "--json"],
};

cliRouter.get("/run/:command", async (req, res) => {
  const args = ALLOWED_COMMANDS[req.params.command];
  if (!args) {
    res.status(400).json({ error: "Command not allowed" });
    return;
  }
  try {
    const { stdout } = await execFileAsync("openclaw", args);
    res.json(JSON.parse(stdout));
  } catch (e) {
    res.status(500).json({ error: "CLI command failed", detail: String(e) });
  }
});

cliRouter.post("/hooks/:action/:name", async (req, res) => {
  const { action, name } = req.params;
  if (!["enable", "disable"].includes(action)) {
    res.status(400).json({ error: "Invalid action" });
    return;
  }
  if (!/^[a-z0-9_-]+$/.test(name)) {
    res.status(400).json({ error: "Invalid hook name" });
    return;
  }
  try {
    await execFileAsync("openclaw", ["hooks", action, name]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed", detail: String(e) });
  }
});

cliRouter.post("/plugins/install", async (req, res) => {
  const { packageName } = req.body as { packageName: string };
  if (!/^(@[a-z0-9_-]+\/)?[a-z0-9_-]+$/.test(packageName)) {
    res.status(400).json({ error: "Invalid package name" });
    return;
  }
  try {
    await execFileAsync("openclaw", ["plugins", "install", packageName]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed", detail: String(e) });
  }
});
```

**Step 3: Enregistrer les routes dans index.ts**

```typescript
import { clawhubRouter } from "./routes/clawhub.js";
import { cliRouter } from "./routes/cli.js";
app.use("/api/clawhub", clawhubRouter);
app.use("/api/cli", cliRouter);
```

**Step 4: Commit**

```bash
git add packages/backend/src/routes/
git commit -m "feat: backend API for ClawHub skills install and OpenClaw CLI wrapper"
```

---

## Phase 2 — Frontend base + WebSocket

### Task 5: Frontend Vite + React + Tailwind setup

**Files:**
- Create: `packages/frontend/vite.config.ts`
- Create: `packages/frontend/tsconfig.json`
- Create: `packages/frontend/tailwind.config.js`
- Create: `packages/frontend/src/main.tsx`
- Create: `packages/frontend/src/App.tsx`
- Create: `packages/frontend/index.html`

**Step 1: Créer `packages/frontend/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
});
```

**Step 2: Créer `packages/frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

**Step 3: Créer `packages/frontend/tailwind.config.js`**

```javascript
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { pixel: ['"Press Start 2P"', "monospace"] },
      colors: {
        pixel: {
          bg: "#1a1a2e",
          panel: "#16213e",
          border: "#0f3460",
          accent: "#e94560",
          green: "#4ade80",
          yellow: "#fbbf24",
        },
      },
    },
  },
};
```

**Step 4: Créer `packages/frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OpenClaw Pixel UI</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
      rel="stylesheet"
    />
  </head>
  <body class="bg-pixel-bg">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 5: Créer `packages/frontend/src/main.tsx`**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 6: Créer `packages/frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { image-rendering: pixelated; }
```

**Step 7: Créer `packages/frontend/src/App.tsx` (squelette)**

```typescript
export function App() {
  return (
    <div className="flex flex-col h-screen bg-pixel-bg text-white font-pixel text-xs">
      <div id="top-bar" className="h-10 bg-pixel-panel border-b border-pixel-border flex items-center px-4">
        <span className="text-pixel-accent">OpenClaw</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <canvas id="office-canvas" className="flex-1" />
      </div>
    </div>
  );
}
```

**Step 8: Vérifier que ça compile**

```bash
cd packages/frontend && npm run dev
# Expected: Vite running on http://localhost:5173
```

**Step 9: Commit**

```bash
git add packages/frontend/
git commit -m "feat: frontend React+Vite+Tailwind scaffold with pixel art theme"
```

---

### Task 6: WebSocket client + event parser

**Files:**
- Create: `packages/frontend/src/openclaw/openclawClient.ts`
- Create: `packages/frontend/src/openclaw/eventParser.ts`
- Create: `packages/frontend/src/openclaw/types.ts`
- Test: `packages/frontend/src/openclaw/__tests__/eventParser.test.ts`

**Step 1: Définir les types dans `types.ts`**

```typescript
// packages/frontend/src/openclaw/types.ts

export type AgentStatus = "idle" | "working" | "waiting_approval" | "error" | "cron";

export interface AgentState {
  id: string;
  name: string;
  emoji: string;
  status: AgentStatus;
  currentTool?: string;
  currentToolDetail?: string;
  model?: string;
}

export interface OpenClawEvent {
  type: "req" | "res" | "event";
  event?: string;
  payload?: unknown;
  id?: string;
  ok?: boolean;
}

export interface GatewayMessage {
  type: string;
  payload: Record<string, unknown>;
}
```

**Step 2: Ecrire les tests pour eventParser**

```typescript
// packages/frontend/src/openclaw/__tests__/eventParser.test.ts
import { describe, it, expect } from "vitest";
import { parseEvent } from "../eventParser.ts";

describe("eventParser", () => {
  it("maps message:sent event to working status", () => {
    const event = {
      type: "event",
      event: "message:sent",
      payload: { agentId: "work", content: "Hello" },
    };
    const result = parseEvent(event);
    expect(result?.agentId).toBe("work");
    expect(result?.status).toBe("working");
  });

  it("maps exec.approval.requested to waiting_approval", () => {
    const event = {
      type: "event",
      event: "exec.approval.requested",
      payload: { agentId: "work" },
    };
    const result = parseEvent(event);
    expect(result?.status).toBe("waiting_approval");
  });

  it("returns null for unknown events", () => {
    expect(parseEvent({ type: "event", event: "unknown", payload: {} })).toBeNull();
  });
});
```

**Step 3: Lancer les tests pour vérifier qu'ils échouent**

```bash
cd packages/frontend && npm test
# Expected: FAIL — eventParser not found
```

**Step 4: Implémenter `eventParser.ts`**

```typescript
// packages/frontend/src/openclaw/eventParser.ts
import type { AgentStatus, OpenClawEvent } from "./types.ts";

interface ParsedAgentUpdate {
  agentId: string;
  status: AgentStatus;
  currentTool?: string;
  currentToolDetail?: string;
}

const EVENT_STATUS_MAP: Record<string, AgentStatus> = {
  "message:sent": "working",
  "message:received": "idle",
  "message:preprocessed": "working",
  "exec.approval.requested": "waiting_approval",
  "exec.approval.resolved": "working",
  "agent:bootstrap": "working",
  "command:new": "idle",
  "command:stop": "idle",
};

export function parseEvent(event: OpenClawEvent): ParsedAgentUpdate | null {
  if (event.type !== "event" || !event.event) return null;
  const status = EVENT_STATUS_MAP[event.event];
  if (!status) return null;
  const payload = event.payload as Record<string, unknown>;
  const agentId = String(payload?.agentId ?? "default");
  const currentTool = payload?.tool ? String(payload.tool) : undefined;
  return { agentId, status, currentTool };
}
```

**Step 5: Lancer les tests pour vérifier qu'ils passent**

```bash
cd packages/frontend && npm test
# Expected: PASS
```

**Step 6: Implémenter `openclawClient.ts`**

```typescript
// packages/frontend/src/openclaw/openclawClient.ts
import type { OpenClawEvent } from "./types.ts";

type EventHandler = (event: OpenClawEvent) => void;

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private handlers: Set<EventHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly wsUrl: string) {}

  connect(): void {
    if (this.ws) this.ws.close();
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as OpenClawEvent;
        this.handlers.forEach((h) => h(event));
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const gatewayClient = new OpenClawClient("/ws");
```

**Step 7: Commit**

```bash
git add packages/frontend/src/openclaw/
git commit -m "feat: OpenClaw WebSocket client and event parser with tests"
```

---

### Task 7: Agent store (Zustand)

**Files:**
- Create: `packages/frontend/src/store/agentStore.ts`
- Create: `packages/frontend/src/store/gatewayStore.ts`
- Test: `packages/frontend/src/store/__tests__/agentStore.test.ts`

**Step 1: Ecrire les tests**

```typescript
// packages/frontend/src/store/__tests__/agentStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "../agentStore.ts";

describe("agentStore", () => {
  beforeEach(() => {
    useAgentStore.setState({ agents: {} });
  });

  it("adds a new agent", () => {
    useAgentStore.getState().upsertAgent({ id: "work", name: "Worker", emoji: "💼", status: "idle" });
    expect(useAgentStore.getState().agents["work"]?.name).toBe("Worker");
  });

  it("updates agent status", () => {
    useAgentStore.getState().upsertAgent({ id: "work", name: "Worker", emoji: "💼", status: "idle" });
    useAgentStore.getState().setAgentStatus("work", "working", "exec", "npm test");
    const agent = useAgentStore.getState().agents["work"];
    expect(agent?.status).toBe("working");
    expect(agent?.currentTool).toBe("exec");
  });
});
```

**Step 2: Lancer les tests (doit échouer)**

```bash
npm test
# Expected: FAIL
```

**Step 3: Implémenter `agentStore.ts`**

```typescript
// packages/frontend/src/store/agentStore.ts
import { create } from "zustand";
import type { AgentState, AgentStatus } from "../openclaw/types.ts";

interface AgentStoreState {
  agents: Record<string, AgentState>;
  selectedAgentId: string | null;
  upsertAgent: (agent: AgentState) => void;
  setAgentStatus: (id: string, status: AgentStatus, tool?: string, detail?: string) => void;
  selectAgent: (id: string | null) => void;
}

export const useAgentStore = create<AgentStoreState>((set) => ({
  agents: {},
  selectedAgentId: null,
  upsertAgent: (agent) =>
    set((s) => ({ agents: { ...s.agents, [agent.id]: { ...s.agents[agent.id], ...agent } } })),
  setAgentStatus: (id, status, tool, detail) =>
    set((s) => ({
      agents: {
        ...s.agents,
        [id]: { ...s.agents[id]!, status, currentTool: tool, currentToolDetail: detail },
      },
    })),
  selectAgent: (id) => set({ selectedAgentId: id }),
}));
```

**Step 4: Implémenter `gatewayStore.ts`**

```typescript
// packages/frontend/src/store/gatewayStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Instance {
  id: string;
  name: string;
  url: string;
  token: string;
}

interface GatewayStore {
  status: "connecting" | "connected" | "disconnected";
  instances: Instance[];
  activeInstanceId: string;
  setStatus: (s: GatewayStore["status"]) => void;
  setActiveInstance: (id: string) => void;
  addInstance: (instance: Instance) => void;
}

export const useGatewayStore = create<GatewayStore>()(
  persist(
    (set) => ({
      status: "connecting",
      instances: [{ id: "default", name: "Local", url: "/ws", token: "" }],
      activeInstanceId: "default",
      setStatus: (status) => set({ status }),
      setActiveInstance: (id) => set({ activeInstanceId: id }),
      addInstance: (instance) => set((s) => ({ instances: [...s.instances, instance] })),
    }),
    { name: "gateway-store" }
  )
);
```

**Step 5: Lancer les tests**

```bash
npm test
# Expected: PASS
```

**Step 6: Connecter les events WebSocket au store dans App.tsx**

```typescript
// Ajouter dans App.tsx useEffect
import { useEffect } from "react";
import { gatewayClient } from "./openclaw/openclawClient.ts";
import { parseEvent } from "./openclaw/eventParser.ts";
import { useAgentStore } from "./store/agentStore.ts";
import { useGatewayStore } from "./store/gatewayStore.ts";

// Dans le composant App:
const { upsertAgent, setAgentStatus } = useAgentStore();
const { setStatus } = useGatewayStore();

useEffect(() => {
  gatewayClient.connect();
  const unsub = gatewayClient.on((event) => {
    const update = parseEvent(event);
    if (update) setAgentStatus(update.agentId, update.status, update.currentTool);
  });
  return () => { unsub(); gatewayClient.disconnect(); };
}, []);
```

**Step 7: Commit**

```bash
git add packages/frontend/src/store/
git commit -m "feat: Zustand stores for agents and gateway state with tests"
```

---

## Phase 3 — Canvas pixel art

### Task 8: Chargement des assets MetroCity

**Files:**
- Create: `packages/frontend/src/canvas/assetLoader.ts`
- Create: `packages/frontend/public/assets/README.md`
- Test: `packages/frontend/src/canvas/__tests__/assetLoader.test.ts`

**Step 1: Télécharger les assets MetroCity**

Aller sur https://jik-a-4.itch.io/metrocity-free-topdown-character-pack et télécharger le pack gratuit. Placer les fichiers dans :

```
packages/frontend/public/assets/
  sprites/
    characters.png    ← spritesheet personnages MetroCity
  tilesets/
    office.png        ← tileset bureau (sol, murs, meubles)
```

**Step 2: Créer `assetLoader.ts`**

```typescript
// packages/frontend/src/canvas/assetLoader.ts

export interface GameAssets {
  characters: HTMLImageElement;
  officeTiles: HTMLImageElement;
}

let cached: GameAssets | null = null;

export async function loadAssets(): Promise<GameAssets> {
  if (cached) return cached;

  const [characters, officeTiles] = await Promise.all([
    loadImage("/assets/sprites/characters.png"),
    loadImage("/assets/tilesets/office.png"),
  ]);

  cached = { characters, officeTiles };
  return cached;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}
```

**Step 3: Commit**

```bash
git add packages/frontend/src/canvas/assetLoader.ts
git commit -m "feat: asset loader for MetroCity sprites and office tilesets"
```

---

### Task 9: OfficeState + game loop

**Files:**
- Create: `packages/frontend/src/canvas/OfficeState.ts`
- Create: `packages/frontend/src/canvas/pathfinder.ts`
- Test: `packages/frontend/src/canvas/__tests__/OfficeState.test.ts`

**Step 1: Ecrire les tests**

```typescript
// packages/frontend/src/canvas/__tests__/OfficeState.test.ts
import { describe, it, expect } from "vitest";
import { OfficeState } from "../OfficeState.ts";

describe("OfficeState", () => {
  it("adds a character for a new agent", () => {
    const state = new OfficeState(800, 600);
    state.upsertCharacter("work", { id: "work", name: "Worker", emoji: "💼", status: "idle" });
    expect(state.characters.size).toBe(1);
  });

  it("moves character to desk when status changes to working", () => {
    const state = new OfficeState(800, 600);
    state.upsertCharacter("work", { id: "work", name: "Worker", emoji: "💼", status: "idle" });
    state.setCharacterStatus("work", "working");
    const char = state.characters.get("work")!;
    expect(char.targetState).toBe("seated");
  });
});
```

**Step 2: Implémenter `pathfinder.ts` (BFS simple)**

```typescript
// packages/frontend/src/canvas/pathfinder.ts

export interface Point { x: number; y: number; }

export function bfsPath(
  from: Point,
  to: Point,
  walkable: (x: number, y: number) => boolean
): Point[] {
  const queue: Array<{ pos: Point; path: Point[] }> = [{ pos: from, path: [from] }];
  const visited = new Set<string>();
  const key = (p: Point) => `${p.x},${p.y}`;

  while (queue.length) {
    const { pos, path } = queue.shift()!;
    if (pos.x === to.x && pos.y === to.y) return path;
    if (visited.has(key(pos))) continue;
    visited.add(key(pos));

    for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const next = { x: pos.x + dx, y: pos.y + dy };
      if (!visited.has(key(next)) && walkable(next.x, next.y)) {
        queue.push({ pos: next, path: [...path, next] });
      }
    }
  }
  return [from]; // no path found, stay
}
```

**Step 3: Implémenter `OfficeState.ts`**

```typescript
// packages/frontend/src/canvas/OfficeState.ts
import type { AgentState, AgentStatus } from "../openclaw/types.ts";
import { bfsPath, type Point } from "./pathfinder.ts";

export type CharacterState = "walking" | "seated" | "standing" | "idle";

export interface Character {
  agentId: string;
  name: string;
  emoji: string;
  pos: Point;
  targetPos: Point;
  path: Point[];
  state: CharacterState;
  targetState: CharacterState;
  spriteRow: number; // row dans le spritesheet MetroCity
  animFrame: number;
  status: AgentStatus;
}

// Positions des bureaux dans la carte (en tiles)
const DESK_POSITIONS: Point[] = [
  { x: 3, y: 4 }, { x: 6, y: 4 }, { x: 9, y: 4 },
  { x: 3, y: 7 }, { x: 6, y: 7 }, { x: 9, y: 7 },
];

const IDLE_ZONE: Point = { x: 12, y: 8 }; // salle de pause

export class OfficeState {
  characters: Map<string, Character> = new Map();
  private deskAssignments: Map<string, Point> = new Map();
  private usedDesks: Set<string> = new Set();

  constructor(
    readonly width: number,
    readonly height: number
  ) {}

  private getOrAssignDesk(agentId: string): Point {
    if (this.deskAssignments.has(agentId)) return this.deskAssignments.get(agentId)!;
    const free = DESK_POSITIONS.find((d) => !this.usedDesks.has(`${d.x},${d.y}`));
    const desk = free ?? { x: 3, y: 4 }; // fallback
    this.deskAssignments.set(agentId, desk);
    this.usedDesks.add(`${desk.x},${desk.y}`);
    return desk;
  }

  upsertCharacter(agentId: string, agent: AgentState): void {
    if (!this.characters.has(agentId)) {
      const pos = { x: 1, y: 1 };
      this.characters.set(agentId, {
        agentId,
        name: agent.name,
        emoji: agent.emoji,
        pos: { ...pos },
        targetPos: { ...pos },
        path: [],
        state: "standing",
        targetState: "standing",
        spriteRow: this.characters.size % 6,
        animFrame: 0,
        status: agent.status,
      });
    }
    this.setCharacterStatus(agentId, agent.status);
  }

  setCharacterStatus(agentId: string, status: AgentStatus): void {
    const char = this.characters.get(agentId);
    if (!char) return;
    char.status = status;

    if (status === "working" || status === "cron") {
      const desk = this.getOrAssignDesk(agentId);
      char.targetPos = desk;
      char.targetState = "seated";
    } else {
      char.targetPos = { ...IDLE_ZONE, x: IDLE_ZONE.x + Math.random() * 3 | 0 };
      char.targetState = "standing";
    }
    // Recalculate path
    char.path = bfsPath(char.pos, char.targetPos, () => true);
  }

  tick(deltaMs: number): void {
    const speed = 0.004; // tiles/ms
    for (const char of this.characters.values()) {
      if (char.path.length > 1) {
        const next = char.path[1];
        const dx = next.x - char.pos.x;
        const dy = next.y - char.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const move = speed * deltaMs;
        if (move >= dist) {
          char.pos = { ...next };
          char.path.shift();
        } else {
          char.pos.x += (dx / dist) * move;
          char.pos.y += (dy / dist) * move;
        }
        char.state = "walking";
      } else if (char.path.length <= 1) {
        char.state = char.targetState;
      }
      // Animate sprite frame (4 frames, 150ms each)
      char.animFrame = Math.floor(Date.now() / 150) % 4;
    }
  }
}
```

**Step 4: Lancer les tests**

```bash
npm test
# Expected: PASS
```

**Step 5: Commit**

```bash
git add packages/frontend/src/canvas/
git commit -m "feat: OfficeState game engine with BFS pathfinding and character state machine"
```

---

### Task 10: OfficeCanvas React component

**Files:**
- Create: `packages/frontend/src/canvas/OfficeCanvas.tsx`
- Modify: `packages/frontend/src/App.tsx`

**Step 1: Implémenter `OfficeCanvas.tsx`**

Ce composant initialise le canvas, charge les assets, lance le game loop, et rend le monde pixel art. La taille de chaque tile est 32x32 pixels. Les personnages MetroCity font 32x48 pixels (4 frames d'animation, 6 directions).

```typescript
// packages/frontend/src/canvas/OfficeCanvas.tsx
import { useRef, useEffect, useCallback } from "react";
import { OfficeState } from "./OfficeState.ts";
import { loadAssets } from "./assetLoader.ts";
import { useAgentStore } from "../store/agentStore.ts";

const TILE_SIZE = 32;

export function OfficeCanvas({ onAgentClick }: { onAgentClick: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const officeRef = useRef<OfficeState | null>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const agents = useAgentStore((s) => s.agents);

  // Sync agents to OfficeState
  useEffect(() => {
    if (!officeRef.current) return;
    for (const agent of Object.values(agents)) {
      officeRef.current.upsertCharacter(agent.id, agent);
    }
  }, [agents]);

  const startLoop = useCallback(async (canvas: HTMLCanvasElement) => {
    const assets = await loadAssets();
    const office = new OfficeState(canvas.width, canvas.height);
    officeRef.current = office;

    const loop = (time: number) => {
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;
      office.tick(delta);
      drawFrame(canvas, office, assets);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    startLoop(canvas);
    return () => cancelAnimationFrame(animRef.current);
  }, [startLoop]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !officeRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / TILE_SIZE;
    const my = (e.clientY - rect.top) / TILE_SIZE;
    for (const char of officeRef.current.characters.values()) {
      if (Math.abs(char.pos.x - mx) < 1 && Math.abs(char.pos.y - my) < 1.5) {
        onAgentClick(char.agentId);
        break;
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer"
      onClick={handleClick}
    />
  );
}

function drawFrame(canvas: HTMLCanvasElement, office: OfficeState, assets: Awaited<ReturnType<typeof loadAssets>>) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw floor (brown tiles)
  ctx.fillStyle = "#8B6914";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw characters
  for (const char of office.characters.values()) {
    const sx = char.animFrame * 32; // frame X in spritesheet
    const sy = char.spriteRow * 48; // character row Y
    const dx = char.pos.x * TILE_SIZE;
    const dy = char.pos.y * TILE_SIZE;

    // Status indicator above character
    ctx.font = "16px sans-serif";
    ctx.fillText(
      char.status === "working" ? "⚡" :
      char.status === "waiting_approval" ? "❓" :
      char.status === "error" ? "⚠️" : "",
      dx, dy - 4
    );

    // Draw sprite (placeholder: colored rectangle if sprite not loaded)
    try {
      ctx.drawImage(assets.characters, sx, sy, 32, 48, dx - 16, dy - 24, 32, 48);
    } catch {
      ctx.fillStyle = char.status === "working" ? "#4ade80" : "#94a3b8";
      ctx.fillRect(dx - 12, dy - 24, 24, 32);
    }

    // Name label
    ctx.fillStyle = "white";
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.fillText(char.name.slice(0, 6), dx - 12, dy + 16);
  }
}
```

**Step 2: Connecter dans App.tsx**

```typescript
// App.tsx — remplacer le canvas statique par OfficeCanvas
import { OfficeCanvas } from "./canvas/OfficeCanvas.tsx";
import { useAgentStore } from "./store/agentStore.ts";

// Dans App:
const selectAgent = useAgentStore((s) => s.selectAgent);

// Dans le JSX:
<OfficeCanvas onAgentClick={selectAgent} />
```

**Step 3: Vérifier visuellement**

```bash
npm run dev
# Ouvrir http://localhost:5173 — doit afficher le canvas avec fond marron
```

**Step 4: Commit**

```bash
git add packages/frontend/src/canvas/OfficeCanvas.tsx packages/frontend/src/App.tsx
git commit -m "feat: OfficeCanvas pixel art renderer with character sprites and click detection"
```

---

## Phase 4 — UI panels

### Task 11: Top bar (statut + instance switcher)

**Files:**
- Create: `packages/frontend/src/components/TopBar.tsx`

```typescript
// packages/frontend/src/components/TopBar.tsx
import { useGatewayStore } from "../store/gatewayStore.ts";
import { useAgentStore } from "../store/agentStore.ts";

export function TopBar() {
  const { status, instances, activeInstanceId, setActiveInstance } = useGatewayStore();
  const agents = useAgentStore((s) => s.agents);
  const activeCount = Object.values(agents).filter((a) => a.status === "working").length;

  const statusColor = {
    connected: "bg-pixel-green",
    connecting: "bg-pixel-yellow",
    disconnected: "bg-pixel-accent",
  }[status];

  return (
    <div className="h-10 bg-pixel-panel border-b border-pixel-border flex items-center px-4 gap-4 text-xs font-pixel">
      <span className="text-pixel-accent tracking-wider">OPENCLAW</span>
      <div className={`w-2 h-2 rounded-full ${statusColor}`} title={status} />
      <span className="text-gray-400">{activeCount} actifs</span>
      <div className="ml-auto flex items-center gap-2">
        <select
          className="bg-pixel-bg border border-pixel-border text-white text-xs px-2 py-1"
          value={activeInstanceId}
          onChange={(e) => setActiveInstance(e.target.value)}
        >
          {instances.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <button className="text-pixel-accent hover:text-white px-2 py-1 border border-pixel-border">
          ⚙
        </button>
      </div>
    </div>
  );
}
```

Commit : `git commit -m "feat: TopBar with connection status and instance switcher"`

---

### Task 12: Panneau agent — conteneur + onglets

**Files:**
- Create: `packages/frontend/src/components/AgentPanel/index.tsx`
- Create: `packages/frontend/src/components/AgentPanel/tabs/LiveTab.tsx`
- Create: `packages/frontend/src/components/AgentPanel/tabs/ChatTab.tsx`
- Create: `packages/frontend/src/components/AgentPanel/tabs/SkillsTab.tsx`
- Create: `packages/frontend/src/components/AgentPanel/tabs/ToolsTab.tsx`
- Create: `packages/frontend/src/components/AgentPanel/tabs/ModelTab.tsx`
- Create: `packages/frontend/src/components/AgentPanel/tabs/FilesTab.tsx`
- Create: `packages/frontend/src/components/AgentPanel/tabs/CronTab.tsx`
- Create: `packages/frontend/src/components/AgentPanel/tabs/HooksTab.tsx`

**Step 1: Créer le conteneur `AgentPanel/index.tsx`**

```typescript
import { useState } from "react";
import { useAgentStore } from "../../store/agentStore.ts";
import { LiveTab } from "./tabs/LiveTab.tsx";
import { ChatTab } from "./tabs/ChatTab.tsx";
import { SkillsTab } from "./tabs/SkillsTab.tsx";
import { ToolsTab } from "./tabs/ToolsTab.tsx";
import { ModelTab } from "./tabs/ModelTab.tsx";
import { FilesTab } from "./tabs/FilesTab.tsx";
import { CronTab } from "./tabs/CronTab.tsx";
import { HooksTab } from "./tabs/HooksTab.tsx";

const TABS = [
  { id: "live", label: "Live", icon: "👁" },
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "skills", label: "Skills", icon: "🧩" },
  { id: "tools", label: "Tools", icon: "🔧" },
  { id: "model", label: "Modele", icon: "🤖" },
  { id: "files", label: "Fichiers", icon: "📁" },
  { id: "cron", label: "Cron", icon: "⏰" },
  { id: "hooks", label: "Hooks", icon: "🎣" },
] as const;

type TabId = typeof TABS[number]["id"];

export function AgentPanel() {
  const { selectedAgentId, agents, selectAgent } = useAgentStore();
  const [activeTab, setActiveTab] = useState<TabId>("live");

  if (!selectedAgentId) return null;
  const agent = agents[selectedAgentId];
  if (!agent) return null;

  return (
    <div className="w-96 bg-pixel-panel border-l border-pixel-border flex flex-col h-full font-pixel text-xs">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-pixel-border">
        <span className="text-pixel-accent">{agent.emoji} {agent.name}</span>
        <button onClick={() => selectAgent(null)} className="text-gray-500 hover:text-white">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-pixel-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-2 text-xs ${activeTab === tab.id ? "bg-pixel-border text-white" : "text-gray-500 hover:text-gray-300"}`}
            title={tab.label}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "live" && <LiveTab agentId={selectedAgentId} />}
        {activeTab === "chat" && <ChatTab agentId={selectedAgentId} />}
        {activeTab === "skills" && <SkillsTab agentId={selectedAgentId} />}
        {activeTab === "tools" && <ToolsTab agentId={selectedAgentId} />}
        {activeTab === "model" && <ModelTab agentId={selectedAgentId} />}
        {activeTab === "files" && <FilesTab agentId={selectedAgentId} />}
        {activeTab === "cron" && <CronTab agentId={selectedAgentId} />}
        {activeTab === "hooks" && <HooksTab agentId={selectedAgentId} />}
      </div>
    </div>
  );
}
```

Commit : `git commit -m "feat: AgentPanel container with 8 tabs"`

---

### Task 13: LiveTab — flux temps réel

**Files:**
- Create: `packages/frontend/src/components/AgentPanel/tabs/LiveTab.tsx`
- Modify: `packages/frontend/src/store/agentStore.ts` (ajouter eventLog)

**Step 1: Ajouter eventLog dans agentStore.ts**

```typescript
// Ajouter au store
interface AgentEvent {
  timestamp: number;
  agentId: string;
  type: string;
  detail: string;
}

// Dans l'état :
eventLog: AgentEvent[];
addEvent: (event: AgentEvent) => void;

// Dans l'implémentation :
eventLog: [],
addEvent: (event) => set((s) => ({
  eventLog: [event, ...s.eventLog].slice(0, 200)
})),
```

**Step 2: Implémenter LiveTab.tsx**

```typescript
import { useAgentStore } from "../../../store/agentStore.ts";

export function LiveTab({ agentId }: { agentId: string }) {
  const eventLog = useAgentStore((s) => s.eventLog.filter((e) => e.agentId === agentId));
  const agent = useAgentStore((s) => s.agents[agentId]);

  return (
    <div className="space-y-2">
      {agent?.currentTool && (
        <div className="bg-pixel-border p-2 text-pixel-green text-xs">
          ⚡ {agent.currentTool}
          {agent.currentToolDetail && <span className="text-gray-400 ml-2">{agent.currentToolDetail}</span>}
        </div>
      )}
      <div className="space-y-1">
        {eventLog.length === 0 && <p className="text-gray-600">Aucun événement</p>}
        {eventLog.map((e, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="text-gray-600 shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
            <span className="text-gray-300">{e.type}</span>
            <span className="text-gray-500 truncate">{e.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Commit : `git commit -m "feat: LiveTab showing real-time agent events"`

---

### Task 14: ChatTab — conversation avec l'agent

**Files:**
- Create: `packages/frontend/src/components/AgentPanel/tabs/ChatTab.tsx`

```typescript
import { useState, useRef, useEffect } from "react";
import { gatewayClient } from "../../../openclaw/openclawClient.ts";

interface Message { role: "user" | "agent"; content: string; ts: number; }

export function ChatTab({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    gatewayClient.send({
      type: "req",
      id: crypto.randomUUID(),
      method: "agent.message",
      params: { agentId, content: input.trim() },
    });
    setMessages((m) => [...m, { role: "user", content: input.trim(), ts: Date.now() }]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`p-2 text-xs ${m.role === "user" ? "bg-pixel-border text-white" : "bg-pixel-bg text-gray-300"}`}>
            <span className="text-pixel-accent">{m.role === "user" ? "Toi" : "Agent"} </span>
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-pixel-bg border border-pixel-border text-white text-xs px-2 py-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message..."
        />
        <button
          onClick={send}
          className="bg-pixel-accent text-white px-3 py-1 text-xs hover:opacity-80"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
```

Commit : `git commit -m "feat: ChatTab for real-time conversation with agent"`

---

### Task 15: SkillsTab + intégration ClawHub

**Files:**
- Create: `packages/frontend/src/components/AgentPanel/tabs/SkillsTab.tsx`
- Create: `packages/frontend/src/api/clawhub.ts`

**Step 1: Créer `src/api/clawhub.ts`**

```typescript
export interface ClawHubSkill {
  slug: string;
  name: string;
  description: string;
  author: string;
  stars: number;
}

export async function searchSkills(q: string): Promise<ClawHubSkill[]> {
  const res = await fetch(`/api/clawhub/search?q=${encodeURIComponent(q)}`);
  return res.json();
}

export async function installSkill(slug: string, agentId: string): Promise<void> {
  const res = await fetch("/api/clawhub/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, agentId }),
  });
  if (!res.ok) throw new Error("Install failed");
}
```

**Step 2: Implémenter SkillsTab.tsx**

```typescript
import { useState } from "react";
import { searchSkills, installSkill, type ClawHubSkill } from "../../../api/clawhub.ts";

export function SkillsTab({ agentId }: { agentId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClawHubSkill[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);
  const [showHub, setShowHub] = useState(false);

  const search = async () => {
    const res = await searchSkills(query);
    setResults(res);
    setShowHub(true);
  };

  const install = async (skill: ClawHubSkill) => {
    setInstalling(skill.slug);
    try {
      await installSkill(skill.slug, agentId);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="flex-1 bg-pixel-bg border border-pixel-border text-white text-xs px-2 py-1"
          placeholder="Chercher sur ClawHub..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button onClick={search} className="bg-pixel-accent text-white px-3 py-1 text-xs">
          🔍
        </button>
      </div>

      {showHub && (
        <div className="space-y-2">
          {results.map((skill) => (
            <div key={skill.slug} className="bg-pixel-bg border border-pixel-border p-2 flex justify-between items-start gap-2">
              <div>
                <div className="text-white text-xs">{skill.name}</div>
                <div className="text-gray-500 text-xs mt-1">{skill.description}</div>
                <div className="text-gray-600 text-xs mt-1">★ {skill.stars}</div>
              </div>
              <button
                onClick={() => install(skill)}
                disabled={installing === skill.slug}
                className="bg-pixel-green text-black text-xs px-2 py-1 shrink-0 hover:opacity-80 disabled:opacity-50"
              >
                {installing === skill.slug ? "..." : "+ Install"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Commit : `git commit -m "feat: SkillsTab with ClawHub search and one-click install"`

---

### Task 16: ToolsTab, ModelTab, FilesTab, CronTab, HooksTab

Ces 5 onglets suivent le même pattern. Implémenter dans l'ordre.

**ToolsTab.tsx** — toggles visuels pour les tools :

```typescript
import { useState, useEffect } from "react";

const TOOL_GROUPS = [
  { group: "group:runtime", label: "Exécution", tools: ["exec", "bash", "process"] },
  { group: "group:fs", label: "Fichiers", tools: ["read", "write", "edit"] },
  { group: "group:web", label: "Web", tools: ["web_search", "web_fetch", "browser"] },
  { group: "group:messaging", label: "Messaging", tools: ["message"] },
  { group: "group:automation", label: "Automation", tools: ["cron", "gateway"] },
];

export function ToolsTab({ agentId }: { agentId: string }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  const toggle = (tool: string) => {
    setEnabled((e) => ({ ...e, [tool]: !e[tool] }));
    // TODO: persist via openclaw config API
  };

  return (
    <div className="space-y-4">
      {TOOL_GROUPS.map((group) => (
        <div key={group.group}>
          <div className="text-gray-500 text-xs mb-2 uppercase tracking-wider">{group.label}</div>
          <div className="space-y-1">
            {group.tools.map((tool) => (
              <label key={tool} className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => toggle(tool)}
                  className={`w-8 h-4 relative cursor-pointer ${enabled[tool] !== false ? "bg-pixel-green" : "bg-gray-700"}`}
                >
                  <div className={`absolute top-0 w-4 h-4 bg-white transition-transform ${enabled[tool] !== false ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <span className="text-gray-300 text-xs">{tool}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**ModelTab.tsx** — dropdown provider/modèle :

```typescript
const PROVIDERS = [
  { label: "Anthropic", models: ["anthropic/claude-opus-4-6", "anthropic/claude-sonnet-4-6", "anthropic/claude-haiku-4-5"] },
  { label: "OpenAI", models: ["openai/gpt-4o", "openai/gpt-4o-mini"] },
  { label: "Mistral", models: ["mistral/mistral-large", "mistral/mistral-small"] },
  { label: "Ollama (local)", models: ["ollama/llama3", "ollama/mistral", "ollama/gemma"] },
  { label: "OpenRouter", models: ["openrouter/auto"] },
];

export function ModelTab({ agentId }: { agentId: string }) {
  const [selected, setSelected] = useState("anthropic/claude-opus-4-6");

  return (
    <div className="space-y-3">
      <div className="text-gray-500 text-xs">Modele actif</div>
      <div className="bg-pixel-bg border border-pixel-border p-2 text-pixel-green text-xs">
        {selected}
      </div>
      <div className="text-gray-500 text-xs mt-4">Changer le modele</div>
      {PROVIDERS.map((p) => (
        <div key={p.label}>
          <div className="text-gray-600 text-xs mb-1">{p.label}</div>
          <div className="space-y-1">
            {p.models.map((m) => (
              <button
                key={m}
                onClick={() => setSelected(m)}
                className={`w-full text-left text-xs px-2 py-1 border ${selected === m ? "border-pixel-green text-pixel-green" : "border-pixel-border text-gray-400 hover:text-white"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**FilesTab.tsx** — éditeur pour les fichiers bootstrap :

```typescript
import { useState, useEffect } from "react";

const FILES = ["AGENTS.md", "SOUL.md", "IDENTITY.md", "USER.md"];

export function FilesTab({ agentId }: { agentId: string }) {
  const [selected, setSelected] = useState("AGENTS.md");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/files/${agentId}/${selected}`)
      .then((r) => r.json())
      .then((d) => setContent(d.content ?? ""));
  }, [agentId, selected]);

  const save = async () => {
    setSaving(true);
    await fetch(`/api/files/${agentId}/${selected}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex gap-1">
        {FILES.map((f) => (
          <button
            key={f}
            onClick={() => setSelected(f)}
            className={`text-xs px-2 py-1 border ${selected === f ? "border-pixel-accent text-pixel-accent" : "border-pixel-border text-gray-500"}`}
          >
            {f.replace(".md", "")}
          </button>
        ))}
      </div>
      <textarea
        className="flex-1 bg-pixel-bg border border-pixel-border text-gray-300 text-xs p-2 font-mono resize-none"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button
        onClick={save}
        disabled={saving}
        className="bg-pixel-accent text-white text-xs py-1 hover:opacity-80 disabled:opacity-50"
      >
        {saving ? "Sauvegarde..." : "Sauvegarder"}
      </button>
    </div>
  );
}
```

**CronTab.tsx** et **HooksTab.tsx** — lister via `/api/cli/run/...` avec toggle enable/disable. Même pattern que ToolsTab mais données depuis l'API.

Commit : `git commit -m "feat: ToolsTab, ModelTab, FilesTab, CronTab, HooksTab implementations"`

---

## Phase 5 — Panneau Gateway

### Task 17: GatewayPanel (Plugins, Hooks globaux, Routing, Canaux)

**Files:**
- Create: `packages/frontend/src/components/GatewayPanel/index.tsx`
- Create: `packages/frontend/src/components/GatewayPanel/tabs/PluginsTab.tsx`
- Create: `packages/frontend/src/components/GatewayPanel/tabs/GlobalHooksTab.tsx`
- Create: `packages/frontend/src/components/GatewayPanel/tabs/RoutingTab.tsx`
- Create: `packages/frontend/src/components/GatewayPanel/tabs/ChannelsTab.tsx`

Le pattern est identique à AgentPanel. Chaque onglet appelle `/api/cli/run/<command>` pour lire les données et l'API correspondante pour les mutations.

**RoutingTab** affiche les bindings sous forme de liste visuelle :

```
[WhatsApp perso] ──→ [Agent: chat 💬]
[WhatsApp biz]   ──→ [Agent: work 💼]
```

Avec des boutons pour modifier ou supprimer chaque binding, et un formulaire "Ajouter binding".

Commit : `git commit -m "feat: GatewayPanel with Plugins, Hooks, Routing and Channels tabs"`

---

## Phase 6 — Docker final + README

### Task 18: Dockerfile multi-stage optimisé + nginx

**Files:**
- Modify: `Dockerfile`
- Create: `nginx.conf`

**nginx.conf** :

```nginx
server {
  listen 80;
  root /app/public;
  index index.html;

  location /api/ {
    proxy_pass http://localhost:3000/api/;
  }

  location /ws {
    proxy_pass http://localhost:3000/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Commit : `git commit -m "feat: production Dockerfile with nginx and Node backend"`

---

### Task 19: README utilisateur final

**Files:**
- Modify: `README.md`

Le README doit contenir **uniquement** les étapes pour un non-dev :

```markdown
# OpenClaw Pixel UI

Interface visuelle pixel art pour gérer tes agents Open Claw.

## Installation (2 minutes)

1. Installe [Docker Desktop](https://docker.com/get-started)
2. Ouvre un terminal et copie-colle :

git clone https://github.com/<user>/openclaw-pixel
cd openclaw-pixel
cp .env.example .env

3. Ouvre le fichier `.env` avec un éditeur de texte, colle ta clé Anthropic
4. Lance :

docker compose up -d

5. Ouvre http://localhost:3333

## Ajouter une instance (VPS, second serveur)

Modifie `instances.json` en copiant l'exemple `instances.json.example`,
puis recharge la page. Tu peux switcher d'instance depuis la barre en haut.
```

Commit : `git commit -m "docs: user-friendly README with 5-step installation"`

---

## Ordre d'exécution recommandé

```
Task 1  → scaffolding monorepo
Task 2  → backend WS proxy
Task 3  → backend files API
Task 4  → backend clawhub + CLI
Task 5  → frontend Vite setup
Task 6  → WS client + event parser
Task 7  → Zustand stores
Task 8  → asset loader
Task 9  → OfficeState + pathfinding
Task 10 → OfficeCanvas renderer
Task 11 → TopBar
Task 12 → AgentPanel container
Task 13 → LiveTab
Task 14 → ChatTab
Task 15 → SkillsTab + ClawHub
Task 16 → ToolsTab, ModelTab, FilesTab, CronTab, HooksTab
Task 17 → GatewayPanel
Task 18 → Docker final
Task 19 → README
```

Chaque task est indépendante de la suivante une fois ses prérequis en place. Les tasks 1-4 (backend) et 5-7 (frontend base) peuvent être développées en parallèle.
