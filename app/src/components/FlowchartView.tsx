import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import ViewShot from "react-native-view-shot";
import * as Clipboard from "expo-clipboard";
import { Text } from "./Text";
import { CopyIcon } from "./CopyIcon";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface FlowNode {
  id: string;
  label: string;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

interface ParsedFlowchart {
  direction: "TD" | "LR";
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const HEADER_REGEX = /^\s*(graph|flowchart)\s+(TD|TB|LR|RL|BT)\s*$/i;
// id, then an optional shape wrapper: [Label], ("Label"), {Label}, ([Label]),
// [["Label"]], etc. The shape glyph is intentionally ignored (see module
// comment below) - only the id/label pair is captured, and any quotes around
// the label are stripped.
const NODE_TOKEN_REGEX = /^([A-Za-z0-9_]+)(?:(\[+|\(+|\{+)\s*"?([^"\]\)\}]*?)"?\s*(\]+|\)+|\}+))?/;
// Any run of arrow-ish punctuation mermaid uses: -->, --->, -.->,  ==>, ---,
// -.-,  <-->. Captures an optional |label| or leading/trailing text label.
const ARROW_REGEX = /^\s*(?:<?[-=.]{1,3}>?)\s*(?:\|([^|]*)\|)?\s*/;

function stripQuotes(label: string): string {
  const trimmed = label.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  return trimmed;
}

function ensureNode(nodes: Map<string, FlowNode>, id: string, label?: string) {
  const existing = nodes.get(id);
  if (existing) {
    if (label && existing.label === id) existing.label = stripQuotes(label);
    return;
  }
  nodes.set(id, { id, label: label ? stripQuotes(label) : id });
}

/** Consumes one `id` or `id[Label]`/`id("Label")`/`id{Label}` token from the
 * front of `text`. Returns null if `text` doesn't start with a valid node
 * token (e.g. it's blank, or starts with an arrow with no source id). */
function consumeNode(text: string): { id: string; label?: string; rest: string } | null {
  const match = NODE_TOKEN_REGEX.exec(text);
  if (!match) return null;
  const [full, id, , label] = match;
  return { id, label, rest: text.slice(full.length) };
}

/** Consumes one arrow segment (`-->`, `-.->`, `==>`, optionally with a
 * `|label|`) from the front of `text`. Returns null if `text` doesn't start
 * with recognizable arrow punctuation. */
function consumeArrow(text: string): { label?: string; rest: string } | null {
  const match = ARROW_REGEX.exec(text);
  if (!match || match[0].length === 0) return null;
  return { label: match[1], rest: text.slice(match[0].length) };
}

/** Parses one line as a chain of nodes joined by arrows, e.g.
 * `A --> B --> C` or `A -->|ok| B`, handling any number of hops - not just a
 * single A-to-B edge per line, since chained arrows are common mermaid
 * output. Returns null if the line doesn't parse as at least one edge or
 * one standalone node declaration. */
function parseLine(line: string, nodes: Map<string, FlowNode>, edges: FlowEdge[]): boolean {
  let rest = line;
  const firstNode = consumeNode(rest);
  if (!firstNode) return false;
  ensureNode(nodes, firstNode.id, firstNode.label);
  rest = firstNode.rest;

  let prevId = firstNode.id;
  let sawEdge = false;
  while (rest.trim().length > 0) {
    const arrow = consumeArrow(rest);
    if (!arrow) return sawEdge; // trailing text after the last node - ignore
    rest = arrow.rest;
    const nextNode = consumeNode(rest);
    if (!nextNode) return false; // arrow with nothing on the other side - malformed
    ensureNode(nodes, nextNode.id, nextNode.label);

    // `A --> B: Label` (trailing colon-label instead of |label|) applies to
    // this hop only when there's nothing left on the line after it.
    let edgeLabel = arrow.label;
    const afterNode = nextNode.rest.trim();
    if (!edgeLabel && afterNode.startsWith(":")) {
      edgeLabel = afterNode.slice(1).trim();
      rest = "";
    } else {
      rest = nextNode.rest;
    }

    edges.push({ from: prevId, to: nextNode.id, label: edgeLabel?.trim() || undefined });
    prevId = nextNode.id;
    sawEdge = true;
  }
  return true;
}

/** Parses a small, explicit subset of mermaid flowchart syntax - just enough
 * for what a chat model typically outputs (a `graph`/`flowchart` header,
 * node declarations, and chained `-->`/`-.->`/`==>` edges with optional
 * `|label|` or trailing `: label` text). This is not a mermaid-spec parser:
 * subgraphs and styling directives are out of scope. Node shape glyphs
 * ([], (), {}) are parsed only to recover the label text - every node
 * renders as the same flat bordered box regardless of shape, matching this
 * app's sharp-corners-only design language. Returns null if the input
 * doesn't look like a flowchart at all, so the caller can fall back to a
 * plain code block. */
// Counts unclosed [ ( { on a line so a node label a model wrapped across a
// real newline (`C[Retrieve LLM\nConfiguration]`) can be rejoined into one
// logical line before parsing - a bracket opened but not yet closed means
// the line's label text continues on the next one, not that the line is
// malformed.
function unclosedBracketCount(line: string): number {
  let depth = 0;
  for (const ch of line) {
    if (ch === "[" || ch === "(" || ch === "{") depth++;
    else if (ch === "]" || ch === ")" || ch === "}") depth--;
  }
  return depth;
}

/** Rejoins any line left with unclosed brackets onto the next line (with a
 * single space, so the label reads as one phrase) - repeated until every
 * line balances, so a label wrapped across more than two lines still works. */
function rejoinWrappedLabels(rawLines: string[]): string[] {
  const joined: string[] = [];
  let pending = "";
  let pendingDepth = 0;
  for (const line of rawLines) {
    const combined = pending ? `${pending} ${line}` : line;
    pendingDepth += unclosedBracketCount(line);
    if (pendingDepth > 0) {
      pending = combined;
      continue;
    }
    joined.push(combined);
    pending = "";
    pendingDepth = 0;
  }
  if (pending) joined.push(pending);
  return joined;
}

export function parseFlowchart(source: string): ParsedFlowchart | null {
  const lines = rejoinWrappedLabels(
    source
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("%%"))
  );
  if (lines.length === 0) return null;

  const headerMatch = HEADER_REGEX.exec(lines[0]);
  if (!headerMatch) return null;
  const rawDirection = headerMatch[2].toUpperCase();
  const direction: "TD" | "LR" = rawDirection === "LR" || rawDirection === "RL" ? "LR" : "TD";

  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  for (const line of lines.slice(1)) {
    if (parseLine(line, nodes, edges)) continue;
    // A line that parses as neither an edge chain nor a standalone node
    // declaration means this isn't the small subset we support. Bail out
    // entirely (silently dropping nothing) UNLESS at least one real edge
    // has already been parsed - models sometimes append a plain-text
    // legend/summary after a complete, valid diagram (e.g. "[Step 1] -
    // Start" lines restating each node), which isn't valid mermaid syntax
    // but also isn't information the diagram itself would lose by ignoring
    // it. Stop parsing at that point rather than discarding the diagram
    // that already rendered correctly.
    if (edges.length > 0) break;
    return null;
  }

  if (nodes.size === 0) return null;
  return { direction, nodes: Array.from(nodes.values()), edges };
}

const NODE_W = 130;
const NODE_H = 48;
const GAP_MAIN = 36;
const GAP_CROSS = 20;

interface LaidOutNode extends FlowNode {
  x: number;
  y: number;
}

function layout(parsed: ParsedFlowchart): { nodes: LaidOutNode[]; width: number; height: number } {
  const { nodes, edges, direction } = parsed;
  const indegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const outgoing = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (!indegree.has(e.to) || !outgoing.has(e.from)) continue;
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    outgoing.get(e.from)?.push(e.to);
  }

  // Simple layered (topological) placement: repeatedly peel off nodes with
  // no remaining unprocessed incoming edges. A cycle leaves some nodes
  // unplaced by this loop - they're appended as one final extra layer so
  // nothing gets silently dropped, rather than looping forever.
  const remaining = new Map(indegree);
  const layers: string[][] = [];
  const placed = new Set<string>();
  while (placed.size < nodes.length) {
    const layer = nodes.filter((n) => !placed.has(n.id) && (remaining.get(n.id) ?? 0) <= 0).map((n) => n.id);
    if (layer.length === 0) {
      layers.push(nodes.filter((n) => !placed.has(n.id)).map((n) => n.id));
      break;
    }
    layers.push(layer);
    for (const id of layer) {
      placed.add(id);
      for (const next of outgoing.get(id) ?? []) {
        remaining.set(next, (remaining.get(next) ?? 0) - 1);
      }
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const laidOut: LaidOutNode[] = [];

  layers.forEach((layer, layerIndex) => {
    layer.forEach((id, i) => {
      const node = byId.get(id);
      if (!node) return;
      const crossOffset = (i - (layer.length - 1) / 2) * (direction === "TD" ? NODE_W + GAP_CROSS : NODE_H + GAP_CROSS);
      const mainPos = layerIndex * (direction === "TD" ? NODE_H + GAP_MAIN : NODE_W + GAP_MAIN);
      if (direction === "TD") {
        laidOut.push({ ...node, x: crossOffset, y: mainPos });
      } else {
        laidOut.push({ ...node, x: mainPos, y: crossOffset });
      }
    });
  });

  const minX = Math.min(...laidOut.map((n) => n.x));
  const maxX = Math.max(...laidOut.map((n) => n.x + NODE_W));
  const minY = Math.min(...laidOut.map((n) => n.y));
  const maxY = Math.max(...laidOut.map((n) => n.y + NODE_H));
  const normalized = laidOut.map((n) => ({ ...n, x: n.x - minX, y: n.y - minY }));

  return { nodes: normalized, width: maxX - minX, height: maxY - minY };
}

function edgePath(from: LaidOutNode, to: LaidOutNode, direction: "TD" | "LR"): string {
  if (direction === "TD") {
    const startX = from.x + NODE_W / 2;
    const startY = from.y + NODE_H;
    const endX = to.x + NODE_W / 2;
    const endY = to.y;
    const midY = startY + (endY - startY) / 2;
    return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
  }
  const startX = from.x + NODE_W;
  const startY = from.y + NODE_H / 2;
  const endX = to.x;
  const endY = to.y + NODE_H / 2;
  const midX = startX + (endX - startX) / 2;
  return `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
}

interface FlowchartViewProps {
  source: string;
}

/** Renders a small mermaid-subset flowchart (see parseFlowchart) as flat
 * bordered boxes connected by react-native-svg paths - no WebView, reusing
 * the same "draw the graph as one Svg overlay behind/above plain View boxes"
 * approach as the Playground's FlowCanvas, just without any drag/gesture
 * layer since chat output is static. Callers should fall back to a plain
 * code block when parseFlowchart returns null. */
export function FlowchartView({ source }: FlowchartViewProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const parsed = useMemo(() => parseFlowchart(source), [source]);
  const laidOut = useMemo(() => (parsed ? layout(parsed) : null), [parsed]);
  const shotRef = useRef<ViewShot>(null);
  const [copied, setCopied] = useState(false);

  if (!parsed || !laidOut) return null;

  const byId = new Map(laidOut.nodes.map((n) => [n.id, n]));

  const onCopy = async () => {
    const base64 = await shotRef.current?.capture?.();
    if (!base64) return;
    await Clipboard.setImageAsync(base64);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>flowchart</Text>
        <Pressable onPress={onCopy} hitSlop={10} style={styles.copyButton}>
          <CopyIcon color={colors.textSecondary} size={14} />
          {copied ? <Text style={styles.copiedLabel}>Copied</Text> : null}
        </Pressable>
      </View>
      <ViewShot ref={shotRef} options={{ format: "png", result: "base64" }}>
        <View style={[styles.canvas, { width: laidOut.width, height: laidOut.height }]}>
          <Svg width={laidOut.width} height={laidOut.height} style={StyleSheet.absoluteFill}>
            {parsed.edges.map((edge, i) => {
              const from = byId.get(edge.from);
              const to = byId.get(edge.to);
              if (!from || !to) return null;
              return (
                <Path
                  key={i}
                  d={edgePath(from, to, parsed.direction)}
                  stroke={colors.textSecondary}
                  strokeWidth={1.5}
                  fill="none"
                />
              );
            })}
          </Svg>
          {laidOut.nodes.map((node) => (
            <View key={node.id} style={[styles.node, { left: node.x, top: node.y }]}>
              <Text style={styles.nodeLabel} numberOfLines={3}>
                {node.label}
              </Text>
            </View>
          ))}
        </View>
      </ViewShot>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginVertical: spacing.xs,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
    },
    headerLabel: {
      color: colors.textSecondary,
      fontFamily: "monospace",
      fontSize: 11,
      textTransform: "lowercase",
    },
    copyButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.xs },
    copiedLabel: { color: colors.running, fontSize: 11, fontWeight: "600" },
    canvas: {
      padding: spacing.md,
    },
    node: {
      position: "absolute",
      width: NODE_W,
      height: NODE_H,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xs,
    },
    nodeLabel: { color: colors.textPrimary, fontSize: 11, textAlign: "center" },
  });
}
