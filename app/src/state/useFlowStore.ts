import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
}

export interface FlowNode {
  id: string;
  agentId: string;
  x: number;
  y: number;
  /** This node's output feeds nextNodeId's input. null = end of chain. */
  nextNodeId: string | null;
}

export interface Flow {
  id: string;
  name: string;
  nodes: FlowNode[];
  /** Explicit, not derived from the graph - keeps execution unambiguous
   * even with stray/disconnected nodes left on the canvas. */
  startNodeId: string | null;
  modelFilename: string | null;
  temperature: number;
  topP: number;
  topK: number;
  contextLength: number;
  maxTokens: number;
  createdAt: number;
  updatedAt: number;
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface FlowState {
  agents: Agent[];
  flows: Flow[];
  createAgent: (name: string, systemPrompt: string) => Agent;
  updateAgent: (id: string, patch: Partial<Omit<Agent, "id" | "createdAt">>) => void;
  deleteAgent: (id: string) => void;
  createFlow: (name: string) => Flow;
  updateFlow: (id: string, patch: Partial<Omit<Flow, "id" | "nodes" | "createdAt">>) => void;
  deleteFlow: (id: string) => void;
  addNode: (flowId: string, agentId: string, x: number, y: number) => FlowNode;
  moveNode: (flowId: string, nodeId: string, x: number, y: number) => void;
  removeNode: (flowId: string, nodeId: string) => void;
  setStartNode: (flowId: string, nodeId: string | null) => void;
  /** Enforces the linear-chain invariant: at most one outgoing edge per
   * node (source's previous nextNodeId is simply overwritten) and at most
   * one incoming edge per node (any other node pointing at target is
   * cleared first). Rejects self-connections and connections that would
   * create a cycle. */
  connectNodes: (flowId: string, sourceId: string, targetId: string) => void;
  disconnectNode: (flowId: string, nodeId: string) => void;
  /** Removes exactly one directed edge (tapping a connection line on the
   * canvas) - clears sourceId's own outgoing edge, nothing else. */
  removeConnection: (flowId: string, sourceId: string) => void;
}

export const useFlowStore = create<FlowState>()(
  persist(
    (set, get) => ({
      agents: [],
      flows: [],

      createAgent: (name, systemPrompt) => {
        const now = Date.now();
        const agent: Agent = { id: randomId(), name, systemPrompt, createdAt: now, updatedAt: now };
        set((state) => ({ agents: [...state.agents, agent] }));
        return agent;
      },

      updateAgent: (id, patch) => {
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a)),
        }));
      },

      deleteAgent: (id) => {
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          // Cascade: strip any node using this agent from every flow, and
          // repair the chain pointers/start node that ran through it.
          flows: state.flows.map((flow) => {
            const removedIds = new Set(flow.nodes.filter((n) => n.agentId === id).map((n) => n.id));
            if (removedIds.size === 0) return flow;
            const nodes = flow.nodes
              .filter((n) => !removedIds.has(n.id))
              .map((n) => (n.nextNodeId && removedIds.has(n.nextNodeId) ? { ...n, nextNodeId: null } : n));
            const startNodeId = flow.startNodeId && removedIds.has(flow.startNodeId) ? null : flow.startNodeId;
            return { ...flow, nodes, startNodeId, updatedAt: Date.now() };
          }),
        }));
      },

      createFlow: (name) => {
        const now = Date.now();
        const flow: Flow = {
          id: randomId(),
          name,
          nodes: [],
          startNodeId: null,
          modelFilename: null,
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          contextLength: 2048,
          maxTokens: 512,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ flows: [...state.flows, flow] }));
        return flow;
      },

      updateFlow: (id, patch) => {
        set((state) => ({
          flows: state.flows.map((f) => (f.id === id ? { ...f, ...patch, updatedAt: Date.now() } : f)),
        }));
      },

      deleteFlow: (id) => {
        set((state) => ({ flows: state.flows.filter((f) => f.id !== id) }));
      },

      addNode: (flowId, agentId, x, y) => {
        const node: FlowNode = { id: randomId(), agentId, x, y, nextNodeId: null };
        set((state) => ({
          flows: state.flows.map((f) =>
            f.id === flowId
              ? {
                  ...f,
                  nodes: [...f.nodes, node],
                  startNodeId: f.startNodeId ?? node.id,
                  updatedAt: Date.now(),
                }
              : f
          ),
        }));
        return node;
      },

      moveNode: (flowId, nodeId, x, y) => {
        set((state) => ({
          flows: state.flows.map((f) =>
            f.id === flowId
              ? { ...f, nodes: f.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)), updatedAt: Date.now() }
              : f
          ),
        }));
      },

      removeNode: (flowId, nodeId) => {
        set((state) => ({
          flows: state.flows.map((f) => {
            if (f.id !== flowId) return f;
            const nodes = f.nodes
              .filter((n) => n.id !== nodeId)
              .map((n) => (n.nextNodeId === nodeId ? { ...n, nextNodeId: null } : n));
            const startNodeId = f.startNodeId === nodeId ? null : f.startNodeId;
            return { ...f, nodes, startNodeId, updatedAt: Date.now() };
          }),
        }));
      },

      setStartNode: (flowId, nodeId) => {
        set((state) => ({
          flows: state.flows.map((f) => {
            if (f.id !== flowId) return f;
            // Maintains the same invariant connectNodes enforces going
            // forward ("start never has an incoming edge") — otherwise
            // promoting a node to start leaves a dangling edge feeding into
            // it from whatever used to point there, silently orphaning
            // everything upstream of that edge with no warning.
            const nodes = nodeId ? f.nodes.map((n) => (n.nextNodeId === nodeId ? { ...n, nextNodeId: null } : n)) : f.nodes;
            return { ...f, nodes, startNodeId: nodeId, updatedAt: Date.now() };
          }),
        }));
      },

      connectNodes: (flowId, sourceId, targetId) => {
        if (sourceId === targetId) return;
        const flow = get().flows.find((f) => f.id === flowId);
        if (!flow) return;
        if (targetId === flow.startNodeId) return; // start never has an incoming edge

        // Cycle guard: walking forward from target must never reach source.
        const byId = new Map(flow.nodes.map((n) => [n.id, n]));
        let cursor: string | null = targetId;
        const seen = new Set<string>();
        while (cursor) {
          if (cursor === sourceId) return; // would create a loop
          if (seen.has(cursor)) break;
          seen.add(cursor);
          cursor = byId.get(cursor)?.nextNodeId ?? null;
        }

        set((state) => ({
          flows: state.flows.map((f) => {
            if (f.id !== flowId) return f;
            const nodes = f.nodes.map((n) => {
              if (n.id === sourceId) return { ...n, nextNodeId: targetId };
              // target can have at most one incoming edge
              if (n.nextNodeId === targetId && n.id !== sourceId) return { ...n, nextNodeId: null };
              return n;
            });
            return { ...f, nodes, updatedAt: Date.now() };
          }),
        }));
      },

      // Clears both directions - this node's own outgoing edge AND any
      // other node's edge pointing into it - so it doesn't matter which
      // side of a connection the user long-presses to remove it.
      disconnectNode: (flowId, nodeId) => {
        set((state) => ({
          flows: state.flows.map((f) => {
            if (f.id !== flowId) return f;
            const nodes = f.nodes.map((n) => {
              if (n.id === nodeId) return { ...n, nextNodeId: null };
              if (n.nextNodeId === nodeId) return { ...n, nextNodeId: null };
              return n;
            });
            return { ...f, nodes, updatedAt: Date.now() };
          }),
        }));
      },

      removeConnection: (flowId, sourceId) => {
        set((state) => ({
          flows: state.flows.map((f) =>
            f.id === flowId
              ? { ...f, nodes: f.nodes.map((n) => (n.id === sourceId ? { ...n, nextNodeId: null } : n)), updatedAt: Date.now() }
              : f
          ),
        }));
      },
    }),
    {
      name: "pocketcoder-flows",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export function selectAgent(agents: Agent[], id: string): Agent | undefined {
  return agents.find((a) => a.id === id);
}

export function selectFlow(flows: Flow[], id: string): Flow | undefined {
  return flows.find((f) => f.id === id);
}
