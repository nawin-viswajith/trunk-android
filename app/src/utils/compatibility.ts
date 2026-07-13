import DeviceInfo from "react-native-device-info";

/**
 * Estimates whether a GGUF model will fit in this phone's RAM. A heuristic,
 * not an exact model - llama.cpp's actual runtime memory use depends on
 * architecture details we don't have without downloading the file. Mirrors
 * the thresholds used by the (now-removed) backend compatibility_service.py.
 */

export type CompatibilityCategory = "supported" | "can_bottleneck" | "not_supported" | "unknown";

export interface CompatibilityInfo {
  category: CompatibilityCategory;
  requiredMb: number;
  availableMb: number | null;
  totalMb: number | null;
  message: string;
}

const OVERHEAD_FACTOR = 1.2;
const FIXED_OVERHEAD_MB = 512;
const SUPPORTED_THRESHOLD = 0.6;

export function estimateRequiredMb(fileSizeBytes: number): number {
  const fileSizeMb = fileSizeBytes / (1024 * 1024);
  return fileSizeMb * OVERHEAD_FACTOR + FIXED_OVERHEAD_MB;
}

function categorize(requiredMb: number, availableMb: number): Exclude<CompatibilityCategory, "unknown"> {
  if (requiredMb <= availableMb * SUPPORTED_THRESHOLD) return "supported";
  if (requiredMb <= availableMb) return "can_bottleneck";
  return "not_supported";
}

let cachedDeviceMemory: { totalMb: number; availableMb: number } | null = null;

async function getDeviceMemory(): Promise<{ totalMb: number; availableMb: number } | null> {
  if (cachedDeviceMemory) return cachedDeviceMemory;
  try {
    const [totalBytes, usedBytes] = await Promise.all([DeviceInfo.getTotalMemory(), DeviceInfo.getUsedMemory()]);
    const totalMb = totalBytes / (1024 * 1024);
    const availableMb = Math.max(0, (totalBytes - usedBytes) / (1024 * 1024));
    cachedDeviceMemory = { totalMb, availableMb };
    return cachedDeviceMemory;
  } catch {
    return null;
  }
}

// Empirical, not a physical law: derived from a real Qwen2.5-Coder-7B Q4_0
// GGUF (4,431,390,720 bytes / 7B params ~= 604 MB per billion params at Q4).
// Q2/Q8 are scaled from that same anchor by typical relative bits-per-weight
// (roughly 2.6/4.5 and 8.5/4.5 of Q4's footprint). Other quantizations/
// architectures will vary - this is only for the proactive "suggested model
// size" indicator, not the per-file compatibility check above (which always
// uses the file's real size once known).
const MB_PER_BILLION_PARAMS_Q4 = 604;
export const QUANT_MB_PER_BILLION_PARAMS: { quant: string; mbPerBillion: number }[] = [
  { quant: "Q2", mbPerBillion: Math.round(MB_PER_BILLION_PARAMS_Q4 * (2.6 / 4.5)) },
  { quant: "Q4", mbPerBillion: MB_PER_BILLION_PARAMS_Q4 },
  { quant: "Q8", mbPerBillion: Math.round(MB_PER_BILLION_PARAMS_Q4 * (8.5 / 4.5)) },
];

export interface SuggestedModelBudget {
  maxFileSizeMb: number;
  maxParamsBillion: number;
  totalMb: number;
  availableMb: number;
  /** Same maxFileSizeMb budget, converted to a param count per quant level -
   * a lower-bit quant fits more parameters in the same RAM footprint. */
  perQuant: { quant: string; maxParamsBillion: number }[];
}

export async function getDeviceMemoryInfo(): Promise<{ totalMb: number; availableMb: number } | null> {
  return getDeviceMemory();
}

/** "Your device can comfortably run up to ~N B models (Q4)" - the inverse of
 * estimateRequiredMb/categorize: the largest file size that would still land
 * in the "supported" tier on this device. */
export async function getSuggestedModelBudget(): Promise<SuggestedModelBudget | null> {
  const memory = await getDeviceMemory();
  if (!memory) return null;

  const maxFileSizeMb = Math.max(0, (memory.availableMb * SUPPORTED_THRESHOLD - FIXED_OVERHEAD_MB) / OVERHEAD_FACTOR);
  return {
    maxFileSizeMb,
    maxParamsBillion: maxFileSizeMb / MB_PER_BILLION_PARAMS_Q4,
    totalMb: memory.totalMb,
    availableMb: memory.availableMb,
    perQuant: QUANT_MB_PER_BILLION_PARAMS.map(({ quant, mbPerBillion }) => ({
      quant,
      maxParamsBillion: maxFileSizeMb / mbPerBillion,
    })),
  };
}

export async function checkCompatibility(fileSizeBytes: number): Promise<CompatibilityInfo> {
  const requiredMb = estimateRequiredMb(fileSizeBytes);
  const memory = await getDeviceMemory();

  if (!memory) {
    return {
      category: "unknown",
      requiredMb,
      availableMb: null,
      totalMb: null,
      message: "Could not read device memory - proceed with caution.",
    };
  }

  const category = categorize(requiredMb, memory.availableMb);
  const messages: Record<Exclude<CompatibilityCategory, "unknown">, string> = {
    supported: `Estimated ~${requiredMb.toFixed(0)} MB needed, ${memory.availableMb.toFixed(0)} MB RAM available - comfortable fit.`,
    can_bottleneck: `Estimated ~${requiredMb.toFixed(0)} MB needed, ${memory.availableMb.toFixed(0)} MB RAM available - will likely run but expect slowdowns or other apps getting closed.`,
    not_supported: `Estimated ~${requiredMb.toFixed(0)} MB needed, only ${memory.availableMb.toFixed(0)} MB RAM available - likely to crash from out-of-memory.`,
  };

  return {
    category,
    requiredMb,
    availableMb: memory.availableMb,
    totalMb: memory.totalMb,
    message: messages[category],
  };
}
