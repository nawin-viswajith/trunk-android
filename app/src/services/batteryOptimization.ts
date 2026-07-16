import * as IntentLauncher from "expo-intent-launcher";
import { BatteryOptEnabled } from "react-native-battery-optimization-check";
import { showAlert } from "../state/useAlertStore";

const PACKAGE_NAME = "com.tuskerlabs.trunk";

/** true once Trunk is exempt from battery optimization - the Settings
 * button and the launch-time prompt both key off this so neither shows up
 * once it's already been granted. */
export async function isBatteryOptimizationExempt(): Promise<boolean> {
  try {
    const stillOptimized = await BatteryOptEnabled();
    return !stillOptimized;
  } catch {
    return true; // can't determine (unsupported device/OS) - don't nag over it
  }
}

/** Opens Android's native "allow this app to ignore battery optimizations?"
 * dialog directly, so downloads/inference are less likely to be killed while
 * the app is backgrounded. Requires the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
 * permission (declared in app.json). */
export async function requestBatteryOptimizationExemption(): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, {
      data: `package:${PACKAGE_NAME}`,
    });
  } catch (err) {
    showAlert("Couldn't open battery settings", String(err));
  }
}
