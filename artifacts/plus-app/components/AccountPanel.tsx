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

import Colors from "@/constants/colors";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const MENU_ITEMS = [
  { key: "profile", label: "حسابي", icon: "user" as const },
  { key: "purchases", label: "سجل المشتريات", icon: "shopping-bag" as const },
  { key: "notifications", label: "الإشعارات", icon: "bell" as const },
  { key: "settings", label: "الإعدادات", icon: "settings" as const },
  { key: "language", label: "اللغة: العربية", icon: "globe" as const },
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
  const isClosing = React.useRef(false);

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
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 10,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.handleBar} />

        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>الحساب</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.6}>
            <Feather name="x" size={16} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Feather name="user" size={32} color={Colors.light.tint} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>مستخدم زائر</Text>
              <Text style={styles.profileEmail}>تسجيل الدخول</Text>
            </View>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>الرصيد</Text>
            <Text style={styles.balanceAmount}>$0.00</Text>
          </View>

          <View style={styles.menuSection}>
            {MENU_ITEMS.map((item) => (
              <TouchableOpacity key={item.key} style={styles.menuRow} activeOpacity={0.6}>
                <View style={styles.menuIconWrap}>
                  <Feather name={item.icon} size={18} color={Colors.light.tint} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Feather name="chevron-left" size={18} color={Colors.light.separator} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.socialSection}>
            <Text style={styles.socialTitle}>تواصل معنا</Text>
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
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.light.separator,
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
    fontSize: 22,
    fontFamily: "Mestika-Bold",
    color: Colors.light.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.light.cardBorder,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 18,
    fontFamily: "Mestika-Bold",
    color: Colors.light.text,
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: "Mestika-Regular",
    color: Colors.light.textSecondary,
  },
  balanceCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    gap: 4,
  },
  balanceLabel: {
    fontSize: 14,
    fontFamily: "Mestika-Medium",
    color: Colors.light.textSecondary,
  },
  balanceAmount: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  menuSection: {
    backgroundColor: Colors.light.card,
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
    borderBottomColor: Colors.light.cardBorder,
    gap: 14,
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${Colors.light.tint}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Mestika-SemiBold",
    color: Colors.light.text,
  },
  socialSection: {
    marginBottom: 10,
  },
  socialTitle: {
    fontSize: 14,
    fontFamily: "Mestika-SemiBold",
    color: Colors.light.textSecondary,
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
