import { api } from "./client";
import { ModelInfo } from "./types";

export const modelsApi = {
  list: (serial?: string | null) => api.get<ModelInfo[]>(`/api/models${serial ? `?serial=${serial}` : ""}`),
  push: (filename: string, deviceSerial?: string | null) =>
    api.post<{ status: string }>("/api/models/push", { filename, device_serial: deviceSerial }),
  delete: (filename: string, deleteOnDevice: boolean, serial?: string | null) =>
    api.delete<{ status: string }>(
      `/api/models/${encodeURIComponent(filename)}?delete_on_device=${deleteOnDevice}${
        serial ? `&serial=${serial}` : ""
      }`
    ),
};
