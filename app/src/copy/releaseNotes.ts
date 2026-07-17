/** Mirrors the GitHub release notes (see release pipeline docs) — most
 * recent first. Kept short; the full body lives on the GitHub Release
 * itself (see TRUNK_PRODUCT_URL in links.ts). */
export interface ReleaseNote {
  version: string;
  summary: string;
}

export const RELEASE_NOTES: ReleaseNote[] = [
  { version: "1.3.7f", summary: "Added a \"Back up downloads\" setting (Settings > Downloads) that copies each downloaded model to a folder you pick, so it survives uninstalling the app. Added a copy button under every assistant response in chat." },
  { version: "1.3.7e", summary: "Flowchart diagrams are now centered with proper spacing around every box, and dropped the redundant \"flowchart\" label. The raw-text toggle on math and the copy button on flowcharts now sit at the right edge to match code blocks." },
  { version: "1.3.7d", summary: "Fixed math formulas with symbols like square roots, integrals, fractions, summation, and partial derivatives rendering as plain text instead of proper math notation." },
  { version: "1.3.7c", summary: "Math rendering switched from a WebView (which rendered some formulas as blank boxes on-device) to a direct-to-SVG renderer, with a Show raw/rendered toggle as a fallback. Fixed Mermaid flowcharts not rendering when a node label wrapped across multiple lines. Flowcharts now have a copy button that copies the diagram as an image." },
  { version: "1.3.7a", summary: "LaTeX math rendering in chat (offline KaTeX), Mermaid-style flowchart rendering for fenced mermaid code blocks, and a copy button on every code block. Chat sessions are now auto-titled from their first exchange using the on-device model. Chats can be renamed (edit icon) or deleted (long-press for a Rename/Delete choice)." },
  { version: "1.3.6", summary: "Hugging Face search now recommends models sized for your device by default, with a disclaimer before downloading non-quantized or non-chat models. Crash Reporting (on by default, separate from Usage Logging): auto-sends a report on inference/app failures with a 5s cancel window, queues offline/fatal-crash reports for the next launch. Fixed a stale NPU/GPU label on Inference; the toggle is now hidden (with an info button) on unsupported devices. Onboarding's warning screens now require a 5-second read before continuing." },
  { version: "1.3.5", summary: "Fixed a crash on launch caused by an Expo SDK version mismatch. Removed the backend URL debug display from Developer Options." },
  { version: "1.3.4", summary: "Developer Options is now always visible. Usage logging (opt-in) and Send Logs. Flow fixes: token stats, collapsed steps, session-flow persistence, keep-screen-on." },
  { version: "1.3.3", summary: "Fixed keyboard covering form fields in New Project, New Flow, and Agent Editor modals." },
  { version: "1.3.2", summary: "Flows now have their own generation settings. Running a Flow from inside a Project uses that project's settings. Fixed background low-memory kills." },
  { version: "1.3.1", summary: "Chat sessions stay pinned to the inference unit (NPU/GPU/CPU) they started on. Composer token meter fixes." },
  { version: "1.3.0", summary: "Added Hexagon NPU acceleration support on supported Qualcomm chipsets." },
];
