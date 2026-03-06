import { useEffect, useState } from "react";
import { gatewayClient } from "../../../openclaw/openclawClient.ts";
import {
  getAgentElevatedEnabled,
  getAgentSandboxMode,
  getAgentSubagentAllowList,
  getAgentToAgentSettings,
  getAgentToolProfile,
  getGatewayConfig,
  getResolvedAgentsList,
  patchGatewayConfig,
  upsertResolvedAgent,
} from "../../../openclaw/agentConfig.ts";
import { ToolConnectionsSection } from "./ToolConnectionsSection.tsx";

interface ToolsCatalogPayload {
  profiles?: Array<{ id?: string; label?: string }>;
  groups?: Array<{
    id?: string;
    label?: string;
    tools?: Array<{
      id?: string;
      label?: string;
      description?: string;
      defaultProfiles?: string[];
    }>;
  }>;
}

interface ToolSettingsState {
  profile: string;
  elevatedEnabled: boolean;
  sandboxMode: string;
  agentToAgentEnabled: boolean;
  agentToAgentAllow: string[];
  subagentAllow: string[];
}

const TOOL_PROFILES = [
  { id: "minimal", label: "Minimal", help: "Tres peu d'outils. Bien pour un agent qui ne doit presque rien faire seul." },
  { id: "messaging", label: "Messaging", help: "Pour discuter, chercher dans les sessions et repondre. Bon profil par defaut." },
  { id: "coding", label: "Coding", help: "Ajoute fichiers, commandes, memoire et outils de sessions. Plus puissant, donc plus risqué." },
  { id: "full", label: "Full", help: "Quasi sans restriction. A reserver aux usages avances." },
] as const;

const SANDBOX_MODES = [
  { id: "off", label: "Off", help: "L'agent n'est pas isole. Les commandes sensibles peuvent toucher directement l'environnement." },
  { id: "non-main", label: "Non-main", help: "Le sandbox s'applique surtout aux agents secondaires ou non principaux." },
  { id: "all", label: "All", help: "Le plus strict: tous les runs passent par le sandbox." },
] as const;

export function ToolsTab({ agentId }: { agentId: string }) {
  const [catalog, setCatalog] = useState<ToolsCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<ToolSettingsState>({
    profile: "messaging",
    elevatedEnabled: false,
    sandboxMode: "off",
    agentToAgentEnabled: false,
    agentToAgentAllow: [],
    subagentAllow: [],
  });
  const [availableAgents, setAvailableAgents] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      gatewayClient.request<ToolsCatalogPayload>("tools.catalog", {}),
      getGatewayConfig(),
    ])
      .then(([catalogPayload, config]) => {
        if (cancelled) return;
        setCatalog(catalogPayload);
        setAvailableAgents(
          getResolvedAgentsList(config)
            .map((agent) => (typeof agent.id === "string" ? agent.id : null))
            .filter((id): id is string => Boolean(id && id !== agentId)),
        );
        const agentToAgent = getAgentToAgentSettings(config);
        setSettings({
          profile: getAgentToolProfile(config, agentId),
          elevatedEnabled: getAgentElevatedEnabled(config, agentId),
          sandboxMode: getAgentSandboxMode(config, agentId),
          agentToAgentEnabled: agentToAgent.enabled,
          agentToAgentAllow: agentToAgent.allow,
          subagentAllow: getAgentSubagentAllowList(config, agentId),
        });
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Impossible de charger les reglages d'outils.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const toggleListValue = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const config = await getGatewayConfig();
      const nextAgents = upsertResolvedAgent(config, agentId, (agent) => ({
        ...agent,
        sandbox: {
          ...((agent.sandbox as Record<string, unknown> | undefined) ?? {}),
          mode: settings.sandboxMode,
        },
        subagents: {
          ...((agent.subagents as Record<string, unknown> | undefined) ?? {}),
          allowAgents: settings.subagentAllow,
        },
        tools: {
          ...((agent.tools as Record<string, unknown> | undefined) ?? {}),
          profile: settings.profile,
          elevated: {
            ...((((agent.tools as { elevated?: Record<string, unknown> } | undefined)?.elevated) ?? {})),
            enabled: settings.elevatedEnabled,
          },
        },
      }));

      await patchGatewayConfig(
        {
          tools: {
            agentToAgent: {
              enabled: settings.agentToAgentEnabled,
              allow: settings.agentToAgentAllow,
            },
          },
          agents: {
            list: nextAgents,
          },
        },
        config.hash,
      );
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de sauvegarder les reglages.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-3"><p className="font-pixel text-xs text-gray-600">Chargement...</p></div>;
  }

  return (
    <div className="p-3 space-y-4">
      {error && <p className="font-pixel text-xs text-pixel-red">{error}</p>}
      {saved && <p className="font-pixel text-xs text-pixel-green">Reglages sauvegardes.</p>}

      <ToolConnectionsSection agentId={agentId} />

      <section className="space-y-3 border border-pixel-border bg-pixel-bg p-3">
        <div>
          <div className="font-pixel text-xs text-white">Profil d&apos;outils</div>
          <InfoLine text="Choisit le niveau de puissance general de l'agent. Pour debuter, garde 'Messaging' ou 'Coding' selon ton besoin." />
        </div>
        <div className="grid gap-2">
          {TOOL_PROFILES.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setSettings((current) => ({ ...current, profile: profile.id }))}
              className={`border p-2 text-left font-pixel text-xs ${
                settings.profile === profile.id
                  ? "border-pixel-accent text-pixel-accent"
                  : "border-pixel-border text-gray-300"
              }`}
            >
              <div>{profile.label}</div>
              <div className="mt-1 text-[10px] text-gray-500">{profile.help}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 border border-pixel-border bg-pixel-bg p-3">
        <div>
          <div className="font-pixel text-xs text-white">Delegation vers d&apos;autres agents</div>
          <InfoLine text="Active uniquement si cet agent doit demander de l'aide a d'autres agents ou lancer des sous-agents. Sinon, laisse desactive." />
        </div>
        <ToggleRow
          label="Activer agent-to-agent"
          help="Reglage global Open Claw: ouvre la capacite d'envoyer des taches a d'autres agents."
          checked={settings.agentToAgentEnabled}
          onChange={(checked) => setSettings((current) => ({ ...current, agentToAgentEnabled: checked }))}
        />
        <div>
          <div className="font-pixel text-xs text-gray-400 mb-2">Agents que le systeme autorise a contacter</div>
          <div className="flex flex-wrap gap-2">
            {availableAgents.map((otherAgentId) => (
              <TagToggle
                key={otherAgentId}
                active={settings.agentToAgentAllow.includes(otherAgentId)}
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    agentToAgentAllow: toggleListValue(current.agentToAgentAllow, otherAgentId),
                  }))
                }
                label={otherAgentId}
              />
            ))}
            {availableAgents.length === 0 && (
              <span className="font-pixel text-xs text-gray-600">Aucun autre agent configure.</span>
            )}
          </div>
        </div>
        <div>
          <div className="font-pixel text-xs text-gray-400 mb-2">Sous-agents que cet agent a le droit de lancer</div>
          <InfoLine text="Deux verrous existent: le reglage global 'agent-to-agent' ci-dessus, et cette allowlist propre a l'agent courant." />
          <div className="flex flex-wrap gap-2 mt-2">
            {availableAgents.map((otherAgentId) => (
              <TagToggle
                key={`sub-${otherAgentId}`}
                active={settings.subagentAllow.includes(otherAgentId)}
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    subagentAllow: toggleListValue(current.subagentAllow, otherAgentId),
                  }))
                }
                label={otherAgentId}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3 border border-pixel-border bg-pixel-bg p-3">
        <div>
          <div className="font-pixel text-xs text-white">Securite d&apos;execution</div>
          <InfoLine text="Ces reglages decident si l'agent peut lancer des actions puissantes et a quel niveau d'isolation." />
        </div>
        <ToggleRow
          label="Acces eleve"
          help="Autorise les commandes host plus puissantes si Open Claw les permet globalement. Pour un debutant, laisse coupe sauf besoin clair."
          checked={settings.elevatedEnabled}
          onChange={(checked) => setSettings((current) => ({ ...current, elevatedEnabled: checked }))}
        />
        <div>
          <div className="font-pixel text-xs text-gray-400 mb-2">Mode sandbox</div>
          <div className="grid gap-2">
            {SANDBOX_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSettings((current) => ({ ...current, sandboxMode: mode.id }))}
                className={`border p-2 text-left font-pixel text-xs ${
                  settings.sandboxMode === mode.id
                    ? "border-pixel-accent text-pixel-accent"
                    : "border-pixel-border text-gray-300"
                }`}
              >
                <div>{mode.label}</div>
                <div className="mt-1 text-[10px] text-gray-500">{mode.help}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => void saveSettings()}
        disabled={saving}
        className="bg-pixel-accent px-3 py-1 font-pixel text-xs text-white hover:opacity-80 disabled:opacity-50"
      >
        {saving ? "Sauvegarde..." : "Sauvegarder les reglages"}
      </button>

      <section className="space-y-4 pt-2">
        <div>
          <div className="font-pixel text-xs text-gray-500 uppercase tracking-wider mb-2">Catalogue des outils</div>
          <InfoLine text="Vue technique des outils exposes par Open Claw. Utile pour comprendre ce que couvre chaque profil." />
        </div>

        {Array.isArray(catalog?.profiles) && catalog.profiles.length > 0 && (
          <div>
            <div className="font-pixel text-xs text-gray-500 uppercase tracking-wider mb-2">
              Profils disponibles
            </div>
            <div className="flex flex-wrap gap-2">
              {catalog.profiles.map((profile) => (
                <span key={profile.id} className="border border-pixel-border bg-pixel-bg px-2 py-1 font-pixel text-xs text-gray-300">
                  {profile.label ?? profile.id}
                </span>
              ))}
            </div>
          </div>
        )}

        {(catalog?.groups ?? []).map((group) => (
          <div key={group.id ?? group.label}>
            <div className="font-pixel text-xs text-gray-500 uppercase tracking-wider mb-2">
              {group.label ?? group.id}
            </div>
            <div className="space-y-1">
              {(group.tools ?? []).map((tool) => (
                <div key={tool.id} className="border border-pixel-border bg-pixel-bg p-2">
                  <div className="font-pixel text-xs text-white">{tool.label ?? tool.id}</div>
                  {tool.description && (
                    <div className="mt-1 font-pixel text-[10px] text-gray-500">{tool.description}</div>
                  )}
                  {Array.isArray(tool.defaultProfiles) && tool.defaultProfiles.length > 0 && (
                    <div className="mt-1 font-pixel text-[10px] text-pixel-accent">
                      profils: {tool.defaultProfiles.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function InfoLine({ text }: { text: string }) {
  return (
    <div className="mt-1 flex items-start gap-2 font-pixel text-[10px] text-gray-500">
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-pixel-border text-[9px] text-pixel-accent">
        i
      </span>
      <span>{text}</span>
    </div>
  );
}

function ToggleRow({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="border border-pixel-border p-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-pixel text-xs text-white">{label}</div>
          <div className="mt-1 font-pixel text-[10px] text-gray-500">{help}</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`h-6 w-12 rounded-full border transition-colors ${
            checked ? "border-pixel-green bg-pixel-green/20" : "border-pixel-border bg-pixel-panel"
          }`}
        >
          <span
            className={`block h-4 w-4 rounded-full bg-white transition-transform ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function TagToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2 py-1 font-pixel text-xs ${
        active ? "border-pixel-accent text-pixel-accent" : "border-pixel-border text-gray-400"
      }`}
    >
      {label}
    </button>
  );
}
