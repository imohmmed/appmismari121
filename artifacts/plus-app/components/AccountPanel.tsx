import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";
import MyAccountModal from "@/components/MyAccountModal";
import SettingsPanel from "@/components/SettingsPanel";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const DEFAULT_SOCIAL = [
  { key: "instagram", label: "Instagram", icon: "instagram" as const, color: "#E1306C", url: "" },
  { key: "telegram", label: "Telegram", icon: "send" as const, color: "#0088CC", url: "" },
  { key: "whatsapp", label: "WhatsApp", icon: "phone" as const, color: "#25D366", url: "" },
];

interface SocialLink { key: string; label: string; icon: "instagram" | "send" | "phone"; color: string; url: string; }

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

interface AccountPanelProps {
  visible: boolean;
  onClose: () => void;
}

export default function AccountPanel({ visible, onClose }: AccountPanelProps) {
  const insets = useSafeAreaInsets();
  const { colors, t, fontAr, isArabic, subscriptionCode, profilePhoto, setProfilePhoto } = useSettings();
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;
  const panY = React.useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showMyAccount, setShowMyAccount] = React.useState(false);
  const [socialLinks, setSocialLinks] = React.useState<SocialLink[]>(DEFAULT_SOCIAL);
  const [subscriber, setSubscriber] = React.useState<SubscriberInfo | null>(null);
  const [subLoading, setSubLoading] = React.useState(false);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [balanceTxs, setBalanceTxs] = React.useState<Array<{ id: number; type: string; amount: number; balanceAfter: number; note: string | null; createdAt: string }>>([]);
  const isClosing = React.useRef(false);

  // Fetch social links
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

  // Fetch subscriber info and balance when panel opens
  React.useEffect(() => {
    if (!visible || !subscriptionCode) { setSubscriber(null); setBalance(null); setBalanceTxs([]); return; }
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;
    // Fetch balance
    fetch(`https://${domain}/api/subscriber/balance?code=${encodeURIComponent(subscriptionCode)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setBalance(data.balance ?? 0); setBalanceTxs(data.transactions || []); } })
      .catch(() => {});
  }, [visible, subscriptionCode]);

  React.useEffect(() => {
    if (!visible || !subscriptionCode) { setSubscriber(null); return; }
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;
    setSubLoading(true);
    fetch(`https://${domain}/api/subscriber/me?code=${encodeURIComponent(subscriptionCode)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setSubscriber(data))
      .catch(() => setSubscriber(null))
      .finally(() => setSubLoading(false));
  }, [visible, subscriptionCode]);

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
  const handleMenuPress = (key: string) => {
    if (key === "settings") setShowSettings(true);
    if (key === "profile") setShowMyAccount(true);
  };
  const activeSocial = socialLinks.filter(s => s.url);

  const displayName = subscriber?.subscriberName || t("guestUser");
  const displaySub = subscriber?.phone || (subscriptionCode ? subscriptionCode : t("signIn"));

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setProfilePhoto(result.assets[0].uri);
      }
    } catch {}
  };

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
          {/* ─── Profile Card ─── */}
          <Pressable
            style={[styles.profileCard, { backgroundColor: colors.card }, isArabic && { flexDirection: "row-reverse" }]}
            onPress={handlePickPhoto}
            android_ripple={{ color: `${colors.tint}20` }}
          >
            <View style={styles.avatarWrap}>
              <View style={[styles.avatarCircle, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder }]}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.avatarPhoto} />
                ) : subLoading ? (
                  <ActivityIndicator size="small" color={colors.tint} />
                ) : (
                  <Feather name="user" size={32} color={colors.tint} />
                )}
              </View>
              <View style={[styles.cameraBtn, { backgroundColor: colors.tint }]}>
                <Feather name="camera" size={10} color="#000" />
              </View>
            </View>
            <View style={[styles.profileInfo, isArabic && { alignItems: "flex-end" }]}>
              <Text style={[styles.profileName, { color: colors.text, fontFamily: fontAr("Bold") }]}>
                {displayName}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                {displaySub}
              </Text>
            </View>
            <Feather name={isArabic ? "chevron-left" : "chevron-right"} size={16} color={colors.separator} />
          </Pressable>

          {/* ─── Balance Card ─── */}
          {subscriptionCode ? (
            <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={[styles.balanceHeader, isArabic && { flexDirection: "row-reverse" }]}>
                <Feather name="credit-card" size={16} color={colors.tint} />
                <Text style={[styles.balanceLabel, { color: colors.textSecondary, fontFamily: fontAr("Medium") }]}>
                  الرصيد
                </Text>
              </View>
              <View style={[styles.balanceAmountRow, isArabic && { flexDirection: "row-reverse" }]}>
                {balance === null ? (
                  <ActivityIndicator size="small" color={colors.tint} />
                ) : (
                  <>
                    <Text style={[styles.balanceAmount, { color: colors.tint, fontFamily: "Inter_700Bold" }]}>
                      {balance.toLocaleString("ar-IQ")}
                    </Text>
                    <Text style={[styles.balanceCurrency, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                      {" "}د.ع
                    </Text>
                  </>
                )}
              </View>
              {balanceTxs.length > 0 && (
                <View style={[styles.balanceTxList, { borderTopColor: colors.cardBorder }]}>
                  {balanceTxs.slice(0, 3).map(tx => (
                    <View key={tx.id} style={[styles.balanceTxRow, isArabic && { flexDirection: "row-reverse" }]}>
                      <View style={[styles.balanceTxDot, { backgroundColor: tx.type === "credit" ? "#34C759" : "#FF3B30" }]} />
                      <Text style={[styles.balanceTxNote, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]} numberOfLines={1}>
                        {tx.note || (tx.type === "credit" ? "إضافة رصيد" : tx.type === "purchase" ? "شراء" : "خصم رصيد")}
                      </Text>
                      <Text style={[styles.balanceTxAmt, { color: tx.type === "credit" ? "#34C759" : "#FF3B30", fontFamily: "Inter_600SemiBold" }]}>
                        {tx.type === "credit" ? "+" : "-"}{tx.amount.toLocaleString("ar-IQ")}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* ─── Menu ─── */}
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

          {/* ─── Social Links ─── */}
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

      <MyAccountModal
        visible={showMyAccount}
        onClose={() => setShowMyAccount(false)}
        subscriber={subscriber}
        loading={subLoading}
        profilePhoto={profilePhoto}
      />
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
    top: 130,
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
  avatarWrap: { position: "relative" },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    overflow: "hidden",
  },
  avatarPhoto: { width: 60, height: 60, borderRadius: 30 },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
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
  balanceCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 12,
    gap: 8,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  balanceLabel: {
    fontSize: 12,
  },
  balanceAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  balanceAmount: {
    fontSize: 28,
  },
  balanceCurrency: {
    fontSize: 14,
  },
  balanceTxList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  balanceTxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  balanceTxDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  balanceTxNote: {
    flex: 1,
    fontSize: 12,
  },
  balanceTxAmt: {
    fontSize: 12,
  },
});
