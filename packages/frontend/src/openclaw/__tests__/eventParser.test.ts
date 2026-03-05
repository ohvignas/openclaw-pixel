import { describe, it, expect } from "vitest";
import { parseEvent } from "../eventParser.ts";

describe("parseEvent", () => {
  it("maps message:sent to working status", () => {
    const result = parseEvent({
      type: "event",
      event: "message:sent",
      payload: { agentId: "work", content: "Hello" },
    });
    expect(result).not.toBeNull();
    expect(result!.agentId).toBe("work");
    expect(result!.status).toBe("working");
  });

  it("maps exec.approval.requested to waiting_approval", () => {
    const result = parseEvent({
      type: "event",
      event: "exec.approval.requested",
      payload: { agentId: "bot" },
    });
    expect(result).not.toBeNull();
    expect(result!.status).toBe("waiting_approval");
  });

  it("maps command:new to idle", () => {
    const result = parseEvent({
      type: "event",
      event: "command:new",
      payload: { agentId: "work" },
    });
    expect(result).not.toBeNull();
    expect(result!.status).toBe("idle");
  });

  it("returns null for unknown event types", () => {
    const result = parseEvent({
      type: "event",
      event: "some:unknown:event",
      payload: { agentId: "work" },
    });
    expect(result).toBeNull();
  });

  it("returns null for non-event messages", () => {
    const result = parseEvent({ type: "res", ok: true, id: "123" });
    expect(result).toBeNull();
  });

  it("falls back to 'default' agentId when not in payload", () => {
    const result = parseEvent({
      type: "event",
      event: "message:received",
      payload: {},
    });
    expect(result).not.toBeNull();
    expect(result!.agentId).toBe("default");
  });

  it("extracts tool info when present in payload", () => {
    const result = parseEvent({
      type: "event",
      event: "message:preprocessed",
      payload: { agentId: "work", tool: "exec", detail: "npm test" },
    });
    expect(result).not.toBeNull();
    expect(result!.currentTool).toBe("exec");
    expect(result!.currentToolDetail).toBe("npm test");
  });
});
