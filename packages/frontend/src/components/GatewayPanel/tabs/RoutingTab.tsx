import { useState, useEffect } from "react";

interface Binding {
  id: string;
  channel: string;
  agentId: string;
  agentName?: string;
}

function isBinding(value: Binding | null): value is Binding {
  return value !== null;
}

export function RoutingTab() {
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBindings = () => {
    fetch("/api/cli/run/agents:bindings")
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((d: Array<Record<string, unknown>> | { items?: Array<Record<string, unknown>> } | null) => {
        if (!d) { setBindings([]); return; }
        const items = Array.isArray(d) ? d : (d.items ?? []);
        setBindings(
          items
            .map<Binding | null>((item) => {
              const channel = String(item.channel ?? item.bind ?? item.binding ?? "");
              const agentId = String(item.agentId ?? item.agent ?? "");
              if (!channel || !agentId) return null;
              return {
                id: String(item.id ?? `${agentId}:${channel}`),
                channel,
                agentId,
                agentName: typeof item.agentName === "string" ? item.agentName : undefined,
              };
            })
            .filter(isBinding)
        );
      })
      .catch(() => setBindings([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBindings();
  }, []);

  if (loading) {
    return (
      <div className="p-3 flex items-center justify-center">
        <span className="font-pixel text-xs text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="font-pixel text-xs text-gray-500">
        Vue lecture seule. L'edition des bindings n'est pas encore branchee au backend.
      </div>

      {/* Binding list */}
      <div className="space-y-2">
        {bindings.length === 0 ? (
          <p className="font-pixel text-xs text-gray-600">Aucun routing configuré</p>
        ) : (
          bindings.map((binding) => (
            <div
              key={binding.id}
              className="bg-pixel-bg border border-pixel-border p-2 flex items-center justify-between gap-2"
            >
              <div className="font-pixel text-xs text-white min-w-0 truncate">
                <span className="text-pixel-yellow">{binding.channel}</span>
                <span className="text-gray-500 mx-1">──→</span>
                <span className="text-pixel-green">
                  {binding.agentName ?? binding.agentId}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
