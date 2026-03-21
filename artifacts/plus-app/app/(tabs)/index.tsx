import { Feather } from "@expo/vector-icons";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import SlidePanel from "@/components/SlidePanel";
import AppDetailPanel from "@/components/AppDetailPanel";
import GlassBackButton from "@/components/GlassBackButton";
import AccountPanel from "@/components/AccountPanel";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_WIDTH = SCREEN_WIDTH - 80;

const CATEGORIES = [
  { key: "social", label: "Social Media", icon: "message-circle" },
  { key: "ai", label: "Ai", icon: "cpu" },
  { key: "edit", label: "Edit", icon: "edit-3" },
  { key: "games", label: "Games", icon: "play" },
  { key: "tweaked", label: "Tweaked Apps", icon: "settings" },
  { key: "tv", label: "TV , LIVE", icon: "tv" },
  { key: "develop", label: "Develop", icon: "terminal" },
] as const;

const FEATURED_APPS = [
  { id: 1, title: "Black Friday Sale", subtitle: "50% off all premium subscriptions", color: "#007AFF" },
  { id: 2, title: "New Apps Added", subtitle: "100+ new tweaked apps this week", color: "#9FBCFF" },
  { id: 3, title: "Premium Bundle", subtitle: "Get all apps with one subscription", color: "#FF9500" },
];

type AppItem = {
  id: number;
  name: string;
  desc: string;
  category: string;
  tag: "tweaked" | "modded" | "hacked";
  icon: string;
  isHot?: boolean;
  isNew?: boolean;
  isMostDownloaded?: boolean;
  catKey?: string;
};

const ALL_APPS: AppItem[] = [
  { id: 1, name: "WhatsApp++", desc: "Hidden features unlocked", category: "Social Media", tag: "tweaked", icon: "message-circle", isHot: true, isMostDownloaded: true, catKey: "social" },
  { id: 2, name: "Snapchat++", desc: "Save snaps & stories", category: "Social Media", tag: "tweaked", icon: "camera", isHot: true, isMostDownloaded: true, catKey: "social" },
  { id: 3, name: "Instagram++", desc: "Download stories & reels", category: "Social Media", tag: "tweaked", icon: "instagram", isHot: true, isMostDownloaded: true, catKey: "social" },
  { id: 4, name: "TikTok++", desc: "No ads, download videos", category: "Social Media", tag: "tweaked", icon: "video", isHot: true, catKey: "social" },
  { id: 5, name: "Telegram++", desc: "Premium features free", category: "Social Media", tag: "tweaked", icon: "send", catKey: "social" },
  { id: 6, name: "Twitter++", desc: "Download videos & threads", category: "Social Media", tag: "tweaked", icon: "twitter", catKey: "social" },
  { id: 7, name: "ChatGPT Pro", desc: "GPT-4 access unlocked", category: "Ai", tag: "modded", icon: "cpu", isHot: true, isMostDownloaded: true, catKey: "ai" },
  { id: 8, name: "Copilot+", desc: "AI coding assistant", category: "Ai", tag: "modded", icon: "zap", isNew: true, catKey: "ai" },
  { id: 9, name: "Gemini Pro", desc: "Google AI premium", category: "Ai", tag: "modded", icon: "star", isNew: true, catKey: "ai" },
  { id: 10, name: "CapCut Pro", desc: "Premium editing tools", category: "Edit", tag: "modded", icon: "scissors", isHot: true, isNew: true, catKey: "edit" },
  { id: 11, name: "Canva Pro", desc: "All templates unlocked", category: "Edit", tag: "modded", icon: "edit", isNew: true, catKey: "edit" },
  { id: 12, name: "Lightroom++", desc: "Premium presets free", category: "Edit", tag: "tweaked", icon: "aperture", catKey: "edit" },
  { id: 13, name: "PUBG Hack", desc: "Aim assist & ESP", category: "Games", tag: "hacked", icon: "crosshair", isHot: true, isMostDownloaded: true, catKey: "games" },
  { id: 14, name: "Minecraft+", desc: "All skins unlocked", category: "Games", tag: "hacked", icon: "box", catKey: "games" },
  { id: 15, name: "Roblox Mod", desc: "Unlimited Robux", category: "Games", tag: "modded", icon: "play", isNew: true, catKey: "games" },
  { id: 16, name: "YouTube Premium", desc: "Ad-free, background play", category: "Tweaked Apps", tag: "tweaked", icon: "youtube", isHot: true, isMostDownloaded: true, catKey: "tweaked" },
  { id: 17, name: "Spotify++", desc: "Premium features free", category: "Tweaked Apps", tag: "tweaked", icon: "music", isHot: true, isMostDownloaded: true, catKey: "tweaked" },
  { id: 18, name: "SoundCloud++", desc: "Offline downloads", category: "Tweaked Apps", tag: "tweaked", icon: "headphones", catKey: "tweaked" },
  { id: 19, name: "Netflix", desc: "All content unlocked", category: "TV , LIVE", tag: "modded", icon: "film", isHot: true, isMostDownloaded: true, catKey: "tv" },
  { id: 20, name: "Disney+", desc: "Stream Disney & Marvel", category: "TV , LIVE", tag: "modded", icon: "play-circle", catKey: "tv" },
  { id: 21, name: "Shahid VIP", desc: "Arabic content premium", category: "TV , LIVE", tag: "tweaked", icon: "tv", isNew: true, catKey: "tv" },
  { id: 22, name: "Xcode Helper", desc: "iOS dev tools", category: "Develop", tag: "modded", icon: "terminal", catKey: "develop" },
  { id: 23, name: "iSH Shell", desc: "Linux shell on iOS", category: "Develop", tag: "tweaked", icon: "code", isNew: true, catKey: "develop" },
  { id: 24, name: "Pythonista+", desc: "Python IDE premium", category: "Develop", tag: "modded", icon: "file-text", catKey: "develop" },
];

const BROWSE_CATEGORIES = [
  { key: "social", label: "Social Media", icon: "message-circle", bgColor: "#007AFF" },
  { key: "ai", label: "Ai", icon: "cpu", bgColor: "#AF52DE" },
  { key: "edit", label: "Edit", icon: "edit-3", bgColor: "#FF9500" },
  { key: "games", label: "Games", icon: "play", bgColor: "#34C759" },
  { key: "tweaked", label: "Tweaked Apps", icon: "settings", bgColor: "#5AC8FA" },
  { key: "tv", label: "TV , LIVE", icon: "tv", bgColor: "#FF3B30" },
  { key: "develop", label: "Develop", icon: "terminal", bgColor: "#FF9500" },
];

function getTagColor(tag: string) {
  switch (tag) {
    case "tweaked": return Colors.light.tagTweaked;
    case "modded": return Colors.light.tagModded;
    case "hacked": return Colors.light.tagHacked;
    default: return Colors.light.tint;
  }
}

function CategoryPill({ item, onPress }: { item: typeof CATEGORIES[number]; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.categoryPill}>
      <Feather name={item.icon as any} size={14} color={Colors.light.tint} style={{ marginRight: 5 }} />
      <Text style={styles.categoryPillText}>{item.label}</Text>
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

function AppListRow({ app, showDivider, onPress }: { app: AppItem; showDivider: boolean; onPress: () => void }) {
  const tagColor = getTagColor(app.tag);
  return (
    <View>
      <Pressable style={styles.listRow} onPress={onPress}>
        <View style={[styles.listRowIcon, { backgroundColor: `${tagColor}15` }]}>
          <Feather name={app.icon as any} size={24} color={tagColor} />
        </View>
        <View style={styles.listRowInfo}>
          <Text style={styles.listRowName} numberOfLines={1}>{app.name}</Text>
          <Text style={styles.listRowDesc} numberOfLines={1}>{app.desc}</Text>
        </View>
        <Pressable style={styles.listRowGetButton}>
          <Text style={styles.listRowGetText}>Get</Text>
        </Pressable>
      </Pressable>
      {showDivider && <View style={styles.listRowDivider} />}
    </View>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function StackedSection({ title, subtitle, data, onAppPress }: { title: string; subtitle: string; data: AppItem[]; onAppPress: (app: AppItem) => void }) {
  const pages = chunkArray(data, 3);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={Colors.light.textSecondary} />
      </View>
      <FlatList
        data={pages}
        horizontal
        pagingEnabled={false}
        snapToInterval={PAGE_WIDTH + 16}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item: page }) => (
          <View style={{ width: PAGE_WIDTH }}>
            {page.map((app, idx) => (
              <AppListRow key={app.id} app={app} showDivider={idx < page.length - 1} onPress={() => onAppPress(app)} />
            ))}
          </View>
        )}
      />
    </View>
  );
}

function AppRow({ app, onPress }: { app: AppItem; onPress: () => void }) {
  const tagColor = getTagColor(app.tag);
  return (
    <Pressable style={styles.appRow} onPress={onPress}>
      <View style={[styles.appIcon, { backgroundColor: `${tagColor}15` }]}>
        <Feather name={app.icon as any} size={22} color={tagColor} />
      </View>
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{app.name}</Text>
        <Text style={styles.appDesc}>{app.desc}</Text>
      </View>
      <Pressable style={styles.getButton}>
        <Text style={styles.getButtonText}>Get</Text>
      </Pressable>
    </Pressable>
  );
}

function CategoryCard({ cat, onPress }: { cat: typeof BROWSE_CATEGORIES[number]; onPress: () => void }) {
  return (
    <Pressable style={[styles.catCard, { backgroundColor: cat.bgColor }]} onPress={onPress}>
      <Feather name={cat.icon as any} size={28} color="rgba(255,255,255,0.9)" style={styles.catCardIcon} />
      <Text style={styles.catCardLabel}>{cat.label}</Text>
    </Pressable>
  );
}

function CategoryPageContent({ catKey, onClose, onAppPress }: { catKey: string; onClose: () => void; onAppPress: (app: AppItem) => void }) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const cat = CATEGORIES.find((c) => c.key === catKey);
  const apps = ALL_APPS.filter((a) => a.catKey === catKey);

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={styles.catPageHeader}>
        <GlassBackButton onPress={onClose} />
      </View>
      <View style={styles.catPageTitleRow}>
        <Text style={styles.headerTitle}>{cat?.label}</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.appList}>
          {apps.map((app, idx) => (
            <View key={app.id}>
              <AppRow app={app} onPress={() => onAppPress(app)} />
              {idx < apps.length - 1 && <View style={styles.listRowDivider} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default function PlusScreen() {
  const insets = useSafeAreaInsets();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const catToAppTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const featuredRef = useRef<FlatList>(null);
  const featuredIndex = useRef(0);
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    const interval = setInterval(() => {
      featuredIndex.current = (featuredIndex.current + 1) % FEATURED_APPS.length;
      featuredRef.current?.scrollToOffset({
        offset: featuredIndex.current * (SCREEN_WIDTH - 24),
        animated: true,
      });
    }, 3000);
    return () => {
      clearInterval(interval);
      if (catToAppTimer.current) clearTimeout(catToAppTimer.current);
    };
  }, []);

  const hotApps = ALL_APPS.filter((a) => a.isHot);
  const mostDownloaded = ALL_APPS.filter((a) => a.isMostDownloaded);
  const newAdds = ALL_APPS.filter((a) => a.isNew);

  const handleAppPress = (app: AppItem) => setSelectedApp(app);

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mismari +</Text>
        <TouchableOpacity style={styles.profileButton} onPress={() => setShowAccount(true)} activeOpacity={0.6}>
          <Feather name="user" size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.categoryWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          style={styles.categoryScrollView}
        >
        {CATEGORIES.map((cat) => (
          <CategoryPill key={cat.key} item={cat} onPress={() => setActiveCat(cat.key)} />
        ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 80 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>FEATURED</Text>
            <Feather name="chevron-right" size={18} color={Colors.light.textSecondary} />
          </View>
          <FlatList
            ref={featuredRef}
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
              return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]} />;
            })}
          </View>
        </View>

        <StackedSection title="What's Hot 🔥" subtitle="Trending right now" data={hotApps} onAppPress={handleAppPress} />
        <StackedSection title="Most Downloaded" subtitle="Top picks by the community" data={mostDownloaded} onAppPress={handleAppPress} />
        <StackedSection title="Recently Added" subtitle="Fresh apps just dropped" data={newAdds} onAppPress={handleAppPress} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
          </View>
          <View style={styles.catGrid}>
            {BROWSE_CATEGORIES.map((cat) => (
              <CategoryCard key={cat.key} cat={cat} onPress={() => setActiveCat(cat.key)} />
            ))}
          </View>
        </View>
      </ScrollView>

      <SlidePanel visible={activeCat !== null} onClose={() => setActiveCat(null)}>
        {activeCat && (
          <CategoryPageContent
            catKey={activeCat}
            onClose={() => setActiveCat(null)}
            onAppPress={(app) => {
              setActiveCat(null);
              if (catToAppTimer.current) clearTimeout(catToAppTimer.current);
              catToAppTimer.current = setTimeout(() => setSelectedApp(app), 300);
            }}
          />
        )}
      </SlidePanel>

      <SlidePanel visible={selectedApp !== null} onClose={() => setSelectedApp(null)}>
        {selectedApp && (
          <AppDetailPanel
            app={selectedApp}
            onClose={() => setSelectedApp(null)}
            onCategoryPress={(catKey) => {
              setSelectedApp(null);
              if (catToAppTimer.current) clearTimeout(catToAppTimer.current);
              catToAppTimer.current = setTimeout(() => setActiveCat(catKey), 300);
            }}
            relatedApps={ALL_APPS.filter(
              (a) => a.catKey === selectedApp.catKey && a.id !== selectedApp.id
            )}
            onRelatedAppPress={(a) => setSelectedApp(a)}
          />
        )}
      </SlidePanel>

      <AccountPanel visible={showAccount} onClose={() => setShowAccount(false)} />
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

  categoryWrapper: {
    marginBottom: 4,
  },
  categoryScrollView: {
    flexGrow: 0,
  },
  categoryRow: {
    paddingHorizontal: 16,
    paddingRight: 32,
    gap: 8,
    paddingVertical: 12,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: Colors.light.background,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
      },
    }),
  },
  categoryPillText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },

  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
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

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  listRowIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  listRowInfo: {
    flex: 1,
    gap: 3,
  },
  listRowName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  listRowDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  listRowGetButton: {
    backgroundColor: Colors.light.card,
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 18,
  },
  listRowGetText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.tint,
  },
  listRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
    marginLeft: 68,
  },

  appList: {
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

  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
  },
  catCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 100,
    borderRadius: 16,
    padding: 16,
    justifyContent: "flex-end",
  },
  catCardIcon: {
    position: "absolute",
    top: 16,
    right: 16,
    opacity: 0.8,
  },
  catCardLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },

  catPageHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  catPageTitleRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
});
