import { api } from "./client";
import { WizardProgress } from "./types";

export const deploymentApi = {
  progress: (serial: string) => api.get<WizardProgress>(`/api/deployment/progress?serial=${serial}`),
  runStep: (stepId: number, serial: string) =>
    api.post<{ job_id: string }>(`/api/deployment/run/${stepId}?serial=${serial}`),
};
