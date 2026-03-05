import { useState, useEffect } from "react";

interface Binding {
  id: string;
  channel: string;
  agentId: string;
  agentName?: string;
}

export function RoutingTab() {
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState("");
  const [agentId, setAgentId] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchBindings = () => {
    fetch("/api/cli/run/routing:list")
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((d: Binding[] | { items?: Binding[] } | null) => {
        if (!d) { setBindings([]); return; }
        setBindings(Array.isArray(d) ? d : (d.items ?? []));
      })
      .catch(() => setBindings([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBindings();
  }, []);

  const addBinding = async () => {
    if (!channel.trim() || !agentId.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/cli/routing/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channel.trim(), agentId: agentId.trim() }),
      });
      if (!res.ok) return;
      setChannel("");
      setAgentId("");
      await fetchBindings();
    } catch {
      // ignore silently
    } finally {
      setAdding(false);
    }
  };

  const removeBinding = async (id: string) => {
    try {
      await fetch(`/api/cli/routing/unbind/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setBindings((bs) => bs.filter((b) => b.id !== id));
    } catch {
      // ignore silently
    }
  };

  if (loading) {
    return (
      <div className="p-3 flex items-center justify-center">
        <span className="font-pixel text-xs text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
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
              <button
                onClick={() => removeBinding(binding.id)}
                className="shrink-0 font-pixel text-xs text-pixel-red hover:opacity-70"
                title="Supprimer"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add binding form */}
      <div className="border-t border-pixel-border pt-3 space-y-2">
        <div className="font-pixel text-xs text-gray-400">Ajouter un binding</div>
        <input
          className="w-full bg-pixel-bg border border-pixel-border text-white font-pixel text-xs px-2 py-1 focus:outline-none focus:border-pixel-accent"
          placeholder="Canal"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        />
        <input
          className="w-full bg-pixel-bg border border-pixel-border text-white font-pixel text-xs px-2 py-1 focus:outline-none focus:border-pixel-accent"
          placeholder="Agent ID"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        />
        <button
          onClick={addBinding}
          disabled={adding || !channel.trim() || !agentId.trim()}
          className="w-full bg-pixel-accent text-white font-pixel text-xs py-1 hover:opacity-80 disabled:opacity-50"
        >
          {adding ? "..." : "Ajouter"}
        </button>
      </div>
    </div>
  );
}
