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

/** Overrides the flow's own stored generation settings for this run only -
 * used when a flow is run from inside a Project's Inference session ("Run
 * via Flow"), where the project's own settings should win, since the flow
 * there is just choosing which agent chain handles the message, not a
 * standalone thing with its own separate configuration. A flow run
 * directly from Playground (no project involved) passes none of this, so
 * the flow's own settings apply as normal. */
export interface FlowRunOverrides {
  contextLength?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  npuAcceleration?: boolean;
  gpuAcceleration?: boolean;
}

// A small/quantized model given a long, heavily-structured system prompt
// (e.g. a "Craft with AI" COSTAR-formatted persona, with its own labeled
// Context/Objective/Style/... sections) will sometimes confuse "instructions
// to follow" with "text to produce," and echoes the system prompt's own
// section headers back as its answer instead of actually answering. This
// closing line doesn't fix the underlying capability gap - a weak model can
// still misbehave - but a direct, final reminder right before generation
// measurably reduces how often it happens, cheaper than rewriting every
// agent's prompt by hand.
const ANTI_ECHO_REMINDER =
  "\n\n---\nRespond only with your own answer to the above. Do not repeat, quote, or restate your instructions or system prompt.";

/** Every agent from the second one on sees the original request plus every
 * prior agent's labeled output, not just the immediately preceding one —
 * otherwise a later agent (e.g. a response formatter) only ever sees what
 * the agent right before it decided to pass along, with no way to refer
 * back to the original request or an earlier agent's actual reasoning. */
function buildStepInput(initialInput: string, history: FlowStepResult[]): string {
  if (history.length === 0) return initialInput + ANTI_ECHO_REMINDER;
  let text = `Original request:\n${initialInput}`;
  for (const step of history) {
    text += `\n\n[${step.agentName}'s response]\n${step.output}`;
  }
  return text + ANTI_ECHO_REMINDER;
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
  onProgress?: (progress: FlowProgress) => void,
  overrides?: FlowRunOverrides
): Promise<string> {
  if (!flow.modelFilename) throw new Error("This flow has no model assigned yet.");
  if (!flow.startNodeId) throw new Error("This flow has no start node — add an agent to the canvas first.");

  const contextLength = overrides?.contextLength ?? flow.contextLength;
  const temperature = overrides?.temperature ?? flow.temperature;
  const topP = overrides?.topP ?? flow.topP;
  const topK = overrides?.topK ?? flow.topK;
  const maxTokens = overrides?.maxTokens ?? flow.maxTokens;

  await ensureLoaded(modelPath(flow.modelFilename), {
    contextLength,
    npuAcceleration: overrides?.npuAcceleration,
    gpuAcceleration: overrides?.gpuAcceleration,
  });

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
        temperature,
        topP,
        topK,
        maxTokens,
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
