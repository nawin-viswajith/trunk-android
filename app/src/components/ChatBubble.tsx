import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { MarkdownText } from "./MarkdownText";
import { TypingDots } from "./TypingDots";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  meta?: string;
}

export function ChatBubble({ role, content, meta }: ChatBubbleProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUser = role === "user";
  const isPending = !isUser && !content;
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={styles.column}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          {isPending ? <TypingDots /> : <MarkdownText content={content} textStyle={styles.text} />}
        </View>
        {meta ? <Text style={[styles.meta, isUser ? styles.metaUser : styles.metaAssistant]}>{meta}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: { flexDirection: "row", marginBottom: spacing.sm },
    rowUser: { justifyContent: "flex-end" },
    rowAssistant: { justifyContent: "flex-start" },
    column: { maxWidth: "82%" },
    bubble: {
      borderWidth: 1,
      padding: spacing.sm,
    },
    bubbleUser: {
      backgroundColor: colors.accent + "22",
      borderColor: colors.accent,
      borderTopWidth: 3,
      borderTopColor: colors.accent,
    },
    bubbleAssistant: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderTopColor: colors.accentSecondary,
    },
    text: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 21,
    },
    meta: {
      color: colors.running,
      fontFamily: "monospace",
      fontSize: 10,
      marginTop: spacing.xs,
    },
    metaUser: { textAlign: "right" },
    metaAssistant: { textAlign: "left" },
  });
}
