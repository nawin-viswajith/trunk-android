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

type Block = { type: "code"; content: string } | { type: "text"; runs: TextRun[] };

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

function parseMarkdown(content: string): Block[] {
  const blocks: Block[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CODE_FENCE_REGEX.lastIndex = 0;
  while ((match = CODE_FENCE_REGEX.exec(content))) {
    if (match.index > lastIndex) {
      const segment = content.slice(lastIndex, match.index);
      if (segment.length) blocks.push({ type: "text", runs: parseInline(segment) });
    }
    blocks.push({ type: "code", content: match[1].replace(/\n$/, "") });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length || blocks.length === 0) {
    blocks.push({ type: "text", runs: parseInline(content.slice(lastIndex)) });
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

  return (
    <>
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <View key={i} style={styles.codeBlock}>
            <Text style={styles.codeBlockText}>{block.content}</Text>
          </View>
        ) : (
          <Text key={i} style={textStyle}>
            {block.runs.map((run, j) => (
              <Text
                key={j}
                style={[run.bold && styles.bold, run.italic && styles.italic, run.code && styles.inlineCode]}
              >
                {run.text}
              </Text>
            ))}
          </Text>
        )
      )}
    </>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    bold: { fontWeight: "700" },
    italic: { fontStyle: "italic" },
    inlineCode: {
      fontFamily: "monospace",
      backgroundColor: colors.surface,
      color: colors.accentSecondary,
    },
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
