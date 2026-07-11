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

  return {
    text: result.text,
    tokens: result.timings?.predicted_n ?? 0,
    tokensPerSecond: result.timings?.predicted_per_second ?? 0,
  };
}
