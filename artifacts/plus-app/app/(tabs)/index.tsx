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
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";
import SlidePanel from "@/components/SlidePanel";
import AppDetailPanel from "@/components/AppDetailPanel";
import GlassBackButton from "@/components/GlassBackButton";
import AccountPanel from "@/components/AccountPanel";
import { useCategories, useApps, getCategoryColor, getTagColor, type ApiApp, type ApiCategory } from "@/hooks/useAppData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_WIDTH = SCREEN_WIDTH - 80;

// ─── App Row ──────────────────────────────────────────────────────────────────
function AppListRow({ app, showDivider, onPress }: { app: ApiApp; showDivider: boolean; onPress: () => void }) {
  const { colors, t, fontAr, isArabic } = useSettings();
  const tagColor = getTagColor(app.tag);
  const desc = (isArabic ? app.descAr : null) || app.description || "";
  return (
    <View>
      <Pressable style={styles.listRow} onPress={onPress}>
        <View style={[styles.listRowIcon, { backgroundColor: `${tagColor}15` }]}>
          <Feather name={(app.icon as any) || "box"} size={24} color={tagColor} />
        </View>
        <View style={styles.listRowInfo}>
          <Text style={[styles.listRowName, { color: colors.text }]} numberOfLines={1}>{app.name}</Text>
          <Text style={[styles.listRowDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]} numberOfLines={1}>{desc}</Text>
        </View>
        <View style={[styles.listRowGetButton, { backgroundColor: colors.card }]}>
          <Text style={[styles.listRowGetText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
        </View>
      </Pressable>
      {showDivider && <View style={[styles.listRowDivider, { backgroundColor: colors.separator }]} />}
    </View>
  );
}

// ─── Stacked Section ──────────────────────────────────────────────────────────
function StackedSection({ title, subtitle, apps, onAppPress, sectionType }: {
  title: string; subtitle: string; apps: ApiApp[];
  onAppPress: (app: ApiApp) => void; sectionType: string;
}) {
  const { colors, fontAr, isArabic } = useSettings();
  const router = useRouter();
  const pages = [];
  for (let i = 0; i < apps.length; i += 3) pages.push(apps.slice(i, i + 3));
  if (apps.length === 0) return null;
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

// ─── Category Page Content (slide panel) ─────────────────────────────────────
function CategoryPageContent({ cat, onClose, onAppPress }: {
  cat: ApiCategory; onClose: () => void; onAppPress: (app: ApiApp) => void;
}) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { colors, t, fontAr } = useSettings();
  const { apps, loading } = useApps({ categoryId: cat.id, limit: 50 });
  const tagColor = getCategoryColor(cat.id);
  const desc = (app: ApiApp) => app.description || "";

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top, backgroundColor: colors.background }]}>
      <View style={styles.catPageHeader}>
        <GlassBackButton onPress={onClose} />
      </View>
      <View style={styles.catPageTitleRow}>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
          {cat.nameAr || cat.name}
        </Text>
        <Text style={[styles.catAppCount, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
          {cat.appCount} {t("app" as any) || "تطبيق"}
        </Text>
      </View>
      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={tagColor} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: isWeb ? 34 : 80 }}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.appList}>
            {apps.map((app, idx) => {
              const tc = getTagColor(app.tag);
              return (
                <View key={app.id}>
                  <Pressable style={styles.appRow} onPress={() => onAppPress(app)}>
                    <View style={[styles.appIcon, { backgroundColor: `${tc}15` }]}>
                      <Feather name={(app.icon as any) || "box"} size={22} color={tc} />
                    </View>
                    <View style={styles.appInfo}>
                      <Text style={[styles.appName, { color: colors.text }]}>{app.name}</Text>
                      <Text style={[styles.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                        {desc(app)}
                      </Text>
                    </View>
                    <View style={[styles.getButton, { backgroundColor: colors.card }]}>
                      <Text style={[styles.getButtonText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
                    </View>
                  </Pressable>
                  {idx < apps.length - 1 && <View style={[styles.listRowDivider, { backgroundColor: colors.separator }]} />}
                </View>
              );
            })}
            {apps.length === 0 && (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={40} color={colors.textSecondary} />
                <Text style={[{ color: colors.textSecondary, fontFamily: fontAr("Medium"), marginTop: 12, fontSize: 15 }]}>لا توجد تطبيقات</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Category Card (grid) ─────────────────────────────────────────────────────
function CategoryCard({ cat, onPress }: { cat: ApiCategory; onPress: () => void }) {
  const { fontAr } = useSettings();
  const color = getCategoryColor(cat.id);
  const icon = cat.icon && !cat.icon.match(/[\u{1F300}-\u{1FAFF}]/u) ? cat.icon : null;
  const emoji = cat.icon && cat.icon.match(/[\u{1F300}-\u{1FAFF}]/u) ? cat.icon : null;
  return (
    <Pressable style={[styles.catCard, { backgroundColor: color }]} onPress={onPress}>
      {icon ? (
        <Feather name={icon as any} size={28} color="rgba(255,255,255,0.9)" style={styles.catCardIcon} />
      ) : (
        <Text style={[styles.catCardEmoji, styles.catCardIcon]}>{emoji || "📱"}</Text>
      )}
      <Text style={[styles.catCardLabel, { fontFamily: fontAr("Bold") }]}>
        {cat.nameAr || cat.name}
      </Text>
    </Pressable>
  );
}

// ─── Featured Card ────────────────────────────────────────────────────────────
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PlusScreen() {
  const insets = useSafeAreaInsets();
  const { colors, t, fontAr, isArabic } = useSettings();
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<ApiCategory | null>(null);
  const [selectedApp, setSelectedApp] = useState<ApiApp | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const catToAppTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const featuredRef = useRef<FlatList>(null);
  const featuredIndex = useRef(0);
  const isWeb = Platform.OS === "web";

  // ── Fetch from API ──────────────────────────────────────────────────────────
  const { categories } = useCategories();
  const { apps: hotApps }      = useApps({ section: "trending",       limit: 30 });
  const { apps: mostDownloaded } = useApps({ section: "most_downloaded", limit: 30 });
  const { apps: newAdds }      = useApps({ section: "latest",         limit: 15 });

  const FEATURED_APPS = [
    { id: 1, title: t("featuredBlackFriday"), subtitle: t("featuredBlackFridaySub"), color: "#007AFF" },
    { id: 2, title: t("featuredNewApps"),     subtitle: t("featuredNewAppsSub"),     color: "#5856D6" },
    { id: 3, title: t("featuredPremium"),     subtitle: t("featuredPremiumSub"),     color: "#FF9500" },
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

  const handleAppPress = useCallback((app: ApiApp) => setSelectedApp(app), []);

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top, backgroundColor: colors.background }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
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

      {/* ── Category Pills + Search (merged) ───────────────────────────────── */}
      <View style={styles.categoryWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.categoryRow, isArabic && { paddingRight: 16, paddingLeft: 32 }]}
          style={[styles.categoryScrollView, isArabic && { transform: [{ scaleX: -1 }] }]}
        >
          {/* Search pill — merged at the start */}
          <View style={isArabic ? { transform: [{ scaleX: -1 }] } : undefined}>
            <Pressable
              onPress={() => router.push("/(tabs)/search")}
              style={[styles.categoryPill, styles.searchPill, { backgroundColor: colors.card }]}
            >
              <Feather name="search" size={14} color={colors.tint} style={{ marginRight: 5 }} />
              <Text style={[styles.categoryPillText, { color: colors.tint, fontFamily: fontAr("SemiBold") }]}>
                {t("headerSearch" as any) || "بحث"}
              </Text>
            </Pressable>
          </View>

          {/* Category pills from API */}
          {categories.map((cat) => (
            <View key={cat.id} style={isArabic ? { transform: [{ scaleX: -1 }] } : undefined}>
              <Pressable
                onPress={() => setActiveCat(cat)}
                style={[styles.categoryPill, { backgroundColor: colors.background }]}
              >
                <Text style={[styles.catPillEmoji]}>{cat.icon && cat.icon.length <= 2 ? cat.icon : "📱"} </Text>
                <Text style={[styles.categoryPillText, { color: colors.text, fontFamily: fontAr("SemiBold") }]}>
                  {cat.nameAr || cat.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 80 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Featured banners */}
        <View style={{ marginTop: 8 }}>
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
              const dotWidth   = scrollX.interpolate({ inputRange, outputRange: [8, 20, 8], extrapolate: "clamp" });
              const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: "clamp" });
              return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: colors.tint }]} />;
            })}
          </View>
        </View>

        {/* Sections — data from API */}
        <StackedSection title={t("trending")} subtitle={t("trendingSub")} apps={hotApps} onAppPress={handleAppPress} sectionType="trending" />
        <StackedSection title={t("mostDownloaded")} subtitle={t("mostDownloadedSub")} apps={mostDownloaded} onAppPress={handleAppPress} sectionType="mostDownloaded" />
        <StackedSection title={t("recentlyAdded")} subtitle={t("recentlyAddedSub")} apps={newAdds} onAppPress={handleAppPress} sectionType="recentlyAdded" />

        {/* Categories grid — from API */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isArabic && { justifyContent: "flex-end" }]}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>{t("sections")}</Text>
            </View>
            <View style={styles.catGrid}>
              {categories.map((cat) => (
                <CategoryCard key={cat.id} cat={cat} onPress={() => setActiveCat(cat)} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Category slide panel */}
      <SlidePanel visible={activeCat !== null} onClose={() => setActiveCat(null)}>
        {activeCat && (
          <CategoryPageContent
            cat={activeCat}
            onClose={() => setActiveCat(null)}
            onAppPress={(app) => {
              setActiveCat(null);
              if (catToAppTimer.current) clearTimeout(catToAppTimer.current);
              catToAppTimer.current = setTimeout(() => setSelectedApp(app), 300);
            }}
          />
        )}
      </SlidePanel>

      {/* App detail panel */}
      <SlidePanel visible={selectedApp !== null} onClose={() => setSelectedApp(null)}>
        {selectedApp && (
          <AppDetailPanel
            app={selectedApp as any}
            onClose={() => setSelectedApp(null)}
            onCategoryPress={(catKey) => {
              setSelectedApp(null);
              const cat = categories.find(c => String(c.id) === String(catKey));
              if (cat) {
                if (catToAppTimer.current) clearTimeout(catToAppTimer.current);
                catToAppTimer.current = setTimeout(() => setActiveCat(cat), 300);
              }
            }}
            relatedApps={[]}
            onRelatedAppPress={(a) => setSelectedApp(a as any)}
          />
        )}
      </SlidePanel>

      <AccountPanel visible={showAccount} onClose={() => setShowAccount(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 28 },
  profileButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  categoryWrapper: { marginBottom: 4 },
  categoryScrollView: { flexGrow: 0 },
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
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4 },
      android: { elevation: 3 },
      web: { boxShadow: "0 1px 4px rgba(0,0,0,0.12)" },
    }),
  },
  searchPill: {
    borderWidth: 1,
    borderColor: "rgba(159,188,255,0.3)",
  },
  catPillEmoji: { fontSize: 13, marginRight: 2 },
  categoryPillText: { fontSize: 14 },
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 22 },
  sectionSubtitle: { fontSize: 13, marginTop: 2 },
  featuredCard: { borderRadius: 16, overflow: "hidden" },
  featuredGradient: { borderRadius: 16, padding: 24, minHeight: 180, justifyContent: "flex-end" },
  featuredContent: { gap: 4 },
  featuredTitle: { fontSize: 22, color: "#FFF" },
  featuredSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  paginationDots: {
    flexDirection: "row", justifyContent: "center",
    alignItems: "center", gap: 6, marginTop: 12,
  },
  dot: { height: 6, borderRadius: 3 },
  listRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  listRowIcon: { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  listRowInfo: { flex: 1, gap: 3 },
  listRowName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  listRowDesc: { fontSize: 13 },
  listRowGetButton: { paddingHorizontal: 22, paddingVertical: 7, borderRadius: 18 },
  listRowGetText: { fontSize: 15 },
  listRowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  appList: { paddingHorizontal: 20 },
  appRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14 },
  appIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  appInfo: { flex: 1, gap: 3 },
  appName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  appDesc: { fontSize: 13 },
  getButton: { paddingHorizontal: 22, paddingVertical: 7, borderRadius: 18 },
  getButtonText: { fontSize: 15 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  catCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 100, borderRadius: 16,
    padding: 16, justifyContent: "flex-end",
  },
  catCardIcon: { position: "absolute", top: 16, right: 16, opacity: 0.8 },
  catCardEmoji: { fontSize: 28 },
  catCardLabel: { fontSize: 16, color: "#FFF" },
  catPageHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  catPageTitleRow: { paddingHorizontal: 20, paddingBottom: 8 },
  catAppCount: { fontSize: 14, marginTop: 2 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyState: { alignItems: "center", paddingTop: 60 },
});
