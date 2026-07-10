import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { LogLineRow } from "../components/LogLineRow";
import { colors, spacing } from "../theme/colors";
import { connectJsonWs } from "../api/ws";
import { LogLine } from "../api/types";

const CATEGORIES = ["CPU", "NPU", "DSP", "FastRPC", "OpenCL", "System"] as const;
const MAX_LINES = 1000;

export function LogsScreen() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const disconnect = connectJsonWs<LogLine>("/ws/logs", (line) => {
      setLines((prev) => [...prev.slice(-(MAX_LINES - 1)), line]);
    });
    return disconnect;
  }, []);

  const toggleFilter = (category: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const filtered = useMemo(
    () => (activeFilters.size === 0 ? lines : lines.filter((l) => activeFilters.has(l.category))),
    [lines, activeFilters]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Logs</Text>
      <View style={styles.filters}>
        {CATEGORIES.map((category) => {
          const active = activeFilters.has(category);
          return (
            <Pressable
              key={category}
              onPress={() => toggleFilter(category)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{category}</Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(_, index) => String(index)}
        renderItem={({ item }) => <LogLineRow line={item} />}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", padding: spacing.md, paddingBottom: spacing.sm },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  filterChip: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 4 },
  filterChipActive: { borderColor: colors.cpu, backgroundColor: colors.cpu + "22" },
  filterText: { color: colors.textSecondary, fontSize: 11, fontFamily: "monospace" },
  filterTextActive: { color: colors.cpu },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
});
