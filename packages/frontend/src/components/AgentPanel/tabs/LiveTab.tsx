import { useAgentStore } from "../../../store/agentStore.ts";

export function LiveTab({ agentId }: { agentId: string }) {
  const eventLog = useAgentStore((s) => s.eventLog.filter((e) => e.agentId === agentId));
  const agent = useAgentStore((s) => s.agents[agentId]);

  return (
    <div className="p-3 space-y-3">
      {/* Outil actif */}
      {agent?.currentTool && (
        <div className="bg-pixel-bg border border-pixel-green p-2">
          <div className="font-pixel text-xs text-pixel-green">⚡ {agent.currentTool}</div>
          {agent.currentToolDetail && (
            <div className="font-pixel text-xs text-gray-500 mt-1 truncate">
              {agent.currentToolDetail}
            </div>
          )}
        </div>
      )}

      {/* Log d'événements */}
      <div className="space-y-1">
        {eventLog.length === 0 ? (
          <p className="font-pixel text-xs text-gray-600">Aucun événement</p>
        ) : (
          eventLog.map((e) => (
            <div key={e.id ?? `${e.timestamp}-${e.agentId}-${e.type}`} className="flex gap-2 font-pixel text-xs">
              <span className="text-gray-600 shrink-0">
                {new Date(e.timestamp).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className="text-gray-400">{e.type}</span>
              <span className="text-gray-600 truncate">{e.detail}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
