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
  { key: "social", label: "Social Media", icon: "message-circle" as const, bgColor: "#007AFF" },
  { key: "ai", label: "Ai", icon: "cpu" as const, bgColor: "#AF52DE" },
  { key: "edit", label: "Edit", icon: "edit-3" as const, bgColor: "#FF9500" },
  { key: "games", label: "Games", icon: "play" as const, bgColor: "#34C759" },
  { key: "tweaked", label: "Tweaked Apps", icon: "settings" as const, bgColor: "#5AC8FA" },
  { key: "tv", label: "TV , LIVE", icon: "tv" as const, bgColor: "#FF3B30" },
  { key: "develop", label: "Develop", icon: "terminal" as const, bgColor: "#FF9500" },
];

const ALL_APPS = [
  { id: 1, name: "WhatsApp++", desc: "Hidden features unlocked", category: "Social Media", icon: "message-circle" as const, iconBg: "#007AFF" },
  { id: 2, name: "Snapchat++", desc: "Save snaps & stories", category: "Social Media", icon: "camera" as const, iconBg: "#007AFF" },
  { id: 3, name: "Instagram++", desc: "Download stories & reels", category: "Social Media", icon: "instagram" as const, iconBg: "#007AFF" },
  { id: 4, name: "TikTok++", desc: "No ads, download videos", category: "Social Media", icon: "video" as const, iconBg: "#007AFF" },
  { id: 5, name: "Telegram++", desc: "Premium features free", category: "Social Media", icon: "send" as const, iconBg: "#007AFF" },
  { id: 6, name: "Twitter++", desc: "Download videos & threads", category: "Social Media", icon: "twitter" as const, iconBg: "#007AFF" },
  { id: 7, name: "ChatGPT Pro", desc: "GPT-4 access unlocked", category: "Ai", icon: "cpu" as const, iconBg: "#AF52DE" },
  { id: 8, name: "Copilot+", desc: "AI coding assistant", category: "Ai", icon: "zap" as const, iconBg: "#AF52DE" },
  { id: 9, name: "Gemini Pro", desc: "Google AI premium", category: "Ai", icon: "star" as const, iconBg: "#AF52DE" },
  { id: 10, name: "CapCut Pro", desc: "Premium editing tools", category: "Edit", icon: "scissors" as const, iconBg: "#FF9500" },
  { id: 11, name: "Canva Pro", desc: "All templates unlocked", category: "Edit", icon: "edit" as const, iconBg: "#FF9500" },
  { id: 12, name: "Lightroom++", desc: "Premium presets free", category: "Edit", icon: "aperture" as const, iconBg: "#FF9500" },
  { id: 13, name: "PUBG Hack", desc: "Aim assist & ESP", category: "Games", icon: "crosshair" as const, iconBg: "#34C759" },
  { id: 14, name: "Minecraft+", desc: "All skins unlocked", category: "Games", icon: "box" as const, iconBg: "#34C759" },
  { id: 15, name: "Roblox Mod", desc: "Unlimited Robux", category: "Games", icon: "play" as const, iconBg: "#34C759" },
  { id: 16, name: "YouTube Premium", desc: "Ad-free, background play", category: "Tweaked Apps", icon: "youtube" as const, iconBg: "#5AC8FA" },
  { id: 17, name: "Spotify++", desc: "Premium features free", category: "Tweaked Apps", icon: "music" as const, iconBg: "#5AC8FA" },
  { id: 18, name: "SoundCloud++", desc: "Offline downloads", category: "Tweaked Apps", icon: "headphones" as const, iconBg: "#5AC8FA" },
  { id: 19, name: "Netflix", desc: "All content unlocked", category: "TV , LIVE", icon: "film" as const, iconBg: "#FF3B30" },
  { id: 20, name: "Disney+", desc: "Stream Disney & Marvel", category: "TV , LIVE", icon: "play-circle" as const, iconBg: "#FF3B30" },
  { id: 21, name: "Shahid VIP", desc: "Arabic content premium", category: "TV , LIVE", icon: "tv" as const, iconBg: "#FF3B30" },
  { id: 22, name: "Xcode Helper", desc: "iOS dev tools", category: "Develop", icon: "terminal" as const, iconBg: "#FF9500" },
  { id: 23, name: "iSH Shell", desc: "Linux shell on iOS", category: "Develop", icon: "code" as const, iconBg: "#FF9500" },
  { id: 24, name: "Pythonista+", desc: "Python IDE premium", category: "Develop", icon: "file-text" as const, iconBg: "#FF9500" },
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
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={Colors.light.textSecondary} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search apps..."
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
                      <Text style={styles.getButtonText}>Get</Text>
                    </Pressable>
                  </Pressable>
                  {index < filteredApps.length - 1 && <View style={styles.divider} />}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Feather name="search" size={48} color={Colors.light.textSecondary} />
                <Text style={styles.emptyText}>No apps found</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.categoriesContainer}>
            <Text style={styles.sectionTitle}>Categories</Text>
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
  headerTitle: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.light.text },
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
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
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
    fontFamily: "Inter_700Bold",
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
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Inter_700Bold",
    color: Colors.light.tint,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
    marginLeft: 66,
  },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
});
