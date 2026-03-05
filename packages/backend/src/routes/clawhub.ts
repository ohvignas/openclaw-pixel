import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";

export const clawhubRouter = Router();
const execFileAsync = promisify(execFile);

clawhubRouter.get("/search", async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  if (!query) {
    res.json([]);
    return;
  }
  try {
    const { stdout } = await execFileAsync("clawhub", ["search", query, "--json"], {
      timeout: 10000,
    });
    const parsed = JSON.parse(stdout);
    res.json(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    // clawhub not installed or search failed — return empty for graceful degradation
    console.warn("[clawhub] search failed:", String(e).slice(0, 200));
    res.json([]);
  }
});

clawhubRouter.post("/install", async (req, res) => {
  const { slug, agentId } = req.body as { slug?: string; agentId?: string };

  if (!slug || !agentId) {
    res.status(400).json({ error: "slug and agentId are required" });
    return;
  }

  // Validate slug format: "author/skill-name"
  if (!/^[a-z0-9_-]+\/[a-z0-9_-]+$/.test(slug)) {
    res.status(400).json({ error: "Invalid slug format. Expected: author/skill-name" });
    return;
  }

  if (!/^[a-z0-9_-]+$/i.test(agentId)) {
    res.status(400).json({ error: "Invalid agentId" });
    return;
  }

  const dataPath = process.env.OPENCLAW_DATA_PATH ?? "/data/openclaw";
  const workdir = `${dataPath}/agents/${agentId}/workspace`;

  try {
    await execFileAsync("clawhub", ["install", slug, "--workdir", workdir], {
      timeout: 30000,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "clawhub install failed", detail: String(e).slice(0, 300) });
  }
});
