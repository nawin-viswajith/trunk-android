import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

export interface Attachment {
  name: string;
  content: string;
  truncated: boolean;
}

// Rough safety cap - keeps one attached file from consuming a small model's
// entire context window on its own, before the user's own message is even
// added. Comfortably larger than most short docs/code files; small enough
// that tokenizing and replaying it stays fast.
const MAX_ATTACHMENT_CHARS = 20000;

// No parser for binary formats (PDF/DOCX) yet - restricting to extensions
// that are actually plain text keeps this honest instead of silently
// reading garbage bytes as "content" for something like a PDF.
const TEXT_EXTENSIONS = [
  ".txt", ".md", ".markdown", ".json", ".csv", ".log", ".yml", ".yaml",
  ".xml", ".html", ".htm", ".js", ".ts", ".tsx", ".jsx", ".py", ".java",
  ".c", ".cpp", ".h", ".rs", ".go", ".rb", ".sh", ".css", ".sql",
];

/** Result of a cancelled picker is null; throws only for a file that can't
 * be treated as text at all - callers show that message directly, matching
 * importModelFromDevice's convention in modelStorage.ts. */
export async function pickTextAttachment(): Promise<Attachment | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const lowerName = asset.name.toLowerCase();
  if (!TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    throw new Error("Only plain-text files are supported right now (.txt, .md, .json, code files, etc).");
  }

  let content: string;
  try {
    content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  } catch {
    throw new Error("Couldn't read this file as text.");
  }

  const truncated = content.length > MAX_ATTACHMENT_CHARS;
  return {
    name: asset.name,
    content: truncated ? content.slice(0, MAX_ATTACHMENT_CHARS) : content,
    truncated,
  };
}

/** How an attachment is folded into a prompt - kept in one place so
 * Inference and Playground format it identically. */
export function formatAttachmentForPrompt(attachment: Attachment): string {
  return `[Attached file: ${attachment.name}]\n${attachment.content}`;
}
