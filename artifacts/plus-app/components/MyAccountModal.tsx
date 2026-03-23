import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface SubscriberInfo {
  subscriberName?: string | null;
  phone?: string | null;
  email?: string | null;
  udid?: string | null;
  deviceType?: string | null;
  groupName?: string | null;
  planName?: string | null;
  planNameAr?: string | null;
  planPrice?: number | null;
  planDurationDays?: number | null;
  balance?: number | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  isActive?: string | null;
  createdAt?: string | null;
}

interface MyAccountModalProps {
  visible: boolean;
  onClose: () => void;
  subscriber: SubscriberInfo | null;
  loading?: boolean;
  profilePhoto?: string;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  try {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export default function MyAccountModal({
  visible,
  onClose,
  subscriber,
  loading,
  profilePhoto,
}: MyAccountModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, t, fontAr, isArabic, subscriptionCode } = useSettings();
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;
  const panY = React.useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(false);
  const isClosing = React.useRef(false);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10,
      onPanResponderMove: (_, g) => { if (g.dy > 0) panY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.5) {
          onClose();
          Animated.timing(panY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (visible) {
      isClosing.current = false;
      setMounted(true);
      slideAnim.setValue(SCREEN_HEIGHT);
      backdropAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, damping: 25, stiffness: 300, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else if (mounted && !isClosing.current) {
      isClosing.current = true;
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setMounted(false);
        isClosing.current = false;
      });
    }
  }, [visible]);

  if (!mounted) return null;

  const isActive = subscriber?.isActive === "true";
  const planLabel = subscriber?.planNameAr || subscriber?.planName;
  const daysLeft = daysUntil(subscriber?.expiresAt);
  const balance = subscriber?.balance ?? 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + 10,
            transform: [{ translateY: Animated.add(slideAnim, panY) }],
          },
        ]}
      >
        <View {...panResponder.panHandlers}>
          <View style={[styles.handleBar, { backgroundColor: colors.separator }]} />
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.card }]} activeOpacity={0.6}>
              <Feather name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
              {t("myAccountDetails")}
            </Text>
            <View style={{ width: 32 }} />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces>

          {/* ── Profile Header ─────────────────────────────── */}
          <View style={[styles.profileHeader, { backgroundColor: colors.card }]}>
            <View style={[styles.avatarLarge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.tint }]}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatarPhoto} />
              ) : (
                <Feather name="user" size={40} color={colors.tint} />
              )}
            </View>
            <Text style={[styles.profileName, { color: colors.text, fontFamily: fontAr("Bold") }]}>
              {subscriber?.subscriberName || t("guestUser")}
            </Text>
            {subscriber?.phone ? (
              <Text style={[styles.profilePhone, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                {subscriber.phone}
              </Text>
            ) : null}
            {/* Status badge */}
            <View style={styles.badgeRow}>
              <View style={[styles.statusBadge, { backgroundColor: isActive ? "#22c55e20" : "#ef444420" }]}>
                <View style={[styles.statusDot, { backgroundColor: isActive ? "#22c55e" : "#ef4444" }]} />
                <Text style={[styles.statusText, { color: isActive ? "#22c55e" : "#ef4444", fontFamily: fontAr("SemiBold") }]}>
                  {t(isActive ? "subActive" : "subInactive")}
                </Text>
              </View>
              {planLabel ? (
                <View style={[styles.planBadge, { backgroundColor: `${colors.tint}18` }]}>
                  <Text style={[styles.planBadgeText, { color: colors.tint, fontFamily: fontAr("SemiBold") }]}>
                    {planLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── Subscription Code ──────────────────────────── */}
          <View style={[styles.codeCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.codeLabel, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
              {isArabic ? "كود الاشتراك" : "Subscription Code"}
            </Text>
            <Text style={[styles.codeValue, { color: colors.tint, fontFamily: "Inter_600SemiBold" }]} selectable>
              {subscriptionCode || "—"}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <Text style={[styles.loadingText, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                {isArabic ? "جارٍ التحميل..." : "Loading..."}
              </Text>
            </View>
          ) : subscriber ? (
            <>
              {/* ── Quick Stats Row ──────────────────────────── */}
              <View style={[styles.statsRow, isArabic && { flexDirection: "row-reverse" }]}>
                {/* Balance */}
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Feather name="credit-card" size={18} color={colors.tint} />
                  <Text style={[styles.statValue, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                    {balance.toLocaleString("ar-IQ")}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                    {isArabic ? "الرصيد (د.ع)" : "Balance (IQD)"}
                  </Text>
                </View>
                {/* Days left */}
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Feather name="clock" size={18} color={daysLeft !== null && daysLeft < 30 ? "#FF9F0A" : "#34C759"} />
                  <Text style={[
                    styles.statValue,
                    { color: daysLeft !== null && daysLeft < 30 ? "#FF9F0A" : "#34C759", fontFamily: "Inter_700Bold" }
                  ]}>
                    {daysLeft !== null ? (daysLeft > 0 ? daysLeft : 0) : "—"}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                    {isArabic ? "يوم متبقي" : "Days left"}
                  </Text>
                </View>
              </View>

              {/* ── Detail Fields ─────────────────────────────── */}
              <View style={[styles.fieldsCard, { backgroundColor: colors.card }]}>
                {[
                  { icon: "user", label: isArabic ? "الاسم" : "Name", value: subscriber.subscriberName, mono: false },
                  { icon: "phone", label: isArabic ? "رقم الهاتف" : "Phone", value: subscriber.phone, mono: true },
                  { icon: "mail", label: isArabic ? "البريد" : "Email", value: subscriber.email, mono: true },
                  { icon: "package", label: isArabic ? "الباقة" : "Plan", value: planLabel, mono: false },
                  { icon: "smartphone", label: isArabic ? "نوع الجهاز" : "Device", value: subscriber.deviceType, mono: false },
                  { icon: "users", label: isArabic ? "المجموعة" : "Group", value: subscriber.groupName, mono: false },
                  { icon: "calendar", label: isArabic ? "تاريخ التفعيل" : "Activated", value: formatDate(subscriber.activatedAt), mono: false },
                  { icon: "calendar", label: isArabic ? "تاريخ الانتهاء" : "Expires", value: formatDate(subscriber.expiresAt), mono: false },
                ].filter(f => f.value).map((field, i, arr) => (
                  <View
                    key={field.label}
                    style={[
                      styles.fieldRow,
                      { borderBottomColor: colors.cardBorder },
                      isArabic && { flexDirection: "row-reverse" },
                      i === arr.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={[styles.fieldIconWrap, { backgroundColor: `${colors.tint}12` }]}>
                      <Feather name={field.icon as any} size={13} color={colors.tint} />
                    </View>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                      {field.label}
                    </Text>
                    <Text
                      style={[
                        styles.fieldValue,
                        { color: colors.text, fontFamily: field.mono ? "Inter_400Regular" : fontAr("SemiBold") },
                        isArabic && { textAlign: "left" },
                      ]}
                      numberOfLines={1}
                      selectable
                    >
                      {field.value || "—"}
                    </Text>
                  </View>
                ))}
              </View>

              {/* ── UDID (separate collapsible-style card) ─── */}
              {subscriber.udid ? (
                <View style={[styles.udidCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.udidLabel, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                    UDID
                  </Text>
                  <Text style={[styles.udidValue, { color: colors.text, fontFamily: "Inter_400Regular" }]} selectable numberOfLines={2}>
                    {subscriber.udid}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
              <Feather name="user-x" size={36} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
                {t("noSubscription")}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                {t("noSubscriptionHint")}
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  panel: {
    position: "absolute",
    top: 120,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: { fontSize: 18, textAlign: "center" },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  profileHeader: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    overflow: "hidden",
    marginBottom: 2,
  },
  avatarPhoto: { width: 80, height: 80, borderRadius: 40 },
  profileName: { fontSize: 20, textAlign: "center" },
  profilePhone: { fontSize: 14, textAlign: "center", direction: "ltr" },
  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12 },
  planBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  planBadgeText: { fontSize: 12 },
  codeCard: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 10,
    alignItems: "center",
    gap: 4,
  },
  codeLabel: { fontSize: 11 },
  codeValue: { fontSize: 20, letterSpacing: 2 },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 11, textAlign: "center" },
  fieldsCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  fieldIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fieldLabel: { fontSize: 13, flex: 1 },
  fieldValue: { fontSize: 13, flex: 1.5, textAlign: "right" },
  udidCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    gap: 6,
  },
  udidLabel: { fontSize: 11 },
  udidValue: { fontSize: 12, lineHeight: 20, direction: "ltr" },
  loadingWrap: { alignItems: "center", paddingVertical: 40 },
  loadingText: { fontSize: 14 },
  emptyCard: {
    borderRadius: 20,
    padding: 36,
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 17 },
  emptyHint: { fontSize: 13, textAlign: "center" },
});
