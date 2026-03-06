import { Router } from "express";
import {
  fetchClawhubCatalog,
  fetchClawhubSearch,
  fetchClawhubSkillDetail,
  fetchClawhubSkillVersions,
} from "../lib/clawhubPublic.js";
import { listClawhubSkillFiles, readClawhubSkillFile } from "../lib/clawhubZip.js";
import { getAgentWorkspace } from "../lib/openclawPaths.js";
import { parseClawhubSearchOutput } from "../lib/parseClawhubSearch.js";
import { runClawhub } from "../lib/runClawhub.js";

export const clawhubRouter = Router();

clawhubRouter.get("/search", async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  if (!query) {
    res.json({ items: [] });
    return;
  }
  try {
    const publicItems = await fetchClawhubSearch(query);
    const detailItems = await Promise.all(
      publicItems.slice(0, 20).map(async (item) => {
        try {
          return await fetchClawhubSkillDetail(item.slug);
        } catch {
          return null;
        }
      }),
    );
    const items = publicItems.slice(0, 20).map((item, index) => {
      const detail = detailItems[index];
      return {
        slug: item.slug,
        name: detail?.displayName ?? item.displayName,
        description: detail?.summary ?? item.summary,
        summary: detail?.summary ?? item.summary,
        stars: detail?.stats?.stars,
        downloads: detail?.stats?.downloads,
        installsCurrent: detail?.stats?.installsCurrent,
        installsAllTime: detail?.stats?.installsAllTime,
        version: detail?.latestVersion?.version ?? item.version ?? null,
        updatedAt: detail?.updatedAt ?? item.updatedAt ?? null,
        ownerHandle: detail?.ownerHandle ?? null,
        pageUrl: detail?.pageUrl ?? null,
        score: item.score,
      };
    });

    if (items.length > 0) {
      res.json({ items, source: "public-api" });
      return;
    }

    const args = ["search", query, "--limit", "20"];
    const { stdout, stderr } = await runClawhub(args, 20000);
    const cliItems = parseClawhubSearchOutput(stdout);
    res.json({
      items: cliItems,
      source: "cli-fallback",
      debug:
        cliItems.length === 0
          ? {
              query,
              command: ["clawhub", ...args].join(" "),
              stdout: stdout.trim().slice(0, 1500),
              stderr: stderr.trim().slice(0, 600),
            }
          : undefined,
    });
  } catch (e) {
    const detail = String(e).slice(0, 300);
    console.warn("[clawhub] search failed:", detail);
    res.status(500).json({ error: "clawhub search failed", detail });
  }
});

clawhubRouter.get("/discover", async (req, res) => {
  const sort = String(req.query.sort ?? "downloads");
  const cursor = String(req.query.cursor ?? "").trim() || undefined;
  try {
    const payload = await fetchClawhubCatalog(sort, cursor);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: "clawhub discover failed", detail: String(e).slice(0, 300) });
  }
});

clawhubRouter.get("/skill/:slug", async (req, res) => {
  const slug = String(req.params.slug ?? "").trim();
  if (!slug) {
    res.status(400).json({ error: "slug is required" });
    return;
  }
  try {
    const [detail, versions] = await Promise.all([
      fetchClawhubSkillDetail(slug),
      fetchClawhubSkillVersions(slug),
    ]);
    if (!detail) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json({ detail, versions });
  } catch (e) {
    res.status(500).json({ error: "clawhub skill detail failed", detail: String(e).slice(0, 300) });
  }
});

clawhubRouter.get("/skill/:slug/files", async (req, res) => {
  const slug = String(req.params.slug ?? "").trim();
  const version = String(req.query.version ?? "").trim() || undefined;
  if (!slug) {
    res.status(400).json({ error: "slug is required" });
    return;
  }
  try {
    const items = await listClawhubSkillFiles(slug, version);
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: "clawhub skill files failed", detail: String(e).slice(0, 300) });
  }
});

clawhubRouter.get("/skill/:slug/file", async (req, res) => {
  const slug = String(req.params.slug ?? "").trim();
  const version = String(req.query.version ?? "").trim() || undefined;
  const filePath = String(req.query.path ?? "").trim();
  if (!slug || !filePath) {
    res.status(400).json({ error: "slug and path are required" });
    return;
  }
  try {
    const content = await readClawhubSkillFile(slug, filePath, version);
    res.json({ content });
  } catch (e) {
    res.status(500).json({ error: "clawhub skill file failed", detail: String(e).slice(0, 300) });
  }
});

clawhubRouter.post("/install", async (req, res) => {
  const { slug, agentId } = req.body as { slug?: string; agentId?: string };

  if (!slug || !agentId) {
    res.status(400).json({ error: "slug and agentId are required" });
    return;
  }

  if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(slug)) {
    res.status(400).json({ error: "Invalid slug format." });
    return;
  }

  if (!/^[a-z0-9_-]+$/i.test(agentId)) {
    res.status(400).json({ error: "Invalid agentId" });
    return;
  }

  const workdir = getAgentWorkspace(agentId);

  try {
    await runClawhub(["install", slug, "--workdir", workdir], 60000);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "clawhub install failed", detail: String(e).slice(0, 300) });
  }
});
