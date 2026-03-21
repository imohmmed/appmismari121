import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Animated,
  Dimensions,
  Linking,
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const SOCIAL_LINKS = [
  {
    key: "instagram",
    label: "Instagram",
    icon: "instagram" as const,
    color: "#E1306C",
    url: "https://www.instagram.com/mismari.co?igsh=YzF5eXp6b2V0czRo",
  },
  {
    key: "telegram",
    label: "Telegram",
    icon: "send" as const,
    color: "#0088CC",
    url: "https://t.me/imismari",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: "phone" as const,
    color: "#25D366",
    url: "https://wa.me/9647766699669",
  },
];

interface AccountPanelProps {
  visible: boolean;
  onClose: () => void;
}

export default function AccountPanel({ visible, onClose }: AccountPanelProps) {
  const insets = useSafeAreaInsets();
  const { colors, t, fontAr } = useSettings();
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const isClosing = React.useRef(false);

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
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 25,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted && !isClosing.current) {
      isClosing.current = true;
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
        isClosing.current = false;
      });
    }
  }, [visible]);

  if (!mounted) return null;

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const handleMenuPress = (key: string) => {
    if (key === "settings") {
      setShowSettings(true);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 10,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={[styles.handleBar, { backgroundColor: colors.separator }]} />

        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
            {t("account")}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.card }]}
            activeOpacity={0.6}
          >
            <Feather name="x" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
          <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder }]}>
              <Feather name="user" size={32} color={colors.tint} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text, fontFamily: fontAr("Bold") }]}>
                {t("guestUser")}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                {t("signIn")}
              </Text>
            </View>
          </View>

          <View style={[styles.balanceCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.balanceLabel, { color: colors.textSecondary, fontFamily: fontAr("Medium") }]}>
              {t("balance")}
            </Text>
            <Text style={[styles.balanceAmount, { color: colors.text }]}>$0.00</Text>
          </View>

          <View style={[styles.menuSection, { backgroundColor: colors.card }]}>
            {MENU_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuRow, { borderBottomColor: colors.cardBorder }]}
                activeOpacity={0.6}
                onPress={() => handleMenuPress(item.key)}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: `${colors.tint}15` }]}>
                  <Feather name={item.icon} size={18} color={colors.tint} />
                </View>
                <Text style={[styles.menuLabel, { color: colors.text, fontFamily: fontAr("SemiBold") }]}>
                  {item.label}
                </Text>
                <Feather name="chevron-right" size={18} color={colors.separator} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.socialSection}>
            <Text style={[styles.socialTitle, { color: colors.textSecondary, fontFamily: fontAr("SemiBold") }]}>
              {t("contactUs")}
            </Text>
            <View style={styles.socialRow}>
              {SOCIAL_LINKS.map((s) => (
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  headerTitle: {
    fontSize: 20,
  },
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
    marginBottom: 12,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 16,
  },
  profileEmail: {
    fontSize: 13,
  },
  balanceCard: {
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    gap: 4,
  },
  balanceLabel: {
    fontSize: 13,
  },
  balanceAmount: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
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
  menuLabel: {
    flex: 1,
    fontSize: 15,
  },
  socialSection: {
    marginBottom: 10,
  },
  socialTitle: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
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
});
