import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Project {
  id: string;
  name: string;
  modelFilename: string | null;
  temperature: number;
  topP: number;
  topK: number;
  contextLength: number;
  maxTokens: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSession {
  id: string;
  projectId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Set once, on this session's first message - whichever NPU/GPU
   * acceleration toggles were live at that moment. Every later message in
   * this session keeps using them regardless of later Settings changes, so
   * a chat that started on NPU stays on NPU even after NPU is turned off;
   * only a new session picks up the current toggle state. Undefined until
   * the first message (see ensureDefaultSession/pinSessionUnit). */
  pinnedNpuAcceleration?: boolean;
  pinnedGpuAcceleration?: boolean;
}

export interface HistoryEntry {
  id: string;
  projectId: string;
  /** Absent on entries saved before multi-session chat existed; treat as
   * "not yet migrated" — ensureDefaultSession() backfills these once. */
  sessionId?: string;
  prompt: string;
  response: string;
  tokensGenerated: number;
  tokensPerSecond: number;
  promptTokens: number;
  promptTokensPerSecond: number;
  totalMs: number;
  timestamp: number;
  /** Set when this reply came from running a Playground Flow rather than
   * talking to the project's model directly — token stats are zeroed for
   * these (runFlow doesn't expose aggregate stats), so callers computing
   * speed/token analytics should exclude them. */
  viaFlowId?: string;
}

export interface NewHistoryEntry {
  projectId: string;
  sessionId: string;
  prompt: string;
  response: string;
  tokensGenerated: number;
  tokensPerSecond: number;
  promptTokens: number;
  promptTokensPerSecond: number;
  totalMs: number;
  viaFlowId?: string;
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// The whole store persists as one JSON blob under a single AsyncStorage key
// (see the `persist` config below). Android's AsyncStorage is backed by
// SQLite, whose CursorWindow has a practical ~2MB per-row ceiling — an
// unbounded history array risks pushing that one row past it on long-running
// use, which would fail writes (or the next launch's rehydration read) and
// take projects/sessions down with it since they share the same key. Oldest
// entries are dropped first; they're display/analytics history, not
// something functionality depends on.
const MAX_HISTORY_ENTRIES = 500;

interface ProjectState {
  projects: Project[];
  sessions: ChatSession[];
  history: HistoryEntry[];
  createProject: (name: string, modelFilename?: string | null) => Project;
  updateProject: (id: string, patch: Partial<Omit<Project, "id" | "createdAt">>) => void;
  deleteProject: (id: string) => void;
  createSession: (projectId: string, name?: string) => ChatSession;
  deleteSession: (sessionId: string) => void;
  /** Records this session's NPU/GPU acceleration pin, but only the first
   * time - a no-op on every later call, since the whole point is that it
   * never changes again after the session's first message. */
  pinSessionUnit: (sessionId: string, npuAcceleration: boolean, gpuAcceleration: boolean) => void;
  /** Returns the most recently used session for a project, creating one
   * (and migrating any pre-multi-session history into it) if none exist. */
  ensureDefaultSession: (projectId: string) => ChatSession;
  addHistoryEntry: (entry: NewHistoryEntry) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      sessions: [],
      history: [],

      createProject: (name, modelFilename = null) => {
        const now = Date.now();
        const project: Project = {
          id: randomId(),
          name,
          modelFilename,
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          contextLength: 2048,
          maxTokens: 512,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ projects: [...state.projects, project] }));
        return project;
      },

      updateProject: (id, patch) => {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
        }));
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          sessions: state.sessions.filter((s) => s.projectId !== id),
          history: state.history.filter((h) => h.projectId !== id),
        }));
      },

      createSession: (projectId, name) => {
        const now = Date.now();
        const count = get().sessions.filter((s) => s.projectId === projectId).length;
        const session: ChatSession = {
          id: randomId(),
          projectId,
          name: name ?? `Chat ${count + 1}`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ sessions: [...state.sessions, session] }));
        return session;
      },

      deleteSession: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          history: state.history.filter((h) => h.sessionId !== sessionId),
        }));
      },

      pinSessionUnit: (sessionId, npuAcceleration, gpuAcceleration) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId && s.pinnedNpuAcceleration === undefined
              ? { ...s, pinnedNpuAcceleration: npuAcceleration, pinnedGpuAcceleration: gpuAcceleration }
              : s
          ),
        }));
      },

      ensureDefaultSession: (projectId) => {
        const existing = get()
          .sessions.filter((s) => s.projectId === projectId)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        if (existing.length > 0) return existing[0];

        const now = Date.now();
        const session: ChatSession = { id: randomId(), projectId, name: "Chat 1", createdAt: now, updatedAt: now };
        set((state) => ({
          sessions: [...state.sessions, session],
          history: state.history.map((h) => (h.projectId === projectId && !h.sessionId ? { ...h, sessionId: session.id } : h)),
        }));
        return session;
      },

      addHistoryEntry: (entry) => {
        const stored: HistoryEntry = { id: randomId(), timestamp: Date.now(), ...entry };
        set((state) => ({
          history: [stored, ...state.history].slice(0, MAX_HISTORY_ENTRIES),
          sessions: state.sessions.map((s) => (s.id === entry.sessionId ? { ...s, updatedAt: stored.timestamp } : s)),
        }));
      },
    }),
    {
      name: "pocketcoder-projects",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export function selectProject(projects: Project[], id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export function selectHistoryForProject(history: HistoryEntry[], projectId: string): HistoryEntry[] {
  return history.filter((h) => h.projectId === projectId);
}

export function selectSessionsForProject(sessions: ChatSession[], projectId: string): ChatSession[] {
  return sessions.filter((s) => s.projectId === projectId).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function selectHistoryForSession(history: HistoryEntry[], sessionId: string): HistoryEntry[] {
  return history.filter((h) => h.sessionId === sessionId);
}
