import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
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
import { useBackendHealth } from "../services/backendHealth";
import { BackendStatusBanner } from "../components/BackendStatusBanner";
import { getSuggestedModelBudget } from "../utils/compatibility";

type ParamBucket = "all" | "small" | "medium" | "large";

const PARAM_BUCKETS: { key: ParamBucket; label: string }[] = [
  { key: "all", label: "All" },
  { key: "small", label: "≤3B" },
  { key: "medium", label: "3-8B" },
  { key: "large", label: "8B+" },
];

function paramsToBillions(params: string | null): number | null {
  if (!params) return null;
  const n = parseFloat(params);
  return Number.isNaN(n) ? null : n;
}

function matchesBucket(item: HfModelSummary, bucket: ParamBucket): boolean {
  if (bucket === "all") return true;
  const billions = paramsToBillions(item.params);
  if (billions === null) return false;
  if (bucket === "small") return billions <= 3;
  if (bucket === "medium") return billions > 3 && billions <= 8;
  return billions > 8;
}

// A repo with no parsed param count (name doesn't follow the "8B" naming
// convention) can't be judged against the device budget - default to
// keeping it in Recommended rather than assuming it's too big to run.
function withinDeviceBudget(item: HfModelSummary, maxParamsBillion: number | null): boolean {
  if (maxParamsBillion === null) return true;
  const billions = paramsToBillions(item.params);
  if (billions === null) return true;
  return billions <= maxParamsBillion;
}

// pipeline_tag comes back as an HF slug ("text-generation") - title-case it
// for display rather than inventing a separate label map to keep in sync.
function humanizeTag(tag: string): string {
  return tag
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function HuggingFaceSearchScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HfModelSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [paramBucket, setParamBucket] = useState<ParamBucket>("all");
  const [copiedRepoId, setCopiedRepoId] = useState<string | null>(null);
  const [maxParamsBillion, setMaxParamsBillion] = useState<number | null>(null);
  const { status: backendStatus, retry: retryBackend } = useBackendHealth();
  // Both the mount-time "popular" fetch and an explicit search write to the
  // same `results` state with no inherent ordering — without this, a slower
  // popular-list request resolving after a fast explicit search would
  // silently overwrite the user's search results with the popular list.
  const requestIdRef = useRef(0);

  // No hardcoded starter list — pull real trending GGUF repos (sorted by
  // downloads, no search term) from the same endpoint a search hits, then
  // narrow to what this device can actually run so a first-time user's first
  // download isn't already doomed to OOM.
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    getSuggestedModelBudget().then((budget) => {
      if (requestIdRef.current === requestId) setMaxParamsBillion(budget?.maxParamsBillion ?? null);
    });
    huggingfaceApi
      .search("")
      .then((data) => {
        if (requestIdRef.current === requestId) setResults(data);
      })
      .catch(() => {})
      .finally(() => {
        if (requestIdRef.current === requestId) setLoadingPopular(false);
      });
  }, []);

  const search = async () => {
    if (!query.trim() || searching) return;
    const requestId = ++requestIdRef.current;
    setSearching(true);
    try {
      const data = await huggingfaceApi.search(query.trim());
      if (requestIdRef.current !== requestId) return;
      setResults(data);
      setSearched(true);
    } catch (err) {
      if (requestIdRef.current === requestId) showAlert("Search failed", String(err));
    } finally {
      if (requestIdRef.current === requestId) setSearching(false);
    }
  };

  const openRepo = (item: HfModelSummary) => navigation.navigate("Hugging Face Files", { repoId: item.repo_id, model: item });

  // Before an explicit search, "Popular" is narrowed to what this device can
  // actually run (device-budget + non-embedding filter) so a first-time
  // user's first download isn't already doomed to OOM or a model that can't
  // generate text at all. An explicit search shows everything - the user
  // asked for that repo by name, so second-guessing them here would just be
  // in the way.
  const recommendedResults = useMemo(
    () => (searched ? results : results.filter((item) => withinDeviceBudget(item, maxParamsBillion))),
    [results, searched, maxParamsBillion]
  );
  const filteredResults = useMemo(
    () => recommendedResults.filter((item) => matchesBucket(item, paramBucket)),
    [recommendedResults, paramBucket]
  );

  const copyUrl = async (item: HfModelSummary) => {
    await Clipboard.setStringAsync(item.url);
    setCopiedRepoId(item.repo_id);
    setTimeout(() => setCopiedRepoId((current) => (current === item.repo_id ? null : current)), 1500);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Search for GGUF models. Compatibility with your connected device is checked before download.</Text>
      <BackendStatusBanner status={backendStatus} onRetry={retryBackend} />
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
      {!searched ? (
        <Text style={styles.sectionLabel}>
          Recommended{maxParamsBillion !== null ? ` · up to ~${maxParamsBillion.toFixed(1)}B for your device` : ""}
        </Text>
      ) : null}
      <View style={styles.bucketRow}>
        {PARAM_BUCKETS.map((bucket) => (
          <Pressable
            key={bucket.key}
            onPress={() => setParamBucket(bucket.key)}
            style={[styles.bucketChip, paramBucket === bucket.key && { borderColor: colors.accent }]}
          >
            <Text style={[styles.bucketChipText, paramBucket === bucket.key && { color: colors.accent }]}>{bucket.label}</Text>
          </Pressable>
        ))}
      </View>
      {loadingPopular ? <IndeterminateProgressBar /> : null}
      <FlatList
        data={filteredResults}
        keyExtractor={(item) => item.repo_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openRepo(item)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.repoId}>{item.repo_id}</Text>
            <Text style={styles.meta}>
              {item.downloads.toLocaleString()} downloads · {item.likes.toLocaleString()} likes
            </Text>
            {item.params || item.pipeline_tag ? (
              <View style={styles.badgeRow}>
                {item.params ? <Text style={styles.paramBadge}>{item.params}</Text> : null}
                {item.pipeline_tag ? <Text style={styles.typeBadge}>{humanizeTag(item.pipeline_tag)}</Text> : null}
              </View>
            ) : null}
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                copyUrl(item);
              }}
              style={({ pressed }) => [styles.copyButton, pressed && styles.cardPressed]}
            >
              <Text style={styles.copyButtonText}>{copiedRepoId === item.repo_id ? "Copied!" : "Copy URL"}</Text>
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          loadingPopular ? null : (
            <Text style={styles.empty}>
              {recommendedResults.length > 0
                ? "No results in this size range - try a different filter."
                : searched
                  ? `No GGUF repos found for "${query}".`
                  : "Couldn't load recommended models - try searching instead."}
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
    subtitle: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.md },
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
    bucketRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
    bucketChip: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    bucketChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
    badgeRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
    paramBadge: {
      color: colors.accentSecondary,
      fontSize: 11,
      fontFamily: "monospace",
      borderWidth: 1,
      borderColor: colors.accentSecondary,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    typeBadge: {
      color: colors.textSecondary,
      fontSize: 11,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    copyButton: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 4, marginTop: spacing.sm },
    copyButtonText: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
  });
}
