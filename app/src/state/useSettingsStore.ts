import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SettingsState {
  backendUrl: string;
  activeDeviceSerial: string | null;
  setBackendUrl: (url: string) => void;
  setActiveDeviceSerial: (serial: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      backendUrl: "http://localhost:8000",
      activeDeviceSerial: null,
      setBackendUrl: (url) => set({ backendUrl: url }),
      setActiveDeviceSerial: (serial) => set({ activeDeviceSerial: serial }),
    }),
    {
      name: "pocketcoder-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
