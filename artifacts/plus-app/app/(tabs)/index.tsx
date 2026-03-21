import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

import { useSettings } from "@/contexts/SettingsContext";
import type { ThemeColors } from "@/constants/colors";
import SlidePanel from "@/components/SlidePanel";
import AppDetailPanel from "@/components/AppDetailPanel";
import GlassBackButton from "@/components/GlassBackButton";
import AccountPanel from "@/components/AccountPanel";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_WIDTH = SCREEN_WIDTH - 80;

type AppItem = {
  id: number;
  name: string;
  descAr: string;
  descEn: string;
  category: string;
  tag: "tweaked" | "modded" | "hacked";
  icon: string;
  isHot?: boolean;
  isNew?: boolean;
  isMostDownloaded?: boolean;
  catKey?: string;
};

const ALL_APPS: AppItem[] = [
  { id: 1, name: "WhatsApp++", descAr: "ميزات مخفية مفعّلة", descEn: "Hidden features unlocked", category: "social", tag: "tweaked", icon: "message-circle", isHot: true, isMostDownloaded: true, catKey: "social" },
  { id: 2, name: "Snapchat++", descAr: "حفظ السنابات والقصص", descEn: "Save snaps & stories", category: "social", tag: "tweaked", icon: "camera", isHot: true, isMostDownloaded: true, catKey: "social" },
  { id: 3, name: "Instagram++", descAr: "تحميل القصص والريلز", descEn: "Download stories & reels", category: "social", tag: "tweaked", icon: "instagram", isHot: true, isMostDownloaded: true, catKey: "social" },
  { id: 4, name: "TikTok++", descAr: "بدون إعلانات، تحميل الفيديو", descEn: "No ads, video download", category: "social", tag: "tweaked", icon: "video", isHot: true, catKey: "social" },
  { id: 5, name: "Telegram++", descAr: "ميزات بريميوم مجانية", descEn: "Free premium features", category: "social", tag: "tweaked", icon: "send", catKey: "social" },
  { id: 6, name: "Twitter++", descAr: "تحميل الفيديوهات والثريدات", descEn: "Download videos & threads", category: "social", tag: "tweaked", icon: "twitter", catKey: "social" },
  { id: 7, name: "ChatGPT Pro", descAr: "وصول GPT-4 مفعّل", descEn: "GPT-4 access unlocked", category: "ai", tag: "modded", icon: "cpu", isHot: true, isMostDownloaded: true, catKey: "ai" },
  { id: 8, name: "Copilot+", descAr: "مساعد برمجة بالذكاء الاصطناعي", descEn: "AI coding assistant", category: "ai", tag: "modded", icon: "zap", isNew: true, catKey: "ai" },
  { id: 9, name: "Gemini Pro", descAr: "Google AI بريميوم", descEn: "Google AI Premium", category: "ai", tag: "modded", icon: "star", isNew: true, catKey: "ai" },
  { id: 10, name: "CapCut Pro", descAr: "أدوات تعديل متقدمة", descEn: "Advanced editing tools", category: "edit", tag: "modded", icon: "scissors", isHot: true, isNew: true, catKey: "edit" },
  { id: 11, name: "Canva Pro", descAr: "جميع القوالب مفتوحة", descEn: "All templates unlocked", category: "edit", tag: "modded", icon: "edit", isNew: true, catKey: "edit" },
  { id: 12, name: "Lightroom++", descAr: "فلاتر بريميوم مجانية", descEn: "Free premium filters", category: "edit", tag: "tweaked", icon: "aperture", catKey: "edit" },
  { id: 13, name: "PUBG Hack", descAr: "تصويب تلقائي و ESP", descEn: "Aimbot & ESP", category: "games", tag: "hacked", icon: "crosshair", isHot: true, isMostDownloaded: true, catKey: "games" },
  { id: 14, name: "Minecraft+", descAr: "جميع السكنات مفتوحة", descEn: "All skins unlocked", category: "games", tag: "hacked", icon: "box", catKey: "games" },
  { id: 15, name: "Roblox Mod", descAr: "روبوكس غير محدود", descEn: "Unlimited Robux", category: "games", tag: "modded", icon: "play", isNew: true, catKey: "games" },
  { id: 16, name: "YouTube Premium", descAr: "بدون إعلانات، تشغيل بالخلفية", descEn: "No ads, background play", category: "tweaked", tag: "tweaked", icon: "youtube", isHot: true, isMostDownloaded: true, catKey: "tweaked" },
  { id: 17, name: "Spotify++", descAr: "ميزات بريميوم مجانية", descEn: "Free premium features", category: "tweaked", tag: "tweaked", icon: "music", isHot: true, isMostDownloaded: true, catKey: "tweaked" },
  { id: 18, name: "SoundCloud++", descAr: "تحميل بدون إنترنت", descEn: "Offline download", category: "tweaked", tag: "tweaked", icon: "headphones", catKey: "tweaked" },
  { id: 19, name: "Netflix", descAr: "جميع المحتوى مفتوح", descEn: "All content unlocked", category: "tv", tag: "modded", icon: "film", isHot: true, isMostDownloaded: true, catKey: "tv" },
  { id: 20, name: "Disney+", descAr: "ديزني و مارفل مباشر", descEn: "Disney & Marvel streaming", category: "tv", tag: "modded", icon: "play-circle", catKey: "tv" },
  { id: 21, name: "Shahid VIP", descAr: "محتوى عربي بريميوم", descEn: "Premium Arabic content", category: "tv", tag: "tweaked", icon: "tv", isNew: true, catKey: "tv" },
  { id: 22, name: "Xcode Helper", descAr: "أدوات تطوير iOS", descEn: "iOS dev tools", category: "develop", tag: "modded", icon: "terminal", catKey: "develop" },
  { id: 23, name: "iSH Shell", descAr: "طرفية لينكس على iOS", descEn: "Linux terminal on iOS", category: "develop", tag: "tweaked", icon: "code", isNew: true, catKey: "develop" },
  { id: 24, name: "Pythonista+", descAr: "بايثون IDE بريميوم", descEn: "Premium Python IDE", category: "develop", tag: "modded", icon: "file-text", catKey: "develop" },
];

const CATEGORY_KEYS = ["social", "ai", "edit", "games", "tweaked", "tv", "develop"] as const;
const CATEGORY_ICONS: Record<string, string> = {
  social: "message-circle",
  ai: "cpu",
  edit: "edit-3",
  games: "play",
  tweaked: "settings",
  tv: "tv",
  develop: "terminal",
};
const CATEGORY_COLORS: Record<string, string> = {
  social: "#007AFF",
  ai: "#AF52DE",
  edit: "#FF9500",
  games: "#34C759",
  tweaked: "#5AC8FA",
  tv: "#FF3B30",
  develop: "#FF9500",
};

function getTagColor(tag: string, colors: ThemeColors) {
  switch (tag) {
    case "tweaked": return colors.tagTweaked;
    case "modded": return colors.tagModded;
    case "hacked": return colors.tagHacked;
    default: return colors.tint;
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const CAT_TRANSLATION_KEY: Record<string, string> = {
  social: "social",
  ai: "ai",
  edit: "edit",
  games: "games",
  tweaked: "tweakedApps",
  tv: "tv",
  develop: "develop",
};

function CategoryPill({ catKey, onPress }: { catKey: string; onPress: () => void }) {
  const { colors, t, fontAr } = useSettings();
  const icon = CATEGORY_ICONS[catKey];
  const label = t((CAT_TRANSLATION_KEY[catKey] || catKey) as any);
  return (
    <Pressable onPress={onPress} style={[styles.categoryPill, { backgroundColor: colors.background }]}>
      <Feather name={icon as any} size={14} color={colors.tint} style={{ marginRight: 5 }} />
      <Text style={[styles.categoryPillText, { color: colors.text, fontFamily: fontAr("SemiBold") }]}>{label}</Text>
    </Pressable>
  );
}

function FeaturedCard({ item }: { item: { id: number; title: string; subtitle: string; color: string } }) {
  const { fontAr } = useSettings();
  return (
    <View style={[styles.featuredCard, { width: SCREEN_WIDTH - 48 }]}>
      <View style={[styles.featuredGradient, { backgroundColor: item.color }]}>
        <View style={styles.featuredContent}>
          <Text style={[styles.featuredTitle, { fontFamily: fontAr("Bold") }]}>{item.title}</Text>
          <Text style={[styles.featuredSubtitle, { fontFamily: fontAr("Regular") }]}>{item.subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

function AppListRow({ app, showDivider, onPress }: { app: AppItem; showDivider: boolean; onPress: () => void }) {
  const { colors, t, fontAr, isArabic } = useSettings();
  const tagColor = getTagColor(app.tag, colors);
  return (
    <View>
      <Pressable style={styles.listRow} onPress={onPress}>
        <View style={[styles.listRowIcon, { backgroundColor: `${tagColor}15` }]}>
          <Feather name={app.icon as any} size={24} color={tagColor} />
        </View>
        <View style={styles.listRowInfo}>
          <Text style={[styles.listRowName, { color: colors.text }]} numberOfLines={1}>{app.name}</Text>
          <Text style={[styles.listRowDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]} numberOfLines={1}>
            {isArabic ? app.descAr : app.descEn}
          </Text>
        </View>
        <Pressable style={[styles.listRowGetButton, { backgroundColor: colors.card }]}>
          <Text style={[styles.listRowGetText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
        </Pressable>
      </Pressable>
      {showDivider && <View style={[styles.listRowDivider, { backgroundColor: colors.separator }]} />}
    </View>
  );
}

function StackedSection({ title, subtitle, data, onAppPress, sectionType }: { title: string; subtitle: string; data: AppItem[]; onAppPress: (app: AppItem) => void; sectionType: string }) {
  const { colors, fontAr, isArabic } = useSettings();
  const router = useRouter();
  const pages = chunkArray(data, 3);
  return (
    <View style={styles.section}>
      <Pressable
        style={styles.sectionHeader}
        onPress={() => router.push({ pathname: "/section/[type]", params: { type: sectionType, title } })}
      >
        <Feather name={isArabic ? "chevron-left" : "chevron-right"} size={18} color={colors.textSecondary} />
        <View style={isArabic ? { alignItems: "flex-end", flex: 1 } : { flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>{title}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>{subtitle}</Text>
        </View>
      </Pressable>
      <FlatList
        data={pages}
        horizontal
        inverted={isArabic}
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
  const { colors, t, fontAr, isArabic } = useSettings();
  const tagColor = getTagColor(app.tag, colors);
  return (
    <Pressable style={styles.appRow} onPress={onPress}>
      <View style={[styles.appIcon, { backgroundColor: `${tagColor}15` }]}>
        <Feather name={app.icon as any} size={22} color={tagColor} />
      </View>
      <View style={styles.appInfo}>
        <Text style={[styles.appName, { color: colors.text }]}>{app.name}</Text>
        <Text style={[styles.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
          {isArabic ? app.descAr : app.descEn}
        </Text>
      </View>
      <Pressable style={[styles.getButton, { backgroundColor: colors.card }]}>
        <Text style={[styles.getButtonText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
      </Pressable>
    </Pressable>
  );
}

function CategoryCard({ catKey, onPress }: { catKey: string; onPress: () => void }) {
  const { t, fontAr } = useSettings();
  return (
    <Pressable style={[styles.catCard, { backgroundColor: CATEGORY_COLORS[catKey] }]} onPress={onPress}>
      <Feather name={CATEGORY_ICONS[catKey] as any} size={28} color="rgba(255,255,255,0.9)" style={styles.catCardIcon} />
      <Text style={[styles.catCardLabel, { fontFamily: fontAr("Bold") }]}>{t((CAT_TRANSLATION_KEY[catKey] || catKey) as any)}</Text>
    </Pressable>
  );
}

function CategoryPageContent({ catKey, onClose, onAppPress }: { catKey: string; onClose: () => void; onAppPress: (app: AppItem) => void }) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { colors, t, fontAr } = useSettings();
  const apps = ALL_APPS.filter((a) => a.catKey === catKey);

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top, backgroundColor: colors.background }]}>
      <View style={styles.catPageHeader}>
        <GlassBackButton onPress={onClose} />
      </View>
      <View style={styles.catPageTitleRow}>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>{t((CAT_TRANSLATION_KEY[catKey] || catKey) as any)}</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 80 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.appList}>
          {apps.map((app, idx) => (
            <View key={app.id}>
              <AppRow app={app} onPress={() => onAppPress(app)} />
              {idx < apps.length - 1 && <View style={[styles.listRowDivider, { backgroundColor: colors.separator }]} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default function PlusScreen() {
  const insets = useSafeAreaInsets();
  const { colors, t, fontAr, isArabic } = useSettings();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const catToAppTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const featuredRef = useRef<FlatList>(null);
  const featuredIndex = useRef(0);
  const isWeb = Platform.OS === "web";

  const FEATURED_APPS = [
    { id: 1, title: t("featuredBlackFriday"), subtitle: t("featuredBlackFridaySub"), color: "#007AFF" },
    { id: 2, title: t("featuredNewApps"), subtitle: t("featuredNewAppsSub"), color: "#5856D6" },
    { id: 3, title: t("featuredPremium"), subtitle: t("featuredPremiumSub"), color: "#FF9500" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      featuredIndex.current = (featuredIndex.current + 1) % FEATURED_APPS.length;
      featuredRef.current?.scrollToOffset({
        offset: featuredIndex.current * (SCREEN_WIDTH - 48 + 12),
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
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, isArabic && { flexDirection: "row-reverse" }]}>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
          {isArabic ? (
            <>{"مسماري "}<Text style={{ fontFamily: "Inter_700Bold" }}>+</Text></>
          ) : (
            <>{"Mismari "}<Text style={{ fontFamily: "Inter_700Bold" }}>+</Text></>
          )}
        </Text>
        <TouchableOpacity style={[styles.profileButton, { backgroundColor: colors.card }]} onPress={() => setShowAccount(true)} activeOpacity={0.6}>
          <Feather name="user" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.categoryWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.categoryRow, isArabic && { paddingRight: 16, paddingLeft: 32 }]}
          style={[styles.categoryScrollView, isArabic && { transform: [{ scaleX: -1 }] }]}
        >
          {CATEGORY_KEYS.map((catKey) => (
            <View key={catKey} style={isArabic ? { transform: [{ scaleX: -1 }] } : undefined}>
              <CategoryPill catKey={catKey} onPress={() => setActiveCat(catKey)} />
            </View>
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
            <Text style={[styles.sectionLabel, { color: colors.tint, fontFamily: fontAr("SemiBold"), writingDirection: "ltr" }]}>{t("featured")}</Text>
          </View>
          <FlatList
            ref={featuredRef}
            data={FEATURED_APPS}
            horizontal
            inverted={isArabic}
            pagingEnabled={false}
            snapToInterval={SCREEN_WIDTH - 48 + 12}
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
              const snap = SCREEN_WIDTH - 48 + 12;
              const inputRange = [(i - 1) * snap, i * snap, (i + 1) * snap];
              const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 20, 8], extrapolate: "clamp" });
              const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: "clamp" });
              return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: colors.tint }]} />;
            })}
          </View>
        </View>

        <StackedSection title={t("trending")} subtitle={t("trendingSub")} data={hotApps} onAppPress={handleAppPress} sectionType="trending" />
        <StackedSection title={t("mostDownloaded")} subtitle={t("mostDownloadedSub")} data={mostDownloaded} onAppPress={handleAppPress} sectionType="mostDownloaded" />
        <StackedSection title={t("recentlyAdded")} subtitle={t("recentlyAddedSub")} data={newAdds} onAppPress={handleAppPress} sectionType="recentlyAdded" />

        <View style={styles.section}>
          <View style={[styles.sectionHeader, isArabic && { justifyContent: "flex-end" }]}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>{t("sections")}</Text>
          </View>
          <View style={styles.catGrid}>
            {CATEGORY_KEYS.map((catKey) => (
              <CategoryCard key={catKey} catKey={catKey} onPress={() => setActiveCat(catKey)} />
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 22,
  },
  sectionSubtitle: {
    fontSize: 13,
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
  featuredTitle: {
    fontSize: 22,
    color: "#FFF",
  },
  featuredSubtitle: {
    fontSize: 14,
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
  },
  listRowDesc: {
    fontSize: 13,
  },
  listRowGetButton: {
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 18,
  },
  listRowGetText: {
    fontSize: 15,
  },
  listRowDivider: {
    height: StyleSheet.hairlineWidth,
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
  },
  appDesc: {
    fontSize: 13,
  },
  getButton: {
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 18,
  },
  getButtonText: {
    fontSize: 15,
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
