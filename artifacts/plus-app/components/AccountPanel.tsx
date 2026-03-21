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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const MENU_ITEMS = [
  { key: "profile", label: "ملفي الشخصي", icon: "user" as const },
  { key: "purchases", label: "سجل المشتريات", icon: "shopping-bag" as const },
  { key: "notifications", label: "الاشعارات", icon: "bell" as const },
  { key: "settings", label: "الاعدادات", icon: "settings" as const },
];

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
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
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
    } else if (mounted) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: SCREEN_HEIGHT,
          damping: 25,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 20,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.handleBar} />

        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Account</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={18} color="#999" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Feather name="user" size={32} color="#FFF" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Guest User</Text>
              <Text style={styles.profileEmail}>تسجيل الدخول</Text>
            </View>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>الرصيد</Text>
            <Text style={styles.balanceAmount}>$0.00</Text>
          </View>

          <View style={styles.menuSection}>
            {MENU_ITEMS.map((item, index) => (
              <Pressable key={item.key} style={styles.menuRow}>
                <View style={styles.menuIconWrap}>
                  <Feather name={item.icon} size={18} color="#007AFF" />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Feather name="chevron-right" size={18} color="#C7C7CC" />
              </Pressable>
            ))}
          </View>

          <View style={styles.socialSection}>
            <Text style={styles.socialTitle}>تواصل معنا</Text>
            <View style={styles.socialRow}>
              {SOCIAL_LINKS.map((s) => (
                <Pressable
                  key={s.key}
                  style={[styles.socialBtn, { backgroundColor: s.color }]}
                  onPress={() => openLink(s.url)}
                >
                  <Feather name={s.icon} size={20} color="#FFF" />
                  <Text style={styles.socialLabel}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignSelf: "center",
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
  },
  profileEmail: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
  balanceCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    gap: 6,
  },
  balanceLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFF",
  },
  menuSection: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
    gap: 14,
  },
  menuIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(0,122,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  socialSection: {
    marginBottom: 20,
  },
  socialTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 14,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
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
    fontWeight: "600",
    color: "#FFF",
  },
});
