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
  setStatus: (status: GatewayStoreState["status"]) => void;
  setActiveInstance: (id: string) => void;
  addInstance: (instance: Instance) => void;
  removeInstance: (id: string) => void;
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
    }),
    {
      name: "gateway-store",
      partialize: (state) => ({
        instances: state.instances,
        activeInstanceId: state.activeInstanceId,
      }),
    }
  )
);
