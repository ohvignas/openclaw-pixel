import { useEffect, useState } from "react";
import { gatewayClient } from "../../../openclaw/openclawClient.ts";
import { getAgentModel, getGatewayConfig, patchGatewayConfig, upsertResolvedAgent } from "../../../openclaw/agentConfig.ts";

interface ModelsPayload {
  models?: Array<{
    id?: string;
    name?: string;
    provider?: string;
    contextWindow?: number;
    reasoning?: boolean;
  }>;
}

export function ModelTab({ agentId }: { agentId: string }) {
  const [selected, setSelected] = useState<string>("-");
  const [models, setModels] = useState<NonNullable<ModelsPayload["models"]>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      gatewayClient.request<ModelsPayload>("models.list", {}),
      getGatewayConfig(),
    ])
      .then(([modelsPayload, configPayload]) => {
        if (cancelled) return;
        const nextModels = Array.isArray(modelsPayload.models) ? modelsPayload.models : [];
        setModels(nextModels);
        setSelected(getAgentModel(configPayload, agentId) ?? nextModels[0]?.id ?? "-");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || "Impossible de charger les modeles.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const saveModel = async (modelId: string) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const config = await getGatewayConfig();
      const nextAgents = upsertResolvedAgent(config, agentId, (agent) => ({
        ...agent,
        model: modelId,
      }));
      await patchGatewayConfig({ agents: { list: nextAgents } }, config.hash);
      setSelected(modelId);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de sauvegarder le modele.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 space-y-4">
      <div>
        <div className="font-pixel text-xs text-gray-500 mb-2">Modèle actif</div>
        <div className="bg-pixel-bg border border-pixel-green p-2 font-pixel text-xs text-pixel-green">
          {selected}
        </div>
      </div>

      {loading && <p className="font-pixel text-xs text-gray-600">Chargement...</p>}
      {error && <p className="font-pixel text-xs text-pixel-red">{error}</p>}
      {saved && <p className="font-pixel text-xs text-pixel-green">Modèle mis à jour.</p>}

      <div className="space-y-2">
        {models.map((model) => (
          <button
            key={model?.id}
            type="button"
            onClick={() => model?.id && void saveModel(model.id)}
            disabled={saving || !model?.id}
            className={`border p-2 font-pixel text-xs ${
              selected === model?.id
                ? "border-pixel-green bg-pixel-bg text-pixel-green"
                : "border-pixel-border bg-pixel-bg text-gray-300"
            } disabled:opacity-50 text-left w-full`}
          >
            <div>{model?.name ?? model?.id}</div>
            <div className="mt-1 text-[10px] text-gray-500">
              {model?.provider ?? "provider inconnu"}
              {typeof model?.contextWindow === "number" ? ` · ctx ${model.contextWindow}` : ""}
              {model?.reasoning ? " · reasoning" : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
