import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import AppIconImg from "@/components/AppIconImg";
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
import GlassBackButton from "@/components/GlassBackButton";

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

type Props = {
  categoryId: number;
  categoryName?: string;
  categoryNameAr?: string;
  color?: string;
  onClose: () => void;
};

export default function CategorySlideContent({
  categoryId,
  categoryName,
  categoryNameAr,
  color = "#9fbcff",
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { colors, t, fontAr, isArabic } = useSettings();

  const { apps, loading } = useApps({ categoryId, limit: 100 });
  const [selectedApp, setSelectedApp] = useState<ApiApp | null>(null);

  const catLabel = isArabic ? (categoryNameAr || categoryName || "") : (categoryName || categoryNameAr || "");
  const textAlign = isArabic ? ("right" as const) : ("left" as const);

  const relatedApps = selectedApp
    ? apps.filter(a => a.id !== selectedApp.id).slice(0, 30).map(apiAppToDetail)
    : [];

  return (
    <View style={[st.container, { paddingTop: isWeb ? 67 : insets.top, backgroundColor: colors.background }]}>
      <View style={[st.header, isArabic && { flexDirection: "row", justifyContent: "flex-end" }]}>
        <GlassBackButton onPress={onClose} />
      </View>

      <View style={[st.banner, { backgroundColor: color }]}>
        <Text style={[st.bannerName, { fontFamily: fontAr("Bold") }]}>{catLabel}</Text>
        <Text style={[st.bannerCount, { fontFamily: fontAr("Regular") }]}>
          {apps.length} {isArabic ? "تطبيق" : (apps.length === 1 ? "app" : "apps")}
        </Text>
      </View>

      {loading ? (
        <View style={st.loading}>
          <ActivityIndicator color={color} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: isWeb ? 34 : 80 }}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={st.list}>
            {apps.map((app, idx) => {
              const tc = getTagColor(app.tag);
              const desc = (isArabic ? app.descAr : null) || app.description || "";
              return (
                <View key={app.id}>
                  <Pressable
                    style={[st.appRow, !isArabic && { flexDirection: "row" }]}
                    onPress={() => setSelectedApp(app)}
                  >
                    {isArabic ? (
                      <>
                        <View style={[st.getBtn, { backgroundColor: colors.card }]}>
                          <Text style={[st.getBtnText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
                        </View>
                        <View style={[st.appInfo, { alignItems: "flex-end" }]}>
                          <Text style={[st.appName, { color: colors.text, textAlign }]}>{app.name}</Text>
                          <Text style={[st.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign }]}>{desc}</Text>
                        </View>
                        <AppIconImg icon={app.icon} size={52} borderRadius={14} />
                      </>
                    ) : (
                      <>
                        <AppIconImg icon={app.icon} size={52} borderRadius={14} />
                        <View style={[st.appInfo, { alignItems: "flex-start" }]}>
                          <Text style={[st.appName, { color: colors.text, textAlign }]}>{app.name}</Text>
                          <Text style={[st.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign }]}>{desc}</Text>
                        </View>
                        <View style={[st.getBtn, { backgroundColor: colors.card }]}>
                          <Text style={[st.getBtnText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
                        </View>
                      </>
                    )}
                  </Pressable>
                  {idx < apps.length - 1 && (
                    <View style={[st.divider, { backgroundColor: colors.separator }]} />
                  )}
                </View>
              );
            })}
            {apps.length === 0 && (
              <View style={st.empty}>
                <Feather name="inbox" size={40} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontFamily: fontAr("Medium"), marginTop: 12, fontSize: 15 }}>
                  لا توجد تطبيقات
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

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

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 8 },
  banner: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  bannerName: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 4 },
  bannerCount: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { paddingHorizontal: 16 },
  appRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  appIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  appInfo: { flex: 1, gap: 2 },
  appName: { fontSize: 15, fontWeight: "600" },
  appDesc: { fontSize: 12, numberOfLines: 1 } as any,
  getBtn: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  getBtnText: { fontSize: 14, fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  empty: { alignItems: "center", paddingVertical: 48 },
});
