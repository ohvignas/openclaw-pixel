import { useState, useRef, useEffect } from "react";
import { gatewayClient } from "../../../openclaw/openclawClient.ts";

interface Message {
  role: "user" | "agent";
  content: string;
  ts: number;
}

export function ChatTab({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    const unsub = gatewayClient.on((event) => {
      if (
        event.type === "event" &&
        event.event === "message:sent" &&
        (event.payload as Record<string, unknown>)?.agentId === agentId
      ) {
        const payload = event.payload as Record<string, unknown>;
        const content = typeof payload.content === "string" ? payload.content : "";
        setMessages((m) => [...m, { role: "agent", content, ts: Date.now() }]);
      }
    });

    return unsub;
  }, [agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;

    gatewayClient.send({
      type: "req",
      id: crypto.randomUUID(),
      method: "agent.message",
      params: { agentId, content: text },
    });

    setMessages((m) => [...m, { role: "user", content: text, ts: Date.now() }]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
        {messages.length === 0 && (
          <p className="font-pixel text-xs text-gray-600">Envoie un message à l&apos;agent...</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
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
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 shrink-0">
        <input
          className="flex-1 bg-pixel-bg border border-pixel-border text-white font-pixel text-xs px-2 py-1 focus:outline-none focus:border-pixel-accent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Message..."
        />
        <button
          onClick={send}
          className="bg-pixel-accent text-white font-pixel text-xs px-3 py-1 hover:opacity-80 active:opacity-60"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
