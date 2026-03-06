import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Instance {
  id: string;
  name: string;
  url: string;
  token: string;
}

interface GatewayStoreState {
  status: "connecting" | "connected" | "disconnected";
  instances: Instance[];
  activeInstanceId: string;
  manualReconnectRequired: boolean;
  setStatus: (status: GatewayStoreState["status"]) => void;
  setActiveInstance: (id: string) => void;
  addInstance: (instance: Instance) => void;
  removeInstance: (id: string) => void;
  requireManualReconnect: () => void;
  clearManualReconnect: () => void;
}

const DEFAULT_INSTANCE: Instance = {
  id: "default",
  name: "Gateway local",
  url: "/ws",
  token: "",
};

export const useGatewayStore = create<GatewayStoreState>()(
  persist(
    (set) => ({
      status: "connecting" as const,
      instances: [DEFAULT_INSTANCE],
      activeInstanceId: "default",
      manualReconnectRequired: false,

      setStatus: (status) => set({ status }),

      setActiveInstance: (id) => set({ activeInstanceId: id }),

      addInstance: (instance) =>
        set((s) => ({
          instances: [...s.instances.filter((i) => i.id !== instance.id), instance],
        })),

      removeInstance: (id) =>
        set((s) => ({
          instances: s.instances.filter((i) => i.id !== id),
          activeInstanceId: s.activeInstanceId === id ? "default" : s.activeInstanceId,
        })),
      requireManualReconnect: () => set({ manualReconnectRequired: true, status: "disconnected" }),
      clearManualReconnect: () => set({ manualReconnectRequired: false }),
    }),
    {
      name: "gateway-store",
      partialize: (state) => ({
        instances: state.instances,
        activeInstanceId: state.activeInstanceId,
        manualReconnectRequired: state.manualReconnectRequired,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<GatewayStoreState> | undefined) ?? {};
        const persistedInstances = Array.isArray(persisted.instances) ? persisted.instances : [];
        const customInstances = persistedInstances.filter((instance): instance is Instance =>
          Boolean(
            instance &&
            typeof instance.id === "string" &&
            typeof instance.name === "string" &&
            typeof instance.url === "string" &&
            typeof instance.token === "string" &&
            instance.id !== DEFAULT_INSTANCE.id
          )
        );
        const instances = [DEFAULT_INSTANCE, ...customInstances];
        const activeInstanceId = instances.some((instance) => instance.id === persisted.activeInstanceId)
          ? persisted.activeInstanceId!
          : DEFAULT_INSTANCE.id;

        return {
          ...currentState,
          ...persisted,
          instances,
          activeInstanceId,
          manualReconnectRequired: persisted.manualReconnectRequired ?? false,
        };
      },
    }
  )
);
