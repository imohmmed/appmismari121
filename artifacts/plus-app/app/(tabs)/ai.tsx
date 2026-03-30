import { useFocusEffect, useRouter } from "expo-router";
import React, { useState, useCallback, useRef } from "react";
import {
  Animated,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import AiScreen from "../ai";
import { useSettings } from "@/contexts/SettingsContext";

function AiLockedScreen() {
  const { isDark, contactWhatsapp, contactInstagram, contactTelegram } = useSettings();
  const insets = useSafeAreaInsets();

  const bg      = isDark ? "#2B283B" : "#F0F2F5";
  const card    = isDark ? "#36334A" : "#FFFFFF";
  const border  = isDark ? "#4A4760" : "#E5E7EB";
  const textCol = isDark ? "#FFFFFF" : "#111111";
  const subCol  = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const accent  = "#9fbcff";
  const WHITE   = "#FFFFFF";

  // ── Animation refs ──────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState(false);

  const mainScale   = useRef(new Animated.Value(1)).current;
  const mainOpacity = useRef(new Animated.Value(1)).current;
  const waScale     = useRef(new Animated.Value(0)).current;
  const waOpacity   = useRef(new Animated.Value(0)).current;
  const tgScale     = useRef(new Animated.Value(0)).current;
  const tgOpacity   = useRef(new Animated.Value(0)).current;
  const igScale     = useRef(new Animated.Value(0)).current;
  const igOpacity   = useRef(new Animated.Value(0)).current;

  const expand = () => {
    setExpanded(true);
    Animated.parallel([
      Animated.timing(mainScale,   { toValue: 0.7, duration: 200, useNativeDriver: true }),
      Animated.timing(mainOpacity, { toValue: 0,   duration: 180, useNativeDriver: true }),
    ]).start();
    Animated.stagger(80, [
      Animated.parallel([
        Animated.spring(waScale,   { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(waOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(tgScale,   { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(tgOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(igScale,   { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(igOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const collapse = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(waScale,     { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(waOpacity,   { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(tgScale,     { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(tgOpacity,   { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(igScale,     { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(igOpacity,   { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setExpanded(false);
      Animated.parallel([
        Animated.spring(mainScale,   { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(mainOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      cb?.();
    });
  };

  const open = (url: string) => {
    collapse(() => { setTimeout(() => Linking.openURL(url).catch(() => {}), 300); });
  };

  const hasWhatsApp  = !!contactWhatsapp;
  const hasTelegram  = !!contactTelegram;
  const hasInstagram = !!contactInstagram;

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* ── Brain icon with slash ── */}
      <View style={[styles.iconCard, { backgroundColor: card, borderColor: border }]}>
        <MaterialCommunityIcons name="brain" size={62} color={isDark ? "#9fbcff" : "#6B7FD4"} />
        {/* Diagonal "not available" slash */}
        <View style={styles.slashWrap} pointerEvents="none">
          <View style={[styles.slashLine, { backgroundColor: isDark ? "rgba(255,100,100,0.85)" : "rgba(200,50,50,0.75)" }]} />
        </View>
      </View>

      <Text style={[styles.title, { color: textCol, fontFamily: "Mestika-Bold" }]}>
        الذكاء الاصطناعي غير متاح
      </Text>
      <Text style={[styles.subtitle, { color: subCol, fontFamily: "Mestika-Regular" }]}>
        هذه الميزة غير مفعّلة لاشتراكك حالياً.{"\n"}إذا كنت ترغب بشراءها تواصل معنا.
      </Text>

      {/* ── Contact button area ── */}
      <View style={styles.contactArea}>
          {/* Main "تواصل معنا" button */}
          <Animated.View
            style={{
              position: "absolute",
              width: "100%",
              opacity: mainOpacity,
              transform: [{ scale: mainScale }],
            }}
            pointerEvents={expanded ? "none" : "auto"}
          >
            <TouchableOpacity
              style={[styles.mainBtn, { backgroundColor: accent }]}
              activeOpacity={0.85}
              onPress={() => {
                if (!hasWhatsApp && !hasTelegram && !hasInstagram) return;
                expand();
              }}
            >
              <Feather name="message-circle" size={18} color={WHITE} style={{ marginLeft: 8 }} />
              <Text style={[styles.mainBtnText, { fontFamily: "Mestika-Bold" }]}>تواصل معنا</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* 3 circle buttons */}
          <View style={styles.circleRow}>
            {hasWhatsApp && (
              <Animated.View style={{ opacity: waOpacity, transform: [{ scale: waScale }], alignItems: "center" }}>
                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: "#25D366", shadowColor: "#25D366" }]}
                  activeOpacity={0.8}
                  onPress={() => open(contactWhatsapp)}
                >
                  <Feather name="phone" size={26} color={WHITE} />
                </TouchableOpacity>
                <Text style={[styles.circleLabel, { fontFamily: "Mestika-SemiBold", color: "#25D366" }]}>واتساب</Text>
              </Animated.View>
            )}

            {hasTelegram && (
              <Animated.View style={{ opacity: tgOpacity, transform: [{ scale: tgScale }], alignItems: "center" }}>
                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: "#0088CC", shadowColor: "#0088CC" }]}
                  activeOpacity={0.8}
                  onPress={() => open(contactTelegram)}
                >
                  <Feather name="send" size={26} color={WHITE} />
                </TouchableOpacity>
                <Text style={[styles.circleLabel, { fontFamily: "Mestika-SemiBold", color: "#0088CC" }]}>تيليكرام</Text>
              </Animated.View>
            )}

            {hasInstagram && (
              <Animated.View style={{ opacity: igOpacity, transform: [{ scale: igScale }], alignItems: "center" }}>
                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: "#E1306C", shadowColor: "#E1306C" }]}
                  activeOpacity={0.8}
                  onPress={() => open(contactInstagram)}
                >
                  <Feather name="instagram" size={26} color={WHITE} />
                </TouchableOpacity>
                <Text style={[styles.circleLabel, { fontFamily: "Mestika-SemiBold", color: "#E1306C" }]}>انستكرام</Text>
              </Animated.View>
            )}
          </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconCard: {
    width: 128,
    height: 128,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    overflow: "hidden",
    position: "relative",
  },
  slashWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  slashLine: {
    width: 160,
    height: 4,
    borderRadius: 2,
    transform: [{ rotate: "-45deg" }],
  },
  title: {
    fontSize: 22,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 36,
  },
  contactArea: {
    width: "100%",
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  mainBtn: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 50,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  mainBtnText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  circleRow: {
    flexDirection: "row-reverse",
    gap: 24,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
  circleBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  circleLabel: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
});

export default function AiTab() {
  const [visible, setVisible] = useState(false);
  const { isDark, aiActive } = useSettings();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => { setVisible(false); };
    }, [])
  );

  const handleClose = useCallback(() => {
    router.navigate("/");
  }, [router]);

  if (aiActive === false) {
    return <AiLockedScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#2B283B" : "#F0F2F5" }}>
      <Modal
        visible={visible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <AiScreen onClose={handleClose} />
      </Modal>
    </View>
  );
}
