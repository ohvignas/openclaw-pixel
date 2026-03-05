import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

export const filesRouter = Router();

const ALLOWED_FILES = ["AGENTS.md", "SOUL.md", "IDENTITY.md", "USER.md", "TOOLS.md"];

function agentWorkspace(agentId: string): string {
  const dataPath = process.env.OPENCLAW_DATA_PATH ?? "/data/openclaw";
  return join(dataPath, "agents", agentId, "workspace");
}

function validatePath(workspace: string, filename: string): string | null {
  const resolvedWorkspace = resolve(workspace);
  const filePath = resolve(join(workspace, filename));
  if (!filePath.startsWith(resolvedWorkspace + "/") && filePath !== resolvedWorkspace) {
    return null;
  }
  return filePath;
}

filesRouter.get("/:agentId/:filename", (req, res) => {
  const { agentId, filename } = req.params;

  if (!ALLOWED_FILES.includes(filename)) {
    res.status(400).json({ error: "File not allowed" });
    return;
  }

  if (!/^[a-z0-9_-]+$/i.test(agentId)) {
    res.status(400).json({ error: "Invalid agent ID" });
    return;
  }

  const workspace = agentWorkspace(agentId);
  const filePath = validatePath(workspace, filename);

  if (!filePath) {
    res.status(400).json({ error: "Path traversal detected" });
    return;
  }

  if (!existsSync(filePath)) {
    res.json({ content: "" });
    return;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    res.json({ content });
  } catch {
    res.status(500).json({ error: "Failed to read file" });
  }
});

filesRouter.put("/:agentId/:filename", (req, res) => {
  const { agentId, filename } = req.params;
  const { content } = req.body as { content?: string };

  if (!ALLOWED_FILES.includes(filename)) {
    res.status(400).json({ error: "File not allowed" });
    return;
  }

  if (!/^[a-z0-9_-]+$/i.test(agentId)) {
    res.status(400).json({ error: "Invalid agent ID" });
    return;
  }

  if (typeof content !== "string") {
    res.status(400).json({ error: "content must be a string" });
    return;
  }

  const workspace = agentWorkspace(agentId);
  const filePath = validatePath(workspace, filename);

  if (!filePath) {
    res.status(400).json({ error: "Path traversal detected" });
    return;
  }

  try {
    if (!existsSync(workspace)) {
      mkdirSync(workspace, { recursive: true });
    }
    writeFileSync(filePath, content, "utf-8");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to write file" });
  }
});
