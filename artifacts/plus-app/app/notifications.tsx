import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSettings } from "@/contexts/SettingsContext";
import { type NotifType } from "@/utils/notificationStorage";
import { emitOpenApp } from "@/utils/openAppSignal";

const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
const BASE_URL = API_DOMAIN ? `https://${API_DOMAIN}` : "";

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
    if (mins < 1)  return "الآن";
    if (mins < 60) return `منذ ${mins} د`;
    if (hours < 24) return `منذ ${hours} س`;
    return `منذ ${days} ي`;
  } else {
    if (mins < 1)  return "now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
}

function notifIcon(type: string) {
  if (type === "broadcast")    return { name: "bell" as const, color: "#9fbcff" };
  if (type === "app_added")    return { name: "plus-circle" as const, color: "#34C759" };
  if (type === "app_updated")  return { name: "refresh-cw" as const, color: "#FF9500" };
  return { name: "bell" as const, color: "#9fbcff" };
}

function resolveIcon(appIcon: string | null | undefined): string | null {
  if (!appIcon) return null;
  if (appIcon.startsWith("http")) return appIcon;
  return `${BASE_URL}${appIcon}`;
}

interface NotifRowProps {
  notif: ServerNotification;
  onPress: (notif: ServerNotification) => void;
}

function NotifRow({ notif, onPress }: NotifRowProps) {
  const { colors, fontAr, isArabic } = useSettings();
  const icon = notifIcon(notif.type);
  const time = timeAgo(notif.sentAt, isArabic);
  const iconUri = resolveIcon(notif.appIcon);

  return (
    <Pressable
      style={[styles.row, { backgroundColor: colors.background }]}
      onPress={() => onPress(notif)}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${icon.color}18` }]}>
        {iconUri && (notif.type === "app_added" || notif.type === "app_updated") ? (
          <Image source={{ uri: iconUri }} style={styles.appIcon} />
        ) : (
          <Feather name={icon.name} size={20} color={icon.color} />
        )}
      </View>

      <View style={[styles.rowContent, isArabic && { alignItems: "flex-end" }]}>
        <Text
          style={[
            styles.rowTitle,
            { color: colors.text, fontFamily: fontAr("SemiBold"), textAlign: isArabic ? "right" : "left" },
          ]}
          numberOfLines={1}
        >
          {notif.title}
        </Text>
        <Text
          style={[
            styles.rowBody,
            { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" },
          ]}
          numberOfLines={2}
        >
          {notif.body}
        </Text>
        <Text style={[styles.rowTime, { color: `${colors.textSecondary}80`, fontFamily: "Inter_400Regular" }]}>
          {time}
        </Text>
      </View>
    </Pressable>
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
    } catch (e: any) {
      setError(isArabic ? "فشل تحميل الإشعارات" : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = notifications.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "broadcast") return n.type === "broadcast";
    if (activeTab === "apps") return n.type === "app_added" || n.type === "app_updated";
    return true;
  });

  const handleNotifPress = (notif: ServerNotification) => {
    if (notif.appId) {
      emitOpenApp(notif.appId);
      router.back();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, isArabic && { flexDirection: "row-reverse" }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name={isArabic ? "arrow-right" : "arrow-left"} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
          {isArabic ? "الإشعارات" : "Notifications"}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsRow, isArabic && { flexDirection: "row-reverse" }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                active && { borderBottomColor: colors.tint, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: active ? colors.tint : colors.textSecondary,
                    fontFamily: fontAr(active ? "Bold" : "Regular"),
                  },
                ]}
              >
                {isArabic ? tab.labelAr : tab.labelEn}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.tint} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={40} color={`${colors.textSecondary}50`} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
            {error}
          </Text>
          <TouchableOpacity onPress={load} style={[styles.retryBtn, { borderColor: colors.tint }]}>
            <Text style={[styles.retryText, { color: colors.tint, fontFamily: fontAr("Regular") }]}>
              {isArabic ? "إعادة المحاولة" : "Retry"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Feather name="bell-off" size={40} color={`${colors.textSecondary}50`} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
            {isArabic ? "لا توجد إشعارات" : "No notifications"}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.tint}
            />
          }
        >
          {filtered.map((notif) => (
            <NotifRow key={notif.id} notif={notif} onPress={handleNotifPress} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: "flex-start" },
  headerTitle: { fontSize: 20 },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 15 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 16, marginTop: 8 },
  retryBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderRadius: 8 },
  retryText: { fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  appIcon: { width: 44, height: 44, borderRadius: 12 },
  rowContent: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15 },
  rowBody: { fontSize: 13, lineHeight: 18 },
  rowTime: { fontSize: 12, marginTop: 2 },
});
