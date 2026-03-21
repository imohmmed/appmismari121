import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState, useRef, useMemo } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const FILTERS = [
  { key: "all", label: "All" },
  { key: "hot", label: "Hot", icon: "flame" },
  { key: "new", label: "New" },
  { key: "tweaked", label: "Tweaked" },
  { key: "modded", label: "Modded" },
  { key: "hacked", label: "Hacked" },
] as const;

const FEATURED_APPS = [
  { id: 1, title: "Black Friday Sale", subtitle: "50% off all premium subscriptions", color: "#B044FF" },
  { id: 2, title: "New Apps Added", subtitle: "100+ new tweaked apps this week", color: "#4488FF" },
  { id: 3, title: "Premium Bundle", subtitle: "Get all apps with one subscription", color: "#FF8844" },
];

type AppItem = {
  id: number;
  name: string;
  category: string;
  tag: "tweaked" | "modded" | "hacked" | "new";
  icon: string;
  isHot?: boolean;
  isNew?: boolean;
};

const ALL_APPS: AppItem[] = [
  { id: 1, name: "WhatsApp++", category: "Tweaks", tag: "tweaked", icon: "message-circle", isHot: true },
  { id: 2, name: "Snapchat++", category: "Tweaks", tag: "tweaked", icon: "camera", isHot: true },
  { id: 3, name: "PUBG Mobile Hack", category: "Modded Games", tag: "hacked", icon: "crosshair", isHot: true },
  { id: 4, name: "Instagram++", category: "Tweaks", tag: "tweaked", icon: "instagram", isHot: true },
  { id: 5, name: "YouTube Premium", category: "Tweaks", tag: "tweaked", icon: "youtube", isHot: true },
  { id: 6, name: "Spotify++", category: "Music", tag: "tweaked", icon: "music", isHot: true },
  { id: 7, name: "Netflix", category: "Movies", tag: "modded", icon: "film", isHot: true },
  { id: 8, name: "TikTok++", category: "Tweaks", tag: "tweaked", icon: "video", isHot: true },
  { id: 9, name: "CapCut Pro", category: "Design", tag: "modded", icon: "scissors", isNew: true },
  { id: 10, name: "Canva Pro", category: "Design", tag: "modded", icon: "edit", isNew: true },
  { id: 11, name: "Minecraft Hack", category: "Games", tag: "hacked", icon: "box" },
  { id: 12, name: "GTA+", category: "Games", tag: "modded", icon: "monitor" },
];

function getTagColor(tag: string) {
  switch (tag) {
    case "tweaked": return Colors.light.tagTweaked;
    case "modded": return Colors.light.tagModded;
    case "hacked": return Colors.light.tagHacked;
    case "new": return Colors.light.tagNew;
    case "hot": return Colors.light.tagHot;
    default: return Colors.light.tint;
  }
}

function FilterChip({ item, isActive, onPress }: { item: typeof FILTERS[number]; isActive: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        isActive && styles.filterChipActive,
      ]}
    >
      {"icon" in item && item.icon === "flame" && (
        <Ionicons name="flame" size={14} color={isActive ? "#FFF" : Colors.light.tagHot} style={{ marginRight: 4 }} />
      )}
      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

function FeaturedCard({ item }: { item: typeof FEATURED_APPS[number] }) {
  return (
    <View style={[styles.featuredCard, { width: SCREEN_WIDTH - 48 }]}>
      <View style={[styles.featuredGradient, { backgroundColor: item.color }]}>
        <View style={styles.featuredContent}>
          <Text style={styles.featuredLabel}>FEATURED</Text>
          <Text style={styles.featuredTitle}>{item.title}</Text>
          <Text style={styles.featuredSubtitle}>{item.subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

function AppRow({ app }: { app: AppItem }) {
  const tagColor = getTagColor(app.tag);
  return (
    <Pressable style={styles.appRow}>
      <View style={[styles.appIcon, { backgroundColor: `${tagColor}20` }]}>
        <Feather name={app.icon as any} size={22} color={tagColor} />
      </View>
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{app.name}</Text>
        <View style={styles.appMeta}>
          <Text style={styles.appCategory}>{app.category}</Text>
          <View style={[styles.tagBadge, { backgroundColor: `${tagColor}20` }]}>
            <Text style={[styles.tagText, { color: tagColor }]}>{app.tag}</Text>
          </View>
        </View>
      </View>
      <Pressable style={styles.getButton}>
        <Text style={styles.getButtonText}>GET</Text>
      </Pressable>
    </Pressable>
  );
}

export default function PlusScreen() {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState("all");
  const scrollX = useRef(new Animated.Value(0)).current;
  const isWeb = Platform.OS === "web";

  const filteredApps = useMemo(() => {
    switch (activeFilter) {
      case "hot":
        return ALL_APPS.filter((a) => a.isHot);
      case "new":
        return ALL_APPS.filter((a) => a.isNew);
      case "tweaked":
        return ALL_APPS.filter((a) => a.tag === "tweaked");
      case "modded":
        return ALL_APPS.filter((a) => a.tag === "modded");
      case "hacked":
        return ALL_APPS.filter((a) => a.tag === "hacked");
      default:
        return ALL_APPS;
    }
  }, [activeFilter]);

  const hotApps = useMemo(() => ALL_APPS.filter((a) => a.isHot), []);

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PLUS+</Text>
        <Pressable style={styles.profileButton}>
          <Feather name="user" size={20} color={Colors.light.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              item={f}
              isActive={activeFilter === f.key}
              onPress={() => setActiveFilter(f.key)}
            />
          ))}
        </ScrollView>

        {activeFilter === "all" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>FEATURED</Text>
              <Feather name="chevron-right" size={18} color={Colors.light.textSecondary} />
            </View>
            <FlatList
              data={FEATURED_APPS}
              horizontal
              pagingEnabled={false}
              snapToInterval={SCREEN_WIDTH - 24}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => <FeaturedCard item={item} />}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: false }
              )}
            />
            <View style={styles.paginationDots}>
              {FEATURED_APPS.map((_, i) => {
                const inputRange = [(i - 1) * (SCREEN_WIDTH - 24), i * (SCREEN_WIDTH - 24), (i + 1) * (SCREEN_WIDTH - 24)];
                const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 20, 8], extrapolate: "clamp" });
                const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: "clamp" });
                return (
                  <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]} />
                );
              })}
            </View>
          </View>
        )}

        {activeFilter === "all" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>What's Hot</Text>
                <Text style={styles.sectionSubtitle}>These favorites are always a great choice</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.light.textSecondary} />
            </View>
            <View style={styles.appList}>
              {hotApps.map((app) => (
                <AppRow key={app.id} app={app} />
              ))}
            </View>
          </View>
        )}

        {activeFilter !== "all" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  {FILTERS.find((f) => f.key === activeFilter)?.label} Apps
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {filteredApps.length} {filteredApps.length === 1 ? "app" : "apps"} found
                </Text>
              </View>
            </View>
            <View style={styles.appList}>
              {filteredApps.map((app) => (
                <AppRow key={app.id} app={app} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  filterChipText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  filterChipTextActive: {
    color: "#FFF",
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.tint,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  featuredCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  featuredGradient: {
    borderRadius: 16,
    padding: 24,
    minHeight: 180,
    justifyContent: "flex-end",
  },
  featuredContent: {
    gap: 4,
  },
  featuredLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
  },
  featuredTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  featuredSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
  },
  paginationDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.tint,
  },
  appList: {
    paddingHorizontal: 20,
    gap: 2,
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
    gap: 4,
  },
  appName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  appMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appCategory: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  getButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  getButtonText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
});
