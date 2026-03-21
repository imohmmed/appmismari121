import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ALL_APPS = [
  { id: 1, name: "WhatsApp++", descAr: "ميزات مخفية مفعّلة", descEn: "Hidden features unlocked", icon: "message-circle" as const, iconBg: "#007AFF" },
  { id: 2, name: "Snapchat++", descAr: "حفظ السنابات والقصص", descEn: "Save snaps & stories", icon: "camera" as const, iconBg: "#007AFF" },
  { id: 3, name: "Instagram++", descAr: "تحميل القصص والريلز", descEn: "Download stories & reels", icon: "instagram" as const, iconBg: "#007AFF" },
  { id: 4, name: "TikTok++", descAr: "بدون إعلانات، تحميل الفيديو", descEn: "No ads, video download", icon: "video" as const, iconBg: "#007AFF" },
  { id: 5, name: "Telegram++", descAr: "ميزات بريميوم مجانية", descEn: "Free premium features", icon: "send" as const, iconBg: "#007AFF" },
  { id: 6, name: "Twitter++", descAr: "تحميل الفيديوهات والثريدات", descEn: "Download videos & threads", icon: "twitter" as const, iconBg: "#007AFF" },
  { id: 7, name: "ChatGPT Pro", descAr: "وصول GPT-4 مفعّل", descEn: "GPT-4 access unlocked", icon: "cpu" as const, iconBg: "#AF52DE" },
  { id: 8, name: "Copilot+", descAr: "مساعد برمجة بالذكاء الاصطناعي", descEn: "AI coding assistant", icon: "zap" as const, iconBg: "#AF52DE" },
  { id: 9, name: "Gemini Pro", descAr: "Google AI بريميوم", descEn: "Google AI Premium", icon: "star" as const, iconBg: "#AF52DE" },
  { id: 10, name: "CapCut Pro", descAr: "أدوات تعديل متقدمة", descEn: "Advanced editing tools", icon: "scissors" as const, iconBg: "#FF9500" },
  { id: 11, name: "Canva Pro", descAr: "جميع القوالب مفتوحة", descEn: "All templates unlocked", icon: "edit" as const, iconBg: "#FF9500" },
  { id: 12, name: "Lightroom++", descAr: "فلاتر بريميوم مجانية", descEn: "Free premium filters", icon: "aperture" as const, iconBg: "#FF9500" },
  { id: 13, name: "PUBG Hack", descAr: "تصويب تلقائي و ESP", descEn: "Aimbot & ESP", icon: "crosshair" as const, iconBg: "#34C759" },
  { id: 14, name: "Minecraft+", descAr: "جميع السكنات مفتوحة", descEn: "All skins unlocked", icon: "box" as const, iconBg: "#34C759" },
  { id: 15, name: "Roblox Mod", descAr: "روبوكس غير محدود", descEn: "Unlimited Robux", icon: "play" as const, iconBg: "#34C759" },
  { id: 16, name: "YouTube Premium", descAr: "بدون إعلانات، تشغيل بالخلفية", descEn: "No ads, background play", icon: "youtube" as const, iconBg: "#5AC8FA" },
  { id: 17, name: "Spotify++", descAr: "ميزات بريميوم مجانية", descEn: "Free premium features", icon: "music" as const, iconBg: "#5AC8FA" },
  { id: 18, name: "SoundCloud++", descAr: "تحميل بدون إنترنت", descEn: "Offline download", icon: "headphones" as const, iconBg: "#5AC8FA" },
  { id: 19, name: "Netflix", descAr: "جميع المحتوى مفتوح", descEn: "All content unlocked", icon: "film" as const, iconBg: "#FF3B30" },
  { id: 20, name: "Disney+", descAr: "ديزني و مارفل مباشر", descEn: "Disney & Marvel streaming", icon: "play-circle" as const, iconBg: "#FF3B30" },
  { id: 21, name: "Shahid VIP", descAr: "محتوى عربي بريميوم", descEn: "Premium Arabic content", icon: "tv" as const, iconBg: "#FF3B30" },
  { id: 22, name: "Xcode Helper", descAr: "أدوات تطوير iOS", descEn: "iOS dev tools", icon: "terminal" as const, iconBg: "#FF9500" },
  { id: 23, name: "iSH Shell", descAr: "طرفية لينكس على iOS", descEn: "Linux terminal on iOS", icon: "code" as const, iconBg: "#FF9500" },
  { id: 24, name: "Pythonista+", descAr: "بايثون IDE بريميوم", descEn: "Premium Python IDE", icon: "file-text" as const, iconBg: "#FF9500" },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);
  const { colors, t, fontAr, isArabic } = useSettings();
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const BROWSE_CATEGORIES = [
    { key: "social", label: t("social"), icon: "message-circle" as const, bgColor: "#007AFF" },
    { key: "ai", label: t("ai"), icon: "cpu" as const, bgColor: "#AF52DE" },
    { key: "edit", label: t("edit"), icon: "edit-3" as const, bgColor: "#FF9500" },
    { key: "games", label: t("games"), icon: "play" as const, bgColor: "#34C759" },
    { key: "tweaked", label: t("tweakedApps"), icon: "settings" as const, bgColor: "#5AC8FA" },
    { key: "tv", label: t("tv"), icon: "tv" as const, bgColor: "#FF3B30" },
    { key: "develop", label: t("develop"), icon: "terminal" as const, bgColor: "#FF9500" },
  ];

  const isSearching = query.length > 0;
  const filteredApps = isSearching
    ? ALL_APPS.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
    : [];

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
          <Pressable onPress={() => setQuery("")}>
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
            {filteredApps.length > 0 ? (
              filteredApps.map((app, index) => (
                <View key={app.id}>
                  <Pressable style={styles.appRow}>
                    <View style={[styles.appIcon, { backgroundColor: `${app.iconBg}15` }]}>
                      <Feather name={app.icon} size={22} color={app.iconBg} />
                    </View>
                    <View style={styles.appInfo}>
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
                  {index < filteredApps.length - 1 && <View style={[styles.divider, { backgroundColor: colors.separator }]} />}
                </View>
              ))
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
            <View style={styles.catGrid}>
              {BROWSE_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.key}
                  style={[styles.catCard, { backgroundColor: cat.bgColor }]}
                  onPress={() => router.push({ pathname: "/category/[id]", params: { id: cat.key, name: cat.label, color: cat.bgColor } })}
                >
                  <View style={[styles.catCardIcon, isArabic ? { left: 16, right: undefined } : { right: 16 }]}>
                    <Feather name={cat.icon} size={28} color="rgba(255,255,255,0.7)" />
                  </View>
                  <Text style={[styles.catCardLabel, { fontFamily: fontAr("Bold"), textAlign: isArabic ? "right" : "left" }]}>{cat.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
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
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  catCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 120,
    borderRadius: 16,
    padding: 16,
    justifyContent: "flex-end",
  },
  catCardIcon: {
    position: "absolute",
    top: 16,
  },
  catCardLabel: {
    fontSize: 15,
    color: "#FFF",
  },
  resultsContainer: {
    paddingHorizontal: 20,
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
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 15 },
});
