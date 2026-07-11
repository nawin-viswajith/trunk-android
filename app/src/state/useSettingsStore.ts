import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface SettingsState {
  backendUrl: string;
  activeDeviceSerial: string | null;
  themeMode: ThemeMode;
  setBackendUrl: (url: string) => void;
  setActiveDeviceSerial: (serial: string | null) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      backendUrl: "http://localhost:8000",
      activeDeviceSerial: null,
      themeMode: "dark", // PocketCoder is dark-by-default; light/system are opt-in
      setBackendUrl: (url) => set({ backendUrl: url }),
      setActiveDeviceSerial: (serial) => set({ activeDeviceSerial: serial }),
      setThemeMode: (mode) => set({ themeMode: mode }),
    }),
    {
      name: "pocketcoder-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
