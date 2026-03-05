import { describe, it, expect, beforeEach } from "vitest";
import { OfficeState } from "../OfficeState.ts";
import type { AgentStatus } from "../../openclaw/types.ts";

const makeAgent = (id: string, status: AgentStatus = "idle") => ({
  id,
  name: `Agent ${id}`,
  emoji: "🤖",
  status,
});

describe("OfficeState", () => {
  let office: OfficeState;

  beforeEach(() => {
    office = new OfficeState(800, 600);
  });

  it("adds a character for a new agent", () => {
    office.upsertCharacter("work", makeAgent("work"));
    expect(office.characters.size).toBe(1);
  });

  it("adds multiple agents without collision", () => {
    office.upsertCharacter("agent1", makeAgent("agent1"));
    office.upsertCharacter("agent2", makeAgent("agent2"));
    office.upsertCharacter("agent3", makeAgent("agent3"));
    expect(office.characters.size).toBe(3);
  });

  it("sets targetState to seated when agent is working", () => {
    office.upsertCharacter("work", makeAgent("work", "working"));
    const char = office.characters.get("work")!;
    expect(char.targetState).toBe("seated");
  });

  it("sets targetState to standing when agent is idle", () => {
    office.upsertCharacter("work", makeAgent("work", "idle"));
    const char = office.characters.get("work")!;
    expect(char.targetState).toBe("standing");
  });

  it("updates character status without creating duplicate", () => {
    office.upsertCharacter("work", makeAgent("work", "idle"));
    office.setCharacterStatus("work", "working");
    expect(office.characters.size).toBe(1);
    expect(office.characters.get("work")!.status).toBe("working");
  });

  it("tick() moves characters toward their target", () => {
    office.upsertCharacter("work", makeAgent("work", "working"));
    const char = office.characters.get("work")!;
    const initialPos = { ...char.pos };
    // Tick for 500ms to get some movement
    office.tick(500);
    const newPos = office.characters.get("work")!.pos;
    // Either the character moved or was already at target
    const moved = newPos.x !== initialPos.x || newPos.y !== initialPos.y;
    const atTarget = newPos.x === char.targetPos.x && newPos.y === char.targetPos.y;
    expect(moved || atTarget).toBe(true);
  });

  it("does nothing for setCharacterStatus on unknown agent", () => {
    office.setCharacterStatus("unknown", "working");
    expect(office.characters.size).toBe(0);
  });
});
