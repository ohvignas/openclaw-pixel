import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";

export const cliRouter = Router();
const execFileAsync = promisify(execFile);

// Allowlist stricte des commandes autorisées (read-only)
const ALLOWED_READ_COMMANDS: Record<string, string[]> = {
  "agents:list": ["agents", "list", "--json"],
  "agents:bindings": ["agents", "bindings", "--json"],
  "hooks:list": ["hooks", "list", "--json"],
  "plugins:list": ["plugins", "list", "--json"],
  "channels:status": ["channels", "status", "--json"],
};

cliRouter.get("/run/:command", async (req, res) => {
  const args = ALLOWED_READ_COMMANDS[req.params.command];
  if (!args) {
    res.status(400).json({ error: "Command not allowed", allowed: Object.keys(ALLOWED_READ_COMMANDS) });
    return;
  }
  try {
    const { stdout } = await execFileAsync("openclaw", args, { timeout: 10000 });
    try {
      res.json(JSON.parse(stdout));
    } catch {
      res.json({ raw: stdout });
    }
  } catch (e) {
    // openclaw CLI not available in dev — return mock data
    console.warn(`[cli] openclaw ${args.join(" ")} failed:`, String(e).slice(0, 200));
    res.json({ error: "CLI not available", items: [] });
  }
});

// Hooks enable/disable
cliRouter.post("/hooks/:action/:name", async (req, res) => {
  const { action, name } = req.params;

  if (!["enable", "disable"].includes(action)) {
    res.status(400).json({ error: "Action must be enable or disable" });
    return;
  }

  if (!/^[a-z0-9_-]+$/.test(name)) {
    res.status(400).json({ error: "Invalid hook name" });
    return;
  }

  try {
    await execFileAsync("openclaw", ["hooks", action, name], { timeout: 10000 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed", detail: String(e).slice(0, 200) });
  }
});

// Plugins install
cliRouter.post("/plugins/install", async (req, res) => {
  const { packageName } = req.body as { packageName?: string };

  if (!packageName) {
    res.status(400).json({ error: "packageName is required" });
    return;
  }

  // Allow: @scope/name or plain-name (npm package name format)
  if (!/^(@[a-z0-9_-]+\/)?[a-z0-9_-]+$/.test(packageName)) {
    res.status(400).json({ error: "Invalid npm package name format" });
    return;
  }

  try {
    await execFileAsync("openclaw", ["plugins", "install", packageName], { timeout: 60000 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to install plugin", detail: String(e).slice(0, 300) });
  }
});

// Plugins enable/disable
cliRouter.post("/plugins/:action/:name", async (req, res) => {
  const { action, name } = req.params;

  if (!["enable", "disable"].includes(action)) {
    res.status(400).json({ error: "Action must be enable or disable" });
    return;
  }

  if (!/^[a-z0-9_-]+$/.test(name)) {
    res.status(400).json({ error: "Invalid plugin name" });
    return;
  }

  try {
    await execFileAsync("openclaw", ["plugins", action, name], { timeout: 10000 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed", detail: String(e).slice(0, 200) });
  }
});
