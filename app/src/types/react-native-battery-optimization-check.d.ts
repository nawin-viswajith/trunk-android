declare module "react-native-battery-optimization-check" {
  /** Resolves true if battery optimization is still enabled (i.e. NOT exempt) for this app. */
  export function BatteryOptEnabled(): Promise<boolean>;
  export function RequestDisableOptimization(): void;
  export function OpenOptimizationSettings(): void;
}
