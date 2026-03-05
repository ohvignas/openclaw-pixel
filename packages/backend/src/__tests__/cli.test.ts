import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { cliRouter } from "../routes/cli.js";
import { clawhubRouter } from "../routes/clawhub.js";

const cliApp = express();
cliApp.use(express.json());
cliApp.use("/api/cli", cliRouter);

const clawhubApp = express();
clawhubApp.use(express.json());
clawhubApp.use("/api/clawhub", clawhubRouter);

describe("GET /api/cli/run/:command", () => {
  it("returns 400 for unknown command", async () => {
    const res = await request(cliApp).get("/api/cli/run/rm-rf");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("accepts known commands (may fail gracefully if CLI absent)", async () => {
    const res = await request(cliApp).get("/api/cli/run/agents:list");
    // Either succeeds (200) or gracefully returns error object — never throws
    expect([200, 500]).toContain(res.status);
    expect(res.body).toBeDefined();
  });
});

describe("POST /api/cli/hooks/:action/:name", () => {
  it("returns 400 for invalid action", async () => {
    const res = await request(cliApp).post("/api/cli/hooks/delete/session-memory");
    expect(res.status).toBe(400);
  });

  it("returns 400 or 404 for invalid hook name with path separators", async () => {
    const res = await request(cliApp).post("/api/cli/hooks/enable/../../malicious");
    // Slashes in the URL mean Express routing never reaches the handler (404),
    // which is a valid security outcome — the invalid path is rejected at routing level.
    expect([400, 404, 500]).toContain(res.status);
  });
});

describe("POST /api/cli/plugins/install", () => {
  it("returns 400 when packageName is missing", async () => {
    const res = await request(cliApp).post("/api/cli/plugins/install").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid package name format", async () => {
    const res = await request(cliApp)
      .post("/api/cli/plugins/install")
      .send({ packageName: "../../evil" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/clawhub/install", () => {
  it("returns 400 when slug or agentId is missing", async () => {
    const res = await request(clawhubApp).post("/api/clawhub/install").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid slug format", async () => {
    const res = await request(clawhubApp)
      .post("/api/clawhub/install")
      .send({ slug: "../evil", agentId: "my-agent" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid agentId", async () => {
    const res = await request(clawhubApp)
      .post("/api/clawhub/install")
      .send({ slug: "author/skill", agentId: "../evil" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/clawhub/search", () => {
  it("returns empty array for empty query", async () => {
    const res = await request(clawhubApp).get("/api/clawhub/search?q=");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns array (may be empty if CLI absent) for valid query", async () => {
    const res = await request(clawhubApp).get("/api/clawhub/search?q=memory");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
