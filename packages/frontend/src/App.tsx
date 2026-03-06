import { useEffect, useState } from "react";
import { OfficeCanvas } from "./canvas/OfficeCanvas.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { AgentPanel } from "./components/AgentPanel/index.tsx";
import { GatewayPanel } from "./components/GatewayPanel/index.tsx";
import { GatewayConnectScreen } from "./components/GatewayConnectScreen.tsx";
import { ShopOverlay } from "./components/ShopOverlay.tsx";
import { InventoryBar } from "./components/InventoryBar.tsx";
import { AgentScreen } from "./components/AgentScreen/index.tsx";
import { useAgentStore } from "./store/agentStore.ts";
import { useGatewayStore, type Instance } from "./store/gatewayStore.ts";
import { useWorkspaceStore } from "./store/workspaceStore.ts";
import { useEconomyStore } from "./store/economyStore.ts";
import { gatewayClient, type GatewayDebugState } from "./openclaw/openclawClient.ts";
import { parseEvent } from "./openclaw/eventParser.ts";
import { processCoinEvent } from "./economy/coinEngine.ts";
import { OfficeState } from "./office/engine/officeState.ts";
import { loadAssets } from "./canvas/assetLoader.ts";
import { syncAgentToOffice, removeStaleAgents } from "./canvas/officeBridge.ts";
import type { OfficeLayout } from "./office/types.ts";
import { deserializeLayout, serializeLayout } from "./office/layout/layoutSerializer.ts";

const OFFICE_LAYOUT_STORAGE_KEY = "openclaw-pixel.office-layout";

interface DefaultGatewayInfo {
  gatewayWsUrl: string;
  gatewayTokenConfigured: boolean;
  gatewayProxyTarget: string;
}

interface GatewayAgentsListPayload {
  defaultId?: string;
  agents?: Array<{ id?: string }>;
}

interface GatewayIdentityPayload {
  agentId?: string;
  name?: string;
  avatar?: string;
}

interface GatewayConfigPayload {
  hash?: string;
  resolved?: {
    agents?: {
      defaults?: {
        workspace?: string;
      };
      list?: Array<{
        id?: string;
        workspace?: string;
        identity?: {
          name?: string;
          emoji?: string;
        };
      }>;
    };
  };
}

interface GatewayHealthPayload {
  defaultAgentId?: string;
  agents?: Array<{
    agentId?: string;
    isDefault?: boolean;
    sessions?: {
      recent?: Array<{ key?: string }>;
    };
  }>;
  sessions?: {
    recent?: Array<{ key?: string }>;
  };
}

interface DeskOption {
  seatId: string;
  label: string;
  assignedAgentId: string | null;
}

interface CreateAgentInput {
  agentId: string;
  name: string;
  emoji: string;
  seatId: string;
}

function deriveSessionKey(agentId: string, health?: GatewayHealthPayload, recentKey?: string): string {
  if (recentKey) return recentKey;
  const globalRecent = Array.isArray(health?.sessions?.recent) ? health.sessions.recent : [];
  const fallback = globalRecent.find((session) => typeof session?.key === "string")?.key;
  if (health?.defaultAgentId === agentId && fallback) return fallback;
  return `agent:${agentId}:${agentId}`;
}

export function App() {
  const { setAgentStatus, addEvent, selectAgent, selectedAgentId, agents, upsertAgent, reset: resetAgents } = useAgentStore();
  const {
    agentSeatAssignments,
    assignSeat,
    setAssignments,
    clearStale: clearStaleAssignments,
  } = useWorkspaceStore();
  const {
    setStatus,
    status,
    activeInstanceId,
    instances,
    manualReconnectRequired,
    setActiveInstance,
    requireManualReconnect,
    clearManualReconnect,
  } = useGatewayStore();
  const { coins, fetchBalance, fetchInventory } = useEconomyStore();
  const [showGateway, setShowGateway] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [agentScreenId, setAgentScreenId] = useState<string | null>(null);
  const [deskNames, setDeskNames] = useState<Record<string, string>>({});
  const [placingItem, setPlacingItem] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [characterImages, setCharacterImages] = useState<HTMLImageElement[]>([]);
  const [office, setOffice] = useState<OfficeState | null>(null);
  const [defaultLayout, setDefaultLayout] = useState<OfficeLayout | null>(null);
  const [gatewayDebug, setGatewayDebug] = useState<GatewayDebugState>(gatewayClient.getDebugState());
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [createAgentError, setCreateAgentError] = useState<string | null>(null);
  const [defaultGatewayInfo, setDefaultGatewayInfo] = useState<DefaultGatewayInfo>({
    gatewayWsUrl: "/ws",
    gatewayTokenConfigured: false,
    gatewayProxyTarget: "ws://localhost:18789",
  });

  // Load assets (characters PNG + walls PNG + floor sprites + layout JSON)
  useEffect(() => {
    loadAssets()
      .then((assets) => {
        setCharacterImages(assets.characters);
        setDefaultLayout(assets.layout ?? null);
        const savedLayout = window.localStorage.getItem(OFFICE_LAYOUT_STORAGE_KEY);
        const restoredLayout = savedLayout ? deserializeLayout(savedLayout) : null;
        const office = new OfficeState(restoredLayout ?? assets.layout ?? undefined);
        setOffice(office);
      })
      .catch(() => {
        const office = new OfficeState();
        setOffice(office);
      });
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((config) => {
        setDefaultGatewayInfo({
          gatewayWsUrl: typeof config.gatewayWsUrl === "string" ? config.gatewayWsUrl : "/ws",
          gatewayTokenConfigured: Boolean(config.gatewayTokenConfigured),
          gatewayProxyTarget: typeof config.gatewayProxyTarget === "string"
            ? config.gatewayProxyTarget
            : "ws://localhost:18789",
        });
      })
      .catch(() => {});
  }, []);

  // Sync agentStore → OfficeState on every agents change
  useEffect(() => {
    if (!office) return;
    const currentIds = new Set(Object.keys(agents));
    for (const agent of Object.values(agents)) {
      syncAgentToOffice(
        { ...agent, assignedSeatId: agentSeatAssignments[agent.id] ?? agent.assignedSeatId },
        office,
      );
    }
    removeStaleAgents(currentIds, office);
  }, [agents, office, agentSeatAssignments]);

  useEffect(() => {
    if (!office) return;
    const seatIds = office.getAssignableSeatIds();
    const nextAssignments = { ...agentSeatAssignments };
    let changed = false;

    const orderedAgents = Object.values(agents).sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.id.localeCompare(b.id);
    });

    for (const agent of orderedAgents) {
      const assignedSeatId = nextAssignments[agent.id];
      if (assignedSeatId && seatIds.includes(assignedSeatId)) continue;

      const usedSeats = new Set(
        Object.entries(nextAssignments)
          .filter(([otherAgentId]) => otherAgentId !== agent.id)
          .map(([, seatId]) => seatId),
      );
      const freeSeatId = seatIds.find((seatId) => !usedSeats.has(seatId));
      if (!freeSeatId) continue;
      nextAssignments[agent.id] = freeSeatId;
      changed = true;
    }

    for (const agentId of Object.keys(nextAssignments)) {
      if (!agents[agentId] || !seatIds.includes(nextAssignments[agentId])) {
        delete nextAssignments[agentId];
        changed = true;
      }
    }

    if (changed) {
      setAssignments(nextAssignments);
    }
  }, [agents, office, agentSeatAssignments, setAssignments]);

  useEffect(() => {
    if (!office) return;
    office.selectedAgentId = selectedAgentId;
    if (selectedAgentId === null) {
      office.cameraFollowId = null;
    }
  }, [office, selectedAgentId]);

  const upsertGatewayAgent = (agentId: string, patch: Partial<(typeof agents)[string]> = {}) => {
    const existing = useAgentStore.getState().agents[agentId];
    upsertAgent({
      id: agentId,
      name: patch.name ?? existing?.name ?? agentId,
      emoji: patch.emoji ?? existing?.emoji ?? "🤖",
      status: patch.status ?? existing?.status ?? "idle",
      model: patch.model ?? existing?.model,
      currentTool: patch.currentTool ?? existing?.currentTool,
      currentToolDetail: patch.currentToolDetail ?? existing?.currentToolDetail,
      sessionKey: patch.sessionKey ?? existing?.sessionKey,
      isDefault: patch.isDefault ?? existing?.isDefault,
      assignedSeatId: patch.assignedSeatId ?? existing?.assignedSeatId ?? agentSeatAssignments[agentId],
    });
  };

  const syncAgentsFromHealth = (payload: GatewayHealthPayload) => {
    if (!Array.isArray(payload.agents)) return;
    for (const item of payload.agents) {
      const agentId = typeof item?.agentId === "string" ? item.agentId : null;
      if (!agentId) continue;
      const recentKey = Array.isArray(item.sessions?.recent)
        ? item.sessions.recent.find((session) => typeof session?.key === "string")?.key
        : undefined;
      upsertGatewayAgent(agentId, {
        isDefault: item.isDefault ?? payload.defaultAgentId === agentId,
        sessionKey: deriveSessionKey(agentId, payload, recentKey),
      });
    }
  };

  // Abonnement aux événements et statut du client singleton
  useEffect(() => {
    const unsubStatus = gatewayClient.onStatus(setStatus);
    const unsubDebug = gatewayClient.onDebug(setGatewayDebug);

    const unsubEvents = gatewayClient.on((event) => {
      if (event.type === "event" && event.event === "health") {
        syncAgentsFromHealth((event.payload ?? {}) as GatewayHealthPayload);
      }

      processCoinEvent(event);

      const update = parseEvent(event);
      if (update) {
        setAgentStatus(update.agentId, update.status, update.currentTool, update.currentToolDetail);
        addEvent({
          timestamp: Date.now(),
          agentId: update.agentId,
          type: update.eventType,
          detail: update.detail,
        });
      }
    });

    return () => {
      unsubStatus();
      unsubDebug();
      unsubEvents();
    };
  }, [setStatus, setAgentStatus, addEvent]);

  useEffect(() => {
    if (manualReconnectRequired) {
      setStatus("disconnected");
    }
  }, [manualReconnectRequired, setStatus]);

  useEffect(() => {
    if (status === "connected") {
      clearManualReconnect();
    }
  }, [status, clearManualReconnect]);

  useEffect(() => {
    if (status === "connected") return;
    resetAgents();
    if (office) {
      office.selectedAgentId = null;
      office.cameraFollowId = null;
    }
  }, [status, resetAgents, office]);

  useEffect(() => {
    if (status !== "connected") return;
    void fetchBalance();
    void fetchInventory();
  }, [status]);

  useEffect(() => {
    if (status !== "connected") return;
    let cancelled = false;

    const loadAgents = async () => {
      try {
        const payload = await gatewayClient.request<GatewayAgentsListPayload>("agents.list", {});
        if (cancelled) return;

        const defaultId = typeof payload.defaultId === "string" ? payload.defaultId : undefined;
        const agentIds = (Array.isArray(payload.agents) ? payload.agents : [])
          .map((item) => (typeof item?.id === "string" ? item.id : null))
          .filter((id): id is string => Boolean(id));

        clearStaleAssignments(agentIds);

        for (const agentId of agentIds) {
          upsertGatewayAgent(agentId, {
            isDefault: defaultId === agentId,
            sessionKey: deriveSessionKey(agentId),
          });
        }

        await Promise.all(agentIds.map(async (agentId) => {
          try {
            const identity = await gatewayClient.request<GatewayIdentityPayload>("agent.identity.get", { agentId });
            if (cancelled) return;
            upsertGatewayAgent(agentId, {
              name: typeof identity.name === "string" ? identity.name : agentId,
              emoji: typeof identity.avatar === "string" ? identity.avatar : undefined,
              isDefault: defaultId === agentId,
            });
          } catch {
            // Les events "health" suffisent pour garder un roster minimal.
          }
        }));
      } catch {
        // Le roster peut encore arriver par websocket via "health".
      }
    };

    loadAgents();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (manualReconnectRequired) return;
    const instance = instances.find((i) => i.id === activeInstanceId);
    if (!instance) return;
    connectToInstance(instance);
  }, [activeInstanceId, instances, manualReconnectRequired]);

  const handleLayoutChange = (layout: OfficeLayout) => {
    window.localStorage.setItem(OFFICE_LAYOUT_STORAGE_KEY, serializeLayout(layout));
  };

  const handleResetLayout = () => {
    if (!office || !defaultLayout) return;
    office.setLayout(defaultLayout);
    handleLayoutChange(office.getLayout());
  };

  const resolveInstanceConfig = async (instance: Instance): Promise<{ wsUrl: string; token: string }> => {
    if (instance.id === "default" || instance.url === "/ws") {
      try {
        const response = await fetch("/api/config");
        const cfg = await response.json() as {
          gatewayWsUrl?: string;
          gatewayToken?: string;
          gatewayTokenConfigured?: boolean;
          gatewayProxyTarget?: string;
        };
        setDefaultGatewayInfo({
          gatewayWsUrl: cfg.gatewayWsUrl ?? "/ws",
          gatewayTokenConfigured: Boolean(cfg.gatewayTokenConfigured),
          gatewayProxyTarget: cfg.gatewayProxyTarget ?? "ws://localhost:18789",
        });
        return {
          wsUrl: cfg.gatewayWsUrl ?? "/ws",
          token: cfg.gatewayToken ?? "",
        };
      } catch {
        return { wsUrl: "/ws", token: "" };
      }
    }
    return { wsUrl: instance.url, token: instance.token };
  };

  const connectToInstance = async (instance: Instance) => {
    setActiveInstance(instance.id);
    setStatus("connecting");
    const config = await resolveInstanceConfig(instance);
    gatewayClient.setConfig(config.wsUrl, config.token);
    gatewayClient.connect();
  };

  const handleDisconnect = () => {
    gatewayClient.disconnect();
    requireManualReconnect();
    resetAgents();
    if (office) {
      office.selectedAgentId = null;
      office.cameraFollowId = null;
    }
  };

  const deskOptions: DeskOption[] = office
    ? office.getAssignableSeatIds().map((seatId, index) => ({
        seatId,
        label: `Bureau ${index + 1}`,
        assignedAgentId: Object.entries(agentSeatAssignments).find(([, assignedSeatId]) => assignedSeatId === seatId)?.[0] ?? null,
      }))
    : [];

  const handleCreateAgent = async ({ agentId, name, emoji, seatId }: CreateAgentInput): Promise<boolean> => {
    const normalizedAgentId = normalizeAgentId(agentId || name);
    if (!normalizedAgentId) {
      setCreateAgentError("Choisis un identifiant agent valide.");
      return false;
    }

    if (agents[normalizedAgentId]) {
      setCreateAgentError(`L'agent ${normalizedAgentId} existe deja.`);
      return false;
    }

    if (!deskOptions.some((desk) => desk.seatId === seatId && desk.assignedAgentId === null)) {
      setCreateAgentError("Ce bureau n'est plus disponible. Choisis-en un autre.");
      return false;
    }

    setCreatingAgent(true);
    setCreateAgentError(null);

    try {
      const config = await gatewayClient.request<GatewayConfigPayload>("config.get", {});
      const workspaceRoot = config.resolved?.agents?.defaults?.workspace ?? "~/.openclaw/workspace";
      const nextWorkspace = buildAgentWorkspace(workspaceRoot, normalizedAgentId);
      const nextName = name.trim() || normalizedAgentId;
      const nextEmoji = emoji.trim() || "🤖";

      try {
        await gatewayClient.request("agents.create", {
          agentId: normalizedAgentId,
          workspace: nextWorkspace,
          identity: {
            name: nextName,
            emoji: nextEmoji,
          },
        });
      } catch (createError) {
        const currentAgents = Array.isArray(config.resolved?.agents?.list) ? config.resolved?.agents?.list : [];
        const nextAgents = [
          ...currentAgents,
          {
            id: normalizedAgentId,
            workspace: nextWorkspace,
            identity: {
              name: nextName,
              emoji: nextEmoji,
            },
          },
        ];

        await gatewayClient.request("config.patch", {
          raw: JSON.stringify({
            agents: {
              list: nextAgents,
            },
          }),
          baseHash: config.hash,
          note: `Add agent ${normalizedAgentId}`,
        }).catch((patchError) => {
          const createMessage = createError instanceof Error ? createError.message : String(createError);
          const patchMessage = patchError instanceof Error ? patchError.message : String(patchError);
          throw new Error(`agents.create: ${createMessage} | config.patch: ${patchMessage}`);
        });
      }

      assignSeat(normalizedAgentId, seatId);
      upsertGatewayAgent(normalizedAgentId, {
        name: nextName,
        emoji: nextEmoji,
        status: "idle",
        sessionKey: deriveSessionKey(normalizedAgentId),
        assignedSeatId: seatId,
      });
      selectAgent(normalizedAgentId);
      return true;
    } catch (error) {
      setCreateAgentError(error instanceof Error ? error.message : "Impossible de creer l'agent.");
      return false;
    } finally {
      setCreatingAgent(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-pixel-bg text-white font-pixel text-xs overflow-hidden">
      {status === "connected" ? (
        <>
          <TopBar
            onGatewayClick={() => setShowGateway((v) => !v)}
            onShopClick={() => setShowShop(true)}
            coins={coins}
            editMode={editMode}
            onToggleEdit={() => setEditMode((v) => !v)}
            onResetLayout={handleResetLayout}
            onDisconnect={handleDisconnect}
            deskOptions={deskOptions}
            onCreateAgent={handleCreateAgent}
            creatingAgent={creatingAgent}
            createAgentError={createAgentError}
            onClearCreateAgentError={() => setCreateAgentError(null)}
          />

          <div className="flex flex-1 overflow-hidden flex-col">
            <div className="flex flex-1 overflow-hidden">
              {office && (
                <OfficeCanvas
                  officeState={office}
                  characterImages={characterImages}
                  editMode={editMode}
                  onLayoutChange={handleLayoutChange}
                  onAgentClick={(agentId) => {
                    selectAgent(agentId);
                    setAgentScreenId(agentId);
                  }}
                />
              )}
              <AgentPanel />
              {showGateway && <GatewayPanel onClose={() => setShowGateway(false)} />}
            </div>
            {editMode && (
              <InventoryBar
                selectedItem={placingItem}
                onSelectItem={setPlacingItem}
              />
            )}
          </div>

          {showShop && <ShopOverlay onClose={() => setShowShop(false)} />}

          {agentScreenId && (
            <AgentScreen
              agentId={agentScreenId}
              deskName={deskNames[agentScreenId] ?? `Bureau ${agentScreenId}`}
              onDeskNameChange={(name) =>
                setDeskNames((prev) => ({ ...prev, [agentScreenId]: name }))
              }
              onClose={() => setAgentScreenId(null)}
              availableAgents={Object.values(agents).map((a) => ({
                id: a.id,
                name: a.name,
                emoji: a.emoji,
              }))}
              onChangeAgent={(id) => setAgentScreenId(id)}
            />
          )}
        </>
      ) : (
        <GatewayConnectScreen
          onConnect={connectToInstance}
          debug={gatewayDebug}
          defaultGatewayInfo={defaultGatewayInfo}
        />
      )}
    </div>
  );
}

function normalizeAgentId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildAgentWorkspace(defaultWorkspace: string, agentId: string): string {
  const trimmed = defaultWorkspace.trim();
  if (!trimmed) return `~/.openclaw/workspace-${agentId}`;
  if (trimmed.endsWith(`-${agentId}`)) return trimmed;
  if (trimmed.endsWith("/workspace")) return `${trimmed}-${agentId}`;
  return `${trimmed}-${agentId}`;
}
