import { useEffect, useState } from "react";
import { OfficeCanvas } from "./canvas/OfficeCanvas.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { AgentPanel } from "./components/AgentPanel/index.tsx";
import { GatewayPanel } from "./components/GatewayPanel/index.tsx";
import { useAgentStore } from "./store/agentStore.ts";
import { useGatewayStore } from "./store/gatewayStore.ts";
import { useEconomyStore } from "./store/economyStore.ts";
import { OpenClawClient } from "./openclaw/openclawClient.ts";
import { parseEvent } from "./openclaw/eventParser.ts";
import { processCoinEvent } from "./economy/coinEngine.ts";

export function App() {
  const { setAgentStatus, addEvent, selectAgent } = useAgentStore();
  const { setStatus, activeInstanceId } = useGatewayStore();
  const [showGateway, setShowGateway] = useState(false);

  useEffect(() => {
    // Lire le store directement au moment de l'exécution de l'effet
    const { instances, activeInstanceId } = useGatewayStore.getState();
    const activeInstance = instances.find((i) => i.id === activeInstanceId);
    const wsUrl = activeInstance?.url ?? "/ws";

    const client = new OpenClawClient(wsUrl);

    const unsubStatus = client.onStatus((s) => { setStatus(s); });

    const unsubEvents = client.on((event) => {
      processCoinEvent(event);
      const update = parseEvent(event);
      if (update) {
        setAgentStatus(update.agentId, update.status, update.currentTool, update.currentToolDetail);
        addEvent({
          timestamp: Date.now(),
          agentId: update.agentId,
          type: update.eventType,
          detail: update.detail,
        });
      }
    });

    useEconomyStore.getState().fetchBalance();
    useEconomyStore.getState().fetchInventory();

    client.connect();

    return () => {
      unsubStatus();
      unsubEvents();
      client.disconnect();
    };
  }, [activeInstanceId, setStatus, setAgentStatus, addEvent]); // maintenant correct : instances lu en snapshot au moment de l'exécution

  return (
    <div className="flex flex-col h-screen bg-pixel-bg text-white font-pixel text-xs overflow-hidden">
      <TopBar onGatewayClick={() => setShowGateway((v) => !v)} />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <OfficeCanvas onAgentClick={selectAgent} />
        <AgentPanel />
        {showGateway && <GatewayPanel onClose={() => setShowGateway(false)} />}
      </div>
    </div>
  );
}
