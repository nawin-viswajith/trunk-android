import { create } from "zustand";
import { downloadModel } from "../services/modelStorage";

export type DownloadStatus = "downloading" | "failed";

export interface DownloadEntry {
  filename: string;
  /** Last-committed 0-1 fraction - see reportDownloadProgress for why this
   * lags the true native progress by up to 5s. */
  progress: number;
  status: DownloadStatus;
  error?: string;
  cancel: () => Promise<void>;
  /** The direct download URL this entry came from — kept around so a failed
   * download can be retried from screens (ModelsScreen, HomeScreen) that
   * only see the shared store, not the original HuggingFaceFilesScreen
   * repo/file context that started it. */
  url: string;
  /** HF's reported file size — used to verify the download wasn't truncated
   * before it's moved into place, and carried here so a retry can redo that
   * check without needing the original repo/file browse context either. */
  sizeBytes: number;
}

interface DownloadStoreState {
  downloads: Record<string, DownloadEntry>;
  beginDownload: (filename: string, url: string, sizeBytes: number, cancel: () => Promise<void>) => void;
  commitProgress: (filename: string, progress: number) => void;
  setFailed: (filename: string, error: string) => void;
  clearDownload: (filename: string) => void;
}

export const useDownloadStore = create<DownloadStoreState>((set) => ({
  downloads: {},
  beginDownload: (filename, url, sizeBytes, cancel) =>
    set((state) => ({
      downloads: {
        ...state.downloads,
        [filename]: { filename, progress: 0, status: "downloading", cancel, url, sizeBytes },
      },
    })),
  commitProgress: (filename, progress) =>
    set((state) => {
      const entry = state.downloads[filename];
      if (!entry) return state;
      return { downloads: { ...state.downloads, [filename]: { ...entry, progress } } };
    }),
  setFailed: (filename, error) =>
    set((state) => {
      const entry = state.downloads[filename];
      if (!entry) return state;
      return { downloads: { ...state.downloads, [filename]: { ...entry, status: "failed", error } } };
    }),
  clearDownload: (filename) =>
    set((state) => {
      const rest = { ...state.downloads };
      delete rest[filename];
      return { downloads: rest };
    }),
}));

const latestRawProgress = new Map<string, number>();
const flushTimers = new Map<string, ReturnType<typeof setInterval>>();

/** Raw native progress ticks land here - a fast download can tick far more
 * often than the UI needs to repaint, so this commits to the store (and
 * thus re-renders every screen watching downloads) at most every 5s. The
 * very first tick commits immediately so the UI doesn't sit blank. */
export function reportDownloadProgress(filename: string, fraction: number): void {
  latestRawProgress.set(filename, fraction);
  if (!flushTimers.has(filename)) {
    useDownloadStore.getState().commitProgress(filename, fraction);
    flushTimers.set(
      filename,
      setInterval(() => {
        const latest = latestRawProgress.get(filename);
        if (latest !== undefined) useDownloadStore.getState().commitProgress(filename, latest);
      }, 5000)
    );
  }
}

/** Forces the latest known raw progress to commit immediately - wired to
 * manual pull-to-refresh so it never feels stuck on a stale percentage. */
export function flushDownloadProgress(filename: string): void {
  const latest = latestRawProgress.get(filename);
  if (latest !== undefined) useDownloadStore.getState().commitProgress(filename, latest);
}

export function stopTrackingDownload(filename: string): void {
  const timer = flushTimers.get(filename);
  if (timer) clearInterval(timer);
  flushTimers.delete(filename);
  latestRawProgress.delete(filename);
}

/** Re-attempts a failed download from whichever screen shows the failed
 * banner (ModelsScreen, HomeScreen) without needing the originating repo
 * browse context — the entry's own stored url is enough. Does not re-record
 * the model's source repo (that already happened, or didn't, on the
 * original attempt); a retry is the same download, not a fresh browse. */
export function retryFailedDownload(filename: string): void {
  const entry = useDownloadStore.getState().downloads[filename];
  if (!entry) return;
  const handle = downloadModel(entry.url, filename, entry.sizeBytes, (fraction) => {
    reportDownloadProgress(filename, fraction);
  });
  useDownloadStore.getState().beginDownload(filename, entry.url, entry.sizeBytes, handle.cancel);
  handle.done
    .then(() => {
      stopTrackingDownload(filename);
      useDownloadStore.getState().clearDownload(filename);
    })
    .catch((err) => {
      stopTrackingDownload(filename);
      useDownloadStore.getState().setFailed(filename, String(err));
    });
}
