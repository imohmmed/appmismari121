import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  PanResponder,
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
import SettingsPanel from "@/components/SettingsPanel";
import { useSign } from "@/hooks/useSign";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const DEFAULT_SOCIAL = [
  { key: "instagram", label: "Instagram", icon: "instagram" as const, color: "#E1306C", url: "" },
  { key: "telegram", label: "Telegram", icon: "send" as const, color: "#0088CC", url: "" },
  { key: "whatsapp", label: "WhatsApp", icon: "phone" as const, color: "#25D366", url: "" },
];

interface SocialLink { key: string; label: string; icon: "instagram" | "send" | "phone"; color: string; url: string; }

interface AccountPanelProps {
  visible: boolean;
  onClose: () => void;
}

export default function AccountPanel({ visible, onClose }: AccountPanelProps) {
  const insets = useSafeAreaInsets();
  const { colors, t, fontAr, isArabic, subscriptionCode } = useSettings();
  const { signStore, state: signState, error: signError, reset: resetSign } = useSign();
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;
  const panY = React.useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [socialLinks, setSocialLinks] = React.useState<SocialLink[]>(DEFAULT_SOCIAL);
  const isClosing = React.useRef(false);

  const isSigningStore = signState === "signing" || signState === "opening";

  const handleDownloadStore = React.useCallback(async () => {
    resetSign();
    await signStore(subscriptionCode);
  }, [subscriptionCode, signStore, resetSign]);

  React.useEffect(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;
    fetch(`https://${domain}/api/settings`)
      .then(r => r.json())
      .then(data => {
        setSocialLinks([
          { key: "instagram", label: "Instagram", icon: "instagram", color: "#E1306C", url: data.instagram || "" },
          { key: "telegram", label: "Telegram", icon: "send", color: "#0088CC", url: data.telegram || "" },
          { key: "whatsapp", label: "WhatsApp", icon: "phone", color: "#25D366", url: data.whatsapp || "" },
        ]);
      })
      .catch(() => {});
  }, []);

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

  const MENU_ITEMS = [
    { key: "profile", label: t("myAccount"), icon: "user" as const },
    { key: "purchases", label: t("purchases"), icon: "shopping-bag" as const },
    { key: "notifications", label: t("notifications"), icon: "bell" as const },
    { key: "settings", label: t("settings"), icon: "settings" as const },
  ];

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

  const openLink = (url: string) => { if (url) Linking.openURL(url).catch(() => {}); };
  const handleMenuPress = (key: string) => { if (key === "settings") setShowSettings(true); };
  const activeSocial = socialLinks.filter(s => s.url);

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
            paddingTop: 10,
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
              {t("account")}
            </Text>
            <View style={{ width: 32 }} />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
          <View style={[styles.profileCard, { backgroundColor: colors.card }, isArabic && { flexDirection: "row-reverse" }]}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder }]}>
              <Feather name="user" size={32} color={colors.tint} />
            </View>
            <View style={[styles.profileInfo, isArabic && { alignItems: "flex-end" }]}>
              <Text style={[styles.profileName, { color: colors.text, fontFamily: fontAr("Bold") }]}>
                {t("guestUser")}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                {t("signIn")}
              </Text>
            </View>
          </View>

          {/* ─── Download Store Button ─── */}
          {subscriptionCode ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <TouchableOpacity
                style={[
                  styles.downloadStoreBtn,
                  { backgroundColor: colors.tint, opacity: isSigningStore ? 0.7 : 1 },
                ]}
                activeOpacity={0.8}
                onPress={handleDownloadStore}
                disabled={isSigningStore}
              >
                {isSigningStore ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Feather name="download" size={18} color="#000" />
                )}
                <Text style={[styles.downloadStoreBtnText, { fontFamily: fontAr("Bold") }]}>
                  {isSigningStore
                    ? (signState === "signing" ? "جارٍ التوقيع..." : "جارٍ التثبيت...")
                    : "تحميل المتجر بشهادتك"}
                </Text>
              </TouchableOpacity>
              {signError && signState === "error" && (
                <Text style={[styles.downloadStoreError, { fontFamily: fontAr("Regular") }]}>
                  {signError}
                </Text>
              )}
              {signState === "done" && (
                <Text style={[styles.downloadStoreDone, { fontFamily: fontAr("Regular") }]}>
                  ✓ تم فتح رابط التثبيت
                </Text>
              )}
            </View>
          ) : null}

          <View style={[styles.menuSection, { backgroundColor: colors.card }]}>
            {MENU_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuRow, { borderBottomColor: colors.cardBorder }]}
                activeOpacity={0.6}
                onPress={() => handleMenuPress(item.key)}
              >
                {isArabic ? (
                  <>
                    <Feather name="chevron-left" size={18} color={colors.separator} />
                    <Text style={[styles.menuLabel, { color: colors.text, fontFamily: fontAr("SemiBold"), textAlign: "right" }]}>
                      {item.label}
                    </Text>
                    <View style={[styles.menuIconWrap, { backgroundColor: `${colors.tint}15` }]}>
                      <Feather name={item.icon} size={18} color={colors.tint} />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={[styles.menuIconWrap, { backgroundColor: `${colors.tint}15` }]}>
                      <Feather name={item.icon} size={18} color={colors.tint} />
                    </View>
                    <Text style={[styles.menuLabel, { color: colors.text, fontFamily: fontAr("SemiBold") }]}>
                      {item.label}
                    </Text>
                    <Feather name="chevron-right" size={18} color={colors.separator} />
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {activeSocial.length > 0 && (
            <View style={styles.socialSection}>
              <Text style={[styles.socialTitle, { color: colors.textSecondary, fontFamily: fontAr("SemiBold") }]}>
                {t("contactUs")}
              </Text>
              <View style={styles.socialRow}>
                {activeSocial.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.socialBtn, { backgroundColor: s.color }]}
                    onPress={() => openLink(s.url)}
                    activeOpacity={0.7}
                  >
                    <Feather name={s.icon} size={18} color="#FFF" />
                    <Text style={styles.socialLabel}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      <SettingsPanel visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  panel: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
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
  headerTitle: { fontSize: 20, textAlign: "center" },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 16 },
  profileEmail: { fontSize: 13 },
  menuSection: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 15 },
  enrollBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  enrollIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  enrollText: { flex: 1, gap: 2 },
  enrollTitle: { fontSize: 15 },
  enrollSub: { fontSize: 12 },
  socialSection: { marginBottom: 10 },
  socialTitle: { fontSize: 13, textAlign: "center", marginBottom: 12 },
  socialRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  socialLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  downloadStoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 16,
  },
  downloadStoreBtnText: {
    fontSize: 15,
    color: "#000",
  },
  downloadStoreError: {
    fontSize: 12,
    color: "#FF3B30",
    textAlign: "center",
    marginTop: 8,
  },
  downloadStoreDone: {
    fontSize: 12,
    color: "#34C759",
    textAlign: "center",
    marginTop: 8,
  },
});
