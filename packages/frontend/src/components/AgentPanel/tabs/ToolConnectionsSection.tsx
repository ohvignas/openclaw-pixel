import { useEffect, useMemo, useState } from "react";
import {
  disconnectToolConnection,
  fetchToolConnectors,
  saveToolConnection,
  type ToolConnector,
  type ToolConnectionsResponse,
} from "../../../openclaw/toolConnections.ts";

interface ToolConnectionsSectionProps {
  agentId: string;
}

export function ToolConnectionsSection({ agentId }: ToolConnectionsSectionProps) {
  const [payload, setPayload] = useState<ToolConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextPayload = await fetchToolConnectors(agentId);
      setPayload(nextPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les connecteurs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [agentId]);

  const items = payload?.items ?? [];
  const readyItems = useMemo(
    () => items.filter((item) => item.availability === "ready").sort(sortByName),
    [items],
  );
  const pendingItems = useMemo(
    () => items.filter((item) => item.availability !== "ready").sort(sortByName),
    [items],
  );

  const setDraft = (toolId: string, value: string) => {
    setDrafts((current) => ({ ...current, [toolId]: value }));
  };

  const save = async (item: ToolConnector) => {
    const secret = (drafts[item.id] ?? "").trim();
    if (!secret) {
      setError(`Entre une valeur pour ${item.name}.`);
      return;
    }

    setSavingId(item.id);
    setError(null);
    try {
      await saveToolConnection(item.id, secret);
      setDraft(item.id, "");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer la cle.");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (item: ToolConnector) => {
    setSavingId(item.id);
    setError(null);
    try {
      await disconnectToolConnection(item.id);
      setDraft(item.id, "");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer la cle.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-4 border border-pixel-border bg-pixel-bg p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-pixel text-xs text-white">Connexions securisees</div>
          <InfoLine text="La cle tapee ici n'est jamais stockee par le repo ni renvoyee au frontend. Elle part dans le state OpenClaw, puis la gateway lit une SecretRef file." />
        </div>
        <div className="shrink-0 text-right">
          <div className="font-pixel text-[10px] uppercase tracking-wider text-gray-500">Stockage</div>
          <div className="mt-1 font-pixel text-[10px] text-pixel-accent">
            {payload?.security.storageMode === "openclaw-secretref-file" ? "OpenClaw SecretRef" : "inconnu"}
          </div>
          <div className="font-pixel text-[10px] text-gray-400">
            gateway {payload?.security.gatewayReachable ? "connectee" : "indisponible"}
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <InfoCard label="State dir" value={payload?.security.stateDir ?? "indisponible"} />
        <InfoCard
          label="Provider file"
          value={payload?.security.provider.path ?? "indisponible"}
        />
      </div>

      {!payload?.security.gatewayReachable && payload?.security.error && (
        <p className="font-pixel text-xs text-pixel-red">{payload.security.error}</p>
      )}

      {error && <p className="font-pixel text-xs text-pixel-red">{error}</p>}

      {loading ? (
        <p className="font-pixel text-xs text-gray-500">Chargement des connecteurs...</p>
      ) : (
        <>
          <div className="space-y-3">
            <div className="font-pixel text-xs text-white">Disponibles maintenant</div>
            <div className="grid gap-3 md:grid-cols-2">
              {readyItems.map((item) => (
                <article key={item.id} className="border border-pixel-border bg-pixel-panel p-3">
                  <ConnectorHeader item={item} />
                  <p className="mt-2 font-pixel text-[10px] leading-5 text-gray-400">{item.description}</p>
                  <p className="mt-2 font-pixel text-[10px] leading-5 text-gray-500">{item.helper}</p>

                  <div className="mt-3 border border-pixel-border/70 bg-pixel-bg px-2 py-2">
                    <div className="font-pixel text-[10px] text-pixel-yellow">{item.targetLabel}</div>
                    <div className="mt-1 font-pixel text-[10px] text-gray-500">
                      {item.connection?.status === "connected"
                        ? `Cle deja presente: ${item.connection.secretMasked ?? "***"}`
                        : item.connection?.status === "misconfigured"
                          ? item.connection.detail
                          : "Aucune cle enregistree pour le moment."}
                    </div>
                  </div>

                  <label className="mt-3 block">
                    <span className="font-pixel text-[10px] text-gray-400">{item.secretLabel}</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={drafts[item.id] ?? ""}
                      onChange={(event) => setDraft(item.id, event.target.value)}
                      placeholder={item.secretPlaceholder ?? ""}
                      className="mt-2 w-full border border-pixel-border bg-pixel-bg px-3 py-2 font-pixel text-[10px] text-white outline-none focus:border-pixel-accent"
                    />
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      active
                      disabled={savingId === item.id || !payload?.security.gatewayReachable}
                      onClick={() => void save(item)}
                    >
                      {savingId === item.id ? "..." : item.connection ? "Remplacer la cle" : "Enregistrer la cle"}
                    </ActionButton>
                    <ActionButton
                      disabled={savingId === item.id || !item.connection || !payload?.security.gatewayReachable}
                      onClick={() => void remove(item)}
                    >
                      Supprimer
                    </ActionButton>
                  </div>

                  {item.name === "OpenRouter" && (
                    <p className="mt-3 font-pixel text-[10px] text-gray-500">
                      Ensuite, choisis un modele `openrouter/...` dans l&apos;onglet Modele.
                    </p>
                  )}

                  {item.name === "Brave Search" && (
                    <p className="mt-3 font-pixel text-[10px] text-gray-500">
                      Cette cle active le `web_search` global de la gateway avec Brave.
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="font-pixel text-xs text-white">Pas encore branchables ici</div>
            <div className="grid gap-3 md:grid-cols-2">
              {pendingItems.map((item) => (
                <article key={item.id} className="border border-pixel-border bg-pixel-panel p-3">
                  <ConnectorHeader item={item} />
                  <p className="mt-2 font-pixel text-[10px] leading-5 text-gray-400">{item.description}</p>
                  <p className="mt-2 font-pixel text-[10px] leading-5 text-gray-500">{item.helper}</p>
                  <div className="mt-3 border border-pixel-border/70 bg-pixel-bg px-2 py-2">
                    <div className="font-pixel text-[10px] text-pixel-yellow">{item.availabilityLabel}</div>
                    <div className="mt-1 font-pixel text-[10px] text-gray-500">{item.availabilityReason}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ConnectorHeader({ item }: { item: ToolConnector }) {
  return (
    <div className="flex items-start gap-3">
      <img
        src={item.iconUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded border border-pixel-border bg-white/5 p-1 object-contain"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-pixel text-xs text-white">{item.name}</div>
          <Badge tone={item.availability === "ready" ? "green" : item.availability === "env-only" ? "yellow" : "gray"}>
            {item.availabilityLabel}
          </Badge>
          <Badge tone="pink">{item.authKind === "oauth" ? "OAuth" : "API key"}</Badge>
          <Badge tone="blue">{categoryLabel(item.category)}</Badge>
        </div>
      </div>
    </div>
  );
}

function categoryLabel(category: ToolConnector["category"]): string {
  if (category === "provider") return "Provider";
  if (category === "tool") return "Tool";
  if (category === "env-only") return "Env";
  if (category === "oauth") return "OAuth";
  return "Plugin";
}

function sortByName(left: ToolConnector, right: ToolConnector) {
  return left.name.localeCompare(right.name, "fr");
}

function Badge({ children, tone }: { children: string; tone: "gray" | "pink" | "blue" | "green" | "yellow" }) {
  const toneClass =
    tone === "pink"
      ? "border-pixel-accent text-pixel-accent"
      : tone === "blue"
        ? "border-sky-500 text-sky-400"
        : tone === "green"
          ? "border-pixel-green text-pixel-green"
          : tone === "yellow"
            ? "border-pixel-yellow text-pixel-yellow"
            : "border-gray-600 text-gray-400";

  return <span className={`border px-2 py-1 font-pixel text-[9px] uppercase tracking-wider ${toneClass}`}>{children}</span>;
}

function ActionButton({
  children,
  active = false,
  disabled = false,
  onClick,
}: {
  children: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const className = active
    ? "border-pixel-accent bg-pixel-accent/10 text-pixel-accent"
    : "border-pixel-border text-gray-300";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border px-3 py-2 font-pixel text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-pixel-border bg-pixel-panel px-3 py-2">
      <div className="font-pixel text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 break-all font-pixel text-[10px] text-gray-300">{value}</div>
    </div>
  );
}
