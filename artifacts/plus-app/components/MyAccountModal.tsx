import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
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

interface SubscriberInfo {
  subscriberName?: string | null;
  phone?: string | null;
  email?: string | null;
  udid?: string | null;
  deviceType?: string | null;
  groupName?: string | null;
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

  const fields: { labelKey: string; value?: string | null }[] = [
    { labelKey: "subName", value: subscriber?.subscriberName },
    { labelKey: "subPhone", value: subscriber?.phone },
    { labelKey: "subEmail", value: subscriber?.email },
    { labelKey: "subGroup", value: subscriber?.groupName },
    { labelKey: "subDeviceType", value: subscriber?.deviceType },
    { labelKey: "subDate", value: formatDate(subscriber?.activatedAt) },
    { labelKey: "subExpiry", value: formatDate(subscriber?.expiresAt) },
    { labelKey: "subUdid", value: subscriber?.udid },
  ];

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
          {/* Profile header */}
          <View style={[styles.profileHeader, { backgroundColor: colors.card }]}>
            <View style={[styles.avatarLarge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.tint }]}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatarPhoto} />
              ) : (
                <Feather name="user" size={40} color={colors.tint} />
              )}
            </View>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={[styles.profileName, { color: colors.text, fontFamily: fontAr("Bold") }]}>
                {subscriber?.subscriberName || t("guestUser")}
              </Text>
              {subscriber?.phone ? (
                <Text style={[styles.profilePhone, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                  {subscriber.phone}
                </Text>
              ) : null}
              <View style={[styles.statusBadge, { backgroundColor: isActive ? "#22c55e20" : "#ef444420" }]}>
                <Text style={[styles.statusText, { color: isActive ? "#22c55e" : "#ef4444", fontFamily: fontAr("SemiBold") }]}>
                  {t(isActive ? "subActive" : "subInactive")}
                </Text>
              </View>
            </View>
          </View>

          {/* Subscription code */}
          <View style={[styles.codeCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.codeLabel, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
              {isArabic ? "كود الاشتراك" : "Subscription Code"}
            </Text>
            <Text style={[styles.codeValue, { color: colors.tint, fontFamily: "Inter_600SemiBold" }]}>
              {subscriptionCode || "—"}
            </Text>
          </View>

          {/* Fields */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <Text style={[styles.loadingText, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                {isArabic ? "جارٍ التحميل..." : "Loading..."}
              </Text>
            </View>
          ) : subscriber ? (
            <View style={[styles.fieldsCard, { backgroundColor: colors.card }]}>
              {fields.map((f, i) => (
                <View
                  key={f.labelKey}
                  style={[
                    styles.fieldRow,
                    { borderBottomColor: colors.cardBorder },
                    isArabic && { flexDirection: "row-reverse" },
                    i === fields.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                    {t(f.labelKey as any)}
                  </Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      { color: colors.text, fontFamily: f.labelKey === "subUdid" ? "Inter_400Regular" : fontAr("SemiBold") },
                      isArabic && { textAlign: "left" },
                    ]}
                    numberOfLines={f.labelKey === "subUdid" ? 2 : 1}
                    selectable
                  >
                    {f.value || "—"}
                  </Text>
                </View>
              ))}
            </View>
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
    top: 220,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
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
    marginBottom: 20,
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
    padding: 24,
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
  },
  avatarLarge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    overflow: "hidden",
  },
  avatarPhoto: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  profileName: { fontSize: 20 },
  profilePhone: { fontSize: 14 },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontSize: 13 },
  codeCard: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 12,
    alignItems: "center",
    gap: 4,
  },
  codeLabel: { fontSize: 12 },
  codeValue: { fontSize: 22, letterSpacing: 2 },
  fieldsCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  fieldLabel: { fontSize: 13, flex: 1 },
  fieldValue: { fontSize: 13, flex: 2, textAlign: "right" },
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
