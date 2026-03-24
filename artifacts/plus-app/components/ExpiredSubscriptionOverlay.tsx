import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { BlurView } from "expo-blur";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";

export default function ExpiredSubscriptionOverlay({ visible }: { visible: boolean }) {
  const insets = useSafeAreaInsets();
  const { fontAr, isArabic, setLanguage } = useSettings();
  const [whatsapp, setWhatsapp] = useState("");
  const scaleAnim = React.useRef(new Animated.Value(0.85)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
    if (!domain) return;
    fetch(`https://${domain}/api/settings`)
      .then(r => r.json())
      .then(d => setWhatsapp(d.whatsapp || ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 100, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const toggleLang = () => setLanguage(isArabic ? "en" : "ar");

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      {/* Blurred background */}
      {Platform.OS === "ios" ? (
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.75)" }]} />
      )}

      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Animated.View style={[styles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          {/* Language toggle */}
          <TouchableOpacity style={styles.langBtn} onPress={toggleLang} activeOpacity={0.7}>
            <Feather name="globe" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconWrap}>
            <Feather name="clock" size={40} color="#FF3B30" />
            <View style={styles.iconBadge}>
              <Feather name="x" size={12} color="#fff" />
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.title, { fontFamily: fontAr("Bold") }]}>
            {isArabic ? "انتهى الاشتراك" : "Subscription Expired"}
          </Text>

          {/* Message */}
          <Text style={[styles.message, { fontFamily: fontAr("Regular") }]}>
            {isArabic
              ? "انتهى اشتراكك.\nيرجى التجديد للاستمرار في استخدام التطبيق."
              : "Your subscription has ended.\nPlease renew to continue using the app."}
          </Text>

          {/* Renew button */}
          <TouchableOpacity
            style={styles.renewBtn}
            activeOpacity={0.85}
            onPress={() => Linking.openURL("https://app.mismari.com")}
          >
            <Text style={[styles.renewBtnText, { fontFamily: fontAr("Bold") }]}>
              {isArabic ? "تجديد الاشتراك" : "Renew Subscription"}
            </Text>
          </TouchableOpacity>

          {/* Contact support */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { if (whatsapp) Linking.openURL(whatsapp); }}
          >
            <Text style={[styles.supportLink, { fontFamily: fontAr("SemiBold") }]}>
              {isArabic ? "تواصل مع الدعم" : "Contact Support"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 44,
    paddingBottom: 32,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  langBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
  },
  langText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    display: "none",
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,59,48,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#1C1C1E",
  },
  title: {
    fontSize: 24,
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  renewBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 50,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 18,
  },
  renewBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
  },
  supportLink: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
});
