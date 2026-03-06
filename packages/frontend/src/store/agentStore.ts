import { create } from "zustand";
import type { AgentState, AgentEvent, AgentStatus } from "../openclaw/types.ts";

interface AgentStoreState {
  agents: Record<string, AgentState>;
  selectedAgentId: string | null;
  eventLog: AgentEvent[];
  upsertAgent: (agent: AgentState) => void;
  setAgentStatus: (id: string, status: AgentStatus, tool?: string, detail?: string) => void;
  selectAgent: (id: string | null) => void;
  addEvent: (event: AgentEvent) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentStoreState>((set) => ({
  agents: {},
  selectedAgentId: null,
  eventLog: [],

  upsertAgent: (agent) =>
    set((s) => ({
      agents: {
        ...s.agents,
        [agent.id]: { ...s.agents[agent.id], ...agent },
      },
    })),

  setAgentStatus: (id, status, tool, detail) =>
    set((s) => {
      const existing = s.agents[id];
      return {
        agents: {
          ...s.agents,
          [id]: {
            id,
            name: existing?.name ?? id,
            emoji: existing?.emoji ?? "🤖",
            model: existing?.model,
            sessionKey: existing?.sessionKey,
            isDefault: existing?.isDefault,
            assignedSeatId: existing?.assignedSeatId,
            status,
            currentTool: tool,
            currentToolDetail: detail,
          },
        },
      };
    }),

  selectAgent: (id) => set({ selectedAgentId: id }),

  addEvent: (event) =>
    set((s) => ({
      eventLog: [{ ...event, id: event.id ?? crypto.randomUUID() }, ...s.eventLog].slice(0, 200),
    })),

  reset: () => set({ agents: {}, selectedAgentId: null, eventLog: [] }),
}));
