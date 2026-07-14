import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useSettingsStore } from "../state/useSettingsStore";

/** Activates/deactivates screen-sleep prevention for one named reason (a
 * download, a generation) - gated on the Keep Screen On setting so calling
 * this unconditionally from several independent places (downloads,
 * Inference, Run Flow) never fights the user's own preference. Each tag is
 * independent: the screen only sleeps again once every active tag has been
 * deactivated. */
export function setKeepAwake(tag: string, active: boolean): void {
  if (active && !useSettingsStore.getState().keepScreenOnDuringActivity) return;
  if (active) {
    activateKeepAwakeAsync(tag).catch(() => {});
  } else {
    deactivateKeepAwake(tag).catch(() => {});
  }
}
