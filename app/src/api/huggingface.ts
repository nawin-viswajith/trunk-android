import { api } from "./client";
import { HfModelSummary } from "./types";

export interface HfFileSummary {
  filename: string;
  size_bytes: number;
  quant: string | null;
}

export const huggingfaceApi = {
  search: (query: string) => api.get<HfModelSummary[]>(`/api/huggingface/search?q=${encodeURIComponent(query)}`),
  // repoId (e.g. "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF") must keep its literal
  // "/" -- the backend route uses FastAPI's `{repo_id:path}` converter, which
  // expects real path segments, not a %2F-encoded single segment.
  listFiles: (repoId: string) => api.get<HfFileSummary[]>(`/api/huggingface/models/${repoId}/files`),
  downloadUrl: (repoId: string, filename: string) => `https://huggingface.co/${repoId}/resolve/main/${filename}`,
};
