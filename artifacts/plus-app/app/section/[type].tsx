import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";
import { ALL_APPS } from "@/constants/apps";

const ICON_COLORS: Record<string, string> = {
  "message-circle": "#25D366",
  camera: "#FFFC00",
  instagram: "#E1306C",
  video: "#010101",
  send: "#0088CC",
  twitter: "#1DA1F2",
  cpu: "#10A37F",
  zap: "#7B61FF",
  star: "#4285F4",
  scissors: "#000000",
  edit: "#00C4CC",
  aperture: "#31A8FF",
  crosshair: "#F2A900",
  box: "#62B47A",
  play: "#E2231A",
  youtube: "#FF0000",
  music: "#1DB954",
  headphones: "#FF5500",
  film: "#E50914",
  "play-circle": "#113CCF",
  tv: "#00B140",
  terminal: "#147EFB",
  code: "#333333",
  "file-text": "#3776AB",
};

const SECTION_EMOJI: Record<string, string> = {
  trending: "🔥",
  mostDownloaded: "📥",
  recentlyAdded: "🆕",
};

function getAppsForSection(type: string) {
  switch (type) {
    case "trending":
      return ALL_APPS.filter((a) => a.isHot);
    case "mostDownloaded":
      return [...ALL_APPS].sort((a, b) => b.downloadCount - a.downloadCount).slice(0, 30);
    case "recentlyAdded":
      return [...ALL_APPS].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()).slice(0, 10);
    default:
      return [];
  }
}

export default function SectionDetailScreen() {
  const { type, title } = useLocalSearchParams<{ type: string; title: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, t, fontAr, isArabic } = useSettings();
  const isWeb = Platform.OS === "web";

  const apps = getAppsForSection(type);
  const emoji = SECTION_EMOJI[type] || "";

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 100 }}
      >
        <View style={[styles.listCard, { backgroundColor: colors.card }]}>
          {apps.map((app, index) => {
            const iconColor = ICON_COLORS[app.icon] || colors.tint;
            return (
              <View key={app.id}>
                <Pressable style={[styles.appRow, isArabic && { flexDirection: "row-reverse" }]}>
                  <View style={[styles.appIcon, { backgroundColor: `${iconColor}15` }]}>
                    <Feather name={app.icon as any} size={22} color={iconColor} />
                  </View>
                  <View style={[styles.appInfo, isArabic && { alignItems: "flex-end" }]}>
                    <Text style={[styles.appName, { color: colors.text }]}>{app.name}</Text>
                    <Text style={[styles.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                      {isArabic ? app.descAr : app.descEn}
                    </Text>
                  </View>
                  <Pressable style={[styles.getButton, { backgroundColor: colors.background }]}>
                    <Text style={[styles.getButtonText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>
                      {t("download")}
                    </Text>
                  </Pressable>
                </Pressable>
                {index < apps.length - 1 && <View style={[styles.divider, { backgroundColor: colors.separator }]} />}
              </View>
            );
          })}
        </View>
      </ScrollView>
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
});
