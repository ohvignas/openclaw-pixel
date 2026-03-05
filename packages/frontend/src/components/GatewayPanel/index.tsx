import { useState } from "react";
import { PluginsTab } from "./tabs/PluginsTab.tsx";
import { GlobalHooksTab } from "./tabs/GlobalHooksTab.tsx";
import { RoutingTab } from "./tabs/RoutingTab.tsx";
import { ChannelsTab } from "./tabs/ChannelsTab.tsx";

const TABS = [
  { id: "plugins" as const, icon: "🔌", label: "Plugins" },
  { id: "hooks" as const, icon: "🎣", label: "Hooks" },
  { id: "routing" as const, icon: "🔀", label: "Routing" },
  { id: "channels" as const, icon: "📡", label: "Canaux" },
];

type TabId = typeof TABS[number]["id"];

interface GatewayPanelProps {
  onClose: () => void;
}

export function GatewayPanel({ onClose }: GatewayPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("plugins");

  return (
    <div className="w-96 bg-pixel-panel border-l border-pixel-border flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-pixel-border shrink-0">
        <div className="font-pixel text-xs text-pixel-accent tracking-widest">GATEWAY</div>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-white font-pixel text-sm leading-none"
          aria-label="Fermer le panneau gateway"
        >
          ✕
        </button>
      </div>

      {/* Tab navigation */}
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

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "plugins" && <PluginsTab />}
        {activeTab === "hooks" && <GlobalHooksTab />}
        {activeTab === "routing" && <RoutingTab />}
        {activeTab === "channels" && <ChannelsTab />}
      </div>
    </div>
  );
}
