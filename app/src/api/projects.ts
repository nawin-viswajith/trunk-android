import { api } from "./client";
import { HistoryEntry, Project } from "./types";

export const projectsApi = {
  list: () => api.get<Project[]>("/api/projects"),
  get: (id: string) => api.get<Project>(`/api/projects/${id}`),
  create: (data: { name: string; backend?: string; model_filename?: string | null }) =>
    api.post<Project>("/api/projects", data),
  update: (id: string, data: Partial<Project>) => api.patch<Project>(`/api/projects/${id}`, data),
  remove: (id: string) => api.delete<{ status: string }>(`/api/projects/${id}`),
  history: (id: string) => api.get<HistoryEntry[]>(`/api/projects/${id}/history`),
};
