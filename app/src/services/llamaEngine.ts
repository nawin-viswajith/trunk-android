// Copyright © 2026 TuskerLabs. All rights reserved.
// Unauthorized copying of this file, via any medium, is strictly prohibited.

import { initLlama, LlamaContext } from "llama.rn";

export interface EngineParams {
  contextLength: number;
  threads?: number;
  nGpuLayers?: number;
}

export interface CompletionParams {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  stop?: string[];
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

export async function ensureLoaded(modelPath: string, params: EngineParams): Promise<void> {
  if (activeModelPath === modelPath && activeContext) return;

  if (activeContext) {
    await activeContext.release();
    activeContext = null;
    activeModelPath = null;
  }

  activeContext = await initLlama({
    model: modelPath,
    n_ctx: params.contextLength,
    n_threads: params.threads,
    n_gpu_layers: params.nGpuLayers ?? 0,
  });
  activeModelPath = modelPath;
}

export async function releaseEngine(): Promise<void> {
  if (activeContext) {
    await activeContext.release();
    activeContext = null;
    activeModelPath = null;
  }
}

export function isLoaded(modelPath: string): boolean {
  return activeModelPath === modelPath && !!activeContext;
}

export interface BenchmarkResult {
  loadTimeMs: number;
  tokens: number;
  tokensPerSecond: number;
}

const BENCHMARK_PROMPT = "Write one short sentence about the ocean.";
const BENCHMARK_MAX_TOKENS = 48;

/** A lightweight integrity/perf check: load the model fresh and run one small
 * fixed prompt. Throws if the model fails to load or complete -- that failure
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

export async function complete(params: CompletionParams, onToken: (token: string) => void): Promise<CompletionResult> {
  if (!activeContext) throw new Error("no model loaded");

  const result = await activeContext.completion(
    {
      messages: params.messages,
      temperature: params.temperature,
      top_p: params.topP,
      top_k: params.topK,
      n_predict: params.maxTokens,
      stop: params.stop,
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
}
