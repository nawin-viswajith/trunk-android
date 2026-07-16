import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextStyle, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Text } from "./Text";
import { CopyIcon } from "./CopyIcon";
import { MathView } from "./MathView";
import { FlowchartView, parseFlowchart } from "./FlowchartView";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

type Block =
  | { type: "code"; content: string; language?: string }
  | { type: "heading"; level: number; runs: TextRun[] }
  | { type: "listItem"; marker: string; runs: TextRun[] }
  | { type: "text"; runs: TextRun[] }
  | { type: "math"; latex: string; displayMode: boolean };

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

const CODE_FENCE_REGEX = /```(\w*)\n?([\s\S]*?)```/g;
const HEADING_LINE_REGEX = /^(#{1,6})\s+(.*)$/;
const UNORDERED_LINE_REGEX = /^[-*]\s+(.*)$/;
const ORDERED_LINE_REGEX = /^(\d+)\.\s+(.*)$/;
// \[ ... \] (display math) and \( ... \) (inline math) - the two LaTeX
// delimiter styles models actually emit (see the Inference screen bug this
// was written for: raw "\[ \text{Attention}(...) \]" leaking through as
// plain text). $$...$$ is also common enough from some models to support.
const MATH_REGEX = /\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$\$([\s\S]+?)\$\$/g;

/** Splits a text segment (already known to contain no code fences) into
 * heading/list/plain-text and math blocks. Headings and list items each get
 * their own block for distinct styling; consecutive plain lines are
 * buffered and flushed as one paragraph so wrapping/justify still reads as
 * normal running text instead of one block per line. Math is extracted from
 * whatever's left of a paragraph line, not from heading/list lines - a model
 * has never been observed emitting LaTeX inside a heading or list marker,
 * and handling it there would meaningfully complicate both parsers for a
 * case that doesn't happen. Inline math (`\( ... \)`) still renders as its
 * own block-level MathView rather than flowing inside the surrounding
 * prose's Text run - a WebView can't sit inline in RN text layout, so a
 * `\(x^2\)` reference in the middle of a sentence breaks onto its own line.
 * This is a deliberate simplification, not a bug: KaTeX itself still renders
 * the math correctly, just not flowed with the surrounding words. */
function parseTextWithMath(text: string): Block[] {
  const blocks: Block[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MATH_REGEX.lastIndex = 0;
  while ((match = MATH_REGEX.exec(text))) {
    if (match.index > lastIndex) {
      const segment = text.slice(lastIndex, match.index);
      if (segment.trim().length) blocks.push({ type: "text", runs: parseInline(segment) });
    }
    const displayLatex = match[1];
    const inlineLatex = match[2];
    const dollarLatex = match[3];
    if (displayLatex !== undefined) {
      blocks.push({ type: "math", latex: displayLatex.trim(), displayMode: true });
    } else if (inlineLatex !== undefined) {
      blocks.push({ type: "math", latex: inlineLatex.trim(), displayMode: false });
    } else if (dollarLatex !== undefined) {
      blocks.push({ type: "math", latex: dollarLatex.trim(), displayMode: true });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    const segment = text.slice(lastIndex);
    if (segment.trim().length || blocks.length === 0) blocks.push({ type: "text", runs: parseInline(segment) });
  }
  return blocks;
}

/** Line-level block parsing for a plain-text (non-code-fence) segment:
 * headings and list items each become their own block so they can get
 * distinct styling; consecutive plain lines are buffered and flushed
 * through parseTextWithMath so math extraction still applies to normal
 * paragraph text. */
function parseTextSegment(segment: string): Block[] {
  const blocks: Block[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push(...parseTextWithMath(paragraphLines.join("\n")));
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
    const language = match[1] || undefined;
    blocks.push({ type: "code", content: match[2].replace(/\n$/, ""), language });
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

function CodeBlock({ content, language, styles }: { content: string; language?: string; styles: ReturnType<typeof createStyles> }) {
  const [copied, setCopied] = useState(false);
  const colors = useColors();

  if (language === "mermaid") {
    const parsed = parseFlowchart(content);
    if (parsed) return <FlowchartView source={content} />;
    // Falls through to the plain code block below when the fence is tagged
    // mermaid but doesn't parse as the supported subset - never render blank.
  }

  const onCopy = async () => {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <View style={styles.codeBlock}>
      <View style={styles.codeBlockHeader}>
        <Text style={styles.codeBlockLanguage}>{language || " "}</Text>
        <Pressable onPress={onCopy} hitSlop={10} style={styles.copyButton}>
          <CopyIcon color={colors.textSecondary} size={14} />
          {copied ? <Text style={styles.copiedLabel}>Copied</Text> : null}
        </Pressable>
      </View>
      <Text style={styles.codeBlockText}>{content}</Text>
    </View>
  );
}

/** Lightweight markdown for chat responses - headings, list items, fenced
 * code blocks (with a copy button, and mermaid-tagged fences rendered as a
 * flowchart), LaTeX math (`\[ \]`, `\( \)`, `$$ $$`, rendered via KaTeX in
 * MathView), inline code, bold and italic. Not a full CommonMark parser,
 * just what model output actually uses. */
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
          return <CodeBlock key={i} content={block.content} language={block.language} styles={styles} />;
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
        if (block.type === "math") {
          return <MathView key={i} latex={block.latex} displayMode={block.displayMode} />;
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
      marginVertical: spacing.xs,
    },
    codeBlockHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
    },
    codeBlockLanguage: {
      color: colors.textSecondary,
      fontFamily: "monospace",
      fontSize: 11,
      textTransform: "lowercase",
    },
    copyButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.xs },
    copiedLabel: { color: colors.running, fontSize: 11, fontWeight: "600" },
    codeBlockText: {
      fontFamily: "monospace",
      fontSize: 13,
      lineHeight: 18,
      color: colors.textPrimary,
      padding: spacing.sm,
      paddingTop: spacing.xs,
    },
  });
}
