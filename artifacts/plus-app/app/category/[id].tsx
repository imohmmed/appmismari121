import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import AppIconImg from "@/components/AppIconImg";
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
    descAr: app.descAr ?? app.descriptionAr ?? undefined,
    descEn: app.descEn ?? app.descriptionEn ?? undefined,
    desc: app.description ?? undefined,
    category: app.categoryName,
    categoryNameAr: app.categoryNameAr ?? undefined,
    categoryId: app.categoryId,
    tag: app.tag,
    icon: app.icon || "box",
    catKey: app.categoryName?.toLowerCase(),
    size: app.size ?? null,
    createdAt: app.createdAt ?? null,
    bundleId: app.bundleId ?? null,
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

  const relatedApps = selectedApp
    ? apps.filter(a => a.id !== selectedApp.id).slice(0, 30).map(apiAppToDetail)
    : [];

  const renderAppRow = (app: ApiApp, index: number, list: ApiApp[]) => {
    const tc = getTagColor(app.tag);
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
              </View>
              <AppIconImg icon={app.icon} size={52} borderRadius={14} />
            </>
          ) : (
            <>
              <AppIconImg icon={app.icon} size={52} borderRadius={14} />
              <View style={[styles.appInfo, { alignItems: "flex-start" }]}>
                <Text style={[styles.appName, { color: colors.text, textAlign }]}>{app.name}</Text>
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

  const appCountText = loading ? "..." : `${apps.length}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: isWeb ? 20 : insets.top }]}>
      {/* Back button */}
      <View style={[styles.header, isArabic && { justifyContent: "flex-end" }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card }]}>
          <Feather name={isArabic ? "chevron-right" : "chevron-left"} size={22} color={colors.text} />
        </Pressable>
      </View>
      {/* Banner */}
      <View style={[styles.catBanner, { backgroundColor: tileColor }]}>
        <Text style={[styles.catBannerName, { fontFamily: fontAr("Bold") }]}>{name}</Text>
        <Text style={[styles.catBannerCount, { fontFamily: fontAr("Regular") }]}>
          {appCountText} {isArabic ? "تطبيق" : (Number(appCountText) === 1 ? "app" : "apps")}
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
          <View style={styles.appList}>
            {apps.map((app, i) => renderAppRow(app, i, apps))}

            {apps.length === 0 && (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fontAr("Medium") }]}>
                  {isArabic ? "لا توجد تطبيقات في هذا التصنيف" : "No apps in this category"}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* App Detail — slides in on top with swipe-to-dismiss */}
      <SlidePanel visible={selectedApp !== null} onClose={() => setSelectedApp(null)}>
        {selectedApp && (
          <AppDetailPanel
            app={apiAppToDetail(selectedApp)}
            onClose={() => setSelectedApp(null)}
            onCategoryPress={() => setSelectedApp(null)}
            relatedApps={relatedApps}
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
  appList: { paddingHorizontal: 20 },
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
