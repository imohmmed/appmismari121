import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
const BASE_URL = API_DOMAIN ? `https://${API_DOMAIN}` : "";

function apiUrl(path: string) {
  return `${BASE_URL}/api${path}`;
}

interface IpaInfo {
  name: string;
  bundleId: string;
  version: string;
  fileSize: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onAnalyzed: (info: IpaInfo, url: string) => void;
}

export default function SignUrlModal({ visible, onClose, onAnalyzed }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, t, fontAr, isArabic, subscriptionCode, appName } = useSettings();

  const TINT = "#9fbcff";

  const slideX = useRef(new Animated.Value(isArabic ? -SCREEN_WIDTH : SCREEN_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const isClosing = useRef(false);

  const startX = isArabic ? -SCREEN_WIDTH : SCREEN_WIDTH;

  const closeModal = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    Animated.parallel([
      Animated.timing(slideX, { toValue: startX, duration: 280, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setMounted(false);
      isClosing.current = false;
      panX.setValue(0);
      setUrlInput("");
      setAnalyzing(false);
      onClose();
    });
  }, [isArabic, onClose]);

  useEffect(() => {
    if (visible) {
      isClosing.current = false;
      slideX.setValue(startX);
      backdropAnim.setValue(0);
      panX.setValue(0);
      setMounted(true);
      setUrlInput("");
      setAnalyzing(false);
      Animated.parallel([
        Animated.spring(slideX, { toValue: 0, damping: 28, stiffness: 320, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else if (mounted && !isClosing.current) {
      isClosing.current = true;
      Animated.parallel([
        Animated.timing(slideX, { toValue: startX, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setMounted(false);
        isClosing.current = false;
        panX.setValue(0);
      });
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        isArabic ? g.dx < -8 : g.dx > 8,
      onPanResponderMove: (_, g) => {
        const val = isArabic ? Math.min(0, g.dx) : Math.max(0, g.dx);
        panX.setValue(val);
      },
      onPanResponderRelease: (_, g) => {
        const threshold = SCREEN_WIDTH * 0.3;
        const swipedFar = isArabic ? g.dx < -threshold : g.dx > threshold;
        const fastSwipe = isArabic ? g.vx < -0.5 : g.vx > 0.5;
        if (swipedFar || fastSwipe) {
          closeModal();
        } else {
          Animated.spring(panX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const handleAnalyze = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!subscriptionCode) {
      Alert.alert(
        isArabic ? "يلزم الاشتراك" : "Subscription Required",
        isArabic ? "أدخل كود الاشتراك أولاً" : "Please enter your subscription code first"
      );
      return;
    }
    setAnalyzing(true);
    try {
      const r = await fetch(apiUrl("/sign/personal/analyze-url"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, code: subscriptionCode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      closeModal();
      setTimeout(() => onAnalyzed(data, url), 50);
    } catch (err: any) {
      Alert.alert(isArabic ? "خطأ" : "Error", err.message);
    }
    setAnalyzing(false);
  }, [urlInput, subscriptionCode, isArabic, closeModal, onAnalyzed]);

  if (!mounted) return null;

  const translateX = Animated.add(slideX, panX);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[st.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeModal} />
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[st.panel, { backgroundColor: colors.background, transform: [{ translateX }] }]}
      >
        {/* ── Header ── */}
        <View
          style={[
            st.header,
            { paddingTop: insets.top + 14 },
            isArabic && { flexDirection: "row-reverse" },
          ]}
        >
          <TouchableOpacity
            style={[st.backBtn, { backgroundColor: colors.card }]}
            onPress={closeModal}
            activeOpacity={0.7}
          >
            <Feather name={isArabic ? "arrow-right" : "arrow-left"} size={16} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <Text style={[st.headerTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
            {isArabic
              ? <><Text style={{ fontFamily: fontAr("Bold") }}>{appName} </Text><Text style={{ fontFamily: "Inter_700Bold" }}>Sign</Text></>
              : <><Text style={{ fontFamily: "Inter_700Bold" }}>{appName} </Text><Text style={{ fontFamily: fontAr("Bold") }}>Sign</Text></>
            }
          </Text>
        </View>

        {/* ── Content ── */}
        <View style={[st.content, { paddingBottom: insets.bottom + 24 }]}>
          <View style={{ marginBottom: 24, alignItems: isArabic ? "flex-end" : "flex-start" }}>
            <Text style={[st.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
              {t("signViaUrl")}
            </Text>
            <Text style={[st.sectionSub, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
              {t("signViaUrlSub")}
            </Text>
          </View>

          <View style={[st.inputCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isArabic && { flexDirection: "row-reverse" }]}>
            <Feather name="link" size={16} color={colors.textSecondary} style={{ flexShrink: 0 }} />
            <TextInput
              style={[st.input, { color: colors.text, fontFamily: "Inter_400Regular", textAlign: isArabic ? "right" : "left" }]}
              placeholder="https://example.com/app.ipa"
              placeholderTextColor={colors.textSecondary + "60"}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleAnalyze}
              editable={!analyzing}
            />
            {urlInput.length > 0 && !analyzing && (
              <TouchableOpacity onPress={() => setUrlInput("")}>
                <Feather name="x" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              st.primaryBtn,
              { backgroundColor: analyzing ? colors.card : TINT, opacity: !urlInput.trim() ? 0.4 : 1 },
              isArabic && { flexDirection: "row-reverse" },
            ]}
            onPress={handleAnalyze}
            disabled={!urlInput.trim() || analyzing}
            activeOpacity={0.8}
          >
            {analyzing
              ? <ActivityIndicator size="small" color={TINT} />
              : <Feather name="search" size={16} color="#000" />
            }
            <Text style={[st.primaryBtnText, { color: analyzing ? colors.text : "#000", fontFamily: fontAr("Bold") }]}>
              {analyzing ? t("signAnalyzing") : t("signAnalyze")}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 28,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 22,
    marginBottom: 3,
  },
  sectionSub: {
    fontSize: 13,
  },
  inputCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: 22,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryBtnText: {
    fontSize: 15,
  },
});
