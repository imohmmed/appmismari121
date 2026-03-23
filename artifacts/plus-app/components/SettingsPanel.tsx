import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings, type ThemeMode } from "@/contexts/SettingsContext";
import type { Language } from "@/constants/translations";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface SettingsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ visible, onClose }: SettingsPanelProps) {
  const insets = useSafeAreaInsets();
  const { language, setLanguage, themeMode, setThemeMode, colors, t, fontAr, isArabic } = useSettings();
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

  const langOptions: { key: Language; label: string; labelEn: string; icon: string }[] = [
    { key: "ar", label: "العربية", labelEn: "Arabic", icon: "🇸🇦" },
    { key: "en", label: "English", labelEn: "English", icon: "🇺🇸" },
  ];

  const themeOptions: { key: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "light", label: t("lightMode"), icon: "sun" },
    { key: "dark", label: t("darkMode"), icon: "moon" },
    { key: "system", label: t("systemMode"), icon: "smartphone" },
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
            paddingTop: 10,
            paddingBottom: insets.bottom + 10,
            transform: [{ translateY: Animated.add(slideAnim, panY) }],
          },
        ]}
      >
        {/* ── Drag Handle ── */}
        <View {...panResponder.panHandlers}>
          <View style={[styles.handleBar, { backgroundColor: colors.separator }]} />
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.card }]}
              activeOpacity={0.6}
            >
              <Feather name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
              {t("settingsTitle")}
            </Text>
            <View style={{ width: 32 }} />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces>

          {/* ── Language Section ── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: fontAr("SemiBold") }, isArabic && { textAlign: "right" }]}>
            {t("language")}
          </Text>
          <View style={[styles.optionGroup, { backgroundColor: colors.card }]}>
            {langOptions.map((opt, idx) => {
              const isSelected = language === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.optionRow,
                    isArabic && { flexDirection: "row-reverse" },
                    idx < langOptions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder },
                  ]}
                  activeOpacity={0.6}
                  onPress={() => setLanguage(opt.key)}
                >
                  <View style={[styles.optionLeft, isArabic && { flexDirection: "row-reverse" }]}>
                    <View style={[styles.langIconWrap, { backgroundColor: `${colors.tint}15` }]}>
                      <Text style={styles.flagEmoji}>{opt.icon}</Text>
                    </View>
                    <View style={[styles.langLabels, isArabic && { alignItems: "flex-end" }]}>
                      <Text style={[styles.optionLabel, { color: colors.text, fontFamily: fontAr("SemiBold") }]}>
                        {opt.label}
                      </Text>
                      {opt.key !== (isArabic ? "ar" : "en") && (
                        <Text style={[styles.optionLabelSub, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                          {opt.labelEn}
                        </Text>
                      )}
                    </View>
                  </View>
                  {isSelected ? (
                    <View style={[styles.checkCircle, { backgroundColor: colors.tint }]}>
                      <Feather name="check" size={13} color="#000" />
                    </View>
                  ) : (
                    <View style={[styles.checkCircleEmpty, { borderColor: colors.separator }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Appearance Section ── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: fontAr("SemiBold") }, isArabic && { textAlign: "right" }]}>
            {t("appearance")}
          </Text>
          <View style={[styles.optionGroup, { backgroundColor: colors.card }]}>
            {themeOptions.map((opt, idx) => {
              const isSelected = themeMode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.optionRow,
                    isArabic && { flexDirection: "row-reverse" },
                    idx < themeOptions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder },
                  ]}
                  activeOpacity={0.6}
                  onPress={() => setThemeMode(opt.key)}
                >
                  <View style={[styles.optionLeft, isArabic && { flexDirection: "row-reverse" }]}>
                    <View style={[styles.themeIconWrap, { backgroundColor: `${colors.tint}15` }]}>
                      <Feather name={opt.icon} size={18} color={colors.tint} />
                    </View>
                    <Text style={[styles.optionLabel, { color: colors.text, fontFamily: fontAr("SemiBold") }]}>
                      {opt.label}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View style={[styles.checkCircle, { backgroundColor: colors.tint }]}>
                      <Feather name="check" size={13} color="#000" />
                    </View>
                  ) : (
                    <View style={[styles.checkCircleEmpty, { borderColor: colors.separator }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
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
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    textAlign: "center",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 13,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  optionGroup: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  langIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  flagEmoji: {
    fontSize: 20,
  },
  langLabels: {
    gap: 2,
  },
  themeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    fontSize: 15,
  },
  optionLabelSub: {
    fontSize: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
