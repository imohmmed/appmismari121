import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

const SECTION_EMOJI: Record<string, string> = {
  trending: "🔥",
  mostDownloaded: "📥",
  recentlyAdded: "🆕",
};

function sectionTypeToApi(type: string): "trending" | "most_downloaded" | "latest" | undefined {
  switch (type) {
    case "trending":      return "trending";
    case "mostDownloaded": return "most_downloaded";
    case "recentlyAdded": return "latest";
    default:              return undefined;
  }
}

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

export default function SectionDetailScreen() {
  const { type, title } = useLocalSearchParams<{ type: string; title: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, t, fontAr, isArabic } = useSettings();
  const isWeb = Platform.OS === "web";

  const apiSection = sectionTypeToApi(type);
  const { apps, loading } = useApps({ section: apiSection, limit: 50 });
  const [selectedApp, setSelectedApp] = useState<ApiApp | null>(null);

  const emoji = SECTION_EMOJI[type] || "";

  const relatedApps = selectedApp
    ? apps.filter(a => a.id !== selectedApp.id).slice(0, 9).map(apiAppToDetail)
    : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: isWeb ? 20 : insets.top }]}>
      <View style={[styles.header, isArabic && { flexDirection: "row-reverse" }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card }]}>
          <Feather name={isArabic ? "chevron-right" : "chevron-left"} size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
          {title} {emoji}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.tint} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: isWeb ? 34 : 100 }}
        >
          <View style={[styles.listCard, { backgroundColor: colors.card }]}>
            {apps.map((app, index) => {
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
                        <View style={[styles.getButton, { backgroundColor: colors.background }]}>
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
                        <View style={[styles.getButton, { backgroundColor: colors.background }]}>
                          <Text style={[styles.getButtonText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
                        </View>
                      </>
                    )}
                  </Pressable>
                  {index < apps.length - 1 && <View style={[styles.divider, { backgroundColor: colors.separator }]} />}
                </View>
              );
            })}

            {apps.length === 0 && (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={40} color={colors.textSecondary} />
                <Text style={[{ color: colors.textSecondary, fontFamily: fontAr("Medium"), marginTop: 12, fontSize: 15 }]}>
                  لا توجد تطبيقات
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
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    textAlign: "center",
  },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  listCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  appIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  appInfo: {
    flex: 1,
    gap: 3,
  },
  appName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  appDesc: {
    fontSize: 12,
  },
  getButton: {
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 18,
  },
  getButtonText: {
    fontSize: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
});
