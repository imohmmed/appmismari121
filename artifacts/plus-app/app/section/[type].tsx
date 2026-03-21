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

type AppItem = {
  id: number;
  name: string;
  descAr: string;
  descEn: string;
  icon: string;
  iconBg: string;
};

const SECTION_APPS: Record<string, AppItem[]> = {
  trending: [
    { id: 1, name: "WhatsApp++", descAr: "ميزات مخفية مفعّلة", descEn: "Hidden features unlocked", icon: "message-circle", iconBg: "#25D366" },
    { id: 2, name: "Snapchat++", descAr: "حفظ السنابات والقصص", descEn: "Save snaps & stories", icon: "camera", iconBg: "#FFFC00" },
    { id: 3, name: "Instagram++", descAr: "تحميل القصص والريلز", descEn: "Download stories & reels", icon: "instagram", iconBg: "#E1306C" },
    { id: 4, name: "TikTok++", descAr: "بدون إعلانات، تحميل الفيديو", descEn: "No ads, video download", icon: "video", iconBg: "#010101" },
    { id: 7, name: "ChatGPT Pro", descAr: "وصول GPT-4 مفعّل", descEn: "GPT-4 access unlocked", icon: "cpu", iconBg: "#10A37F" },
    { id: 10, name: "CapCut Pro", descAr: "أدوات تعديل متقدمة", descEn: "Advanced editing tools", icon: "scissors", iconBg: "#000000" },
    { id: 13, name: "PUBG Hack", descAr: "تصويب تلقائي و ESP", descEn: "Aimbot & ESP", icon: "crosshair", iconBg: "#F2A900" },
    { id: 16, name: "YouTube Premium", descAr: "بدون إعلانات، تشغيل بالخلفية", descEn: "No ads, background play", icon: "youtube", iconBg: "#FF0000" },
    { id: 17, name: "Spotify++", descAr: "ميزات بريميوم مجانية", descEn: "Free premium features", icon: "music", iconBg: "#1DB954" },
    { id: 19, name: "Netflix", descAr: "جميع المحتوى مفتوح", descEn: "All content unlocked", icon: "film", iconBg: "#E50914" },
  ],
  mostDownloaded: [
    { id: 19, name: "Netflix", descAr: "جميع المحتوى مفتوح", descEn: "All content unlocked", icon: "film", iconBg: "#E50914" },
    { id: 16, name: "YouTube Premium", descAr: "بدون إعلانات، تشغيل بالخلفية", descEn: "No ads, background play", icon: "youtube", iconBg: "#FF0000" },
    { id: 7, name: "ChatGPT Pro", descAr: "وصول GPT-4 مفعّل", descEn: "GPT-4 access unlocked", icon: "cpu", iconBg: "#10A37F" },
    { id: 17, name: "Spotify++", descAr: "ميزات بريميوم مجانية", descEn: "Free premium features", icon: "music", iconBg: "#1DB954" },
    { id: 13, name: "PUBG Hack", descAr: "تصويب تلقائي و ESP", descEn: "Aimbot & ESP", icon: "crosshair", iconBg: "#F2A900" },
    { id: 1, name: "WhatsApp++", descAr: "ميزات مخفية مفعّلة", descEn: "Hidden features unlocked", icon: "message-circle", iconBg: "#25D366" },
    { id: 20, name: "Disney+", descAr: "ديزني و مارفل مباشر", descEn: "Disney & Marvel streaming", icon: "play-circle", iconBg: "#113CCF" },
    { id: 3, name: "Instagram++", descAr: "تحميل القصص والريلز", descEn: "Download stories & reels", icon: "instagram", iconBg: "#E1306C" },
    { id: 2, name: "Snapchat++", descAr: "حفظ السنابات والقصص", descEn: "Save snaps & stories", icon: "camera", iconBg: "#FFFC00" },
    { id: 14, name: "Minecraft+", descAr: "جميع السكنات مفتوحة", descEn: "All skins unlocked", icon: "box", iconBg: "#62B47A" },
  ],
  recentlyAdded: [
    { id: 8, name: "Copilot+", descAr: "مساعد برمجة بالذكاء الاصطناعي", descEn: "AI coding assistant", icon: "zap", iconBg: "#7B61FF" },
    { id: 9, name: "Gemini Pro", descAr: "Google AI بريميوم", descEn: "Google AI Premium", icon: "star", iconBg: "#4285F4" },
    { id: 10, name: "CapCut Pro", descAr: "أدوات تعديل متقدمة", descEn: "Advanced editing tools", icon: "scissors", iconBg: "#000000" },
    { id: 11, name: "Canva Pro", descAr: "جميع القوالب مفتوحة", descEn: "All templates unlocked", icon: "edit", iconBg: "#00C4CC" },
    { id: 15, name: "Roblox Mod", descAr: "روبوكس غير محدود", descEn: "Unlimited Robux", icon: "play", iconBg: "#E2231A" },
    { id: 21, name: "Shahid VIP", descAr: "محتوى عربي بريميوم", descEn: "Premium Arabic content", icon: "tv", iconBg: "#00B140" },
    { id: 23, name: "iSH Shell", descAr: "طرفية لينكس على iOS", descEn: "Linux terminal on iOS", icon: "code", iconBg: "#333333" },
  ],
};

const SECTION_EMOJI: Record<string, string> = {
  trending: "🔥",
  mostDownloaded: "📥",
  recentlyAdded: "🆕",
};

export default function SectionDetailScreen() {
  const { type, title } = useLocalSearchParams<{ type: string; title: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, t, fontAr, isArabic } = useSettings();
  const isWeb = Platform.OS === "web";

  const apps = SECTION_APPS[type] || [];
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
          {apps.map((app, index) => (
            <View key={app.id}>
              <Pressable style={[styles.appRow, isArabic && { flexDirection: "row-reverse" }]}>
                <View style={[styles.appIcon, { backgroundColor: `${app.iconBg}15` }]}>
                  <Feather name={app.icon as any} size={22} color={app.iconBg} />
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
          ))}
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
