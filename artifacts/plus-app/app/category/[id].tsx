import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CATEGORY_APPS: Record<string, Array<{ id: number; name: string; descAr: string; descEn: string; icon: any; iconBg: string; downloads: number; trending: boolean; recent: boolean }>> = {
  social: [
    { id: 1, name: "WhatsApp++", descAr: "ميزات مخفية مفعّلة", descEn: "Hidden features unlocked", icon: "message-circle", iconBg: "#25D366", downloads: 15200, trending: true, recent: false },
    { id: 2, name: "Snapchat++", descAr: "حفظ السنابات والقصص", descEn: "Save snaps & stories", icon: "camera", iconBg: "#FFFC00", downloads: 12800, trending: true, recent: false },
    { id: 3, name: "Instagram++", descAr: "تحميل القصص والريلز", descEn: "Download stories & reels", icon: "instagram", iconBg: "#E1306C", downloads: 14500, trending: true, recent: false },
    { id: 4, name: "TikTok++", descAr: "بدون إعلانات، تحميل الفيديو", descEn: "No ads, video download", icon: "video", iconBg: "#010101", downloads: 11000, trending: false, recent: true },
    { id: 5, name: "Telegram++", descAr: "ميزات بريميوم مجانية", descEn: "Free premium features", icon: "send", iconBg: "#0088CC", downloads: 9800, trending: false, recent: false },
    { id: 6, name: "Twitter++", descAr: "تحميل الفيديوهات والثريدات", descEn: "Download videos & threads", icon: "twitter", iconBg: "#1DA1F2", downloads: 8500, trending: false, recent: true },
  ],
  ai: [
    { id: 7, name: "ChatGPT Pro", descAr: "وصول GPT-4 مفعّل", descEn: "GPT-4 access unlocked", icon: "cpu", iconBg: "#10A37F", downloads: 18000, trending: true, recent: true },
    { id: 8, name: "Copilot+", descAr: "مساعد برمجة بالذكاء الاصطناعي", descEn: "AI coding assistant", icon: "zap", iconBg: "#7B61FF", downloads: 9200, trending: true, recent: false },
    { id: 9, name: "Gemini Pro", descAr: "Google AI بريميوم", descEn: "Google AI Premium", icon: "star", iconBg: "#4285F4", downloads: 11500, trending: false, recent: true },
    { id: 25, name: "Claude Pro", descAr: "ذكاء اصطناعي متقدم", descEn: "Advanced AI assistant", icon: "message-square", iconBg: "#D97757", downloads: 7800, trending: true, recent: true },
  ],
  edit: [
    { id: 10, name: "CapCut Pro", descAr: "أدوات تعديل متقدمة", descEn: "Advanced editing tools", icon: "scissors", iconBg: "#000000", downloads: 13000, trending: true, recent: false },
    { id: 11, name: "Canva Pro", descAr: "جميع القوالب مفتوحة", descEn: "All templates unlocked", icon: "edit", iconBg: "#00C4CC", downloads: 10500, trending: true, recent: false },
    { id: 12, name: "Lightroom++", descAr: "فلاتر بريميوم مجانية", descEn: "Free premium filters", icon: "aperture", iconBg: "#31A8FF", downloads: 8900, trending: false, recent: true },
    { id: 26, name: "Premiere Pro", descAr: "محرر فيديو احترافي", descEn: "Professional video editor", icon: "film", iconBg: "#9999FF", downloads: 7200, trending: false, recent: true },
  ],
  games: [
    { id: 13, name: "PUBG Hack", descAr: "تصويب تلقائي و ESP", descEn: "Aimbot & ESP", icon: "crosshair", iconBg: "#F2A900", downloads: 16000, trending: true, recent: false },
    { id: 14, name: "Minecraft+", descAr: "جميع السكنات مفتوحة", descEn: "All skins unlocked", icon: "box", iconBg: "#62B47A", downloads: 14200, trending: true, recent: false },
    { id: 15, name: "Roblox Mod", descAr: "روبوكس غير محدود", descEn: "Unlimited Robux", icon: "play", iconBg: "#E2231A", downloads: 13500, trending: false, recent: true },
    { id: 27, name: "GTA San Andreas", descAr: "نقود غير محدودة", descEn: "Unlimited money", icon: "map", iconBg: "#FF6600", downloads: 9100, trending: false, recent: true },
  ],
  tweaked: [
    { id: 16, name: "YouTube Premium", descAr: "بدون إعلانات، تشغيل بالخلفية", descEn: "No ads, background play", icon: "youtube", iconBg: "#FF0000", downloads: 19000, trending: true, recent: false },
    { id: 17, name: "Spotify++", descAr: "ميزات بريميوم مجانية", descEn: "Free premium features", icon: "music", iconBg: "#1DB954", downloads: 17500, trending: true, recent: false },
    { id: 18, name: "SoundCloud++", descAr: "تحميل بدون إنترنت", descEn: "Offline download", icon: "headphones", iconBg: "#FF5500", downloads: 6800, trending: false, recent: true },
  ],
  tv: [
    { id: 19, name: "Netflix", descAr: "جميع المحتوى مفتوح", descEn: "All content unlocked", icon: "film", iconBg: "#E50914", downloads: 20000, trending: true, recent: false },
    { id: 20, name: "Disney+", descAr: "ديزني و مارفل مباشر", descEn: "Disney & Marvel streaming", icon: "play-circle", iconBg: "#113CCF", downloads: 15000, trending: true, recent: false },
    { id: 21, name: "Shahid VIP", descAr: "محتوى عربي بريميوم", descEn: "Premium Arabic content", icon: "tv", iconBg: "#00B140", downloads: 12000, trending: false, recent: true },
  ],
  develop: [
    { id: 22, name: "Xcode Helper", descAr: "أدوات تطوير iOS", descEn: "iOS dev tools", icon: "terminal", iconBg: "#147EFB", downloads: 5200, trending: true, recent: true },
    { id: 23, name: "iSH Shell", descAr: "طرفية لينكس على iOS", descEn: "Linux terminal on iOS", icon: "code", iconBg: "#333333", downloads: 4800, trending: false, recent: true },
    { id: 24, name: "Pythonista+", descAr: "بايثون IDE بريميوم", descEn: "Premium Python IDE", icon: "file-text", iconBg: "#3776AB", downloads: 4200, trending: false, recent: false },
  ],
};

export default function CategoryDetailScreen() {
  const { id, name, color } = useLocalSearchParams<{ id: string; name: string; color: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, t, fontAr, isArabic } = useSettings();
  const isWeb = Platform.OS === "web";

  const apps = CATEGORY_APPS[id] || [];
  const trendingApps = apps.filter((a) => a.trending);
  const mostDownloaded = [...apps].sort((a, b) => b.downloads - a.downloads);
  const recentApps = apps.filter((a) => a.recent);

  const renderAppRow = (app: (typeof apps)[0], index: number, list: typeof apps) => (
    <View key={app.id}>
      <Pressable style={[styles.appRow, isArabic && { flexDirection: "row-reverse" }]}>
        <View style={[styles.appIcon, { backgroundColor: `${app.iconBg}15` }]}>
          <Feather name={app.icon} size={22} color={app.iconBg} />
        </View>
        <View style={[styles.appInfo, isArabic && { alignItems: "flex-end" }]}>
          <Text style={[styles.appName, { color: colors.text }]}>{app.name}</Text>
          <Text style={[styles.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
            {isArabic ? app.descAr : app.descEn}
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

  const renderSectionHeader = (title: string, emoji: string) => (
    <View style={[styles.sectionHeader, isArabic && { flexDirection: "row-reverse" }]}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
        {title} {emoji}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: isWeb ? 20 : insets.top }]}>
      <View style={[styles.header, isArabic && { flexDirection: "row-reverse" }]}>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card }]}>
          <Feather name={isArabic ? "chevron-right" : "chevron-left"} size={22} color={colors.text} />
        </Pressable>
        <View style={[styles.headerTitleWrap, { backgroundColor: color || colors.tint }]}>
          <Text style={[styles.headerTitle, { fontFamily: fontAr("Bold") }]}>{name}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 100 }}
      >
        {trendingApps.length > 0 && (
          <View style={styles.section}>
            {renderSectionHeader(t("trending"), "🔥")}
            <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
              {trendingApps.map((app, i) => renderAppRow(app, i, trendingApps))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          {renderSectionHeader(t("mostDownloaded"), "📥")}
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            {mostDownloaded.map((app, i) => renderAppRow(app, i, mostDownloaded))}
          </View>
        </View>

        {recentApps.length > 0 && (
          <View style={styles.section}>
            {renderSectionHeader(t("recentlyAdded"), "🆕")}
            <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
              {recentApps.map((app, i) => renderAppRow(app, i, recentApps))}
            </View>
          </View>
        )}
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
  headerTitleWrap: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    color: "#FFF",
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
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
