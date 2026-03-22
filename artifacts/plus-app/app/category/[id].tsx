import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
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
import { useApps, getTagColor, type ApiApp } from "@/hooks/useAppData";
import AppDetailPanel from "@/components/AppDetailPanel";
import SlidePanel from "@/components/SlidePanel";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function apiAppToDetail(app: ApiApp) {
  return {
    id: app.id,
    name: app.name,
    descAr: app.descAr ?? undefined,
    descEn: app.description ?? undefined,
    desc: app.description ?? undefined,
    category: app.categoryName,
    tag: app.tag,
    icon: app.icon || "box",
    catKey: app.categoryName?.toLowerCase(),
  };
}

export default function CategoryDetailScreen() {
  const { id, name, color } = useLocalSearchParams<{ id: string; name: string; color: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, t, fontAr, isArabic } = useSettings();
  const isWeb = Platform.OS === "web";

  const { apps, loading } = useApps({ categoryId: Number(id), limit: 100 });
  const [selectedApp, setSelectedApp] = useState<ApiApp | null>(null);

  const tileColor = color || "#9fbcff";

  const trending    = apps.filter(a => a.isHot);
  const byDownloads = [...apps].sort((a, b) => b.downloads - a.downloads);
  const recent      = [...apps].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  const relatedApps = selectedApp
    ? apps.filter(a => a.id !== selectedApp.id).slice(0, 9).map(apiAppToDetail)
    : [];

  const renderAppRow = (app: ApiApp, index: number, list: ApiApp[]) => {
    const tc = getTagColor(app.tag);
    const desc = (isArabic ? app.descAr : null) || app.description || "";
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
                <Text style={[styles.appName, { color: colors.text, textAlign }]}>{app.name}</Text>
                <Text style={[styles.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign }]}>{desc}</Text>
              </View>
              <View style={[styles.appIcon, { backgroundColor: `${tc}15` }]}>
                <Feather name={(app.icon as any) || "box"} size={22} color={tc} />
              </View>
            </>
          ) : (
            <>
              <View style={[styles.appIcon, { backgroundColor: `${tc}15` }]}>
                <Feather name={(app.icon as any) || "box"} size={22} color={tc} />
              </View>
              <View style={[styles.appInfo, { alignItems: "flex-start" }]}>
                <Text style={[styles.appName, { color: colors.text, textAlign }]}>{app.name}</Text>
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

  const renderSectionHeader = (title: string, emoji: string) => (
    <View style={[styles.sectionHeader, isArabic && { flexDirection: "row-reverse" }]}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
        {title} {emoji}
      </Text>
    </View>
  );

  const appCountText = loading ? "..." : `${apps.length}`; 

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: isWeb ? 20 : insets.top }]}>
      {/* Back button */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card }]}>
          <Feather name={isArabic ? "chevron-right" : "chevron-left"} size={22} color={colors.text} />
        </Pressable>
      </View>
      {/* Banner */}
      <View style={[styles.catBanner, { backgroundColor: tileColor }]}>
        <Text style={[styles.catBannerName, { fontFamily: fontAr("Bold") }]}>{name}</Text>
        <Text style={[styles.catBannerCount, { fontFamily: fontAr("Regular") }]}>
          {appCountText} {isArabic ? "تطبيق" : "app"}
        </Text>
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
          {trending.length > 0 && (
            <View style={styles.section}>
              {renderSectionHeader(t("trending"), "🔥")}
              <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                {trending.map((app, i) => renderAppRow(app, i, trending))}
              </View>
            </View>
          )}

          {byDownloads.length > 0 && (
            <View style={styles.section}>
              {renderSectionHeader(t("mostDownloaded"), "📥")}
              <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                {byDownloads.map((app, i) => renderAppRow(app, i, byDownloads))}
              </View>
            </View>
          )}

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

      {/* App Detail — slides in on top with swipe-to-dismiss */}
      <SlidePanel visible={selectedApp !== null} onClose={() => setSelectedApp(null)}>
        {selectedApp && (
          <AppDetailPanel
            app={apiAppToDetail(selectedApp)}
            onClose={() => setSelectedApp(null)}
            relatedApps={relatedApps}
            onRelatedAppPress={(a) => {
              const found = apps.find(x => x.id === a.id);
              if (found) setSelectedApp(found);
            }}
          />
        )}
      </SlidePanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  catBanner: {
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  catBannerName: { fontSize: 22, color: "#FFF", textAlign: "center" },
  catBannerCount: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4, textAlign: "center" },
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
