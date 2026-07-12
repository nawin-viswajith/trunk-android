import { api } from "./client";
import { HfGgufFile, HfModelSummary } from "./types";

export const huggingfaceApi = {
  search: (query: string) => api.get<HfModelSummary[]>(`/api/huggingface/search?q=${encodeURIComponent(query)}`),
  // repoId (e.g. "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF") must keep its literal
  // "/" -- the backend route uses FastAPI's `{repo_id:path}` converter, which
  // expects real path segments, not a %2F-encoded single segment.
  listFiles: (repoId: string, serial?: string | null) =>
    api.get<HfGgufFile[]>(`/api/huggingface/models/${repoId}/files${serial ? `?serial=${serial}` : ""}`),
  download: (repoId: string, filename: string, deviceSerial?: string | null) =>
    api.post<{ job_id: string }>("/api/huggingface/download", { repo_id: repoId, filename, device_serial: deviceSerial }),
  cancel: (jobId: string) => api.post<{ status: string }>(`/api/huggingface/download/${jobId}/cancel`),
};
