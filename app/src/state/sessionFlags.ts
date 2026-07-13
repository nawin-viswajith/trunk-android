import { useSettingsStore } from "./useSettingsStore";

// Deliberately NOT part of the persisted zustand store: these capture
// whatever Secret Themes/Developer Options were unlocked-to at boot, once,
// and never change again for the rest of this process's lifetime - even if
// the user flips the toggle off mid-session. Turning a toggle off should
// still take effect (it updates the real persisted flag, so it's gone for
// the NEXT launch), but the section shouldn't vanish out from under the
// user while they're still looking at the very screen they turned it off
// from - same "changes apply next restart" convention as Android's own
// developer options toggle.
let developerModeUnlockedAtBoot = false;
let secretThemesUnlockedAtBoot = false;
let captured = false;

export function captureSessionVisibilityFlags(): void {
  if (captured) return;
  captured = true;
  const state = useSettingsStore.getState();
  developerModeUnlockedAtBoot = state.developerModeUnlocked;
  secretThemesUnlockedAtBoot = state.secretThemesUnlocked;
}

/** Combine with the live flag at each call site (`unlocked || wasUnlockedAtBoot()`)
 * - the live flag alone handles "just unlocked this session" (shows
 * immediately, no restart needed to appear), this alone handles "was on at
 * boot, toggled off just now" (stays visible until restart). */
export function wasDeveloperModeUnlockedAtBoot(): boolean {
  return developerModeUnlockedAtBoot;
}

export function wasSecretThemesUnlockedAtBoot(): boolean {
  return secretThemesUnlockedAtBoot;
}
