import { Platform } from "react-native";
import { initLlama, LlamaContext, getBackendDevicesInfo } from "llama.rn";
import { useSettingsStore } from "../state/useSettingsStore";

export interface EngineParams {
  contextLength: number;
  threads?: number;
  nGpuLayers?: number;
  /** Overrides the live Settings toggle for this load - used to keep an
   * already-started chat session pinned to whichever unit it began on, even
   * after the Settings toggle changes. Omit to just read the current
   * Settings value (the right choice for a session's first-ever message,
   * a Flow run, or anything else that isn't session-pinned). */
  npuAcceleration?: boolean;
  gpuAcceleration?: boolean;
}

/** Lite Mode's fixed low thread count — deliberately not scaled to the
 * device's core count, since the point is a predictable low-CPU floor rather
 * than "half of whatever this phone has." */
const LITE_MODE_THREADS = 2;

// llama.cpp's own convention for "offload every layer" — used only once NPU
// or GPU acceleration is actually enabled and detected; otherwise nGpuLayers
// stays at its existing default of 0 (CPU-only), unchanged from before either
// offload path existed.
const NPU_ALL_LAYERS = 99;
const GPU_ALL_LAYERS = 99;

let cachedNpuDevices: string[] | null = null;
let cachedGpuDevices: string[] | null = null;

/** Queries llama.rn's backend device list once per process (the set of
 * available devices doesn't change while the app is running) and returns
 * just the Hexagon HTP device names, if any — see llama.rn's Hexagon/HTP
 * section: Qualcomm SM8450+ (Snapdragon 8 Gen 1+) devices only, experimental. */
export async function detectNpuDevices(): Promise<string[]> {
  if (cachedNpuDevices) return cachedNpuDevices;
  if (Platform.OS !== "android") {
    cachedNpuDevices = [];
    return cachedNpuDevices;
  }
  try {
    const devices = await getBackendDevicesInfo();
    cachedNpuDevices = devices.filter((d) => d.deviceName.startsWith("HTP")).map((d) => d.deviceName);
  } catch {
    cachedNpuDevices = [];
  }
  return cachedNpuDevices;
}

/** Same idea as detectNpuDevices, for the OpenCL GPU backend instead of
 * Hexagon — llama.rn's OpenCL support is scoped to Qualcomm Adreno 700+
 * GPUs (see its README), and the native device list reports the real
 * driver-reported GPU name (e.g. "QUALCOMM Adreno(TM) 730"), not a fixed
 * string the way HTP devices are, so this matches on "adreno" rather than
 * a prefix. */
export async function detectGpuDevices(): Promise<string[]> {
  if (cachedGpuDevices) return cachedGpuDevices;
  if (Platform.OS !== "android") {
    cachedGpuDevices = [];
    return cachedGpuDevices;
  }
  try {
    const devices = await getBackendDevicesInfo();
    cachedGpuDevices = devices.filter((d) => /adreno/i.test(d.deviceName)).map((d) => d.deviceName);
  } catch {
    cachedGpuDevices = [];
  }
  return cachedGpuDevices;
}

export interface ActiveDeviceInfo {
  /** Whether llama.cpp actually engaged an offload device (HTP/GPU) for the
   * currently-loaded context — can be false even with NPU acceleration
   * turned on, if this device wasn't one of the tested/supported chipsets. */
  gpu: boolean;
  devices: string[];
  /** Set by llama.rn when gpu is false, explaining why offload didn't happen. */
  reasonNoGPU: string;
}

let activeDeviceInfo: ActiveDeviceInfo | null = null;

/** Runtime feedback for whichever context is currently loaded — null if
 * nothing is loaded yet. Distinct from detectNpuDevices(), which only says
 * a device exists, not whether the active context is actually using it. */
export function getActiveDeviceInfo(): ActiveDeviceInfo | null {
  return activeDeviceInfo;
}

/** Short label for whichever unit the currently-loaded context is actually
 * running on — "CPU" if nothing's loaded yet or no offload engaged, else
 * "NPU"/"GPU" derived from llama.rn's reported device list (HTP* means NPU,
 * anything else reported while gpu=true means the OpenCL/Adreno path). */
export function getActiveInferenceUnit(): string {
  const info = activeDeviceInfo;
  if (!info || !info.gpu || info.devices.length === 0) return "CPU";
  return info.devices.some((d) => d.startsWith("HTP")) ? "NPU" : "GPU";
}

export interface CompletionParams {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  stop?: string[];
  /** Not exposed in any parameter UI — a fixed anti-repetition floor so a
   * small/quantized model that starts echoing a phrase has something pushing
   * it off that token path, instead of looping until maxTokens is exhausted. */
  penaltyRepeat?: number;
  penaltyLastN?: number;
}

export interface CompletionResult {
  text: string;
  tokens: number;
  tokensPerSecond: number;
  promptTokens: number;
  promptMs: number;
  promptTokensPerSecond: number;
  completionMs: number;
  totalMs: number;
}

let activeContext: LlamaContext | null = null;
let activeModelPath: string | null = null;
let activeThreads: number | undefined;
let activeContextLength: number | undefined;
let activeNpuRequested: boolean | undefined;
let activeGpuRequested: boolean | undefined;

// The native context is a single shared singleton, but callers (Inference
// chat, Flow runs, Craft-with-AI, benchmarking) live on screens that all
// stay mounted at once (needed for swipe-between-tabs) and can freely
// interleave. Without serializing, one screen's ensureLoaded/releaseEngine
// can release the exact context another screen's complete() is still
// awaiting a native completion on. Every entry point below chains onto this
// one promise so at most one native call is ever in flight at a time.
let lockChain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockChain.then(fn, fn);
  lockChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function ensureLoaded(modelPath: string, params: EngineParams): Promise<void> {
  return withLock(async () => {
    const effectiveThreads = params.threads ?? (useSettingsStore.getState().liteMode ? LITE_MODE_THREADS : undefined);
    const npuRequested = params.npuAcceleration ?? useSettingsStore.getState().npuAcceleration;
    const npuDevices = npuRequested ? await detectNpuDevices() : [];
    const npuActive = npuDevices.length > 0;
    // NPU wins if both happen to be requested at once — combining them
    // (true hybrid offload) is its own future mode, not something this
    // toggle pair falls into by accident.
    const gpuRequested = !npuActive && (params.gpuAcceleration ?? useSettingsStore.getState().gpuAcceleration);
    const gpuDevices = gpuRequested ? await detectGpuDevices() : [];
    const gpuActive = gpuDevices.length > 0;

    // Thread count, context length, and NPU/GPU offload are all fixed at
    // load time by initLlama — toggling Lite Mode, NPU, or GPU acceleration,
    // or changing a project/flow's context length, while this exact model
    // is already loaded must force a reload, or the change would silently
    // never take effect until a different model was picked.
    if (
      activeModelPath === modelPath &&
      activeContext &&
      activeThreads === effectiveThreads &&
      activeContextLength === params.contextLength &&
      activeNpuRequested === npuRequested &&
      activeGpuRequested === gpuRequested
    ) {
      return;
    }

    if (activeContext) {
      await activeContext.release();
      activeContext = null;
      activeModelPath = null;
    }

    activeContext = await initLlama({
      model: modelPath,
      n_ctx: params.contextLength,
      n_threads: effectiveThreads,
      n_gpu_layers: params.nGpuLayers ?? (npuActive ? NPU_ALL_LAYERS : gpuActive ? GPU_ALL_LAYERS : 0),
      // OpenCL (GPU) has no device-selection param — it's used automatically
      // once n_gpu_layers > 0 and no `devices` override is given, unlike
      // HTP which llama.rn requires naming explicitly.
      ...(npuActive ? { devices: ["HTP*"] } : {}),
    });
    activeModelPath = modelPath;
    activeThreads = effectiveThreads;
    activeContextLength = params.contextLength;
    activeNpuRequested = npuRequested;
    activeGpuRequested = gpuRequested;
    activeDeviceInfo = {
      gpu: activeContext.gpu,
      devices: activeContext.devices ?? [],
      reasonNoGPU: activeContext.reasonNoGPU ?? "",
    };
  });
}

export async function releaseEngine(): Promise<void> {
  return withLock(async () => {
    if (activeContext) {
      await activeContext.release();
      activeContext = null;
      activeModelPath = null;
      activeContextLength = undefined;
      activeNpuRequested = undefined;
      activeGpuRequested = undefined;
      activeDeviceInfo = null;
    }
  });
}

export function isLoaded(modelPath: string): boolean {
  return activeModelPath === modelPath && !!activeContext;
}

/** Whichever model is currently loaded, if any — lets screens with no
 * model of their own (e.g. the Agent Library's "craft with AI") check
 * readiness without needing to know a specific path up front. */
export function getActiveModelPath(): string | null {
  return activeContext ? activeModelPath : null;
}

/** The n_ctx the currently-loaded context was actually opened with — lets a
 * screen compute "how full is the context window" without re-threading the
 * project/flow's configured value through separately (and staying correct
 * if ensureLoaded ever changes it, e.g. on a Lite Mode/NPU-triggered reload). */
export function getActiveContextLength(): number | undefined {
  return activeContext ? activeContextLength : undefined;
}

/** Tokenizes arbitrary text with the currently-loaded model's own tokenizer -
 * used to estimate how much of the context window a prompt will consume
 * before actually sending it, rather than only finding out from a completion
 * result (or a native context-overflow error) after the fact. Returns 0 if
 * nothing is loaded yet. */
export async function countTokens(text: string): Promise<number> {
  if (!activeContext || !text) return 0;
  try {
    const result = await activeContext.tokenize(text);
    return result.tokens.length;
  } catch {
    return 0;
  }
}

export interface BenchmarkResult {
  loadTimeMs: number;
  tokens: number;
  tokensPerSecond: number;
}

const BENCHMARK_PROMPT = "Write one short sentence about the ocean.";
const BENCHMARK_MAX_TOKENS = 48;

/** A lightweight integrity/perf check: load the model fresh and run one small
 * fixed prompt. Throws if the model fails to load or complete — that failure
 * itself is the "integrity" signal; a clean run reports load time + tok/s. */
export async function benchmarkModel(modelPath: string, contextLength: number): Promise<BenchmarkResult> {
  await releaseEngine();

  const loadStart = Date.now();
  await ensureLoaded(modelPath, { contextLength });
  const loadTimeMs = Date.now() - loadStart;

  const result = await complete(
    {
      messages: [{ role: "user", content: BENCHMARK_PROMPT }],
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxTokens: BENCHMARK_MAX_TOKENS,
    },
    () => {}
  );

  return { loadTimeMs, tokens: result.tokens, tokensPerSecond: result.tokensPerSecond };
}

// llama.cpp's own convention for a mild-but-present anti-repetition floor —
// applied whenever a caller doesn't explicitly override it, since nothing in
// the app's parameter UI sets these today and leaving them unset disables
// repetition penalty entirely.
const DEFAULT_PENALTY_REPEAT = 1.1;
const DEFAULT_PENALTY_LAST_N = 64;

export async function complete(params: CompletionParams, onToken: (token: string) => void): Promise<CompletionResult> {
  return withLock(async () => {
    if (!activeContext) throw new Error("no model loaded");

    const result = await activeContext.completion(
      {
        messages: params.messages,
        temperature: params.temperature,
        top_p: params.topP,
        top_k: params.topK,
        n_predict: params.maxTokens,
        stop: params.stop,
        penalty_repeat: params.penaltyRepeat ?? DEFAULT_PENALTY_REPEAT,
        penalty_last_n: params.penaltyLastN ?? DEFAULT_PENALTY_LAST_N,
      },
      (data: { token: string }) => onToken(data.token)
    );

    const timings = result.timings;
    return {
      text: result.text,
      tokens: timings?.predicted_n ?? 0,
      tokensPerSecond: timings?.predicted_per_second ?? 0,
      promptTokens: timings?.prompt_n ?? 0,
      promptMs: timings?.prompt_ms ?? 0,
      promptTokensPerSecond: timings?.prompt_per_second ?? 0,
      completionMs: timings?.predicted_ms ?? 0,
      totalMs: (timings?.prompt_ms ?? 0) + (timings?.predicted_ms ?? 0),
    };
  });
}
