import React, { useMemo } from "react";
import { StyleSheet, TextStyle, View } from "react-native";
import { Text } from "./Text";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

type Block =
  | { type: "code"; content: string }
  | { type: "heading"; level: number; runs: TextRun[] }
  | { type: "listItem"; marker: string; runs: TextRun[] }
  | { type: "text"; runs: TextRun[] };

const INLINE_REGEX = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_REGEX.lastIndex = 0;
  while ((match = INLINE_REGEX.exec(text))) {
    if (match.index > lastIndex) runs.push({ text: text.slice(lastIndex, match.index) });
    const token = match[0];
    if (token.startsWith("**")) runs.push({ text: token.slice(2, -2), bold: true });
    else if (token.startsWith("`")) runs.push({ text: token.slice(1, -1), code: true });
    else runs.push({ text: token.slice(1, -1), italic: true });
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) runs.push({ text: text.slice(lastIndex) });
  return runs;
}

const CODE_FENCE_REGEX = /```\w*\n?([\s\S]*?)```/g;
const HEADING_LINE_REGEX = /^(#{1,6})\s+(.*)$/;
const UNORDERED_LINE_REGEX = /^[-*]\s+(.*)$/;
const ORDERED_LINE_REGEX = /^(\d+)\.\s+(.*)$/;

/** Line-level block parsing for a plain-text (non-code-fence) segment:
 * headings and list items each become their own block so they can get
 * distinct styling; consecutive plain lines are buffered and flushed as one
 * paragraph so wrapping/justify still reads as normal running text instead
 * of one block per line. */
function parseTextSegment(segment: string): Block[] {
  const blocks: Block[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "text", runs: parseInline(paragraphLines.join("\n")) });
    paragraphLines = [];
  };

  for (const line of segment.split("\n")) {
    const heading = line.match(HEADING_LINE_REGEX);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: heading[1].length, runs: parseInline(heading[2]) });
      continue;
    }
    const ordered = line.match(ORDERED_LINE_REGEX);
    if (ordered) {
      flushParagraph();
      blocks.push({ type: "listItem", marker: `${ordered[1]}.`, runs: parseInline(ordered[2]) });
      continue;
    }
    const unordered = line.match(UNORDERED_LINE_REGEX);
    if (unordered) {
      flushParagraph();
      blocks.push({ type: "listItem", marker: "•", runs: parseInline(unordered[1]) });
      continue;
    }
    paragraphLines.push(line);
  }
  flushParagraph();
  return blocks;
}

function parseMarkdown(content: string): Block[] {
  const blocks: Block[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CODE_FENCE_REGEX.lastIndex = 0;
  while ((match = CODE_FENCE_REGEX.exec(content))) {
    if (match.index > lastIndex) {
      const segment = content.slice(lastIndex, match.index);
      if (segment.length) blocks.push(...parseTextSegment(segment));
    }
    blocks.push({ type: "code", content: match[1].replace(/\n$/, "") });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length || blocks.length === 0) {
    blocks.push(...parseTextSegment(content.slice(lastIndex)));
  }
  return blocks;
}

interface MarkdownTextProps {
  content: string;
  textStyle: TextStyle;
}

/** Lightweight markdown for chat responses — fenced code blocks, inline
 * code, bold and italic. Not a full CommonMark parser, just what model
 * output actually uses. */
export function MarkdownText({ content, textStyle }: MarkdownTextProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  const renderRuns = (runs: TextRun[], key: number) =>
    runs.map((run, j) => (
      <Text key={`${key}-${j}`} style={[run.bold && styles.bold, run.italic && styles.italic, run.code && styles.inlineCode]}>
        {run.text}
      </Text>
    ));

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "code") {
          return (
            <View key={i} style={styles.codeBlock}>
              <Text style={styles.codeBlockText}>{block.content}</Text>
            </View>
          );
        }
        if (block.type === "heading") {
          return (
            <Text key={i} style={[textStyle, styles.heading, HEADING_LEVEL_STYLES[block.level]]}>
              {renderRuns(block.runs, i)}
            </Text>
          );
        }
        if (block.type === "listItem") {
          return (
            <View key={i} style={styles.listItemRow}>
              <Text style={[textStyle, styles.listMarker]}>{block.marker}</Text>
              <Text style={[textStyle, styles.listItemText]}>{renderRuns(block.runs, i)}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={textStyle}>
            {renderRuns(block.runs, i)}
          </Text>
        );
      })}
    </>
  );
}

// h1 largest down to h6 smallest, relative to the caller's own textStyle
// font size rather than a fixed value, so headings scale with whichever
// screen (chat bubble vs a flow step card) is rendering them.
const HEADING_LEVEL_STYLES: Record<number, TextStyle> = {
  1: { fontSize: 20 },
  2: { fontSize: 18 },
  3: { fontSize: 16 },
  4: { fontSize: 15 },
  5: { fontSize: 14 },
  6: { fontSize: 13 },
};

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    bold: { fontWeight: "700" },
    italic: { fontStyle: "italic" },
    inlineCode: {
      fontFamily: "monospace",
      backgroundColor: colors.surface,
      color: colors.accentSecondary,
    },
    heading: { fontWeight: "700", marginTop: spacing.xs, marginBottom: 2 },
    listItemRow: { flexDirection: "row", marginBottom: 2 },
    listMarker: { marginRight: spacing.xs },
    listItemText: { flex: 1 },
    codeBlock: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      marginVertical: spacing.xs,
    },
    codeBlockText: {
      fontFamily: "monospace",
      fontSize: 13,
      lineHeight: 18,
      color: colors.textPrimary,
    },
  });
}
