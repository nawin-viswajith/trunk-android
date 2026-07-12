import { Agent, Flow } from "../state/useFlowStore";
import { complete, CompletionResult, ensureLoaded } from "./llamaEngine";
import { modelPath } from "./modelStorage";

export interface FlowStepResult {
  nodeId: string;
  agentId: string;
  agentName: string;
  input: string;
  output: string;
  stats: CompletionResult;
}

export interface FlowProgress {
  nodeId: string;
  agentId: string;
  agentName: string;
  partialText: string;
}

/** Every agent from the second one on sees the original request plus every
 * prior agent's labeled output, not just the immediately preceding one —
 * otherwise a later agent (e.g. a response formatter) only ever sees what
 * the agent right before it decided to pass along, with no way to refer
 * back to the original request or an earlier agent's actual reasoning. */
function buildStepInput(initialInput: string, history: FlowStepResult[]): string {
  if (history.length === 0) return initialInput;
  let text = `Original request:\n${initialInput}`;
  for (const step of history) {
    text += `\n\n[${step.agentName}'s response]\n${step.output}`;
  }
  return text;
}

/** Walks a flow's linear chain from its start node, feeding each agent's
 * output into the next agent's input, and returns the final text. All
 * agents share whichever model is currently loaded (ensureLoaded is a
 * cheap no-op if it's already the right one) — a flow is never about
 * switching models mid-chain, only switching persona/system-prompt.
 *
 * `onProgress` fires once with empty text the moment a node starts (so the
 * UI can show "Agent X is working...") and again on every generated token
 * (so it can stream the partial response), matching the live-typing feel
 * regular chat already has instead of a silent wait until the whole step
 * finishes. */
export async function runFlow(
  flow: Flow,
  agents: Agent[],
  initialInput: string,
  onStep: (result: FlowStepResult) => void,
  onProgress?: (progress: FlowProgress) => void
): Promise<string> {
  if (!flow.modelFilename) throw new Error("This flow has no model assigned yet.");
  if (!flow.startNodeId) throw new Error("This flow has no start node — add an agent to the canvas first.");

  await ensureLoaded(modelPath(flow.modelFilename), { contextLength: flow.contextLength });

  const nodesById = new Map(flow.nodes.map((n) => [n.id, n]));
  const agentsById = new Map(agents.map((a) => [a.id, a]));
  const visited = new Set<string>();
  const history: FlowStepResult[] = [];

  let nodeId: string | null = flow.startNodeId;

  while (nodeId) {
    if (visited.has(nodeId)) throw new Error("This flow has a cycle — cannot run it.");
    visited.add(nodeId);

    const node = nodesById.get(nodeId);
    if (!node) break;
    const agent = agentsById.get(node.agentId);
    if (!agent) throw new Error("An agent used by this flow no longer exists.");

    const stepInput = buildStepInput(initialInput, history);
    onProgress?.({ nodeId: node.id, agentId: agent.id, agentName: agent.name, partialText: "" });
    let partialText = "";
    const result = await complete(
      {
        messages: [
          { role: "system", content: agent.systemPrompt },
          { role: "user", content: stepInput },
        ],
        temperature: flow.temperature,
        topP: flow.topP,
        topK: flow.topK,
        maxTokens: flow.maxTokens,
      },
      (token) => {
        partialText += token;
        onProgress?.({ nodeId: node.id, agentId: agent.id, agentName: agent.name, partialText });
      }
    );

    const stepResult: FlowStepResult = {
      nodeId: node.id,
      agentId: agent.id,
      agentName: agent.name,
      input: stepInput,
      output: result.text,
      stats: result,
    };
    history.push(stepResult);
    onStep(stepResult);
    nodeId = node.nextNodeId;
  }

  return history.length > 0 ? history[history.length - 1].output : initialInput;
}
