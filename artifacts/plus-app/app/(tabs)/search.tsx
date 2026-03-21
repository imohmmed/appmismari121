import { Feather } from "@expo/vector-icons";
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

import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const BROWSE_CATEGORIES = [
  { key: "social", label: "تواصل اجتماعي", icon: "message-circle" as const, bgColor: "#007AFF" },
  { key: "ai", label: "ذكاء اصطناعي", icon: "cpu" as const, bgColor: "#AF52DE" },
  { key: "edit", label: "تعديل", icon: "edit-3" as const, bgColor: "#FF9500" },
  { key: "games", label: "ألعاب", icon: "play" as const, bgColor: "#34C759" },
  { key: "tweaked", label: "تطبيقات بلس", icon: "settings" as const, bgColor: "#5AC8FA" },
  { key: "tv", label: "تلفزيون", icon: "tv" as const, bgColor: "#FF3B30" },
  { key: "develop", label: "تطوير", icon: "terminal" as const, bgColor: "#FF9500" },
];

const ALL_APPS = [
  { id: 1, name: "WhatsApp++", desc: "ميزات مخفية مفعّلة", category: "تواصل اجتماعي", icon: "message-circle" as const, iconBg: "#007AFF" },
  { id: 2, name: "Snapchat++", desc: "حفظ السنابات والقصص", category: "تواصل اجتماعي", icon: "camera" as const, iconBg: "#007AFF" },
  { id: 3, name: "Instagram++", desc: "تحميل القصص والريلز", category: "تواصل اجتماعي", icon: "instagram" as const, iconBg: "#007AFF" },
  { id: 4, name: "TikTok++", desc: "بدون إعلانات، تحميل الفيديو", category: "تواصل اجتماعي", icon: "video" as const, iconBg: "#007AFF" },
  { id: 5, name: "Telegram++", desc: "ميزات بريميوم مجانية", category: "تواصل اجتماعي", icon: "send" as const, iconBg: "#007AFF" },
  { id: 6, name: "Twitter++", desc: "تحميل الفيديوهات والثريدات", category: "تواصل اجتماعي", icon: "twitter" as const, iconBg: "#007AFF" },
  { id: 7, name: "ChatGPT Pro", desc: "وصول GPT-4 مفعّل", category: "ذكاء اصطناعي", icon: "cpu" as const, iconBg: "#AF52DE" },
  { id: 8, name: "Copilot+", desc: "مساعد برمجة بالذكاء الاصطناعي", category: "ذكاء اصطناعي", icon: "zap" as const, iconBg: "#AF52DE" },
  { id: 9, name: "Gemini Pro", desc: "Google AI بريميوم", category: "ذكاء اصطناعي", icon: "star" as const, iconBg: "#AF52DE" },
  { id: 10, name: "CapCut Pro", desc: "أدوات تعديل متقدمة", category: "تعديل", icon: "scissors" as const, iconBg: "#FF9500" },
  { id: 11, name: "Canva Pro", desc: "جميع القوالب مفتوحة", category: "تعديل", icon: "edit" as const, iconBg: "#FF9500" },
  { id: 12, name: "Lightroom++", desc: "فلاتر بريميوم مجانية", category: "تعديل", icon: "aperture" as const, iconBg: "#FF9500" },
  { id: 13, name: "PUBG Hack", desc: "تصويب تلقائي و ESP", category: "ألعاب", icon: "crosshair" as const, iconBg: "#34C759" },
  { id: 14, name: "Minecraft+", desc: "جميع السكنات مفتوحة", category: "ألعاب", icon: "box" as const, iconBg: "#34C759" },
  { id: 15, name: "Roblox Mod", desc: "روبوكس غير محدود", category: "ألعاب", icon: "play" as const, iconBg: "#34C759" },
  { id: 16, name: "YouTube Premium", desc: "بدون إعلانات، تشغيل بالخلفية", category: "تطبيقات بلس", icon: "youtube" as const, iconBg: "#5AC8FA" },
  { id: 17, name: "Spotify++", desc: "ميزات بريميوم مجانية", category: "تطبيقات بلس", icon: "music" as const, iconBg: "#5AC8FA" },
  { id: 18, name: "SoundCloud++", desc: "تحميل بدون إنترنت", category: "تطبيقات بلس", icon: "headphones" as const, iconBg: "#5AC8FA" },
  { id: 19, name: "Netflix", desc: "جميع المحتوى مفتوح", category: "تلفزيون", icon: "film" as const, iconBg: "#FF3B30" },
  { id: 20, name: "Disney+", desc: "ديزني و مارفل مباشر", category: "تلفزيون", icon: "play-circle" as const, iconBg: "#FF3B30" },
  { id: 21, name: "Shahid VIP", desc: "محتوى عربي بريميوم", category: "تلفزيون", icon: "tv" as const, iconBg: "#FF3B30" },
  { id: 22, name: "Xcode Helper", desc: "أدوات تطوير iOS", category: "تطوير", icon: "terminal" as const, iconBg: "#FF9500" },
  { id: 23, name: "iSH Shell", desc: "طرفية لينكس على iOS", category: "تطوير", icon: "code" as const, iconBg: "#FF9500" },
  { id: 24, name: "Pythonista+", desc: "بايثون IDE بريميوم", category: "تطوير", icon: "file-text" as const, iconBg: "#FF9500" },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const isSearching = query.length > 0;
  const filteredApps = isSearching
    ? ALL_APPS.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>البحث</Text>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={Colors.light.textSecondary} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="ابحث عن تطبيق..."
          placeholderTextColor={Colors.light.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <Feather name="x-circle" size={18} color={Colors.light.textSecondary} />
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
                      <Text style={styles.appName}>{app.name}</Text>
                      <Text style={styles.appDesc}>{app.desc}</Text>
                    </View>
                    <Pressable style={styles.getButton}>
                      <Text style={styles.getButtonText}>تحميل</Text>
                    </Pressable>
                  </Pressable>
                  {index < filteredApps.length - 1 && <View style={styles.divider} />}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Feather name="search" size={48} color={Colors.light.textSecondary} />
                <Text style={styles.emptyText}>لا توجد نتائج</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.categoriesContainer}>
            <Text style={styles.sectionTitle}>الأقسام</Text>
            <View style={styles.catGrid}>
              {BROWSE_CATEGORIES.map((cat) => (
                <Pressable key={cat.key} style={[styles.catCard, { backgroundColor: cat.bgColor }]}>
                  <View style={styles.catCardIcon}>
                    <Feather name={cat.icon} size={28} color="rgba(255,255,255,0.7)" />
                  </View>
                  <Text style={styles.catCardLabel}>{cat.label}</Text>
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
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 32, fontFamily: "Mestika-Bold", color: Colors.light.text },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Mestika-Regular",
    color: Colors.light.text,
    textAlign: "right",
  },
  categoriesContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "Mestika-Bold",
    color: Colors.light.text,
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
    right: 16,
  },
  catCardLabel: {
    fontSize: 16,
    fontFamily: "Mestika-Bold",
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
    color: Colors.light.text,
  },
  appDesc: {
    fontSize: 13,
    fontFamily: "Mestika-Regular",
    color: Colors.light.textSecondary,
  },
  getButton: {
    backgroundColor: Colors.light.card,
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 18,
  },
  getButtonText: {
    fontSize: 15,
    fontFamily: "Mestika-Bold",
    color: Colors.light.tint,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
    marginLeft: 66,
  },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 16, fontFamily: "Mestika-Medium", color: Colors.light.textSecondary },
});
