import { api } from "./client";

export const diagnosticsApi = {
  run: (serial?: string | null) =>
    api.post<{ job_id: string }>(`/api/diagnostics/run${serial ? `?serial=${serial}` : ""}`),
};
