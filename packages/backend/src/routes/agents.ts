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
