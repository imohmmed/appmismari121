import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

const ALL_APPS = [
  { id: 1, name: "WhatsApp++", category: "Social Media", tag: "tweaked", icon: "message-circle" },
  { id: 2, name: "Instagram++", category: "Social Media", tag: "tweaked", icon: "instagram" },
  { id: 3, name: "Snapchat++", category: "Social Media", tag: "tweaked", icon: "camera" },
  { id: 4, name: "TikTok++", category: "Social Media", tag: "tweaked", icon: "video" },
  { id: 5, name: "YouTube Premium", category: "Music", tag: "tweaked", icon: "youtube" },
  { id: 6, name: "Spotify++", category: "Music", tag: "tweaked", icon: "music" },
  { id: 7, name: "Netflix", category: "Movies", tag: "modded", icon: "film" },
  { id: 8, name: "PUBG Mobile Hack", category: "Games", tag: "hacked", icon: "crosshair" },
  { id: 9, name: "Minecraft Hack", category: "Games", tag: "hacked", icon: "box" },
  { id: 10, name: "GTA+", category: "Games", tag: "modded", icon: "monitor" },
  { id: 11, name: "Telegram++", category: "Social Media", tag: "tweaked", icon: "send" },
  { id: 12, name: "CapCut Pro", category: "Design", tag: "tweaked", icon: "scissors" },
];

function getTagColor(tag: string) {
  switch (tag) {
    case "tweaked": return Colors.light.tagTweaked;
    case "modded": return Colors.light.tagModded;
    case "hacked": return Colors.light.tagHacked;
    default: return Colors.light.tint;
  }
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [query, setQuery] = useState("");

  const filtered = query.length > 0
    ? ALL_APPS.filter((app) => app.name.toLowerCase().includes(query.toLowerCase()))
    : ALL_APPS;

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={Colors.light.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search apps & games..."
          placeholderTextColor={Colors.light.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <Feather name="x-circle" size={18} color={Colors.light.textSecondary} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: isWeb ? 34 : 100 }}
        contentInsetAdjustmentBehavior="automatic"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="search" size={48} color={Colors.light.textSecondary} />
            <Text style={styles.emptyText}>No apps found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const tagColor = getTagColor(item.tag);
          return (
            <Pressable style={styles.appRow}>
              <View style={[styles.appIcon, { backgroundColor: `${tagColor}20` }]}>
                <Feather name={item.icon as any} size={22} color={tagColor} />
              </View>
              <View style={styles.appInfo}>
                <Text style={styles.appName}>{item.name}</Text>
                <View style={styles.meta}>
                  <Text style={styles.appCategory}>{item.category}</Text>
                  <View style={[styles.tagBadge, { backgroundColor: `${tagColor}20` }]}>
                    <Text style={[styles.tagText, { color: tagColor }]}>{item.tag}</Text>
                  </View>
                </View>
              </View>
              <Pressable style={styles.getButton}>
                <Text style={styles.getButtonText}>GET</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
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
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  appRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14 },
  appIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  appInfo: { flex: 1, gap: 4 },
  appName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  appCategory: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  getButton: { backgroundColor: Colors.light.tint, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  getButtonText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
});
