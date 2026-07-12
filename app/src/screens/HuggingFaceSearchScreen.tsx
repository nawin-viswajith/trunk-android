import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../components/Text";
import { TextInput } from "../components/TextInput";
import { Button } from "../components/Button";
import { IndeterminateProgressBar } from "../components/IndeterminateProgressBar";
import { spacing, ColorPalette } from "../theme/colors";
import { createScreenStyles } from "../theme/layout";
import { useColors } from "../theme/ThemeContext";
import { huggingfaceApi } from "../api/huggingface";
import { HfModelSummary } from "../api/types";
import { showAlert } from "../state/useAlertStore";

export function HuggingFaceSearchScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HfModelSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingPopular, setLoadingPopular] = useState(true);

  // No hardcoded starter list — pull real trending GGUF repos (sorted by
  // downloads, no search term) from the same endpoint a search hits.
  useEffect(() => {
    huggingfaceApi
      .search("")
      .then(setResults)
      .catch(() => {})
      .finally(() => setLoadingPopular(false));
  }, []);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await huggingfaceApi.search(query.trim()));
      setSearched(true);
    } catch (err) {
      showAlert("Search failed", String(err));
    } finally {
      setSearching(false);
    }
  };

  const openRepo = (repoId: string) => navigation.navigate("Hugging Face Files", { repoId });

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Search for GGUF models. Compatibility with your connected device is checked before download.</Text>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          placeholder="qwen2.5-coder, phi-4, gemma..."
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoCapitalize="none"
        />
        <Button label="Search" onPress={search} loading={searching} />
      </View>
      {!searched ? <Text style={styles.sectionLabel}>Popular</Text> : null}
      {loadingPopular ? <IndeterminateProgressBar /> : null}
      <FlatList
        data={results}
        keyExtractor={(item) => item.repo_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openRepo(item.repo_id)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.repoId}>{item.repo_id}</Text>
            <Text style={styles.meta}>
              {item.downloads.toLocaleString()} downloads · {item.likes.toLocaleString()} likes
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          loadingPopular ? null : (
            <Text style={styles.empty}>
              {searched ? `No GGUF repos found for "${query}".` : "Couldn't load popular models - try searching instead."}
            </Text>
          )
        }
      />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: { ...screen.container, padding: spacing.md },
    subtitle: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.md, textAlign: "justify" },
    sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: spacing.xs },
    searchRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
    },
    list: { paddingBottom: spacing.lg },
    card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, marginBottom: spacing.sm },
    cardPressed: { backgroundColor: colors.surfaceAlt },
    repoId: { color: colors.accentTertiary, fontWeight: "600", fontSize: 14, marginBottom: spacing.xs },
    meta: { color: colors.textSecondary, fontSize: 12, fontFamily: "monospace" },
    empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
}
