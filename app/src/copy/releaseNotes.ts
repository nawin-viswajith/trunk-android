/** Mirrors the GitHub release notes (see release pipeline docs) — most
 * recent first. Kept short; the full body lives on the GitHub Release
 * itself (see TRUNK_PRODUCT_URL in links.ts). */
export interface ReleaseNote {
  version: string;
  summary: string;
}

export const RELEASE_NOTES: ReleaseNote[] = [
  { version: "1.3.7", summary: "Crash Reporting (on by default, separate from Usage Logging): auto-sends a report on inference/app failures with a 5s cancel window, queues offline/fatal-crash reports for the next launch. Fixed NPU showing active when the toggle was off. Cleaned up dash formatting across the app." },
  { version: "1.3.6", summary: "Hugging Face search now recommends models sized for your device by default, with a disclaimer before downloading non-quantized or non-chat models. Fixed a stale NPU/GPU label on the Inference screen; the toggle is now hidden (with an info button) on devices that don't support it. Onboarding's warning screens now require a 5-second read before continuing." },
  { version: "1.3.5", summary: "Fixed a crash on launch caused by an Expo SDK version mismatch. Removed the backend URL debug display from Developer Options." },
  { version: "1.3.4", summary: "Developer Options is now always visible. Usage logging (opt-in) and Send Logs. Flow fixes: token stats, collapsed steps, session-flow persistence, keep-screen-on." },
  { version: "1.3.3", summary: "Fixed keyboard covering form fields in New Project, New Flow, and Agent Editor modals." },
  { version: "1.3.2", summary: "Flows now have their own generation settings. Running a Flow from inside a Project uses that project's settings. Fixed background low-memory kills." },
  { version: "1.3.1", summary: "Chat sessions stay pinned to the inference unit (NPU/GPU/CPU) they started on. Composer token meter fixes." },
  { version: "1.3.0", summary: "Added Hexagon NPU acceleration support on supported Qualcomm chipsets." },
];
