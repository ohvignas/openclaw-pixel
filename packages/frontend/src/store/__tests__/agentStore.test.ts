import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "../agentStore.ts";

describe("agentStore", () => {
  beforeEach(() => {
    useAgentStore.setState({
      agents: {},
      selectedAgentId: null,
      eventLog: [],
    });
  });

  it("adds a new agent via upsertAgent", () => {
    useAgentStore.getState().upsertAgent({
      id: "work",
      name: "Worker",
      emoji: "💼",
      status: "idle",
    });
    const agents = useAgentStore.getState().agents;
    expect(agents["work"]).toBeDefined();
    expect(agents["work"]!.name).toBe("Worker");
  });

  it("updates an existing agent without overwriting other fields", () => {
    useAgentStore.getState().upsertAgent({
      id: "work",
      name: "Worker",
      emoji: "💼",
      status: "idle",
      model: "anthropic/claude-opus-4-6",
    });
    useAgentStore.getState().upsertAgent({
      id: "work",
      name: "Worker",
      emoji: "💼",
      status: "working",
    });
    const agent = useAgentStore.getState().agents["work"]!;
    expect(agent.status).toBe("working");
    expect(agent.model).toBe("anthropic/claude-opus-4-6"); // not overwritten
  });

  it("sets agent status and tool info", () => {
    useAgentStore.getState().upsertAgent({
      id: "bot",
      name: "Bot",
      emoji: "🤖",
      status: "idle",
    });
    useAgentStore.getState().setAgentStatus("bot", "working", "exec", "npm test");
    const agent = useAgentStore.getState().agents["bot"]!;
    expect(agent.status).toBe("working");
    expect(agent.currentTool).toBe("exec");
    expect(agent.currentToolDetail).toBe("npm test");
  });

  it("does nothing when setAgentStatus targets unknown agent", () => {
    useAgentStore.getState().setAgentStatus("unknown", "working");
    expect(useAgentStore.getState().agents["unknown"]).toBeUndefined();
  });

  it("selects and deselects an agent", () => {
    useAgentStore.getState().selectAgent("work");
    expect(useAgentStore.getState().selectedAgentId).toBe("work");
    useAgentStore.getState().selectAgent(null);
    expect(useAgentStore.getState().selectedAgentId).toBeNull();
  });

  it("adds events to eventLog and keeps max 200", () => {
    for (let i = 0; i < 210; i++) {
      useAgentStore.getState().addEvent({
        timestamp: Date.now(),
        agentId: "work",
        type: "test",
        detail: `event ${i}`,
      });
    }
    expect(useAgentStore.getState().eventLog.length).toBe(200);
  });

  it("stores events most-recent-first", () => {
    useAgentStore.getState().addEvent({ timestamp: 1, agentId: "w", type: "t", detail: "first" });
    useAgentStore.getState().addEvent({ timestamp: 2, agentId: "w", type: "t", detail: "second" });
    expect(useAgentStore.getState().eventLog[0]!.detail).toBe("second");
  });
});
