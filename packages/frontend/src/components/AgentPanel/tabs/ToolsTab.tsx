import { useState } from "react";

const TOOL_GROUPS = [
  { group: "runtime", label: "Exécution", tools: ["exec", "bash", "process"] },
  { group: "fs", label: "Fichiers", tools: ["read", "write", "edit", "apply_patch"] },
  { group: "web", label: "Web", tools: ["web_search", "web_fetch", "browser"] },
  { group: "messaging", label: "Messaging", tools: ["message"] },
  { group: "automation", label: "Automation", tools: ["cron", "gateway"] },
  { group: "ui", label: "Interface", tools: ["canvas", "snapshot"] },
];

export function ToolsTab({ agentId: _agentId }: { agentId: string }) {
  // TODO: charger l'état réel depuis la config agent via /api/cli
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(
      TOOL_GROUPS.flatMap((g) => g.tools.map((t) => [t, true]))
    )
  );

  const toggle = (tool: string) => {
    setEnabled((e) => ({ ...e, [tool]: !e[tool] }));
  };

  return (
    <div className="p-3 space-y-4">
      {TOOL_GROUPS.map((group) => (
        <div key={group.group}>
          <div className="font-pixel text-xs text-gray-500 uppercase tracking-wider mb-2">
            {group.label}
          </div>
          <div className="space-y-1">
            {group.tools.map((tool) => (
              <label key={tool} className="flex items-center gap-3 cursor-pointer hover:bg-pixel-border p-1">
                <button
                  role="switch"
                  aria-checked={enabled[tool]}
                  onClick={() => toggle(tool)}
                  className={`w-8 h-4 relative border ${
                    enabled[tool] ? "bg-pixel-green border-pixel-green" : "bg-pixel-bg border-pixel-border"
                  } transition-colors shrink-0`}
                >
                  <div
                    className={`absolute top-0 w-4 h-4 bg-white transition-transform ${
                      enabled[tool] ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="font-pixel text-xs text-gray-300">{tool}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
