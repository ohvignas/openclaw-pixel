import { useState, useEffect } from "react";

interface Hook {
  name: string;
  description?: string;
  enabled: boolean;
  events?: string[];
}

export function GlobalHooksTab() {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cli/run/hooks:list")
      .then((r) => r.json())
      .then((d: Hook[] | { items?: Hook[] }) =>
        setHooks(Array.isArray(d) ? d : (d.items ?? []))
      )
      .catch(() => setHooks([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (hook: Hook) => {
    setToggling(hook.name);
    const action = hook.enabled ? "disable" : "enable";
    try {
      const res = await fetch(
        `/api/cli/hooks/${action}/${encodeURIComponent(hook.name)}`,
        { method: "POST" }
      );
      if (!res.ok) return;
      setHooks((hs) =>
        hs.map((h) =>
          h.name === hook.name ? { ...h, enabled: !h.enabled } : h
        )
      );
    } finally {
      setToggling(null);
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
    <div className="p-3 space-y-2">
      {hooks.length === 0 ? (
        <p className="font-pixel text-xs text-gray-600">Aucun hook global</p>
      ) : (
        hooks.map((hook) => (
          <div
            key={hook.name}
            className="bg-pixel-bg border border-pixel-border p-2"
          >
            <div className="flex justify-between items-center">
              <div className="min-w-0">
                <div className="font-pixel text-xs text-white">{hook.name}</div>
                {hook.description && (
                  <div className="font-pixel text-xs text-gray-500 mt-1">
                    {hook.description}
                  </div>
                )}
                {hook.events && hook.events.length > 0 && (
                  <div className="font-pixel text-xs text-gray-600 mt-1">
                    {hook.events.join(", ")}
                  </div>
                )}
              </div>
              <button
                onClick={() => toggle(hook)}
                disabled={toggling === hook.name}
                className={`shrink-0 ml-2 font-pixel text-xs px-2 py-1 border transition-colors ${
                  hook.enabled
                    ? "border-pixel-green text-pixel-green hover:opacity-70"
                    : "border-gray-600 text-gray-600 hover:text-white hover:border-gray-400"
                } disabled:opacity-50`}
              >
                {toggling === hook.name ? "..." : hook.enabled ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
