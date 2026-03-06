import { useState, useEffect } from "react";

interface Channel {
  name: string;
  type: string;
  status: "connected" | "disconnected" | "unknown";
}

export function ChannelsTab() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChannels = () => {
    return fetch("/api/cli/run/channels:status")
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((d: Channel[] | { items?: Channel[] } | null) => {
        if (!d) { setChannels([]); return; }
        setChannels(Array.isArray(d) ? d : (d.items ?? []));
      })
      .catch(() => setChannels([]));
  };

  useEffect(() => {
    fetchChannels().finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetchChannels();
    } catch {
      // ignore silently
    } finally {
      setRefreshing(false);
    }
  };

  const statusDot = (status: Channel["status"]) => {
    if (status === "connected") return "bg-pixel-green";
    if (status === "disconnected") return "bg-pixel-red";
    return "bg-gray-500";
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
      <div className="flex items-center justify-between gap-2">
        <div className="font-pixel text-xs text-gray-500">Statut runtime des canaux</div>
        <button
          onClick={() => void refresh()}
          disabled={refreshing}
          className="shrink-0 font-pixel text-xs px-2 py-1 border border-pixel-border text-gray-400 hover:text-white hover:border-gray-400 transition-colors disabled:opacity-50"
        >
          {refreshing ? "..." : "Rafraichir"}
        </button>
      </div>
      {channels.length === 0 ? (
        <p className="font-pixel text-xs text-gray-600">Aucun canal configuré</p>
      ) : (
        channels.map((channel) => (
          <div
            key={channel.name}
            className="bg-pixel-bg border border-pixel-border p-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`shrink-0 w-2 h-2 rounded-full ${statusDot(channel.status)}`}
                />
                <div className="min-w-0">
                  <div className="font-pixel text-xs text-white truncate">
                    {channel.name}
                  </div>
                  <div className="font-pixel text-xs text-gray-500">{channel.type}</div>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
