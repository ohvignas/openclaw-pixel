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
      if (!s.agents[id]) return s;
      return {
        agents: {
          ...s.agents,
          [id]: {
            ...s.agents[id]!,
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
}));
