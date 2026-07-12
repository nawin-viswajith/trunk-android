import DeviceInfo from "react-native-device-info";

export interface StorageInfo {
  totalMb: number;
  freeMb: number;
}

export async function getStorageInfo(): Promise<StorageInfo | null> {
  try {
    const [totalBytes, freeBytes] = await Promise.all([
      DeviceInfo.getTotalDiskCapacity(),
      DeviceInfo.getFreeDiskStorage(),
    ]);
    return { totalMb: totalBytes / (1024 * 1024), freeMb: freeBytes / (1024 * 1024) };
  } catch {
    return null;
  }
}

export interface DeviceDetails {
  manufacturer: string;
  brand: string;
  model: string;
  /** Board/chipset codename as reported by the OS — not always a friendly
   * marketing name (e.g. Samsung/MediaTek boards often just report a
   * platform code, not "Snapdragon 8 Elite" or similar). */
  deviceId: string;
  systemName: string;
  systemVersion: string;
  apiLevel: number;
  supportedAbis: string[];
}

/** What's realistically available to a regular Android app without custom
 * native code: model/chipset identity, OS version, supported CPU ABIs, and
 * RAM/storage totals. CPU/GPU clock speed, core count, GPU/NPU model, and
 * RAM/storage type+speed are NOT exposed by any public Android API to a
 * normal app — there is no cross-device way to read them here. */
export async function getDeviceDetails(): Promise<DeviceDetails | null> {
  try {
    const brand = DeviceInfo.getBrand();
    const model = DeviceInfo.getModel();
    const deviceId = DeviceInfo.getDeviceId();
    const systemName = DeviceInfo.getSystemName();
    const systemVersion = DeviceInfo.getSystemVersion();
    const [manufacturer, apiLevel, supportedAbis] = await Promise.all([
      DeviceInfo.getManufacturer(),
      DeviceInfo.getApiLevel(),
      DeviceInfo.supportedAbis(),
    ]);
    return { manufacturer, brand, model, deviceId, systemName, systemVersion, apiLevel, supportedAbis };
  } catch {
    return null;
  }
}
