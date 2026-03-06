import { Router } from "express";
import fs from "fs/promises";
import path from "path";

export const agentsRouter = Router();

// GET /api/agents/:id/files
agentsRouter.get("/:id/files", async (req, res) => {
  const workspaceDir = process.env.OPENCLAW_WORKSPACE_DIR ?? process.env.HOME ?? "/";
  try {
    const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && /\.(md|ts|tsx|js|json|txt|py)$/.test(e.name))
      .slice(0, 50)
      .map((e) => ({
        name: e.name,
        path: path.join(workspaceDir, e.name),
      }));
    res.json(files);
  } catch {
    res.json([]);
  }
});

// GET /api/agents/:id/file-content?name=<filename>
agentsRouter.get("/:id/file-content", async (req, res) => {
  const workspaceDir = process.env.OPENCLAW_WORKSPACE_DIR ?? process.env.HOME ?? "/";
  const filename = req.query.name as string;

  if (!filename || /[/\\]/.test(filename)) {
    res.status(400).json({ error: "invalid_filename" });
    return;
  }

  const allowedExts = /\.(md|ts|tsx|js|json|txt|py|sh)$/;
  if (!allowedExts.test(filename)) {
    res.status(400).json({ error: "forbidden_extension" });
    return;
  }

  try {
    const filePath = path.join(workspaceDir, filename);
    const content = await fs.readFile(filePath, "utf-8");
    res.type("text/plain").send(content);
  } catch {
    res.status(404).json({ error: "not_found" });
  }
});
