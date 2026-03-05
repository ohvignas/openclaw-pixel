import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import request from "supertest";
import express from "express";
import { filesRouter } from "../routes/files.js";

const TEST_DATA_PATH = "/tmp/test-openclaw-files";
const TEST_AGENT_ID = "test-agent";
const TEST_WORKSPACE = join(TEST_DATA_PATH, "agents", TEST_AGENT_ID, "workspace");

process.env.OPENCLAW_DATA_PATH = TEST_DATA_PATH;

const app = express();
app.use(express.json());
app.use("/api/files", filesRouter);

describe("GET /api/files/:agentId/:filename", () => {
  beforeEach(() => {
    mkdirSync(TEST_WORKSPACE, { recursive: true });
    writeFileSync(join(TEST_WORKSPACE, "AGENTS.md"), "# Hello agent");
  });

  afterEach(() => {
    if (existsSync(TEST_DATA_PATH)) {
      rmSync(TEST_DATA_PATH, { recursive: true, force: true });
    }
  });

  it("returns file content for existing allowed file", async () => {
    const res = await request(app).get(`/api/files/${TEST_AGENT_ID}/AGENTS.md`);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe("# Hello agent");
  });

  it("returns empty content for non-existent file", async () => {
    const res = await request(app).get(`/api/files/${TEST_AGENT_ID}/SOUL.md`);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe("");
  });

  it("returns 400 for disallowed filename", async () => {
    const res = await request(app).get(`/api/files/${TEST_AGENT_ID}/config.json`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 400 for invalid agentId with path separators", async () => {
    const res = await request(app).get(`/api/files/agent%2Fhack/AGENTS.md`);
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/files/:agentId/:filename", () => {
  afterEach(() => {
    if (existsSync(TEST_DATA_PATH)) {
      rmSync(TEST_DATA_PATH, { recursive: true, force: true });
    }
  });

  it("creates and writes a new file", async () => {
    const res = await request(app)
      .put(`/api/files/${TEST_AGENT_ID}/SOUL.md`)
      .send({ content: "# My soul" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(existsSync(join(TEST_WORKSPACE, "SOUL.md"))).toBe(true);
  });

  it("returns 400 for missing content", async () => {
    const res = await request(app)
      .put(`/api/files/${TEST_AGENT_ID}/AGENTS.md`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 or 404 for path traversal filename (slashes in URL)", async () => {
    const res = await request(app)
      .put(`/api/files/${TEST_AGENT_ID}/../../etc/passwd`)
      .send({ content: "hacked" });
    // Express route matching prevents /foo/../../bar from reaching the handler (404),
    // which is also a correct security outcome — it never executes write logic.
    expect([400, 404]).toContain(res.status);
  });
});
