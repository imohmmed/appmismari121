import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSettings } from "@/contexts/SettingsContext";
import { emitOpenApp } from "@/utils/openAppSignal";

const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
const BASE_URL = API_DOMAIN ? `https://${API_DOMAIN}` : "";

const ACCENT = "#9fbcff";

type Tab = "all" | "broadcast" | "apps";

const TABS: { key: Tab; labelAr: string; labelEn: string }[] = [
  { key: "all",       labelAr: "الكل",     labelEn: "All" },
  { key: "broadcast", labelAr: "رسائل",    labelEn: "Messages" },
  { key: "apps",      labelAr: "تطبيقات",  labelEn: "Apps" },
];

interface ServerNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  target: string;
  appId: number | null;
  appIcon: string | null;
  recipientCount: number;
  sentAt: string;
}

function timeAgo(iso: string, isArabic: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (isArabic) {
    if (mins < 1)   return "الآن";
    if (mins < 60)  return `منذ ${mins} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days === 1) return "أمس";
    return `منذ ${days} أيام`;
  } else {
    if (mins < 1)   return "Just now";
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  }
}

function getNotifMeta(type: string) {
  if (type === "app_added")   return { icon: "plus-circle" as const, color: "#30D158", bg: "#30D15818", labelAr: "تطبيق جديد",   labelEn: "New App" };
  if (type === "app_updated") return { icon: "refresh-cw"  as const, color: "#FF9F0A", bg: "#FF9F0A18", labelAr: "تحديث تطبيق",  labelEn: "Update" };
  return                             { icon: "bell"         as const, color: ACCENT,    bg: `${ACCENT}18`, labelAr: "رسالة",        labelEn: "Message" };
}

function resolveIcon(appIcon: string | null | undefined): string | null {
  if (!appIcon) return null;
  if (appIcon.startsWith("http")) return appIcon;
  return `${BASE_URL}${appIcon}`;
}

function NotifRow({ notif, onPress, index }: { notif: ServerNotification; onPress: (n: ServerNotification) => void; index: number }) {
  const { colors, fontAr, isArabic } = useSettings();
  const meta    = getNotifMeta(notif.type);
  const time    = timeAgo(notif.sentAt, isArabic);
  const iconUri = resolveIcon(notif.appIcon);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        delay: index * 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        delay: index * 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const isApp = notif.type === "app_added" || notif.type === "app_updated";

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Pressable
        style={({ pressed }) => [
          styles.row,
          { flexDirection: isArabic ? "row-reverse" : "row" },
          pressed && { opacity: 0.75, backgroundColor: `${ACCENT}08` },
        ]}
        onPress={() => onPress(notif)}
      >
        {/* Icon / App image */}
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          {iconUri && isApp ? (
            <Image source={{ uri: iconUri }} style={styles.appIcon} />
          ) : (
            <Feather name={meta.icon} size={20} color={meta.color} />
          )}
        </View>

        {/* Content */}
        <View style={[styles.rowContent, { alignItems: isArabic ? "flex-end" : "flex-start" }]}>
          {/* Top row: title + badge */}
          <View style={[styles.titleRow, { flexDirection: isArabic ? "row-reverse" : "row", alignSelf: "stretch" }]}>
            <Text
              style={[styles.rowTitle, { color: colors.text, fontFamily: fontAr("SemiBold"), textAlign: isArabic ? "right" : "left" }]}
              numberOfLines={1}
            >
              {notif.title || (isArabic ? "إشعار" : "Notification")}
            </Text>
            <View style={[styles.typeBadge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.typeBadgeText, { color: meta.color, fontFamily: fontAr("Regular") }]}>
                {isArabic ? meta.labelAr : meta.labelEn}
              </Text>
            </View>
          </View>

          {/* Body */}
          <Text
            style={[styles.rowBody, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]}
            numberOfLines={2}
          >
            {notif.body}
          </Text>

          {/* Time */}
          <Text style={[styles.rowTime, { color: `${colors.textSecondary}60`, fontFamily: "Inter_400Regular", textAlign: isArabic ? "right" : "left" }]}>
            {time}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, fontAr, isArabic } = useSettings();

  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [notifications, setNotifications] = useState<ServerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${BASE_URL}/api/notifications`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      setError(isArabic ? "فشل تحميل الإشعارات" : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = notifications.filter((n) => {
    if (activeTab === "all")       return true;
    if (activeTab === "broadcast") return n.type === "broadcast";
    if (activeTab === "apps")      return n.type === "app_added" || n.type === "app_updated";
    return true;
  });

  const handleNotifPress = (notif: ServerNotification) => {
    if (notif.appId) {
      emitOpenApp(notif.appId);
      router.back();
    }
  };

  const counts = {
    all:       notifications.length,
    broadcast: notifications.filter(n => n.type === "broadcast").length,
    apps:      notifications.filter(n => n.type === "app_added" || n.type === "app_updated").length,
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>

      {/* ── Header ── */}
      <View style={[styles.header, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name={isArabic ? "arrow-right" : "arrow-left"} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold"), textAlign: "center" }]}>
          {isArabic ? "الإشعارات" : "Notifications"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Tabs ── */}
      <View style={[styles.tabsWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const count  = counts[tab.key];
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, active && { borderBottomColor: ACCENT, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Text style={[styles.tabText, { color: active ? ACCENT : colors.textSecondary, fontFamily: fontAr(active ? "SemiBold" : "Regular") }]}>
                  {isArabic ? tab.labelAr : tab.labelEn}
                </Text>
                {count > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: active ? `${ACCENT}25` : `${colors.textSecondary}18` }]}>
                    <Text style={[styles.countText, { color: active ? ACCENT : colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                      {count}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
            {isArabic ? "جاري التحميل..." : "Loading..."}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.textSecondary}12` }]}>
            <Feather name="wifi-off" size={32} color={`${colors.textSecondary}60`} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: fontAr("SemiBold") }]}>
            {isArabic ? "لا يوجد اتصال" : "Connection Error"}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
            {error}
          </Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn} activeOpacity={0.8}>
            <Feather name="refresh-cw" size={14} color={ACCENT} />
            <Text style={[styles.retryText, { fontFamily: fontAr("Regular") }]}>
              {isArabic ? "إعادة المحاولة" : "Try again"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconWrap, { backgroundColor: `${ACCENT}12` }]}>
            <Feather name="bell-off" size={32} color={`${ACCENT}70`} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: fontAr("SemiBold") }]}>
            {isArabic ? "لا توجد إشعارات" : "No notifications yet"}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign: "center" }]}>
            {isArabic ? "ستظهر هنا إشعارات التطبيقات والرسائل" : "App updates and messages will appear here"}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
          }
        >
          {filtered.map((notif, i) => (
            <NotifRow key={notif.id} notif={notif} onPress={handleNotifPress} index={i} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: "flex-start" },
  headerTitle: { fontSize: 18, flex: 1 },

  tabsWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 14 },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  countText: { fontSize: 10 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 },
  loadingText: { fontSize: 14, marginTop: 4 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 17 },
  emptySubtitle: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: `${ACCENT}18`,
    borderWidth: 1,
    borderColor: `${ACCENT}35`,
  },
  retryText: { fontSize: 14, color: ACCENT },

  row: {
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  appIcon: { width: 48, height: 48, borderRadius: 14 },

  rowContent: { flex: 1, gap: 4 },

  titleRow: {
    gap: 7,
    alignItems: "center",
    flexWrap: "wrap",
  },
  rowTitle: { fontSize: 15, flex: 1 },

  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  typeBadgeText: { fontSize: 10 },

  rowBody: { fontSize: 13, lineHeight: 19 },
  rowTime: { fontSize: 12, marginTop: 1 },
});
