import DeviceInfo from "react-native-device-info";
import * as FileSystem from "expo-file-system/legacy";
import {
  checkCompatibility,
  estimateRequiredMb,
  getDeviceMemoryInfo,
} from "../utils/compatibility";
import { detectNpuDevices, ensureLoaded, countTokens, complete, getActiveContextLength } from "./llamaEngine";
import { listLocalModels, modelPath } from "./modelStorage";
import { useFlowStore } from "../state/useFlowStore";
import { runFlow } from "./flowRunner";
import { formatAttachmentForPrompt } from "./fileAttachment";

export type DiagnosticStatus = "pass" | "fail" | "skip";

export interface DiagnosticResult {
  name: string;
  status: DiagnosticStatus;
  durationMs: number;
  detail: string;
}

function nowMs(): number {
  return Date.now();
}

/** Every check follows the same shape: run fn, time it, and turn a thrown
 * error into a "fail" result instead of aborting the whole suite — one
 * broken check (e.g. no model downloaded yet) shouldn't hide the results
 * of every check after it. */
async function runCheck(name: string, fn: () => Promise<{ status: DiagnosticStatus; detail: string }>): Promise<DiagnosticResult> {
  const start = nowMs();
  try {
    const { status, detail } = await fn();
    return { name, status, durationMs: Math.round(nowMs() - start), detail };
  } catch (err) {
    return {
      name,
      status: "fail",
      durationMs: Math.round(nowMs() - start),
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Runs the full on-device self-check suite and returns every result in
 * order. Designed to be triggered manually from the Diagnostics screen by
 * whoever is testing the device, not run automatically — several checks
 * load a real model and generate real tokens, which is exactly the
 * expensive-but-necessary work a screenshot-driven test can't shortcut. */
export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  results.push(
    await runCheck("Device memory", async () => {
      const memory = await getDeviceMemoryInfo();
      if (!memory) return { status: "fail", detail: "getDeviceMemoryInfo() returned null" };
      const model = DeviceInfo.getModel();
      return {
        status: "pass",
        detail: `${model} · ${memory.totalMb.toFixed(0)} MB total, ${memory.availableMb.toFixed(0)} MB available`,
      };
    })
  );

  results.push(
    await runCheck("NPU device detection", async () => {
      const devices = await detectNpuDevices();
      return {
        status: "pass",
        detail: devices.length > 0 ? `Found: ${devices.join(", ")}` : "No Hexagon HTP device detected on this chipset",
      };
    })
  );

  results.push(
    await runCheck("Compatibility message format", async () => {
      const memory = await getDeviceMemoryInfo();
      if (!memory) return { status: "skip", detail: "no device memory reading available" };

      const mbToFileSizeBytes = (mb: number) => Math.max(0, ((mb - 512) / 1.2) * 1024 * 1024);
      const cases: { label: string; requiredMb: number; expectCategory: string }[] = [
        { label: "supported", requiredMb: memory.availableMb * 0.3, expectCategory: "supported" },
        { label: "can_bottleneck", requiredMb: memory.availableMb * 0.8, expectCategory: "can_bottleneck" },
        { label: "not_supported", requiredMb: memory.availableMb * 1.5, expectCategory: "not_supported" },
      ];

      const lines: string[] = [];
      let allOk = true;
      for (const c of cases) {
        const info = await checkCompatibility(mbToFileSizeBytes(c.requiredMb));
        const formatOk = /^Needs ~.+ · .+ RAM available - /.test(info.message);
        const categoryOk = info.category === c.expectCategory;
        if (!formatOk || !categoryOk) allOk = false;
        lines.push(`[${c.label}] ${categoryOk ? "ok" : `expected ${c.expectCategory} got ${info.category}`} — "${info.message}"`);
      }
      return { status: allOk ? "pass" : "fail", detail: lines.join("\n") };
    })
  );

  const models = await runCheck("Local models list", async () => {
    const list = await listLocalModels();
    return {
      status: "pass",
      detail: list.length > 0 ? list.map((m) => `${m.filename} (${(m.sizeBytes / 1024 / 1024).toFixed(0)} MB)`).join(", ") : "0 models downloaded",
    };
  });
  results.push(models);

  const localModels = await listLocalModels();
  if (localModels.length === 0) {
    results.push({ name: "Model load", status: "skip", durationMs: 0, detail: "no local models downloaded" });
    results.push({ name: "Tokenizer", status: "skip", durationMs: 0, detail: "no model loaded" });
    results.push({ name: "Inference smoke test", status: "skip", durationMs: 0, detail: "no model loaded" });
    results.push({ name: "Context window reload", status: "skip", durationMs: 0, detail: "no model loaded" });
  } else {
    const testModel = localModels[0];

    results.push(
      await runCheck("Model load", async () => {
        await ensureLoaded(modelPath(testModel.filename), { contextLength: 2048 });
        return { status: "pass", detail: `loaded ${testModel.filename} at n_ctx=2048` };
      })
    );

    results.push(
      await runCheck("Tokenizer", async () => {
        const count = await countTokens("The quick brown fox jumps over the lazy dog.");
        return {
          status: count > 0 ? "pass" : "fail",
          detail: `countTokens(9-word sentence) = ${count}`,
        };
      })
    );

    results.push(
      await runCheck("Inference smoke test", async () => {
        const result = await complete(
          {
            messages: [{ role: "user", content: "Reply with exactly one word: OK" }],
            temperature: 0.1,
            topP: 0.9,
            topK: 40,
            maxTokens: 16,
          },
          () => {}
        );
        const ok = result.text.trim().length > 0 && result.tokensPerSecond > 0;
        return {
          status: ok ? "pass" : "fail",
          detail: `"${result.text.trim().slice(0, 60)}" — ${result.tokensPerSecond.toFixed(1)} tok/s, ${result.tokens} tokens, ${result.totalMs.toFixed(0)}ms total`,
        };
      })
    );

    results.push(
      await runCheck("Context window reload", async () => {
        await ensureLoaded(modelPath(testModel.filename), { contextLength: 4096 });
        const active = getActiveContextLength();
        return {
          status: active === 4096 ? "pass" : "fail",
          detail: `requested n_ctx=4096, getActiveContextLength() = ${active}`,
        };
      })
    );
  }

  results.push(
    await runCheck("Attachment prompt formatting", async () => {
      const formatted = formatAttachmentForPrompt({ name: "notes.txt", content: "hello world", truncated: false });
      const ok = formatted === "[Attached file: notes.txt]\nhello world";
      return { status: ok ? "pass" : "fail", detail: formatted };
    })
  );

  const { agents, flows } = useFlowStore.getState();
  results.push({
    name: "Flow/agent library",
    status: "pass",
    durationMs: 0,
    detail: `${agents.length} agent(s), ${flows.length} flow(s)`,
  });

  const runnableFlow = flows.find((f) => f.modelFilename && f.startNodeId);
  if (!runnableFlow) {
    results.push({
      name: "Flow execution",
      status: "skip",
      durationMs: 0,
      detail: flows.length === 0 ? "no flows created" : "no flow has both a model and a start node assigned",
    });
  } else {
    results.push(
      await runCheck("Flow execution", async () => {
        const steps: { agentName: string; outputLen: number; tokensPerSecond: number }[] = [];
        await runFlow(runnableFlow, agents, "Add a function that reverses a string.", (step) => {
          steps.push({ agentName: step.agentName, outputLen: step.output.length, tokensPerSecond: step.stats.tokensPerSecond });
        });
        const expectedNodes = runnableFlow.nodes.length;
        const ok = steps.length > 0 && steps.every((s) => s.outputLen > 0);
        const chainNote =
          steps.length < expectedNodes
            ? ` (WARNING: flow has ${expectedNodes} node(s) on canvas but only ${steps.length} executed — check node connections)`
            : "";
        return {
          status: ok ? "pass" : "fail",
          detail: `${steps.map((s) => `${s.agentName}: ${s.outputLen} chars @ ${s.tokensPerSecond.toFixed(1)} tok/s`).join(" -> ")}${chainNote}`,
        };
      })
    );
  }

  return results;
}

export function formatDiagnosticsLog(results: DiagnosticResult[]): string {
  const lines = [
    `Trunk diagnostics — ${new Date().toISOString()}`,
    `Device: ${DeviceInfo.getModel()} (${DeviceInfo.getSystemName()} ${DeviceInfo.getSystemVersion()})`,
    "",
  ];
  for (const r of results) {
    lines.push(`[${r.status.toUpperCase()}] ${r.name} (${r.durationMs}ms)`);
    lines.push(`  ${r.detail.split("\n").join("\n  ")}`);
  }
  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const skipCount = results.filter((r) => r.status === "skip").length;
  lines.push("", `${passCount} passed, ${failCount} failed, ${skipCount} skipped`);
  return lines.join("\n");
}

const LOG_FILE_PATH = `${FileSystem.documentDirectory}diagnostics-log.txt`;

/** Appends this run's log to a single on-device file (rather than
 * overwriting) so a history of runs survives across app restarts — useful
 * when comparing "did this regress since the last test pass" without the
 * user needing to copy the text out after every single run. */
export async function appendDiagnosticsLog(logText: string): Promise<string> {
  const existing = await FileSystem.getInfoAsync(LOG_FILE_PATH);
  const separator = "\n\n" + "=".repeat(60) + "\n\n";
  const content = existing.exists ? separator + logText : logText;
  if (existing.exists) {
    const prior = await FileSystem.readAsStringAsync(LOG_FILE_PATH);
    await FileSystem.writeAsStringAsync(LOG_FILE_PATH, prior + content);
  } else {
    await FileSystem.writeAsStringAsync(LOG_FILE_PATH, content);
  }
  return LOG_FILE_PATH;
}

export async function clearDiagnosticsLog(): Promise<void> {
  const existing = await FileSystem.getInfoAsync(LOG_FILE_PATH);
  if (existing.exists) await FileSystem.deleteAsync(LOG_FILE_PATH, { idempotent: true });
}

export function getDiagnosticsLogPath(): string {
  return LOG_FILE_PATH;
}
