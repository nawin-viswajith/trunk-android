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

export interface HistoryEntry {
  id: string;
  projectId: string;
  prompt: string;
  response: string;
  tokensGenerated: number;
  tokensPerSecond: number;
  timestamp: number;
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ProjectState {
  projects: Project[];
  history: HistoryEntry[];
  createProject: (name: string, modelFilename?: string | null) => Project;
  updateProject: (id: string, patch: Partial<Omit<Project, "id" | "createdAt">>) => void;
  deleteProject: (id: string) => void;
  addHistoryEntry: (
    projectId: string,
    prompt: string,
    response: string,
    tokensGenerated: number,
    tokensPerSecond: number
  ) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
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
          history: state.history.filter((h) => h.projectId !== id),
        }));
      },

      addHistoryEntry: (projectId, prompt, response, tokensGenerated, tokensPerSecond) => {
        const entry: HistoryEntry = {
          id: randomId(),
          projectId,
          prompt,
          response,
          tokensGenerated,
          tokensPerSecond,
          timestamp: Date.now(),
        };
        set((state) => ({ history: [entry, ...state.history] }));
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
