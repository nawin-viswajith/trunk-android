import * as Network from "expo-network";
import { showAlert } from "../state/useAlertStore";
import { useNetworkPromptStore } from "../state/useNetworkPromptStore";
import { useSettingsStore } from "../state/useSettingsStore";

/** Gate a model download on the current connection + the user's saved
 * preference. Resolves true if the download should proceed. Wi-Fi (and
 * anything that isn't recognizably cellular, e.g. ethernet) always proceeds
 * without asking - only cellular is ever gated. */
export async function canProceedWithDownload(filename: string): Promise<boolean> {
  let state: Network.NetworkState;
  try {
    state = await Network.getNetworkStateAsync();
  } catch {
    return true; // can't determine the connection - don't block the user over it
  }
  if (state.type !== Network.NetworkStateType.CELLULAR) return true;

  const pref = useSettingsStore.getState().mobileDataDownloads;
  if (pref === "allow") return true;
  if (pref === "wifiOnly") {
    showAlert("Wi-Fi required", `${filename} needs Wi-Fi - mobile data downloads are turned off in Settings.`, [
      { label: "OK" },
    ]);
    return false;
  }

  const { allow, remember } = await useNetworkPromptStore.getState().request(filename);
  if (remember) {
    useSettingsStore.getState().setMobileDataDownloads(allow ? "allow" : "wifiOnly");
  }
  return allow;
}
