import { api } from "./client";

export const inferenceApi = {
  start: (projectId: string, prompt: string) =>
    api.post<{ job_id: string }>("/api/inference/start", { project_id: projectId, prompt }),
};
