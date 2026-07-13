import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";
import { createScreenStyles } from "../../theme/layout";

/** Honest equivalent of "view/extract app data" for this app's actual
 * persistence layer — there's no sqlite database anywhere in Trunk; every
 * zustand store (projects, flows, settings) persists through AsyncStorage. */
export function StorageInspectorScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [keys, setKeys] = useState<string[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    AsyncStorage.getAllKeys().then((k) => setKeys([...k].sort()));
  }, []);

  useFocusEffect(load);

  const toggleExpand = async (key: string) => {
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    if (!(key in values)) {
      const raw = await AsyncStorage.getItem(key);
      setValues((v) => ({ ...v, [key]: raw ?? "" }));
    }
    setExpandedKey(key);
  };

  const shareValue = async (key: string) => {
    await Share.share({ message: `${key}\n\n${values[key] ?? ""}` });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.count}>{keys.length} key(s)</Text>
      {keys.map((key) => {
        const expanded = expandedKey === key;
        return (
          <View key={key} style={styles.keyBlock}>
            <Pressable onPress={() => toggleExpand(key)} style={styles.keyRow}>
              <Text style={styles.keyLabel} numberOfLines={1}>
                {key}
              </Text>
              <Text style={styles.keyCaret}>{expanded ? "▲" : "▼"}</Text>
            </Pressable>
            {expanded ? (
              <View style={styles.valueWrap}>
                <Text style={styles.valueText} selectable>
                  {values[key] || "(empty)"}
                </Text>
                <Button label="Share / Copy" onPress={() => shareValue(key)} variant="secondary" />
              </View>
            ) : null}
          </View>
        );
      })}
      {keys.length === 0 ? <Text style={styles.empty}>No AsyncStorage keys found.</Text> : null}
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    content: { padding: spacing.md },
    count: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: spacing.sm },
    empty: { color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: spacing.lg },
    keyBlock: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.xs },
    keyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.sm },
    keyLabel: { color: colors.textPrimary, fontSize: 12, fontFamily: "monospace", flexShrink: 1, marginRight: spacing.sm },
    keyCaret: { color: colors.textSecondary, fontSize: 10 },
    valueWrap: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.sm, gap: spacing.sm },
    valueText: { color: colors.textSecondary, fontSize: 11, fontFamily: "monospace" },
  });
}
