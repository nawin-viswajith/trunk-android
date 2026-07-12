import React, { useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { huggingfaceApi } from "../api/huggingface";
import { HfModelSummary } from "../api/types";

export function HuggingFaceSearchScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HfModelSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await huggingfaceApi.search(query.trim()));
      setSearched(true);
    } catch (err) {
      Alert.alert("Search failed", String(err));
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Browse Hugging Face</Text>
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
      <FlatList
        data={results}
        keyExtractor={(item) => item.repo_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text
              style={styles.repoId}
              onPress={() => navigation.navigate("Hugging Face Files", { repoId: item.repo_id })}
            >
              {item.repo_id}
            </Text>
            <Text style={styles.meta}>
              {item.downloads.toLocaleString()} downloads · {item.likes.toLocaleString()} likes
            </Text>
          </View>
        )}
        ListEmptyComponent={
          searched ? <Text style={styles.empty}>No GGUF repos found for "{query}".</Text> : null
        }
      />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
    subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs, marginBottom: spacing.md },
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
    repoId: { color: colors.cpu, fontWeight: "600", fontSize: 14, marginBottom: spacing.xs },
    meta: { color: colors.textSecondary, fontSize: 12, fontFamily: "monospace" },
    empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
}
