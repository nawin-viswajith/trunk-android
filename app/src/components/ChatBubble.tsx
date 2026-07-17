import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Text } from "./Text";
import { CopyIcon } from "./CopyIcon";
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
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";
  const isPending = !isUser && !content;

  const onCopy = async () => {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={styles.column}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          {isPending ? <TypingDots /> : <MarkdownText content={content} textStyle={styles.text} />}
        </View>
        {meta ? <Text style={[styles.meta, isUser ? styles.metaUser : styles.metaAssistant]}>{meta}</Text> : null}
        {!isUser && !isPending ? (
          <Pressable onPress={onCopy} hitSlop={8} style={styles.copyButton}>
            <CopyIcon color={colors.textSecondary} size={13} />
            <Text style={styles.copyLabel}>{copied ? "Copied" : "Copy response"}</Text>
          </Pressable>
        ) : null}
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
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      alignSelf: "flex-start",
      marginTop: spacing.xs,
    },
    copyLabel: { color: colors.textSecondary, fontSize: 11 },
  });
}
