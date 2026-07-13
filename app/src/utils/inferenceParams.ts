export interface ParsedInferenceParams {
  temperature: number;
  topP: number;
  topK: number;
  contextLength: number;
  maxTokens: number;
}

export interface RawInferenceParams {
  temperature: string;
  topP: string;
  topK: string;
  contextLength: string;
  maxTokens: string;
}

// Shared by CreateProjectModal and ProjectDetailScreen — both previously only
// checked for NaN, so e.g. a negative context length or a max tokens of 0
// passed straight through to initLlama/completion() unclamped, which can
// hang or crash the native call.
// Upper bounds beyond RANGES' original "just check it's a positive whole
// number" — a context length of e.g. 1,000,000 passed that check fine but
// asks initLlama to allocate a KV cache no phone has the RAM for, hanging or
// crashing the native call instead of failing with a clear message here.
// 131072 (128K) is already far beyond what any current mobile GGUF setup
// can realistically use — generous enough not to block real experimentation,
// tight enough to catch a typo'd extra digit or two.
const RANGES: Record<keyof ParsedInferenceParams, [number, number]> = {
  temperature: [0, 2],
  topP: [0, 1],
  topK: [1, 1000],
  contextLength: [1, 131072],
  maxTokens: [1, 32768],
};

export const INFERENCE_PARAM_HINT =
  "Temperature must be 0-2, Top P 0-1, Top K 1-1000, Context length 1-131072, and Max tokens 1-32768.";

/** Returns null if any field is missing, non-numeric, or outside its valid
 * range — callers should treat that as "reject", not "fall back to a
 * default", so a legitimately-entered value is never silently discarded. */
export function parseInferenceParams(raw: RawInferenceParams): ParsedInferenceParams | null {
  const values: ParsedInferenceParams = {
    temperature: parseFloat(raw.temperature),
    topP: parseFloat(raw.topP),
    topK: parseInt(raw.topK, 10),
    contextLength: parseInt(raw.contextLength, 10),
    maxTokens: parseInt(raw.maxTokens, 10),
  };

  for (const key of Object.keys(RANGES) as (keyof ParsedInferenceParams)[]) {
    const [min, max] = RANGES[key];
    const value = values[key];
    if (!Number.isFinite(value) || value < min || value > max) return null;
  }

  return values;
}
