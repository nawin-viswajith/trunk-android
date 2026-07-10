import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { LogLine } from "../api/types";

const CATEGORY_COLOR: Record<string, string> = {
  CPU: colors.cpu,
  NPU: colors.npu,
  DSP: colors.npu,
  FastRPC: colors.npu,
  OpenCL: colors.gpu,
  System: colors.textSecondary,
};

const LEVEL_COLOR: Record<string, string> = {
  INFO: colors.textPrimary,
  WARNING: colors.warning,
  ERROR: colors.error,
};

export function LogLineRow({ line }: { line: LogLine }) {
  const categoryColor = CATEGORY_COLOR[line.category] ?? colors.textSecondary;
  const levelColor = LEVEL_COLOR[line.level] ?? colors.textPrimary;
  const time = new Date(line.timestamp * 1000).toLocaleTimeString();
  return (
    <View style={styles.row}>
      <Text style={styles.time}>{time}</Text>
      <Text style={[styles.category, { color: categoryColor }]}>{line.category}</Text>
      <Text style={[styles.message, { color: levelColor }]} numberOfLines={4}>
        {line.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 4,
  },
  time: {
    color: colors.textSecondary,
    fontFamily: "monospace",
    fontSize: 11,
    marginRight: 8,
  },
  category: {
    fontFamily: "monospace",
    fontSize: 11,
    width: 60,
  },
  message: {
    fontFamily: "monospace",
    fontSize: 12,
    flex: 1,
  },
});
