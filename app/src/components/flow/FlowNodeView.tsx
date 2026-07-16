import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../Text";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Agent, FlowNode } from "../../state/useFlowStore";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";

export const NODE_WIDTH = 150;
export const NODE_HEIGHT = 76;
// Visually bigger and with a further hitSlop on top (below) — the previous
// 18px dot's real touch target was smaller than that even, and consistently
// hard to land a thumb on precisely enough to connect two nodes.
const HANDLE_SIZE = 30;
const HANDLE_HIT_SLOP = 14;

interface FlowNodeViewProps {
  node: FlowNode;
  agent: Agent | undefined;
  isStart: boolean;
  isEnd: boolean;
  isPendingSource: boolean;
  onMove: (x: number, y: number) => void;
  onDragUpdate: (x: number, y: number) => void;
  onLongPress: () => void;
  onTapOutputHandle: () => void;
  onTapInputHandle: () => void;
}

/** A single draggable agent node on the FlowCanvas. Drag position is kept in
 * local state during the gesture (only this node re-renders while dragging)
 * and committed to the store once via onMove on release. Input/output
 * handles are separate GestureDetectors (their own Tap gesture) so tapping
 * a handle never also starts a card drag. */
export function FlowNodeView({
  node,
  agent,
  isStart,
  isEnd,
  isPendingSource,
  onMove,
  onDragUpdate,
  onLongPress,
  onTapOutputHandle,
  onTapInputHandle,
}: FlowNodeViewProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Rounded even during the live drag (not just on release) — a card
      // sitting at a fractional pixel position is the same sub-pixel
      // hairline-border-dropping issue noted below, just visible mid-drag
      // instead of only after.
      setDragOffset({ x: Math.round(e.translationX), y: Math.round(e.translationY) });
      onDragUpdate(node.x + Math.round(e.translationX), node.y + Math.round(e.translationY));
    })
    .onEnd((e) => {
      // Integer pixels only: gesture translation is floating point, and a
      // card committed at a fractional (x, y) can land its 1px border on a
      // sub-pixel boundary that some Android densities silently don't
      // rasterize, making that edge's border disappear until the node
      // moves again.
      onMove(Math.round(node.x + e.translationX), Math.round(node.y + e.translationY));
      setDragOffset({ x: 0, y: 0 });
    });

  const outputTap = Gesture.Tap().hitSlop(HANDLE_HIT_SLOP).onEnd(() => onTapOutputHandle());
  // A start node should never receive an incoming edge, so its input handle
  // is inert - kept in the layout (pointerEvents="none" + faded) so node
  // width/connection-line anchor math doesn't shift between start/non-start.
  const inputTap = Gesture.Tap().hitSlop(HANDLE_HIT_SLOP).onEnd(() => {
    if (!isStart) onTapInputHandle();
  });

  return (
    <View style={[styles.wrapper, { left: node.x + dragOffset.x, top: node.y + dragOffset.y }]}>
      {/* Card renders as a plain, fully-bounded rectangle first - handles
       * are absolutely positioned on top, straddling its edges. Doing this
       * with flex + negative margins (the previous approach) put the
       * card's edge at a fractional pixel position on some densities,
       * which silently dropped that side's hairline border on Android. */}
      <GestureDetector gesture={pan}>
        <Pressable onLongPress={onLongPress} style={[styles.card, isStart && styles.cardStart, isEnd && styles.cardEnd]}>
          <Text style={styles.name} numberOfLines={2}>
            {agent?.name ?? "Unknown agent"}
          </Text>
          {isStart ? <Text style={styles.startLabel}>START</Text> : null}
          {isEnd ? <Text style={styles.endLabel}>END</Text> : null}
        </Pressable>
      </GestureDetector>

      <GestureDetector gesture={inputTap}>
        <View
          pointerEvents={isStart ? "none" : "auto"}
          style={[styles.handle, styles.handleLeft, isStart && styles.handleHidden]}
        />
      </GestureDetector>

      <GestureDetector gesture={outputTap}>
        {/* Dimmed (not hidden) on the current end node: nothing flows out of
         * it yet, but "end" is just "whichever node currently has no
         * outgoing edge" — tapping this still starts a new connection to
         * extend the chain, so it has to stay functionally identical to
         * every other node's output handle. */}
        <View
          style={[styles.handle, styles.handleRight, isEnd && !isPendingSource && styles.handleDimmed, isPendingSource && styles.handlePending]}
        />
      </GestureDetector>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrapper: { position: "absolute", width: NODE_WIDTH, height: NODE_HEIGHT },
    card: {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.sm,
      // Left/right padding clears the connector dots' half-width overlap
      // (HANDLE_SIZE / 2) plus the usual breathing room - applied to every
      // node regardless of whether a given handle happens to be hidden, so
      // text spacing reads the same on a start/end node as on a plain one.
      paddingLeft: spacing.sm + HANDLE_SIZE / 2,
      paddingRight: spacing.sm + HANDLE_SIZE / 2,
      justifyContent: "center",
    },
    cardStart: { borderColor: colors.accent, borderLeftWidth: 3 },
    cardEnd: { borderColor: colors.accentSecondary, borderRightWidth: 3 },
    name: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
    startLabel: { color: colors.accent, fontSize: 9, fontWeight: "700", marginTop: 2 },
    endLabel: { color: colors.accentSecondary, fontSize: 9, fontWeight: "700", marginTop: 2 },
    // Handles are the one other deliberate circular exception (connector
    // ports read naturally as dots, same spirit as FABs/palette swatches).
    handle: {
      position: "absolute",
      top: NODE_HEIGHT / 2 - HANDLE_SIZE / 2,
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      borderRadius: HANDLE_SIZE / 2,
      borderWidth: 1.5,
      borderColor: colors.textSecondary,
      backgroundColor: colors.background,
    },
    handleLeft: { left: -HANDLE_SIZE / 2 },
    handleRight: { left: NODE_WIDTH - HANDLE_SIZE / 2 },
    handlePending: { backgroundColor: colors.accent, borderColor: colors.accent },
    handleHidden: { opacity: 0 },
    handleDimmed: { opacity: 0.35 },
  });
}
