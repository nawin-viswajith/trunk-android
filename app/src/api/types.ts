export interface Device {
  serial: string;
  state: "device" | "unauthorized" | "offline" | string;
}

export type CheckStatus = "pass" | "fail" | "warn" | "skipped";

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fix_hint: string | null;
  can_auto_fix: boolean;
}

export interface WizardStep {
  id: number;
  title: string;
}

export interface WizardProgress {
  steps: WizardStep[];
  current_step: number;
  statuses: Record<string, CheckStatus>;
  ready: boolean;
}

export interface ModelInfo {
  filename: string;
  size_bytes: number;
  quant: string | null;
  architecture: string | null;
  context_length: number | null;
  installed_on_device: boolean;
}

export interface Project {
  id: string;
  name: string;
  backend: "cpu" | "hexagon";
  model_filename: string | null;
  device_serial: string | null;
  temperature: number;
  top_p: number;
  top_k: number;
  threads: number;
  context_length: number;
  batch_size: number;
  max_tokens: number;
  created_at: number;
  updated_at: number;
}

export interface HistoryEntry {
  id: string;
  project_id: string;
  prompt: string;
  response: string;
  tokens_generated: number;
  tokens_per_sec: number;
  timestamp: number;
}

export interface LogLine {
  channel: string;
  category: "CPU" | "NPU" | "DSP" | "FastRPC" | "OpenCL" | "System";
  level: "INFO" | "WARNING" | "ERROR";
  message: string;
  timestamp: number;
  job_id: string | null;
}

export type InferenceFrame =
  | { type: "token"; text: string }
  | { type: "done"; tokens: number; tok_per_sec: number }
  | { type: "error"; message: string };

export type DiagnosticsFrame = { type: "check"; [key: string]: unknown } | { type: "done" };

export type CompatibilityCategory = "supported" | "can_bottleneck" | "not_supported" | "unknown";

export interface CompatibilityInfo {
  category: CompatibilityCategory;
  required_mb: number;
  available_mb: number | null;
  total_mb: number | null;
  message: string;
}

export interface HfModelSummary {
  repo_id: string;
  downloads: number;
  likes: number;
}

export interface HfGgufFile {
  filename: string;
  size_bytes: number;
  quant: string | null;
  compatibility: CompatibilityInfo;
}

export type HfDownloadFrame =
  | { type: "progress"; downloaded_bytes: number; total_bytes: number }
  | { type: "done"; downloaded_bytes: number; total_bytes: number }
  | { type: "cancelled" }
  | { type: "error"; message: string };
