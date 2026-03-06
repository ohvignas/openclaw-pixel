import { useState, useRef, useEffect } from "react";
import { gatewayClient } from "../../../openclaw/openclawClient.ts";
import { useAgentStore } from "../../../store/agentStore.ts";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  ts: number;
}

export function ChatTab({ agentId }: { agentId: string }) {
  const sessionKey = useAgentStore((s) => s.agents[agentId]?.sessionKey ?? null);
  const agentName = useAgentStore((s) => s.agents[agentId]?.name ?? agentId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
    if (!sessionKey) return;

    setLoading(true);
    gatewayClient.request<{
      messages?: Array<{
        role?: string;
        timestamp?: number;
        content?: unknown;
      }>;
    }>("chat.history", { sessionKey })
      .then((payload) => {
        const history = Array.isArray(payload.messages) ? payload.messages : [];
        setMessages(history
          .map((message, index) => {
            const role = message.role === "user" ? "user" : "agent";
            const content = extractMessageText(message.content);
            if (!content) return null;
            return {
              id: `${sessionKey}-${index}`,
              role,
              content,
              ts: typeof message.timestamp === "number" ? message.timestamp : Date.now(),
            } satisfies Message;
          })
          .filter((message): message is Message => message !== null));
      })
      .catch((err: Error) => {
        setError(err.message || "Impossible de charger l'historique.");
      })
      .finally(() => setLoading(false));

    const unsub = gatewayClient.on((event) => {
      if (event.type !== "event" || event.event !== "chat") return;
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      if (payload.sessionKey !== sessionKey) return;
      const runId = typeof payload.runId === "string" ? payload.runId : crypto.randomUUID();
      const message = (payload.message ?? {}) as Record<string, unknown>;
      if (message.role !== "assistant") return;
      const content = extractMessageText(message.content);
      if (!content) return;
      const timestamp = typeof message.timestamp === "number" ? message.timestamp : Date.now();

      setMessages((current) => {
        const next = [...current];
        const index = next.findIndex((item) => item.id === runId);
        const assistantMessage: Message = {
          id: runId,
          role: "agent",
          content,
          ts: timestamp,
        };
        if (index >= 0) {
          next[index] = assistantMessage;
          return next;
        }
        return [...next, assistantMessage];
      });
    });

    return unsub;
  }, [sessionKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (!sessionKey) {
      setError("Session agent introuvable.");
      return;
    }

    setError(null);
    setSending(true);
    const optimisticId = crypto.randomUUID();
    setMessages((m) => [...m, { id: optimisticId, role: "user", content: text, ts: Date.now() }]);
    setInput("");

    try {
      await gatewayClient.request("chat.send", {
        sessionKey,
        idempotencyKey: crypto.randomUUID(),
        message: text,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le message.");
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
    } finally {
      setSending(false);
    }
  };

  const applyStarter = (mode: "role" | "workflow" | "tools") => {
    const starters = {
      role: `Tu es ${agentName}. Definis clairement ton role, ton objectif principal et ce que tu dois prendre en charge au quotidien.`,
      workflow: `Configure ta maniere de travailler: quand tu dois reflechir, quand tu dois attendre, quand tu dois demander une validation et comment tu dois rendre compte.`,
      tools: `Liste les outils et skills dont tu as besoin pour travailler correctement, puis explique les limites a respecter et ce que tu ne dois jamais faire.`,
    };
    setInput(starters[mode]);
  };

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
        {!sessionKey && (
          <p className="font-pixel text-xs text-gray-600">Session agent indisponible.</p>
        )}
        {loading && (
          <p className="font-pixel text-xs text-gray-600">Chargement du chat...</p>
        )}
        {!loading && sessionKey && messages.length === 0 && (
          <div className="space-y-2">
            <p className="font-pixel text-xs text-gray-600">Configure cet agent directement depuis le chat.</p>
            <div className="flex flex-wrap gap-2">
              <button
                className="border border-pixel-border bg-pixel-bg px-2 py-1 font-pixel text-[10px] text-gray-300 hover:text-white"
                onClick={() => applyStarter("role")}
              >
                Definir son role
              </button>
              <button
                className="border border-pixel-border bg-pixel-bg px-2 py-1 font-pixel text-[10px] text-gray-300 hover:text-white"
                onClick={() => applyStarter("workflow")}
              >
                Definir son workflow
              </button>
              <button
                className="border border-pixel-border bg-pixel-bg px-2 py-1 font-pixel text-[10px] text-gray-300 hover:text-white"
                onClick={() => applyStarter("tools")}
              >
                Definir ses outils
              </button>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={`p-2 font-pixel text-xs ${
              m.role === "user"
                ? "bg-pixel-border text-white ml-4"
                : "bg-pixel-bg text-gray-300 mr-4 border border-pixel-border"
            }`}
          >
            <div className={`text-xs mb-1 ${m.role === "user" ? "text-pixel-accent" : "text-pixel-green"}`}>
              {m.role === "user" ? "Toi" : "Agent"}
            </div>
            <div className="whitespace-pre-wrap break-words">{m.content}</div>
          </div>
        ))}
        {error && (
          <p className="font-pixel text-xs text-pixel-red">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 shrink-0 items-end">
        <textarea
          className="min-h-24 flex-1 bg-pixel-bg border border-pixel-border text-white font-pixel text-xs px-3 py-2 focus:outline-none focus:border-pixel-accent resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message..."
          disabled={!sessionKey || sending}
        />
        <button
          onClick={send}
          disabled={!sessionKey || sending}
          className="bg-pixel-accent text-white font-pixel text-xs px-3 py-1 hover:opacity-80 active:opacity-60 disabled:opacity-50"
        >
          {sending ? "..." : "▶"}
        </button>
      </div>
    </div>
  );
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const record = part as Record<string, unknown>;
      return record.type === "text" && typeof record.text === "string"
        ? record.text
        : "";
    })
    .filter(Boolean)
    .join("\n");
}
