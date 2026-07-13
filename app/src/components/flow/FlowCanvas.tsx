import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../Text";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import { FlowNodeView, NODE_HEIGHT, NODE_WIDTH } from "./FlowNodeView";
import { Agent, Flow } from "../../state/useFlowStore";
import { ColorPalette } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";

interface Point {
  x: number;
  y: number;
}

const REMOVE_BADGE_SIZE = 22;
const CORNER_RADIUS = 12;
const STROKE = 2;

/** Builds one continuous SVG path through a sequence of axis-aligned points,
 * rounding each interior corner with a quadratic curve anchored at the sharp
 * corner point — the standard way to draw a rounded-corner polyline as a
 * single real path. Doing the whole connector as one <Path> sidesteps every
 * segment-joint bug a plain-View approximation ran into (border-radius
 * clamping at small box sizes, rotated-rectangle rasterization artifacts):
 * there are no joints, just one stroked path. Radius is clamped per-corner
 * to half of whichever adjoining leg is shorter, so it degrades gracefully
 * instead of overshooting on a short leg. */
function roundedPolylinePath(points: Point[], radius: number): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const legPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const legNext = Math.hypot(next.x - curr.x, next.y - curr.y);
    const r = Math.min(radius, legPrev / 2, legNext / 2);
    const towardPrevX = legPrev === 0 ? 0 : ((prev.x - curr.x) / legPrev) * r;
    const towardPrevY = legPrev === 0 ? 0 : ((prev.y - curr.y) / legPrev) * r;
    const towardNextX = legNext === 0 ? 0 : ((next.x - curr.x) / legNext) * r;
    const towardNextY = legNext === 0 ? 0 : ((next.y - curr.y) / legNext) * r;
    const a = { x: curr.x + towardPrevX, y: curr.y + towardPrevY };
    const b = { x: curr.x + towardNextX, y: curr.y + towardNextY };
    d += ` L ${a.x} ${a.y} Q ${curr.x} ${curr.y} ${b.x} ${b.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/** Output always exits right, input always enters from the left. The path
 * is a "step" (right stub -> vertical -> horizontal jog at the row midpoint
 * -> vertical -> right stub): the horizontal jog always happens at the
 * vertical midpoint between the two handles, which for normally-spaced rows
 * sits in the empty gap below the source and above the target — so however
 * far it has to travel (including doubling back for a "backward" target
 * sitting behind the source), it never crosses either card's own text. */
function connectionPathAndBadge(from: Point, to: Point): { d: string; badge: Point } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const gap = Math.max(24, CORNER_RADIUS + 12);
  const vGap = Math.abs(dy);

  if (vGap < CORNER_RADIUS * 4) {
    // Nodes are nearly level — no clear row gap to route the jog through,
    // so a plain straight run looks better than a jog fighting for a few
    // pixels of vertical space.
    return { d: `M ${from.x} ${from.y} L ${to.x} ${to.y}`, badge: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } };
  }

  const midY = from.y + dy / 2;
  const x1 = from.x + gap; // right stub out of the source
  const x2 = to.x - gap; // left stub into the target
  const points: Point[] = [from, { x: x1, y: from.y }, { x: x1, y: midY }, { x: x2, y: midY }, { x: x2, y: to.y }, to];
  return { d: roundedPolylinePath(points, CORNER_RADIUS), badge: { x: (x1 + x2) / 2, y: midY } };
}

function RemoveBadge({ x, y, color, badgeColor, onRemove }: { x: number; y: number; color: string; badgeColor: string; onRemove: () => void }) {
  return (
    <Pressable
      onPress={onRemove}
      hitSlop={8}
      style={{
        position: "absolute",
        left: x - REMOVE_BADGE_SIZE / 2,
        top: y - REMOVE_BADGE_SIZE / 2,
        width: REMOVE_BADGE_SIZE,
        height: REMOVE_BADGE_SIZE,
        borderRadius: REMOVE_BADGE_SIZE / 2,
        borderWidth: 1.5,
        borderColor: color,
        backgroundColor: badgeColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color, fontSize: 13, fontWeight: "700", lineHeight: 14 }}>×</Text>
    </Pressable>
  );
}

interface FlowCanvasProps {
  flow: Flow;
  agents: Agent[];
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onConnect: (sourceId: string, targetId: string) => void;
  onRemoveConnection: (sourceId: string) => void;
  onNodeLongPress: (nodeId: string) => void;
  /** Fired whenever the visible viewport (its on-screen size, or the pan
   * offset moving it) changes — lets the caller compute "the canvas-space
   * point currently at the center of the screen" for placing a new node
   * where the user is actually looking, instead of a fixed canvas-space
   * origin that can be scrolled far out of view. */
  onViewportChange?: (info: { offset: Point; width: number; height: number }) => void;
}

/** The last node reached walking forward from the start node — used to
 * label the terminal node "END", symmetric with the "START" label. Not
 * simply "any node with no outgoing edge", since a stray/disconnected node
 * would also match that and isn't actually part of the flow's chain. */
function findEndNodeId(flow: Flow): string | null {
  if (!flow.startNodeId) return null;
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  let cursor = flow.startNodeId;
  while (true) {
    if (visited.has(cursor)) return cursor; // cycle guard, shouldn't happen
    visited.add(cursor);
    const node = byId.get(cursor);
    if (!node || !node.nextNodeId) return cursor;
    cursor = node.nextNodeId;
  }
}

/** Pan-only (no pinch-zoom in v1) node canvas. The whole node+line layer is
 * one View translated by canvasOffset — panning the background moves that
 * one View, no per-node offset math needed. Each node is its own sibling
 * GestureDetector rendered on top, so RNGH's hit-testing naturally gives it
 * priority over the background pan when a touch starts on a node — no
 * explicit Race/Exclusive composition needed between node-drag and
 * background-pan. */
export function FlowCanvas({
  flow,
  agents,
  onMoveNode,
  onConnect,
  onRemoveConnection,
  onNodeLongPress,
  onViewportChange,
}: FlowCanvasProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const endNodeId = useMemo(() => findEndNodeId(flow), [flow]);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const viewportSize = useRef({ width: 0, height: 0 });
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  // While a node is being dragged, its FlowNodeView keeps the buttery-smooth
  // visual offset locally — this just mirrors the live absolute position so
  // connection lines can track it in real time instead of snapping into
  // place only after the drag ends.
  const [liveDrag, setLiveDrag] = useState<{ id: string; x: number; y: number } | null>(null);

  const reportViewport = (offset: Point) => {
    onViewportChange?.({ offset, width: viewportSize.current.width, height: viewportSize.current.height });
  };

  const backgroundPan = Gesture.Pan()
    .onBegin(() => {
      offsetStart.current = canvasOffset;
    })
    .onUpdate((e) => {
      const next = { x: offsetStart.current.x + e.translationX, y: offsetStart.current.y + e.translationY };
      setCanvasOffset(next);
      reportViewport(next);
    });

  const backgroundTap = Gesture.Tap().onEnd(() => setPendingSource(null));
  const backgroundGesture = Gesture.Race(backgroundPan, backgroundTap);

  const getPos = (nodeId: string): Point | null => {
    if (liveDrag && liveDrag.id === nodeId) return { x: liveDrag.x, y: liveDrag.y };
    const node = flow.nodes.find((n) => n.id === nodeId);
    return node ? { x: node.x, y: node.y } : null;
  };

  const handleTapOutput = (nodeId: string) => {
    setPendingSource((cur) => (cur === nodeId ? null : nodeId));
  };

  const handleTapInput = (nodeId: string) => {
    if (pendingSource && pendingSource !== nodeId) {
      onConnect(pendingSource, nodeId);
    }
    setPendingSource(null);
  };

  const connections = flow.nodes
    .map((n) => {
      if (!n.nextNodeId) return null;
      const from = getPos(n.id);
      const to = getPos(n.nextNodeId);
      if (!from || !to) return null;
      const fromHandle = { x: from.x + NODE_WIDTH, y: from.y + NODE_HEIGHT / 2 };
      const toHandle = { x: to.x, y: to.y + NODE_HEIGHT / 2 };
      return { nodeId: n.id, ...connectionPathAndBadge(fromHandle, toHandle) };
    })
    .filter((c): c is { nodeId: string; d: string; badge: Point } => c !== null);

  return (
    <GestureDetector gesture={backgroundGesture}>
      <View
        style={styles.viewport}
        onLayout={(e) => {
          viewportSize.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
          reportViewport(canvasOffset);
        }}
      >
        <View style={[styles.canvasContent, { transform: [{ translateX: canvasOffset.x }, { translateY: canvasOffset.y }] }]}>
          {/* Nodes render first (bottom), the connections SVG after (top) —
           * a "backward" connection (target left of source) has to tuck its
           * final approach segment under the target card to reach its
           * left-edge input handle. With nodes on top that segment was
           * silently hidden behind the opaque card; drawing lines last
           * keeps every part visible. The SVG itself doesn't intercept
           * touches, so this doesn't block node drag/tap gestures underneath
           * — only the (separately-rendered) removal badges are tappable. */}
          {flow.nodes.map((node) => (
            <FlowNodeView
              key={node.id}
              node={node}
              agent={agents.find((a) => a.id === node.agentId)}
              isStart={flow.startNodeId === node.id}
              isEnd={endNodeId === node.id && endNodeId !== flow.startNodeId}
              isPendingSource={pendingSource === node.id}
              onMove={(x, y) => {
                onMoveNode(node.id, x, y);
                setLiveDrag(null);
              }}
              onDragUpdate={(x, y) => setLiveDrag({ id: node.id, x, y })}
              onLongPress={() => onNodeLongPress(node.id)}
              onTapOutputHandle={() => handleTapOutput(node.id)}
              onTapInputHandle={() => handleTapInput(node.id)}
            />
          ))}

          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            {connections.map((c) => (
              <Path key={c.nodeId} d={c.d} stroke={colors.accentTertiary} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
            ))}
          </Svg>

          {/* Hidden while a connection is being made (pendingSource set): a
           * badge sitting right at an existing connection's midpoint is an
           * easy accidental tap while reaching for a different node's
           * handle elsewhere on the canvas, silently deleting an unrelated
           * connection instead of completing the new one. */}
          {!pendingSource
            ? connections.map((c) => (
                <RemoveBadge
                  key={c.nodeId}
                  x={c.badge.x}
                  y={c.badge.y}
                  color={colors.accentTertiary}
                  badgeColor={colors.background}
                  onRemove={() => onRemoveConnection(c.nodeId)}
                />
              ))
            : null}
        </View>
      </View>
    </GestureDetector>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    viewport: { flex: 1, backgroundColor: colors.background, overflow: "hidden" },
    canvasContent: { flex: 1 },
  });
}
