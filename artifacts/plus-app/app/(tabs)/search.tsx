import { Feather } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import AppIconImg from "@/components/AppIconImg";
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";
import { useCategories, useApps, getCategoryColor, getTagColor, type ApiApp } from "@/hooks/useAppData";
import AppDetailPanel from "@/components/AppDetailPanel";
import SlidePanel from "@/components/SlidePanel";
import { emitOpenCategory } from "@/utils/openCategorySignal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function apiAppToDetail(app: ApiApp) {
  return {
    id: app.id,
    name: app.name,
    descAr: app.descAr ?? undefined,
    descEn: app.description ?? undefined,
    desc: app.description ?? undefined,
    category: app.categoryName,
    categoryNameAr: app.categoryNameAr ?? undefined,
    categoryId: app.categoryId,
    tag: app.tag,
    icon: app.icon || "box",
    catKey: app.categoryName?.toLowerCase(),
    size: app.size ?? null,
    createdAt: app.createdAt ?? null,
  };
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);
  const { colors, t, fontAr, isArabic } = useSettings();
  const appFont = (name: string) => /[\u0600-\u06FF]/.test(name) ? fontAr("SemiBold") : "Inter_600SemiBold";

  const [selectedApp, setSelectedApp] = useState<ApiApp | null>(null);

  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as any, () => {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 100);
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener("focus" as any, () => {
      setTimeout(() => inputRef.current?.focus(), 100);
    });
    return unsub;
  }, [navigation]);

  const { categories, loading: catsLoading } = useCategories();
  const { apps: searchResults, loading: searchLoading } = useApps({
    search: query,
    limit: 30,
    skip: query.length < 2,
  });

  const { apps: relatedCategoryApps } = useApps({
    categoryId: selectedApp?.categoryId,
    limit: 31,
    skip: !selectedApp?.categoryId,
  });
  const relatedAppsMapped = selectedApp
    ? relatedCategoryApps.filter(a => a.id !== selectedApp.id).slice(0, 30).map(apiAppToDetail)
    : [];

  const isSearching = query.length >= 2;
  const clearQuery = useCallback(() => setQuery(""), []);

  function openCategory(catId: number) {
    setSelectedApp(null);
    emitOpenCategory(catId);
    router.navigate("/(tabs)/");
  }

  const renderAppRow = (app: ApiApp, index: number, list: ApiApp[]) => {
    const tc = getTagColor(app.tag);
    const desc = isArabic ? (app.descAr || app.descriptionAr || app.description || "") : (app.descEn || app.descriptionEn || app.description || "");
    const textAlign = isArabic ? ("right" as const) : ("left" as const);
    return (
      <View key={app.id}>
        <Pressable
          style={[styles.appRow, !isArabic && { flexDirection: "row" }]}
          onPress={() => setSelectedApp(app)}
        >
          {isArabic ? (
            <>
              <View style={[styles.getButton, { backgroundColor: colors.card }]}>
                <Text style={[styles.getButtonText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
              </View>
              <View style={[styles.appInfo, { alignItems: "flex-end" }]}>
                <Text style={[styles.appName, { color: colors.text, textAlign, fontFamily: appFont(app.name) }]}>{app.name}</Text>
                <Text style={[styles.appCategory, { color: colors.tint, fontFamily: fontAr("Regular"), textAlign }]}>{app.categoryNameAr || app.categoryName}</Text>
                <Text style={[styles.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign }]}>{desc}</Text>
              </View>
              <AppIconImg icon={app.icon} size={52} borderRadius={14} />
            </>
          ) : (
            <>
              <AppIconImg icon={app.icon} size={52} borderRadius={14} />
              <View style={[styles.appInfo, { alignItems: "flex-start" }]}>
                <Text style={[styles.appName, { color: colors.text, textAlign, fontFamily: appFont(app.name) }]}>{app.name}</Text>
                <Text style={[styles.appCategory, { color: colors.tint, fontFamily: fontAr("Regular"), textAlign }]}>{app.categoryName}</Text>
                <Text style={[styles.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign }]}>{desc}</Text>
              </View>
              <View style={[styles.getButton, { backgroundColor: colors.card }]}>
                <Text style={[styles.getButtonText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
              </View>
            </>
          )}
        </Pressable>
        {index < list.length - 1 && <View style={[styles.divider, { backgroundColor: colors.separator }]} />}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, isArabic && { alignItems: "flex-end" }]}>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold"), textAlign: isArabic ? "right" : "left" }]}>
          {t("headerSearch")}
        </Text>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.card }, isArabic && { flexDirection: "row-reverse" }]}>
        <Feather name="search" size={18} color={colors.textSecondary} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: colors.text, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]}
          placeholder={t("searchAppPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={clearQuery}>
            <Feather name="x-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 80 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {isSearching ? (
          <View style={styles.resultsContainer}>
            {searchLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={colors.tint} />
              </View>
            ) : searchResults.length > 0 ? (
              searchResults.map((app, i) => renderAppRow(app, i, searchResults))
            ) : (
              <View style={styles.emptyState}>
                <Feather name="search" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fontAr("Medium") }]}>
                  {t("noResults")}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.categoriesContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold"), textAlign: isArabic ? "right" : "left" }]}>
              {t("sections")}
            </Text>
            {catsLoading ? (
              <ActivityIndicator color={colors.tint} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.catGrid}>
                {categories.map((cat) => {
                  const color = getCategoryColor(cat.id);
                  const isEmoji = cat.icon && cat.icon.length <= 2;
                  const catLabel = isArabic ? (cat.nameAr || cat.name) : (cat.name || cat.nameAr);
                  return (
                    <Pressable
                      key={cat.id}
                      style={[styles.catCard, { backgroundColor: color }]}
                      onPress={() => openCategory(cat.id)}
                    >
                      <View style={[styles.catCardIconWrap, isArabic ? { left: 16, right: undefined } : { right: 16 }]}>
                        {isEmoji ? (
                          <Text style={{ fontSize: 28, opacity: 0.8 }}>{cat.icon}</Text>
                        ) : (
                          <Feather name={(cat.icon as any) || "grid"} size={28} color="rgba(255,255,255,0.7)" />
                        )}
                      </View>
                      <Text style={[styles.catCardLabel, { fontFamily: fontAr("Bold"), textAlign: isArabic ? "right" : "left" }]}>
                        {catLabel}
                      </Text>
                      <Text style={[styles.catAppCount, { fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]}>
                        {cat.appCount} {isArabic ? "تطبيق" : (cat.appCount === 1 ? "app" : "apps")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* App detail from search results */}
      <SlidePanel visible={selectedApp !== null} onClose={() => setSelectedApp(null)}>
        {selectedApp && (
          <AppDetailPanel
            app={apiAppToDetail(selectedApp)}
            onClose={() => setSelectedApp(null)}
            onCategoryPress={() => {
              if (selectedApp?.categoryId) {
                openCategory(selectedApp.categoryId);
              }
            }}
            relatedApps={relatedAppsMapped}
          />
        )}
      </SlidePanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 28 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15 },
  categoriesContainer: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 20, marginBottom: 16, paddingHorizontal: 4 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  catCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 120,
    borderRadius: 16,
    padding: 16,
    justifyContent: "flex-end",
  },
  catCardIconWrap: { position: "absolute", top: 16 },
  catCardLabel: { fontSize: 15, color: "#FFF" },
  catAppCount: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  resultsContainer: { paddingHorizontal: 20 },
  appRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14 },
  appIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  appInfo: { flex: 1, gap: 3, justifyContent: "center" },
  appName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  appCategory: { fontSize: 12, marginTop: 1 },
  appDesc: { fontSize: 12 },
  getButton: { paddingHorizontal: 22, paddingVertical: 7, borderRadius: 18 },
  getButtonText: { fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 66 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 15 },
});
