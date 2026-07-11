import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface SettingsState {
  backendUrl: string;
  themeMode: ThemeMode;
  setBackendUrl: (url: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      backendUrl: "http://localhost:8000",
      themeMode: "dark", // PocketCoder is dark-by-default; light/system are opt-in
      setBackendUrl: (url) => set({ backendUrl: url }),
      setThemeMode: (mode) => set({ themeMode: mode }),
    }),
    {
      name: "pocketcoder-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
