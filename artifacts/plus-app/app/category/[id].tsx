import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";
import { useApps, getTagColor } from "@/hooks/useAppData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function CategoryDetailScreen() {
  const { id, name, color } = useLocalSearchParams<{ id: string; name: string; color: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, t, fontAr, isArabic } = useSettings();
  const isWeb = Platform.OS === "web";

  // ── Fetch all apps for this category from the API ─────────────────────────
  const { apps, loading } = useApps({ categoryId: Number(id), limit: 100 });

  const tileColor = color || "#9fbcff";

  const trending    = apps.filter(a => a.isHot);
  const byDownloads = [...apps].sort((a, b) => b.downloads - a.downloads);
  const recent      = [...apps].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  const renderAppRow = (app: typeof apps[0], index: number, list: typeof apps) => {
    const tc = getTagColor(app.tag);
    const desc = (isArabic ? app.descAr : null) || app.description || "";
    return (
      <View key={app.id}>
        <Pressable style={[styles.appRow, isArabic && { flexDirection: "row-reverse" }]}>
          <View style={[styles.appIcon, { backgroundColor: `${tc}15` }]}>
            <Feather name={(app.icon as any) || "box"} size={22} color={tc} />
          </View>
          <View style={[styles.appInfo, isArabic && { alignItems: "flex-end" }]}>
            <Text style={[styles.appName, { color: colors.text }]}>{app.name}</Text>
            <Text style={[styles.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
              {desc}
            </Text>
          </View>
          <Pressable style={[styles.getButton, { backgroundColor: colors.card }]}>
            <Text style={[styles.getButtonText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>
              {t("download")}
            </Text>
          </Pressable>
        </Pressable>
        {index < list.length - 1 && <View style={[styles.divider, { backgroundColor: colors.separator }]} />}
      </View>
    );
  };

  const renderSectionHeader = (title: string, emoji: string) => (
    <View style={[styles.sectionHeader, isArabic && { flexDirection: "row-reverse" }]}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
        {title} {emoji}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: isWeb ? 20 : insets.top }]}>
      {/* Header */}
      <View style={[styles.header, isArabic && { flexDirection: "row-reverse" }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card }]}>
          <Feather name={isArabic ? "chevron-right" : "chevron-left"} size={22} color={colors.text} />
        </Pressable>
        <View style={[styles.headerTitleWrap, { backgroundColor: tileColor }]}>
          <Text style={[styles.headerTitle, { fontFamily: fontAr("Bold") }]}>{name}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={tileColor} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: isWeb ? 34 : 100 }}
        >
          {/* Trending */}
          {trending.length > 0 && (
            <View style={styles.section}>
              {renderSectionHeader(t("trending"), "🔥")}
              <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                {trending.map((app, i) => renderAppRow(app, i, trending))}
              </View>
            </View>
          )}

          {/* Most Downloaded */}
          {byDownloads.length > 0 && (
            <View style={styles.section}>
              {renderSectionHeader(t("mostDownloaded"), "📥")}
              <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                {byDownloads.map((app, i) => renderAppRow(app, i, byDownloads))}
              </View>
            </View>
          )}

          {/* Recently Added */}
          {recent.length > 0 && (
            <View style={styles.section}>
              {renderSectionHeader(t("recentlyAdded"), "🆕")}
              <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                {recent.map((app, i) => renderAppRow(app, i, recent))}
              </View>
            </View>
          )}

          {apps.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fontAr("Medium") }]}>
                لا توجد تطبيقات في هذا التصنيف
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitleWrap: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  headerTitle: { fontSize: 18, color: "#FFF" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18 },
  sectionCard: { borderRadius: 16, paddingHorizontal: 16 },
  appRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14 },
  appIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  appInfo: { flex: 1, gap: 3 },
  appName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  appDesc: { fontSize: 12 },
  getButton: { paddingHorizontal: 22, paddingVertical: 7, borderRadius: 18 },
  getButtonText: { fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 66 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 100, gap: 16 },
  emptyText: { fontSize: 15 },
});
