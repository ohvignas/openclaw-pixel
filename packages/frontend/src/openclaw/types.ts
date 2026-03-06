export type AgentStatus = "idle" | "working" | "waiting_approval" | "error" | "cron";

export interface AgentState {
  id: string;
  name: string;
  emoji: string;
  status: AgentStatus;
  currentTool?: string;
  currentToolDetail?: string;
  model?: string;
  sessionKey?: string;
  isDefault?: boolean;
  assignedSeatId?: string;
}

export interface AgentEvent {
  id?: string;
  timestamp: number;
  agentId: string;
  type: string;
  detail: string;
}

export interface OpenClawEvent {
  type: "req" | "res" | "event";
  event?: string;
  payload?: unknown;
  id?: string;
  ok?: boolean;
}

export interface ParsedAgentUpdate {
  agentId: string;
  status: AgentStatus;
  currentTool?: string;
  currentToolDetail?: string;
  eventType: string;
  detail: string;
}
