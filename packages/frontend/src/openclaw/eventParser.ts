import type { AgentStatus, OpenClawEvent, ParsedAgentUpdate } from "./types.ts";

const EVENT_STATUS_MAP: Record<string, AgentStatus> = {
  "message:sent": "working",
  "message:received": "idle",
  "message:preprocessed": "working",
  "message:transcribed": "working",
  "exec.approval.requested": "waiting_approval",
  "exec.approval.resolved": "working",
  "agent:bootstrap": "working",
  "command:new": "idle",
  "command:reset": "idle",
  "command:stop": "idle",
  "gateway:startup": "idle",
};

const EVENT_LABELS: Record<string, string> = {
  "message:sent": "Réponse envoyée",
  "message:received": "Message reçu",
  "message:preprocessed": "Traitement en cours",
  "exec.approval.requested": "Attente approbation",
  "exec.approval.resolved": "Approbation accordée",
  "agent:bootstrap": "Démarrage agent",
  "command:new": "Nouvelle session",
  "command:reset": "Réinitialisation",
  "command:stop": "Arrêt",
};

export function parseEvent(event: OpenClawEvent): ParsedAgentUpdate | null {
  if (event.type !== "event" || !event.event) return null;

  const status = EVENT_STATUS_MAP[event.event];
  if (status === undefined) return null;

  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const agentId = typeof payload.agentId === "string" ? payload.agentId : "default";
  const currentTool = typeof payload.tool === "string" ? payload.tool : undefined;
  const currentToolDetail = typeof payload.detail === "string" ? payload.detail : undefined;
  const detail = EVENT_LABELS[event.event] ?? event.event;

  return {
    agentId,
    status,
    currentTool,
    currentToolDetail,
    eventType: event.event,
    detail,
  };
}
