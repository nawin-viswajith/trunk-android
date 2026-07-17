import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { quantFromFilename } from "../utils/quant";
import { useDownloadStore } from "../state/useDownloadStore";
import { useSettingsStore } from "../state/useSettingsStore";

export interface LocalModel {
  filename: string;
  path: string;
  sizeBytes: number;
  quant: string | null;
  addedAt: number;
}

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

// An "mmproj" file is a multimodal vision projector meant to pair with a
// separate main model - it has no text-generation architecture of its own,
// so initLlama() always fails on it as a standalone model. A user can still
// end up with one downloaded (some HF repos list it alongside the real
// model with a similar name), so it stays visible in the Models tab for
// management/deletion, but every model *picker* (Project, Flow, Agent
// Craft-with-AI) should filter it out rather than let it be picked and
// fail with a confusing "Failed to load model" error.
export function isUsableChatModel(filename: string): boolean {
  return !/mmproj/i.test(filename);
}

export function filterUsableChatModels(models: LocalModel[]): LocalModel[] {
  return models.filter((m) => isUsableChatModel(m.filename));
}

async function ensureModelsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MODELS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
  }
}

export function modelPath(filename: string): string {
  return `${MODELS_DIR}${filename}`;
}

export async function listLocalModels(): Promise<LocalModel[]> {
  await ensureModelsDir();
  const filenames = await FileSystem.readDirectoryAsync(MODELS_DIR);
  // A `.part` file left on disk is normally orphaned - leftover from a
  // process kill mid-download (see downloadModel's comment), since
  // useDownloadStore isn't persisted and can't survive an app restart. But
  // *within* one running session, a download started from one screen keeps
  // writing to its `.part` file while the user is on another screen - e.g.
  // Home, which reloads this list on every focus. Without excluding
  // filenames the store still shows as downloading, that reload would
  // delete the live `.part` file out from under the in-progress download,
  // and its subsequent move-to-final-name would fail with "could not be
  // moved" because the source path just vanished.
  const activeDownloadFilenames = new Set(Object.keys(useDownloadStore.getState().downloads));
  await Promise.all(
    filenames
      .filter((f) => f.endsWith(".gguf.part"))
      .filter((f) => !activeDownloadFilenames.has(f.replace(/\.part$/, "")))
      .map((f) => FileSystem.deleteAsync(`${MODELS_DIR}${f}`, { idempotent: true }))
  );
  const models: LocalModel[] = [];
  for (const filename of filenames) {
    if (!filename.endsWith(".gguf")) continue;
    const info = await FileSystem.getInfoAsync(modelPath(filename));
    models.push({
      filename,
      path: modelPath(filename),
      sizeBytes: info.exists && !info.isDirectory ? info.size : 0,
      quant: quantFromFilename(filename),
      addedAt: info.exists && !info.isDirectory ? info.modificationTime * 1000 : 0,
    });
  }
  return models;
}

export async function isModelDownloaded(filename: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(modelPath(filename));
  return info.exists;
}

export async function deleteLocalModel(filename: string): Promise<void> {
  await FileSystem.deleteAsync(modelPath(filename), { idempotent: true });
  await clearModelSource(filename);
}

/** Lets a downloaded model be copied out to a user-chosen folder (e.g. to
 * back it up, or hand it to another app) - Android's scoped storage means
 * the app's own model directory isn't visible to the user or other apps, so
 * this is the only way out. Uses the native copyAsync between the app's
 * file:// path and the chosen SAF destination rather than reading the whole
 * (often multi-GB) file into a JS string, which would risk an OOM crash on
 * a model of any real size. Returns false if the user cancelled the folder
 * picker, true once the copy actually completes. */
export async function exportModelToDevice(filename: string): Promise<boolean> {
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) return false;
  const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    filename,
    "application/octet-stream"
  );
  await FileSystem.StorageAccessFramework.copyAsync({ from: modelPath(filename), to: destUri });
  return true;
}

/** One-time grant for the "back up downloads" setting - same SAF picker as
 * exportModelToDevice, but the resulting directoryUri is persisted
 * (useSettingsStore) so later downloads can reuse it without prompting
 * again. Returns null if the user cancelled the picker. */
export async function pickBackupFolder(): Promise<string | null> {
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  return permissions.granted ? permissions.directoryUri : null;
}

/** Copies a just-downloaded model into the user-granted backup folder so it
 * survives an app uninstall - Android's scoped storage means llama.rn still
 * has to load models from this app's own storage (a content:// SAF URI
 * isn't a path initLlama can open), so this is a secondary durable copy, not
 * a relocation. Failures are swallowed (logged to console only): a backup
 * copy failing shouldn't surface as a "download failed" error to the user
 * when the actual download to app storage already succeeded. */
async function backupModel(filename: string, directoryUri: string): Promise<void> {
  try {
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      directoryUri,
      filename,
      "application/octet-stream"
    );
    await FileSystem.StorageAccessFramework.copyAsync({ from: modelPath(filename), to: destUri });
  } catch (err) {
    console.warn(`Backup copy failed for ${filename}:`, err);
  }
}

/** Called from every successful-download path (initial download in
 * HuggingFaceFilesScreen, retry in useDownloadStore) instead of duplicating
 * the enabled-check + folder-uri lookup at each call site. No-ops silently
 * if the setting is off or no folder has been granted yet. */
export async function maybeBackupModel(filename: string): Promise<void> {
  const { backupDownloadsEnabled, backupFolderUri } = useSettingsStore.getState();
  if (!backupDownloadsEnabled || !backupFolderUri) return;
  await backupModel(filename, backupFolderUri);
}

const MODEL_SOURCES_KEY = "pocketcoder-model-sources";

async function readModelSources(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(MODEL_SOURCES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Downloaded models are identified on disk purely by filename, but many
 * GGUF repos reuse generic filenames (e.g. "model.Q4_K_M.gguf") across
 * unrelated models - without this, a different repo's file sharing that
 * name would silently show as already-downloaded, or get overwritten by it.
 * This records which repo a given filename actually came from so callers can
 * detect that mismatch. Absent entry (never recorded, e.g. an import-from-
 * device or a model downloaded before this tracking existed) is treated
 * leniently by callers as "unknown provenance", not a conflict. */
export async function recordModelSource(filename: string, repoId: string): Promise<void> {
  const sources = await readModelSources();
  sources[filename] = repoId;
  await AsyncStorage.setItem(MODEL_SOURCES_KEY, JSON.stringify(sources));
}

export async function getModelSource(filename: string): Promise<string | null> {
  const sources = await readModelSources();
  return sources[filename] ?? null;
}

async function clearModelSource(filename: string): Promise<void> {
  const sources = await readModelSources();
  if (!(filename in sources)) return;
  delete sources[filename];
  await AsyncStorage.setItem(MODEL_SOURCES_KEY, JSON.stringify(sources));
}

export interface DownloadHandle {
  /** Resolves once the download completes; rejects on failure or cancellation. */
  done: Promise<void>;
  cancel: () => Promise<void>;
}

export function downloadModel(
  url: string,
  filename: string,
  expectedSizeBytes: number,
  onProgress: (fraction: number) => void
): DownloadHandle {
  const destination = modelPath(filename);
  // Bytes land here, never at `destination` directly, until the download is
  // confirmed complete - a process kill mid-download (OS memory pressure,
  // force-close, crash) then leaves at most a `.part` file, never something
  // indistinguishable from a real, loadable model at the final filename.
  const partialDestination = `${destination}.part`;
  let cancelled = false;

  const resumable = FileSystem.createDownloadResumable(url, partialDestination, {}, (data) => {
    if (data.totalBytesExpectedToWrite > 0) {
      onProgress(data.totalBytesWritten / data.totalBytesExpectedToWrite);
    }
  });

  const done = ensureModelsDir()
    .then(() => resumable.downloadAsync())
    .then(async (result) => {
      if (cancelled) throw new Error("cancelled");
      if (!result || result.status !== 200) throw new Error(`download failed: HTTP ${result?.status}`);

      // HTTP 200 only means the response completed - it doesn't rule out a
      // connection drop truncating the body, which downloadAsync can still
      // resolve "successfully". Comparing against the size HF already told
      // us catches that without needing a full checksum pass.
      const partialInfo = await FileSystem.getInfoAsync(partialDestination);
      const actualSize = partialInfo.exists && !partialInfo.isDirectory ? partialInfo.size : 0;
      if (expectedSizeBytes > 0 && actualSize !== expectedSizeBytes) {
        throw new Error(
          `Downloaded file is ${actualSize.toLocaleString()} bytes, expected ${expectedSizeBytes.toLocaleString()} - it may be corrupt or incomplete.`
        );
      }

      await FileSystem.moveAsync({ from: partialDestination, to: destination });
    })
    .catch(async (err) => {
      await FileSystem.deleteAsync(partialDestination, { idempotent: true });
      throw err;
    });

  return {
    done,
    cancel: async () => {
      cancelled = true;
      await resumable.cancelAsync();
      await FileSystem.deleteAsync(partialDestination, { idempotent: true });
    },
  };
}

/** Result of a cancelled or failed import is `null`; throws only on a real
 * copy failure (picker cancellation and non-.gguf selection both just return
 * null/throw a user-facing message the caller can show directly). */
export async function importModelFromDevice(): Promise<LocalModel | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: false });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  if (!asset.name.toLowerCase().endsWith(".gguf")) {
    throw new Error("Please select a .gguf file");
  }

  await ensureModelsDir();
  const destination = modelPath(asset.name);
  await FileSystem.copyAsync({ from: asset.uri, to: destination });

  const info = await FileSystem.getInfoAsync(destination);
  return {
    filename: asset.name,
    path: destination,
    sizeBytes: info.exists && !info.isDirectory ? info.size : 0,
    quant: quantFromFilename(asset.name),
    addedAt: info.exists && !info.isDirectory ? info.modificationTime * 1000 : 0,
  };
}

export async function getTotalStorageUsed(): Promise<number> {
  const models = await listLocalModels();
  return models.reduce((sum, m) => sum + m.sizeBytes, 0);
}
