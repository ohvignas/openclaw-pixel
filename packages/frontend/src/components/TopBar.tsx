import { useState, useEffect, useRef } from "react";
import { useAgentStore } from "../store/agentStore.ts";
import { useGatewayStore, type Instance } from "../store/gatewayStore.ts";
import { CreateAgentDialog } from "./CreateAgentDialog.tsx";

interface DeskOption {
  seatId: string;
  label: string;
  assignedAgentId: string | null;
}

interface TopBarProps {
  onGatewayClick: () => void
  onShopClick: () => void
  coins: number
  editMode: boolean
  onToggleEdit: () => void
  onResetLayout: () => void
  onDisconnect: () => void
  deskOptions: DeskOption[]
  onCreateAgent: (input: { agentId: string; name: string; emoji: string; seatId: string }) => Promise<boolean>
  creatingAgent: boolean
  createAgentError: string | null
  onClearCreateAgentError: () => void
}

export function TopBar({
  onGatewayClick,
  onShopClick,
  coins,
  editMode,
  onToggleEdit,
  onResetLayout,
  onDisconnect,
  deskOptions,
  onCreateAgent,
  creatingAgent,
  createAgentError,
  onClearCreateAgentError,
}: TopBarProps) {
  const status = useGatewayStore((s) => s.status);
  const instances = useGatewayStore((s) => s.instances);
  const activeInstanceId = useGatewayStore((s) => s.activeInstanceId);
  const setActiveInstance = useGatewayStore((s) => s.setActiveInstance);
  const addInstance = useGatewayStore((s) => s.addInstance);

  const agents = useAgentStore((s) => s.agents);
  const activeCount = Object.values(agents).filter((a) => a.status === "working").length;

  const [showAddForm, setShowAddForm] = useState(false);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [newInstance, setNewInstance] = useState<Omit<Instance, "id">>({
    name: "",
    url: "ws://",
    token: "",
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAddForm) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAddForm(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAddForm]);

  const statusDot =
    status === "connected"
      ? "bg-pixel-green"
      : status === "connecting"
      ? "bg-pixel-yellow animate-pulse"
      : "bg-pixel-red";

  const statusLabel =
    status === "connected" ? "Connecté" :
    status === "connecting" ? "Connexion..." :
    "Déconnecté";

  const handleAddInstance = () => {
    if (!newInstance.name.trim() || !newInstance.url.trim()) return;
    if (!newInstance.url.startsWith("ws://") && !newInstance.url.startsWith("wss://")) return;
    const id = `instance-${Date.now()}`;
    addInstance({ id, ...newInstance });
    setNewInstance({ name: "", url: "ws://", token: "" });
    setShowAddForm(false);
    setActiveInstance(id);
  };

  return (
    <div className="h-10 bg-pixel-panel border-b border-pixel-border flex items-center px-4 gap-3 shrink-0 relative">
      {/* Logo */}
      <span className="text-pixel-accent tracking-widest font-pixel text-xs select-none">
        OPENCLAW
      </span>

      {/* Statut */}
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${statusDot}`} />
        <span className="text-gray-500 font-pixel text-xs">{statusLabel}</span>
      </div>

      {/* Compteur agents actifs */}
      <span className="text-gray-600 font-pixel text-xs">
        {activeCount} actif{activeCount !== 1 ? "s" : ""}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Coins */}
      <div className="flex items-center gap-1 font-pixel text-xs text-pixel-yellow">
        <img src="/assets/coin.png" alt="coins" className="w-4 h-4" style={{ imageRendering: "pixelated" }} />
        <span>{coins}</span>
      </div>

      {/* Boutique */}
      <button
        className="font-pixel text-xs px-2 py-1 border text-pixel-yellow border-pixel-yellow hover:bg-pixel-yellow/10 transition-colors"
        onClick={onShopClick}
        title="Ouvrir la boutique"
      >
        SHOP
      </button>

      <div className="flex items-center gap-2">
        <button
          className="font-pixel text-xs px-2 py-1 border text-pixel-accent border-pixel-accent hover:bg-pixel-bg transition-colors"
          onClick={() => setShowCreateAgent(true)}
          title="Creer un agent Open Claw"
        >
          + AGENT
        </button>
        <button
          className={`font-pixel text-xs px-2 py-1 border transition-colors ${
            editMode
              ? "text-pixel-green border-pixel-green bg-pixel-bg"
              : "text-gray-500 hover:text-pixel-green border-pixel-border hover:border-pixel-green"
          }`}
          onClick={onToggleEdit}
          title="Activer le mode edition du bureau"
        >
          {editMode ? "EDIT ON" : "EDIT"}
        </button>
        <button
          className="text-gray-500 hover:text-white font-pixel text-xs px-2 py-1 border border-pixel-border hover:border-white transition-colors"
          onClick={onResetLayout}
          title="Reinitialiser le layout du bureau"
        >
          RESET
        </button>
      </div>

      {/* Sélecteur d'instances */}
      <div className="flex items-center gap-2">
        <select
          className="bg-pixel-bg border border-pixel-border text-white font-pixel text-xs px-2 py-1 cursor-pointer"
          value={activeInstanceId}
          onChange={(e) => setActiveInstance(e.target.value)}
          aria-label="Sélectionner une instance"
        >
          {instances.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>

        {/* Bouton ajouter instance */}
        <button
          className="text-gray-500 hover:text-pixel-green font-pixel text-xs px-1 border border-pixel-border hover:border-pixel-green transition-colors"
          onClick={() => setShowAddForm((v) => !v)}
          title="Ajouter une instance"
        >
          +
        </button>
      </div>

      {/* Bouton Gateway settings */}
      <button
        className="text-gray-500 hover:text-pixel-accent font-pixel text-xs px-2 py-1 border border-pixel-border hover:border-pixel-accent transition-colors"
        onClick={onGatewayClick}
        title="Paramètres Gateway"
        aria-label="Ouvrir les paramètres Gateway"
      >
        ⚙
      </button>
      <button
        className="text-gray-500 hover:text-pixel-red font-pixel text-xs px-2 py-1 border border-pixel-border hover:border-pixel-red transition-colors"
        onClick={onDisconnect}
        title="Se deconnecter du gateway"
        aria-label="Se deconnecter du gateway"
      >
        Disconnect
      </button>

      {/* Formulaire ajout instance (dropdown) */}
      {showAddForm && (
        <div ref={dropdownRef} className="absolute top-10 right-0 w-72 bg-pixel-panel border border-pixel-border p-3 z-50 shadow-lg">
          <div className="font-pixel text-xs text-pixel-accent mb-3">Nouvelle instance</div>
          <div className="space-y-2">
            <div>
              <label className="font-pixel text-xs text-gray-500 block mb-1">Nom</label>
              <input
                className="w-full bg-pixel-bg border border-pixel-border text-white font-pixel text-xs px-2 py-1"
                placeholder="Mon VPS"
                value={newInstance.name}
                onChange={(e) => setNewInstance((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="font-pixel text-xs text-gray-500 block mb-1">URL WebSocket</label>
              <input
                className="w-full bg-pixel-bg border border-pixel-border text-white font-pixel text-xs px-2 py-1"
                placeholder="ws://monvps.com:18789"
                value={newInstance.url}
                onChange={(e) => setNewInstance((p) => ({ ...p, url: e.target.value }))}
              />
            </div>
            <div>
              <label className="font-pixel text-xs text-gray-500 block mb-1">Token (optionnel)</label>
              <input
                type="password"
                className="w-full bg-pixel-bg border border-pixel-border text-white font-pixel text-xs px-2 py-1"
                placeholder="••••••••"
                value={newInstance.token}
                onChange={(e) => setNewInstance((p) => ({ ...p, token: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                className="flex-1 bg-pixel-accent text-white font-pixel text-xs py-1 hover:opacity-80"
                onClick={handleAddInstance}
              >
                Ajouter
              </button>
              <button
                className="flex-1 border border-pixel-border text-gray-500 font-pixel text-xs py-1 hover:text-white"
                onClick={() => setShowAddForm(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateAgentDialog
        open={showCreateAgent}
        deskOptions={deskOptions}
        creating={creatingAgent}
        error={createAgentError}
        onClearError={onClearCreateAgentError}
        onClose={() => setShowCreateAgent(false)}
        onCreate={async (input) => {
          const created = await onCreateAgent(input);
          if (created) {
            setShowCreateAgent(false);
          }
          return created;
        }}
      />
    </div>
  );
}
