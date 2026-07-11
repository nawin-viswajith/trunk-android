import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { quantFromFilename } from "../utils/quant";

export interface LocalModel {
  filename: string;
  path: string;
  sizeBytes: number;
  quant: string | null;
}

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

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
  const models: LocalModel[] = [];
  for (const filename of filenames) {
    if (!filename.endsWith(".gguf")) continue;
    const info = await FileSystem.getInfoAsync(modelPath(filename));
    models.push({
      filename,
      path: modelPath(filename),
      sizeBytes: info.exists && !info.isDirectory ? info.size : 0,
      quant: quantFromFilename(filename),
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
}

export interface DownloadHandle {
  /** Resolves once the download completes; rejects on failure or cancellation. */
  done: Promise<void>;
  cancel: () => Promise<void>;
}

export function downloadModel(url: string, filename: string, onProgress: (fraction: number) => void): DownloadHandle {
  const destination = modelPath(filename);
  let cancelled = false;

  const resumable = FileSystem.createDownloadResumable(url, destination, {}, (data) => {
    if (data.totalBytesExpectedToWrite > 0) {
      onProgress(data.totalBytesWritten / data.totalBytesExpectedToWrite);
    }
  });

  const done = ensureModelsDir()
    .then(() => resumable.downloadAsync())
    .then((result) => {
      if (cancelled) throw new Error("cancelled");
      if (!result || result.status !== 200) throw new Error(`download failed: HTTP ${result?.status}`);
    });

  return {
    done,
    cancel: async () => {
      cancelled = true;
      await resumable.cancelAsync();
      await FileSystem.deleteAsync(destination, { idempotent: true });
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
  };
}

export async function getTotalStorageUsed(): Promise<number> {
  const models = await listLocalModels();
  return models.reduce((sum, m) => sum + m.sizeBytes, 0);
}
