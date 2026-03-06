import { useState, useEffect } from "react";

interface Plugin {
  name: string;
  version?: string;
  enabled: boolean;
  capabilities?: string[];
}

export function PluginsTab() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    fetch("/api/cli/run/plugins:list")
      .then((r) => r.json())
      .then((d: Plugin[] | { items?: Plugin[] }) =>
        setPlugins(Array.isArray(d) ? d : (d.items ?? []))
      )
      .catch(() => setPlugins([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (plugin: Plugin) => {
    setToggling(plugin.name);
    const action = plugin.enabled ? "disable" : "enable";
    try {
      const res = await fetch(
        `/api/cli/plugins/${action}/${encodeURIComponent(plugin.name)}`,
        { method: "POST" }
      );
      if (!res.ok) return;
      setPlugins((ps) =>
        ps.map((p) =>
          p.name === plugin.name ? { ...p, enabled: !p.enabled } : p
        )
      );
    } finally {
      setToggling(null);
    }
  };

  const install = async () => {
    if (!slug.trim()) return;
    setInstalling(true);
    try {
      const res = await fetch("/api/cli/plugins/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageName: slug.trim() }),
      });
      if (!res.ok) return;
      setSlug("");
      // Re-fetch list after install
      const r = await fetch("/api/cli/run/plugins:list");
      const d: Plugin[] | { items?: Plugin[] } = await r.json();
      setPlugins(Array.isArray(d) ? d : (d.items ?? []));
    } catch {
      // ignore silently
    } finally {
      setInstalling(false);
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
      {/* Plugin list */}
      <div className="space-y-2">
        {plugins.length === 0 ? (
          <p className="font-pixel text-xs text-gray-600">Aucun plugin installé</p>
        ) : (
          plugins.map((plugin) => (
            <div
              key={plugin.name}
              className="bg-pixel-bg border border-pixel-border p-2"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-pixel text-xs text-white">
                    {plugin.name}
                    {plugin.version && (
                      <span className="text-gray-500 ml-2">v{plugin.version}</span>
                    )}
                  </div>
                  {plugin.capabilities && plugin.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {plugin.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="font-pixel text-xs bg-pixel-border text-gray-400 px-1 py-0.5"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggle(plugin)}
                  disabled={toggling === plugin.name}
                  className={`shrink-0 font-pixel text-xs px-2 py-1 border transition-colors ${
                    plugin.enabled
                      ? "border-pixel-green text-pixel-green hover:opacity-70"
                      : "border-gray-600 text-gray-600 hover:text-white hover:border-gray-400"
                  } disabled:opacity-50`}
                >
                  {toggling === plugin.name ? "..." : plugin.enabled ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Install form */}
      <div className="border-t border-pixel-border pt-3">
        <div className="font-pixel text-xs text-gray-400 mb-2">Installer un plugin</div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-pixel-bg border border-pixel-border text-white font-pixel text-xs px-2 py-1 focus:outline-none focus:border-pixel-accent"
            placeholder="npm-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && install()}
          />
          <button
            onClick={install}
            disabled={installing || !slug.trim()}
            className="bg-pixel-accent text-white font-pixel text-xs px-3 py-1 hover:opacity-80 disabled:opacity-50"
          >
            {installing ? "..." : "Installer"}
          </button>
        </div>
      </div>
    </div>
  );
}
