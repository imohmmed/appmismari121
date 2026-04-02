import { Feather } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import AppIconImg from "@/components/AppIconImg";
import ProfileAvatar from "@/components/ProfileAvatar";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  ImageBackground,
  Linking,
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
import { useCategories, useApps, useBanners, getCategoryColor, getTagColor, type ApiApp, type ApiCategory, type ApiBanner } from "@/hooks/useAppData";
import { registerOpenCategoryHandler } from "@/utils/openCategorySignal";
import { registerOpenAppHandler } from "@/utils/openAppSignal";
import { consumePendingOpenApp, getUnreadCount } from "@/utils/notificationStorage";

const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
const BASE_URL = API_DOMAIN ? `https://${API_DOMAIN}` : "";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_WIDTH = SCREEN_WIDTH - 80;

// ─── App Row ──────────────────────────────────────────────────────────────────
function AppListRow({ app, showDivider, onPress }: { app: ApiApp; showDivider: boolean; onPress: () => void }) {
  const { colors, t, fontAr, isArabic } = useSettings();
  const tagColor = getTagColor(app.tag);
  const catLabel = isArabic
    ? (app.categoryNameAr || app.categoryName || "")
    : (app.categoryName || app.categoryNameAr || "");
  const textAlign = isArabic ? "right" : "left";
  const appFont = (name: string) => /[\u0600-\u06FF]/.test(name) ? fontAr("SemiBold") : "Inter_600SemiBold";
  return (
    <View>
      <Pressable style={[styles.listRow, !isArabic && { flexDirection: "row" }]} onPress={onPress}>
        {isArabic ? (
          <>
            <View style={[styles.listRowGetButton, { backgroundColor: colors.card }]}>
              <Text style={[styles.listRowGetText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
            </View>
            <View style={[styles.listRowInfo, { alignItems: "flex-end" }]}>
              <Text style={[styles.listRowName, { color: colors.text, textAlign, fontFamily: appFont(app.name) }]} numberOfLines={1}>{app.name}</Text>
              <Text style={[styles.listRowDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign }]} numberOfLines={1}>{catLabel}</Text>
            </View>
            <AppIconImg icon={app.icon} size={56} borderRadius={14} />
          </>
        ) : (
          <>
            <AppIconImg icon={app.icon} size={56} borderRadius={14} />
            <View style={[styles.listRowInfo, { alignItems: "flex-start" }]}>
              <Text style={[styles.listRowName, { color: colors.text, textAlign, fontFamily: appFont(app.name) }]} numberOfLines={1}>{app.name}</Text>
              <Text style={[styles.listRowDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign }]} numberOfLines={1}>{catLabel}</Text>
            </View>
            <View style={[styles.listRowGetButton, { backgroundColor: colors.card }]}>
              <Text style={[styles.listRowGetText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
            </View>
          </>
        )}
      </Pressable>
      {showDivider && <View style={[styles.listRowDivider, { backgroundColor: colors.separator }]} />}
    </View>
  );
}

// ─── Stacked Section ──────────────────────────────────────────────────────────
function StackedSection({ title, subtitle, apps, onAppPress }: {
  title: string; subtitle: string; apps: ApiApp[];
  onAppPress: (app: ApiApp) => void;
}) {
  const { colors, fontAr, isArabic } = useSettings();
  const pages = [];
  for (let i = 0; i < apps.length; i += 3) pages.push(apps.slice(i, i + 3));
  if (apps.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, isArabic && { justifyContent: "flex-end" }]}>
        <View style={isArabic ? { alignItems: "flex-end", flex: 1 } : { flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>{title}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>{subtitle}</Text>
        </View>
      </View>
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
  const { colors, t, fontAr, isArabic, subscriptionCode } = useSettings();
  const { apps, loading } = useApps({ categoryId: cat.id, limit: 50, code: subscriptionCode || undefined });
  const tagColor = getCategoryColor(cat.id);
  const desc = (app: ApiApp) => isArabic
    ? (app.descAr || app.descriptionAr || app.description || "")
    : (app.descEn || app.descriptionEn || "");
  const catName = isArabic ? (cat.nameAr || cat.name) : (cat.name || cat.nameAr);
  const textAlign = isArabic ? ("right" as const) : ("left" as const);
  const appFont = (name: string) => /[\u0600-\u06FF]/.test(name) ? fontAr("SemiBold") : "Inter_600SemiBold";

  const appCountText = `${cat.appCount}`;

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.catPageHeader, isArabic && { flexDirection: "row-reverse" }]}>
        <GlassBackButton onPress={onClose} />
      </View>
      <View style={[styles.catBanner, { backgroundColor: tagColor }]}>
        <Text style={[styles.catBannerName, { fontFamily: fontAr("Bold") }]}>
          {catName}
        </Text>
        <Text style={[styles.catBannerCount, { fontFamily: fontAr("Regular") }]}>
          {appCountText} {isArabic ? "تطبيق" : (Number(appCountText) === 1 ? "app" : "apps")}
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
                  <Pressable style={[styles.appRow, !isArabic && { flexDirection: "row" }]} onPress={() => onAppPress(app)}>
                    {isArabic ? (
                      <>
                        <View style={[styles.getButton, { backgroundColor: colors.card }]}>
                          <Text style={[styles.getButtonText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
                        </View>
                        <View style={[styles.appInfo, { alignItems: "flex-end" }]}>
                          <Text style={[styles.appName, { color: colors.text, textAlign, fontFamily: appFont(app.name) }]}>{app.name}</Text>
                          <Text style={[styles.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign }]}>{desc(app)}</Text>
                        </View>
                        <AppIconImg icon={app.icon} size={52} borderRadius={14} />
                      </>
                    ) : (
                      <>
                        <AppIconImg icon={app.icon} size={52} borderRadius={14} />
                        <View style={[styles.appInfo, { alignItems: "flex-start" }]}>
                          <Text style={[styles.appName, { color: colors.text, textAlign, fontFamily: appFont(app.name) }]}>{app.name}</Text>
                          <Text style={[styles.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign }]}>{desc(app)}</Text>
                        </View>
                        <View style={[styles.getButton, { backgroundColor: colors.card }]}>
                          <Text style={[styles.getButtonText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
                        </View>
                      </>
                    )}
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
  const { fontAr, isArabic } = useSettings();
  const color = getCategoryColor(cat.id);
  const icon = cat.icon && !cat.icon.match(/[\u{1F300}-\u{1FAFF}]/u) ? cat.icon : null;
  const emoji = cat.icon && cat.icon.match(/[\u{1F300}-\u{1FAFF}]/u) ? cat.icon : null;
  const catName = isArabic ? (cat.nameAr || cat.name) : (cat.name || cat.nameAr);
  return (
    <Pressable style={[styles.catCard, { backgroundColor: color }]} onPress={onPress}>
      {icon ? (
        <Feather name={icon as any} size={28} color="rgba(255,255,255,0.9)" style={styles.catCardIcon} />
      ) : (
        <Text style={[styles.catCardEmoji, styles.catCardIcon]}>{emoji || "📱"}</Text>
      )}
      <Text style={[styles.catCardLabel, { fontFamily: fontAr("Bold") }]}>
        {catName}
      </Text>
    </Pressable>
  );
}

// ─── Featured Card ────────────────────────────────────────────────────────────
const BANNER_COLORS = ["#007AFF", "#5856D6", "#FF9500", "#34C759", "#FF3B30", "#AF52DE"];
const BANNER_WIDTH = SCREEN_WIDTH - 48;
const BANNER_HEIGHT = BANNER_WIDTH * (9 / 16);

function FeaturedCard({ item, index }: { item: ApiBanner; index: number }) {
  const { fontAr, isArabic } = useSettings();
  const title = (isArabic ? item.title : item.titleEn) || item.title;
  const subtitle = (isArabic ? item.description : item.descriptionEn) || item.description || "";
  const color = BANNER_COLORS[index % BANNER_COLORS.length];
  const imageUrl = (isArabic ? item.image : item.imageEn) || item.image;
  const handlePress = () => {
    if (item.link) Linking.openURL(item.link);
  };

  if (imageUrl) {
    const domain = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
    const src = imageUrl.startsWith("http") ? imageUrl : `https://${domain}${imageUrl}`;
    return (
      <Pressable
        style={[styles.featuredCard, { width: BANNER_WIDTH }]}
        onPress={handlePress}
        disabled={!item.link}
      >
        <ImageBackground
          source={{ uri: src }}
          style={[styles.featuredGradient, { height: BANNER_HEIGHT }]}
          imageStyle={{ borderRadius: 16 }}
          resizeMode="cover"
        >
          <View style={styles.featuredOverlay}>
            <View style={styles.featuredContent}>
              <Text style={[styles.featuredTitle, { fontFamily: fontAr("Bold") }]}>{title}</Text>
              {subtitle ? <Text style={[styles.featuredSubtitle, { fontFamily: fontAr("Regular") }]}>{subtitle}</Text> : null}
            </View>
          </View>
        </ImageBackground>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.featuredCard, { width: BANNER_WIDTH }]}
      onPress={handlePress}
      disabled={!item.link}
    >
      <View style={[styles.featuredGradient, { backgroundColor: color, height: BANNER_HEIGHT }]}>
        <View style={styles.featuredContent}>
          <Text style={[styles.featuredTitle, { fontFamily: fontAr("Bold") }]}>{title}</Text>
          {subtitle ? <Text style={[styles.featuredSubtitle, { fontFamily: fontAr("Regular") }]}>{subtitle}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PlusScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const { colors, t, fontAr, isArabic, subscriptionCode, appName, appNameEn } = useSettings();
  const [activeCat, setActiveCat] = useState<ApiCategory | null>(null);
  const [selectedApp, setSelectedApp] = useState<ApiApp | null>(null);
  const [catSelectedApp, setCatSelectedApp] = useState<ApiApp | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const catToAppTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const featuredRef = useRef<FlatList>(null);
  const featuredIndex = useRef(0);
  const mainScrollRef = useRef<ScrollView>(null);
  const isWeb = Platform.OS === "web";

  // ── Fetch from API ──────────────────────────────────────────────────────────
  const { categories } = useCategories();
  const code = subscriptionCode || undefined;
  const { apps: hotApps }      = useApps({ section: "trending",       limit: 30, code });
  const { apps: mostDownloaded } = useApps({ section: "most_downloaded", limit: 30, code });
  const { apps: newAdds }      = useApps({ section: "latest",         limit: 15, code });
  const { banners } = useBanners();

  const activeDetailApp = selectedApp || catSelectedApp;
  const { apps: relatedCategoryApps } = useApps({
    categoryId: activeDetailApp?.categoryId,
    limit: 31,
    skip: !activeDetailApp?.categoryId,
    code,
  });
  const relatedApps = relatedCategoryApps.filter(a => a.id !== activeDetailApp?.id).slice(0, 30);

  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as any, () => {
      setCatSelectedApp(null);
      setSelectedApp(null);
      setActiveCat(null);
      setShowAccount(false);
      mainScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    return registerOpenCategoryHandler((categoryId) => {
      const cat = categories.find(c => c.id === categoryId);
      if (cat) {
        setActiveCat(null);
        setSelectedApp(null);
        setCatSelectedApp(null);
        setTimeout(() => setActiveCat(cat), 100);
      }
    });
  }, [categories]);

  // ── Load unread notification count ──────────────────────────────────────────
  useEffect(() => {
    getUnreadCount().then(setUnreadCount);
  }, []);

  // ── Open app from notification signal (in-app tap) ──────────────────────────
  useEffect(() => {
    return registerOpenAppHandler(async (appId) => {
      if (!BASE_URL) return;
      try {
        const res = await fetch(`${BASE_URL}/api/apps/${appId}`);
        if (!res.ok) return;
        const app: ApiApp = await res.json();
        setActiveCat(null);
        setCatSelectedApp(null);
        setSelectedApp(null);
        setTimeout(() => setSelectedApp(app), 100);
      } catch {}
    });
  }, []);

  // ── Consume pending open app (from notification banner tap while app closed) ─
  useEffect(() => {
    consumePendingOpenApp().then(async (appId) => {
      if (!appId || !BASE_URL) return;
      try {
        const res = await fetch(`${BASE_URL}/api/apps/${appId}`);
        if (!res.ok) return;
        const app: ApiApp = await res.json();
        setTimeout(() => setSelectedApp(app), 500);
      } catch {}
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (banners.length === 0) return;
      featuredIndex.current = (featuredIndex.current + 1) % banners.length;
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
        {/* Title */}
        <View style={[styles.headerTitleBlock, isArabic && { alignItems: "flex-end" }]}>
          {isArabic
            ? <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>{appName}+</Text>
            : <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{appNameEn}+</Text>
          }
        </View>
        <View style={[styles.headerActions, isArabic && { flexDirection: "row-reverse" }]}>
          {/* Bell icon */}
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => router.push("/notifications")}
            activeOpacity={0.7}
          >
            <Feather name="bell" size={22} color={colors.text} />
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.tint }]}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Profile */}
          <TouchableOpacity style={[styles.profileButton, { backgroundColor: colors.card, overflow: "hidden" }]} onPress={() => setShowAccount(true)} activeOpacity={0.6}>
            <ProfileAvatar size={36} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Category Pills + Search (merged) ───────────────────────────────── */}
      <View style={styles.categoryWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.categoryRow, isArabic && { paddingRight: 16, paddingLeft: 32 }]}
          style={[styles.categoryScrollView, isArabic && { transform: [{ scaleX: -1 }] }]}
        >
          {/* Category pills from API */}
          {categories.map((cat) => (
            <View key={cat.id} style={isArabic ? { transform: [{ scaleX: -1 }] } : undefined}>
              <Pressable
                onPress={() => setActiveCat(cat)}
                style={[styles.categoryPill, { backgroundColor: colors.background }]}
              >
                <Text style={[styles.catPillEmoji]}>{cat.icon && cat.icon.length <= 2 ? cat.icon : "📱"} </Text>
                <Text style={[styles.categoryPillText, { color: colors.text, fontFamily: fontAr("SemiBold") }]}>
                  {isArabic ? (cat.nameAr || cat.name) : (cat.name || cat.nameAr)}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        ref={mainScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 80 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Featured banners */}
        <View style={{ marginTop: 8 }}>
          <FlatList
            ref={featuredRef}
            data={banners}
            horizontal
            inverted={isArabic}
            pagingEnabled={false}
            snapToInterval={SCREEN_WIDTH - 48 + 12}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item, index }) => <FeaturedCard item={item} index={index} />}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
          />
          <View style={styles.paginationDots}>
            {banners.map((_, i) => {
              const snap = SCREEN_WIDTH - 48 + 12;
              const inputRange = [(i - 1) * snap, i * snap, (i + 1) * snap];
              const dotWidth   = scrollX.interpolate({ inputRange, outputRange: [8, 20, 8], extrapolate: "clamp" });
              const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: "clamp" });
              return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: colors.tint }]} />;
            })}
          </View>
        </View>

        {/* Sections — data from API */}
        <StackedSection title={t("trending")} subtitle={t("trendingSub")} apps={hotApps} onAppPress={handleAppPress} />
        <StackedSection title={t("mostDownloaded")} subtitle={t("mostDownloadedSub")} apps={mostDownloaded} onAppPress={handleAppPress} />
        <StackedSection title={t("recentlyAdded")} subtitle={t("recentlyAddedSub")} apps={newAdds} onAppPress={handleAppPress} />

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
            onAppPress={(app) => setCatSelectedApp(app)}
          />
        )}
      </SlidePanel>

      {/* App detail inside category — stacks on top of category panel */}
      <SlidePanel visible={catSelectedApp !== null} onClose={() => setCatSelectedApp(null)}>
        {catSelectedApp && (
          <AppDetailPanel
            app={catSelectedApp as any}
            onClose={() => setCatSelectedApp(null)}
            onCategoryPress={() => setCatSelectedApp(null)}
            relatedApps={relatedApps as any}
          />
        )}
      </SlidePanel>

      {/* App detail from home sections */}
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
            relatedApps={relatedApps as any}
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
  headerTitleBlock: {
    flex: 1,
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bellButton: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2, right: 2,
    minWidth: 16, height: 16,
    borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#000", fontSize: 10,
    fontFamily: "Inter_700Bold",
    lineHeight: 14,
  },
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
  featuredGradient: { borderRadius: 16, justifyContent: "flex-end" },
  featuredOverlay: { flex: 1, justifyContent: "flex-end", borderRadius: 16, padding: 24, backgroundColor: "rgba(0,0,0,0.3)" },
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
  catBanner: {
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  catBannerName: { fontSize: 22, color: "#FFF", textAlign: "center" },
  catBannerCount: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4, textAlign: "center" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyState: { alignItems: "center", paddingTop: 60 },
});
