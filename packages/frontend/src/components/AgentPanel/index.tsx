import { useState, useEffect } from "react";
import { useAgentStore } from "../../store/agentStore.ts";
import { LiveTab } from "./tabs/LiveTab.tsx";
import { ChatTab } from "./tabs/ChatTab.tsx";
import { SkillsTab } from "./tabs/SkillsTab.tsx";
import { ToolsTab } from "./tabs/ToolsTab.tsx";
import { ModelTab } from "./tabs/ModelTab.tsx";
import { FilesTab } from "./tabs/FilesTab.tsx";
import { CronTab } from "./tabs/CronTab.tsx";
import { HooksTab } from "./tabs/HooksTab.tsx";

const TABS = [
  { id: "live" as const, icon: "👁", label: "Live" },
  { id: "chat" as const, icon: "💬", label: "Chat" },
  { id: "skills" as const, icon: "🧩", label: "Skills" },
  { id: "tools" as const, icon: "🔧", label: "Tools" },
  { id: "model" as const, icon: "🤖", label: "Modèle" },
  { id: "files" as const, icon: "📁", label: "Fichiers" },
  { id: "cron" as const, icon: "⏰", label: "Cron" },
  { id: "hooks" as const, icon: "🎣", label: "Hooks" },
];

type TabId = typeof TABS[number]["id"];

export function AgentPanel() {
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const agents = useAgentStore((s) => s.agents);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const [activeTab, setActiveTab] = useState<TabId>("chat");

  useEffect(() => {
    setActiveTab("chat");
  }, [selectedAgentId]);

  if (!selectedAgentId) return null;
  const agent = agents[selectedAgentId];
  if (!agent) return null;

  const statusColor =
    agent.status === "working" ? "text-pixel-green" :
    agent.status === "waiting_approval" ? "text-pixel-yellow" :
    agent.status === "error" ? "text-pixel-red" :
    "text-gray-400";

  return (
    <div className="w-[min(56rem,72vw)] min-w-[50rem] bg-pixel-panel border-l border-pixel-border flex flex-col h-full shrink-0">
      {/* En-tête agent */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-pixel-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{agent.emoji}</span>
          <div>
            <div className="font-pixel text-xs text-white">{agent.name}</div>
            <div className={`font-pixel text-xs ${statusColor}`}>{agent.status}</div>
            <div className="font-pixel text-[10px] text-gray-500">{agent.id}</div>
          </div>
        </div>
        <button
          onClick={() => selectAgent(null)}
          className="text-gray-600 hover:text-white font-pixel text-sm leading-none"
          aria-label="Fermer le panneau"
        >
          ✕
        </button>
      </div>

      {/* Navigation onglets */}
      <div className="flex border-b border-pixel-border shrink-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            aria-label={tab.label}
            className={`px-2 py-2 font-pixel text-sm shrink-0 transition-colors ${
              activeTab === tab.id
                ? "bg-pixel-border text-white border-b-2 border-pixel-accent"
                : "text-gray-600 hover:text-gray-300"
            }`}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {/* Contenu onglet */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "live" && <LiveTab agentId={selectedAgentId} />}
        {activeTab === "chat" && <ChatTab agentId={selectedAgentId} />}
        {activeTab === "skills" && <SkillsTab agentId={selectedAgentId} />}
        {activeTab === "tools" && <ToolsTab agentId={selectedAgentId} />}
        {activeTab === "model" && <ModelTab agentId={selectedAgentId} />}
        {activeTab === "files" && <FilesTab agentId={selectedAgentId} />}
        {activeTab === "cron" && <CronTab agentId={selectedAgentId} />}
        {activeTab === "hooks" && <HooksTab agentId={selectedAgentId} />}
      </div>
    </div>
  );
}
