import { initLlama, LlamaContext } from "llama.rn";
import { useSettingsStore } from "../state/useSettingsStore";

export interface EngineParams {
  contextLength: number;
  threads?: number;
  nGpuLayers?: number;
}

/** Lite Mode's fixed low thread count — deliberately not scaled to the
 * device's core count, since the point is a predictable low-CPU floor rather
 * than "half of whatever this phone has." */
const LITE_MODE_THREADS = 2;

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
    // Thread count and context length are both fixed at load time by
    // initLlama — toggling Lite Mode, or changing a project/flow's context
    // length, while this exact model is already loaded must force a reload,
    // or the change would silently never take effect until a different
    // model was picked.
    if (
      activeModelPath === modelPath &&
      activeContext &&
      activeThreads === effectiveThreads &&
      activeContextLength === params.contextLength
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
      n_gpu_layers: params.nGpuLayers ?? 0,
    });
    activeModelPath = modelPath;
    activeThreads = effectiveThreads;
    activeContextLength = params.contextLength;
  });
}

export async function releaseEngine(): Promise<void> {
  return withLock(async () => {
    if (activeContext) {
      await activeContext.release();
      activeContext = null;
      activeModelPath = null;
      activeContextLength = undefined;
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
