import { useEffect, useState } from "react";
import { getAgentHooks, getGatewayConfig, patchGatewayConfig, upsertResolvedAgent } from "../../../openclaw/agentConfig.ts";

export function HooksTab({ agentId }: { agentId: string }) {
  const [content, setContent] = useState("{}");
  const [globalContent, setGlobalContent] = useState("{}");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getGatewayConfig()
      .then((payload) => {
        if (cancelled) return;
        const globalHooks = payload.resolved?.hooks ?? payload.resolved?.agents?.defaults?.hooks ?? {};
        setGlobalContent(JSON.stringify(globalHooks, null, 2));
        setContent(JSON.stringify(getAgentHooks(payload, agentId), null, 2));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Impossible de charger les hooks.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const parsed = content.trim() ? JSON.parse(content) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Les hooks agent doivent etre un objet JSON.");
      }
      const config = await getGatewayConfig();
      const nextAgents = upsertResolvedAgent(config, agentId, (agent) => ({
        ...agent,
        hooks: parsed,
      }));
      await patchGatewayConfig({ agents: { list: nextAgents } }, config.hash);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de sauvegarder les hooks.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="font-pixel text-xs text-gray-500">Agent: {agentId}</div>
      {loading && <p className="font-pixel text-xs text-gray-600">Chargement...</p>}
      {error && <p className="font-pixel text-xs text-pixel-red">{error}</p>}
      {saved && <p className="font-pixel text-xs text-pixel-green">Hooks mis a jour.</p>}

      {!loading && (
        <>
          <div>
            <div className="mb-2 font-pixel text-xs text-gray-500">Hooks agent</div>
            <textarea
              className="min-h-48 w-full resize-none border border-pixel-border bg-pixel-bg p-2 font-mono text-xs text-gray-300 focus:outline-none focus:border-pixel-accent"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              spellCheck={false}
            />
          </div>

          <div>
            <div className="mb-2 font-pixel text-xs text-gray-500">Hooks globaux Open Claw</div>
            <pre className="max-h-40 overflow-auto border border-pixel-border bg-pixel-bg p-2 font-mono text-[10px] text-gray-500">
              {globalContent}
            </pre>
          </div>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="bg-pixel-accent px-3 py-1 font-pixel text-xs text-white hover:opacity-80 disabled:opacity-50"
          >
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </>
      )}
    </div>
  );
}
