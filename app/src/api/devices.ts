import { api } from "./client";
import { Device } from "./types";

export const devicesApi = {
  list: () => api.get<Device[]>("/api/devices"),
  select: (serial: string) => api.post<{ active_serial: string }>(`/api/devices/select/${serial}`),
  active: () => api.get<{ active_serial: string | null }>("/api/devices/active"),
};
