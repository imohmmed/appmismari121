import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  StatusBar,
  Alert,
  AppState,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";

import { Feather } from "@expo/vector-icons";

import { useSettings } from "@/contexts/SettingsContext";
import { getApiBase, getApiDomain } from "@/constants/api";

const { width: SW, height: SH } = Dimensions.get("window");

const BLUE = "#9fbcff";
const ACCENT = BLUE;
const BLUE_DARK = "#6fa8ff";
const ORANGE = "#FF8A50";
const ORANGE_DARK = "#E67A3C";
const PURPLE = "#B07DFF";
const PURPLE_DARK = "#9A60F0";
const GREEN = "#34C759";
const DARK = "#2b283b";
const WHITE = "#ffffff";




type Step = "language" | "theme" | "landing" | "download" | "install" | "udid" | "checking" | "result";

const WORDS = [
  { text: "سريع", icon: "zap" as const, color: BLUE },
  { text: "آمن", icon: "shield" as const, color: "#FF9500" },
  { text: "موثوق", icon: "check-circle" as const, color: GREEN },
  { text: "محدّث", icon: "refresh-cw" as const, color: PURPLE },
];

const WORD_HEIGHT = 72;
const VISIBLE_COUNT = 3; // 1 above + active + 1 below

// Words slide DOWN: new word enters from TOP
// Word n at track pos: top = -n * WORD_HEIGHT
// translateY = activeWord * WH + 1 * WH  (center offset = 1 for 3-slot)
// Container y of word n = (activeWord - n + 1) * WH → active always at 1*WH (center)
function ScrollingWords({ activeWord, fontAr: fontArFn }: { activeWord: number; fontAr: (w: string) => string }) {
  const scrollY = useRef(new Animated.Value(WORD_HEIGHT)).current;

  useEffect(() => {
    Animated.timing(scrollY, {
      toValue: activeWord * WORD_HEIGHT + WORD_HEIGHT,
      duration: 600,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeWord]);

  const slots = [];
  for (let n = activeWord - 2; n <= activeWord + 2; n++) {
    const wIdx = ((n % WORDS.length) + WORDS.length) % WORDS.length;
    slots.push({ ...WORDS[wIdx], n });
  }

  return (
    <View style={styles.scrollContainer}>
      <Animated.View style={[styles.scrollTrack, { transform: [{ translateY: scrollY }] }]}>
        {slots.map((w) => {
          // scrollY value when THIS word is exactly at center
          const center = w.n * WORD_HEIGHT + WORD_HEIGHT;

          // opacity & scale driven by scrollY — animates in sync with position (no double effect)
          // words fully transparent near clip edges so overflow:hidden shows no hard cut
          const opacity = scrollY.interpolate({
            inputRange: [center - WORD_HEIGHT * 1.4, center, center + WORD_HEIGHT * 1.4],
            outputRange: [0, 1, 0],
            extrapolate: "clamp",
          });
          const scale = scrollY.interpolate({
            inputRange: [center - WORD_HEIGHT, center, center + WORD_HEIGHT],
            outputRange: [0.76, 1, 0.76],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={w.n}
              style={[styles.wordRow, {
                position: "absolute",
                top: -w.n * WORD_HEIGHT,
                left: 0,
                right: 0,
                height: WORD_HEIGHT,
                opacity,
                transform: [{ scale }],
              }]}
            >
              <View style={styles.wordRowInner}>
                <View style={[styles.wordIcon, { backgroundColor: w.color + "22" }]}>
                  <Feather name={w.icon} size={22} color={w.color} />
                </View>
                <Text style={[styles.wordText, { fontFamily: fontArFn("ExtraBold"), color: DARK }]}>
                  {w.text}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ udid?: string }>();
  const { setOnboardingDone, setDeviceUdid, deviceUdid, fontAr, setSubscriptionCode, language, setLanguage, themeMode, setThemeMode } = useSettings();

  const [step, setStep] = useState<Step>("language");
  const [selLang, setSelLang] = useState<"ar" | "en">(language || "ar");
  const [selTheme, setSelTheme] = useState<"dark" | "light" | "system">(themeMode || "light");
  const [activeWord, setActiveWord] = useState(0);
  const [udid, setUdid] = useState(deviceUdid || "");
  const [checkResult, setCheckResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [socialLinks, setSocialLinks] = useState({ whatsapp: "", telegram: "", instagram: "" });
  const [supportExpanded, setSupportExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Support button animations
  const supportBtnScale = useRef(new Animated.Value(1)).current;
  const supportBtnOpacity = useRef(new Animated.Value(1)).current;
  const wa_scale = useRef(new Animated.Value(0)).current;
  const wa_opacity = useRef(new Animated.Value(0)).current;
  const tg_scale = useRef(new Animated.Value(0)).current;
  const tg_opacity = useRef(new Animated.Value(0)).current;
  const ig_scale = useRef(new Animated.Value(0)).current;
  const ig_opacity = useRef(new Animated.Value(0)).current;

  const expandSupport = () => {
    setSupportExpanded(true);
    Animated.parallel([
      Animated.timing(supportBtnScale, { toValue: 0.7, duration: 200, useNativeDriver: true }),
      Animated.timing(supportBtnOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    Animated.stagger(80, [
      Animated.parallel([
        Animated.spring(wa_scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(wa_opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(tg_scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(tg_opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(ig_scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(ig_opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const collapseSupport = () => {
    Animated.parallel([
      Animated.timing(wa_scale, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(wa_opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(tg_scale, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(tg_opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(ig_scale, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(ig_opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setSupportExpanded(false);
      Animated.parallel([
        Animated.spring(supportBtnScale, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(supportBtnOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  // Fetch contact links from admin settings
  useEffect(() => {
    fetch(`${getApiBase()}/api/settings`)
      .then(r => r.json())
      .then(data => setSocialLinks({
        whatsapp: data.whatsapp || "",
        telegram: data.telegram || "",
        instagram: data.instagram || "",
      }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => { stopPolling(); };
  }, []);

  useEffect(() => {
    if (params.udid) {
      stopPolling();
      const u = params.udid;
      setUdid(u);
      setDeviceUdid(u);
      // Pre-load subscription code if available, then always show UDID step
      fetch(`https://app.mismari.com/api/enroll/check?udid=${encodeURIComponent(u)}`)
        .then(r => r.json())
        .then(data => {
          if (data.found && data.subscriber?.code) {
            setSubscriptionCode(data.subscriber.code);
          }
        })
        .catch(() => {})
        .finally(() => transition("udid"));
    }
  }, [params.udid]);

  useEffect(() => {
    const sub = Linking.addEventListener("url", (event) => {
      const parsed = Linking.parse(event.url);
      if (parsed.queryParams?.udid) {
        const u = parsed.queryParams.udid as string;
        setUdid(u);
        setDeviceUdid(u);
        // Pre-load subscription code if available, then always show UDID step
        fetch(`https://app.mismari.com/api/enroll/check?udid=${encodeURIComponent(u)}`)
          .then(r => r.json())
          .then(data => {
            if (data.found && data.subscriber?.code) {
              setSubscriptionCode(data.subscriber.code);
            }
          })
          .catch(() => {})
          .finally(() => transition("udid"));
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (step !== "landing") return;
    const interval = setInterval(() => {
      setActiveWord((prev) => prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [step]);

  function transition(next: Step) {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  }

  const pollTokenRef = useRef<string>("");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  }

  function startUdidPolling(token: string) {
    stopPolling();
    setIsPolling(true);
    let attempts = 0;
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 120) { stopPolling(); return; }
      try {
        const r = await fetch(`https://app.mismari.com/api/profile/udid-check?token=${encodeURIComponent(token)}&_t=${Date.now()}`);
        const data = await r.json();
        if (data.found && data.udid) {
          stopPolling();
          setUdid(data.udid);
          setDeviceUdid(data.udid);
          // Pre-load subscription code if available (will be used when user taps submit)
          try {
            const subRes = await fetch(`https://app.mismari.com/api/enroll/check?udid=${encodeURIComponent(data.udid)}`);
            const subData = await subRes.json();
            if (subData.found && subData.subscriber?.code) {
              setSubscriptionCode(subData.subscriber.code);
            }
          } catch {}
          // Always show UDID step so user sees their ID before entering the store
          transition("udid");
        }
      } catch {}
    }, 2000);
  }

  async function handleDownloadProfile() {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    pollTokenRef.current = token;
    const url = `https://app.mismari.com/api/profile/enroll?source=app&token=${encodeURIComponent(token)}&dl=1`;
    await Linking.openURL(url);
    startUdidPolling(token);
    transition("install");
  }

  async function handleCheckDevice() {
    setStep("checking");
    fadeAnim.setValue(1);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const r = await fetch(
        `https://app.mismari.com/api/enroll/check?udid=${encodeURIComponent(udid)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      const data = await r.json();
      if (data.found) {
        setCheckResult({ success: true, message: "جهازك مسجّل وجاهز!" });
        if (data.subscriber?.code) {
          setSubscriptionCode(data.subscriber.code);
        }
      } else {
        setCheckResult({ success: false, message: "هذا الجهاز غير مسجّل. تواصل مع المسؤول." });
      }
    } catch {
      clearTimeout(timeout);
      setCheckResult({ success: true, message: "تم تسجيل جهازك!" });
    }
    setStep("result");
  }

  function handleFinish() {
    setOnboardingDone(true);
    router.replace("/(tabs)");
  }

  const stepColors: Record<Step, string[]> = {
    language: [BLUE, BLUE_DARK],
    theme: [PURPLE, PURPLE_DARK],
    landing: [BLUE, BLUE_DARK],
    download: [BLUE, BLUE_DARK],
    install: [ORANGE, ORANGE_DARK],
    udid: [PURPLE, PURPLE_DARK],
    checking: [BLUE, BLUE_DARK],
    result: [GREEN, "#2DBE4E"],
  };

  const gradColors = stepColors[step] ?? stepColors.landing;

  const stepsList = [
    { key: "download", label: "تحميل ملف التعريف", icon: "file-text" as const },
    { key: "install", label: "تثبيت ملف التعريف", icon: "shield" as const },
    { key: "udid", label: "المعرّف الخاص بك", icon: "hash" as const },
  ];

  function getStepStatus(stepKey: string) {
    const order = ["download", "install", "udid", "checking", "result"];
    const currentIdx = order.indexOf(step);
    const stepIdx = order.indexOf(stepKey);
    if (stepIdx < currentIdx) return "done";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Gradient background at top */}
      <LinearGradient
        colors={[gradColors[0] + "40", gradColors[0] + "15", "transparent"]}
        style={styles.topGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Animated.View style={[styles.content, { opacity: fadeAnim, paddingTop: insets.top + 20 }]}>

        {/* ═══ LANGUAGE SELECTION ═══ */}
        {step === "language" && (
          <View style={[styles.setupStep, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.setupHeader}>
              <Image
                source={require("../assets/images/mismari-logo.png")}
                style={{ width: 140, height: 70, resizeMode: "contain", alignSelf: "center", marginBottom: 12 }}
              />
              <Text style={[styles.setupTitle, { fontFamily: fontAr("Black") }]}>اختر لغتك</Text>
              <Text style={[styles.setupSubtitle, { fontFamily: fontAr("Regular") }]}>
                Choose your language
              </Text>
            </View>

            <View style={styles.langCards}>
              {/* Arabic card */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.langCard,
                  selLang === "ar" && { borderColor: BLUE, borderWidth: 2, backgroundColor: BLUE + "0D" },
                ]}
                onPress={() => setSelLang("ar")}
              >
                {selLang === "ar" && (
                  <View style={styles.cardCheckBadge}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
                <Text style={styles.langCardEmoji}>🇸🇦</Text>
                <Text style={[styles.langCardTitle, { fontFamily: fontAr("Bold") }]}>العربية</Text>
                <Text style={[styles.langCardSub, { fontFamily: "Inter_400Regular" }]}>Arabic</Text>
              </TouchableOpacity>

              {/* English card */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.langCard,
                  selLang === "en" && { borderColor: BLUE, borderWidth: 2, backgroundColor: BLUE + "0D" },
                ]}
                onPress={() => setSelLang("en")}
              >
                {selLang === "en" && (
                  <View style={styles.cardCheckBadge}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
                <Text style={styles.langCardEmoji}>🇬🇧</Text>
                <Text style={[styles.langCardTitle, { fontFamily: "Inter_700Bold" }]}>English</Text>
                <Text style={[styles.langCardSub, { fontFamily: fontAr("Regular") }]}>الإنجليزية</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.setupNote, { fontFamily: fontAr("Regular") }]}>
              يمكنك تغيير الإعدادات مستقبلاً من الحساب › إعدادات
            </Text>

            <TouchableOpacity
              style={[styles.setupNextBtn, { backgroundColor: BLUE }]}
              activeOpacity={0.85}
              onPress={() => {
                setLanguage(selLang);
                transition("theme");
              }}
            >
              <Text style={[styles.setupNextText, { fontFamily: fontAr("Bold") }]}>التالي</Text>
              <Feather name="arrow-left" size={18} color="#fff" style={{ marginRight: 6 }} />
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ THEME SELECTION ═══ */}
        {step === "theme" && (
          <View style={[styles.setupStep, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.setupHeader}>
              <Text style={[styles.setupTitle, { fontFamily: fontAr("Black") }]}>اختر المظهر</Text>
              <Text style={[styles.setupSubtitle, { fontFamily: fontAr("Regular") }]}>
                كيف تحب أن يبدو التطبيق؟
              </Text>
            </View>

            <View style={styles.themeCards}>
              {[
                { value: "dark" as const, icon: "moon" as const, label: "داكن", emoji: "🌙" },
                { value: "light" as const, icon: "sun" as const, label: "فاتح", emoji: "☀️" },
                { value: "system" as const, icon: "smartphone" as const, label: "تلقائي", emoji: "📱" },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  activeOpacity={0.85}
                  style={[
                    styles.themeCard,
                    selTheme === opt.value && { borderColor: PURPLE, borderWidth: 2, backgroundColor: PURPLE + "0D" },
                  ]}
                  onPress={() => setSelTheme(opt.value)}
                >
                  {selTheme === opt.value && (
                    <View style={[styles.cardCheckBadge, { backgroundColor: PURPLE }]}>
                      <Feather name="check" size={12} color="#fff" />
                    </View>
                  )}
                  <Text style={styles.themeCardEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.themeCardLabel, { fontFamily: fontAr("Bold") }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.setupNote, { fontFamily: fontAr("Regular") }]}>
              يمكنك تغيير الإعدادات مستقبلاً من الحساب › إعدادات
            </Text>

            <TouchableOpacity
              style={[styles.setupNextBtn, { backgroundColor: PURPLE }]}
              activeOpacity={0.85}
              onPress={() => {
                setThemeMode(selTheme);
                transition("landing");
              }}
            >
              <Text style={[styles.setupNextText, { fontFamily: fontAr("Bold") }]}>متابعة</Text>
              <Feather name="arrow-left" size={18} color="#fff" style={{ marginRight: 6 }} />
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ LANDING ═══ */}
        {step === "landing" && (
          <>
            <ScrollingWords activeWord={activeWord} fontAr={fontAr} />

            <View style={{ flex: 1 }} />

            {/* Bottom gradient blob */}
            <LinearGradient
              colors={[BLUE + "00", BLUE, BLUE_DARK]}
              style={styles.bottomBlob}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            >
              <View style={styles.blobCircle} />
            </LinearGradient>

            <View style={[styles.landingBottom, { paddingBottom: insets.bottom + 20 }]}>
              <Text style={[styles.landingTitle, { fontFamily: fontAr("Black") }]}>
                هاتفك، مُطوّر
              </Text>
              <Text style={[styles.landingSubtitle, { fontFamily: fontAr("Regular") }]}>
                حمّل وثبّت تطبيقات غير متوفرة في App Store
              </Text>
              <TouchableOpacity
                style={styles.continueBtn}
                activeOpacity={0.85}
                onPress={() => transition("download")}
              >
                <Text style={[styles.continueBtnText, { fontFamily: fontAr("Bold") }]}>متابعة</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ═══ STEPS (download / install / udid) ═══ */}
        {(step === "download" || step === "install" || step === "udid") && (
          <>
            {/* Steps tracker */}
            <View style={styles.stepsTracker}>
              {stepsList.map((s) => {
                const status = getStepStatus(s.key);
                const isActive = status === "active";
                const isDone = status === "done";
                return (
                  <View key={s.key} style={styles.stepTrackerItem}>
                    <View style={[
                      styles.stepTrackerIcon,
                      isActive && { backgroundColor: gradColors[0] + "20" },
                      isDone && { backgroundColor: GREEN + "20" },
                    ]}>
                      {isDone ? (
                        <Feather name="check" size={16} color={GREEN} />
                      ) : (
                        <Feather name={s.icon} size={16} color={isActive ? gradColors[0] : "#ccc"} />
                      )}
                    </View>
                    <Text style={[
                      styles.stepTrackerLabel,
                      { fontFamily: fontAr("Medium") },
                      isActive && { color: DARK, fontFamily: fontAr("Bold") },
                      isDone && { color: GREEN },
                    ]}>
                      {s.label}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={{ flex: 1 }} />

            {/* Current step content */}
            <View style={styles.stepContent}>
              <View style={[styles.stepIconCircle, { backgroundColor: gradColors[0] + "15" }]}>
                <Feather
                  name={step === "download" ? "file-text" : step === "install" ? "shield" : "hash"}
                  size={28}
                  color={gradColors[0]}
                />
              </View>

              <Text style={[styles.stepTitle, { fontFamily: fontAr("Black") }]}>
                {step === "download" && "تحميل ملف التعريف"}
                {step === "install" && "تثبيت ملف التعريف"}
                {step === "udid" && "المعرّف الخاص بك"}
              </Text>

              <Text style={[styles.stepDesc, { fontFamily: fontAr("Regular") }]}>
                {step === "download" && "حمّل ملف التعريف للحصول على معرّف جهازك. يساعدنا هذا على تسجيل جهازك."}
                {step === "install" && "اذهب إلى الإعدادات ← عام ← إدارة VPN والأجهزة وثبّت الملف. سيتم الكشف عن جهازك تلقائياً."}
                {step === "udid" && "تم الكشف عن معرّف جهازك الفريد. اضغط إرسال للتحقق من اشتراكك."}
              </Text>
              {step === "install" && isPolling && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, opacity: 0.7 }}>
                  <ActivityIndicator size="small" color={ORANGE} />
                  <Text style={[{ fontFamily: fontAr("Regular"), fontSize: 13, color: "#888" }]}>
                    جارٍ البحث عن جهازك...
                  </Text>
                </View>
              )}
            </View>

            {/* Bottom action */}
            <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 20 }]}>
              {step === "download" && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: DARK }]}
                  activeOpacity={0.85}
                  onPress={handleDownloadProfile}
                >
                  <Feather name="download" size={18} color={WHITE} style={{ marginLeft: 8 }} />
                  <Text style={[styles.actionBtnText, { fontFamily: fontAr("Bold") }]}>تحميل ملف التعريف</Text>
                </TouchableOpacity>
              )}

              {step === "install" && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: DARK }]}
                  activeOpacity={0.85}
                  onPress={() => { stopPolling(); transition("udid"); }}
                >
                  <Feather name="check-circle" size={18} color={WHITE} style={{ marginLeft: 8 }} />
                  <Text style={[styles.actionBtnText, { fontFamily: fontAr("Bold") }]}>تم التثبيت</Text>
                </TouchableOpacity>
              )}

              {step === "udid" && udid && (
                <TouchableOpacity
                  style={[styles.udidPill]}
                  activeOpacity={0.85}
                  onPress={handleCheckDevice}
                >
                  <Text style={[styles.udidText, { fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                    {udid}
                  </Text>
                  <View style={styles.udidArrow}>
                    <Feather name="arrow-left" size={18} color={WHITE} />
                  </View>
                </TouchableOpacity>
              )}

              {step === "udid" && !udid && (
                <View>
                  <Text style={[styles.noUdidText, { fontFamily: fontAr("Medium") }]}>
                    لم يتم الكشف عن المعرّف بعد. تأكد من تثبيت ملف التعريف.
                  </Text>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: PURPLE, marginTop: 12 }]}
                    activeOpacity={0.85}
                    onPress={() => transition("download")}
                  >
                    <Feather name="rotate-ccw" size={18} color={WHITE} style={{ marginLeft: 8 }} />
                    <Text style={[styles.actionBtnText, { fontFamily: fontAr("Bold") }]}>إعادة المحاولة</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}

        {/* ═══ CHECKING ═══ */}
        {step === "checking" && (
          <View style={styles.centeredContent}>
            <View style={styles.stepsTracker}>
              {stepsList.map((s) => {
                const isDone = true;
                return (
                  <View key={s.key} style={styles.stepTrackerItem}>
                    <View style={[styles.stepTrackerIcon, { backgroundColor: GREEN + "20" }]}>
                      <Feather name="check" size={16} color={GREEN} />
                    </View>
                    <Text style={[styles.stepTrackerLabel, { fontFamily: fontAr("Medium"), color: GREEN }]}>
                      {s.label}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.stepTrackerItem}>
                <View style={[styles.stepTrackerIcon, { backgroundColor: BLUE + "20" }]}>
                  <ActivityIndicator size="small" color={BLUE} />
                </View>
                <Text style={[styles.stepTrackerLabel, { fontFamily: fontAr("Bold"), color: DARK }]}>
                  جاري التحقق من جهازك
                </Text>
              </View>
            </View>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={[styles.checkingText, { fontFamily: fontAr("Medium") }]}>
                يرجى الانتظار أثناء التحقق من تسجيل جهازك...
              </Text>
            </View>
          </View>
        )}

        {/* ═══ RESULT ═══ */}
        {step === "result" && checkResult && (
          <View style={styles.centeredContent}>
            <View style={styles.stepsTracker}>
              {stepsList.map((s) => (
                <View key={s.key} style={styles.stepTrackerItem}>
                  <View style={[styles.stepTrackerIcon, { backgroundColor: GREEN + "20" }]}>
                    <Feather name="check" size={16} color={GREEN} />
                  </View>
                  <Text style={[styles.stepTrackerLabel, { fontFamily: fontAr("Medium"), color: GREEN }]}>
                    {s.label}
                  </Text>
                </View>
              ))}
              <View style={styles.stepTrackerItem}>
                <View style={[styles.stepTrackerIcon, {
                  backgroundColor: checkResult.success ? GREEN + "20" : "#FF3B3020",
                }]}>
                  <Feather
                    name={checkResult.success ? "check-circle" : "x-circle"}
                    size={16}
                    color={checkResult.success ? GREEN : "#FF3B30"}
                  />
                </View>
                <Text style={[styles.stepTrackerLabel, {
                  fontFamily: fontAr("Bold"),
                  color: checkResult.success ? GREEN : "#FF3B30",
                }]}>
                  {checkResult.success ? "جهازك جاهز!" : "غير مسجّل"}
                </Text>
              </View>
            </View>

            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 }}>
              <View style={[styles.resultIcon, {
                backgroundColor: checkResult.success ? GREEN + "15" : "#FF3B3015",
              }]}>
                <Feather
                  name={checkResult.success ? "check-circle" : "alert-circle"}
                  size={48}
                  color={checkResult.success ? GREEN : "#FF3B30"}
                />
              </View>
              <Text style={[styles.resultTitle, { fontFamily: fontAr("Black") }]}>
                {checkResult.success ? "كل شيء جاهز!" : "غير مسجّل"}
              </Text>
              <Text style={[styles.resultDesc, { fontFamily: fontAr("Regular") }]}>
                {checkResult.message}
              </Text>
            </View>

            <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 20 }]}>
              {checkResult.success ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: GREEN }]}
                  activeOpacity={0.85}
                  onPress={handleFinish}
                >
                  <Feather name="arrow-left" size={18} color={WHITE} style={{ marginLeft: 8 }} />
                  <Text style={[styles.actionBtnText, { fontFamily: fontAr("Bold") }]}>الدخول للمتجر</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 14, width: "100%", alignItems: "center" }}>
                  {/* Animated support button → 3 app buttons */}
                  <View style={{ minHeight: 64, width: "100%", alignItems: "center", justifyContent: "center" }}>
                    {/* Main button — fades out on expand */}
                    <Animated.View
                      style={{
                        position: "absolute",
                        width: "100%",
                        opacity: supportBtnOpacity,
                        transform: [{ scale: supportBtnScale }],
                      }}
                      pointerEvents={supportExpanded ? "none" : "auto"}
                    >
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: ACCENT }]}
                        activeOpacity={0.85}
                        onPress={expandSupport}
                      >
                        <Feather name="message-circle" size={18} color={WHITE} style={{ marginLeft: 8 }} />
                        <Text style={[styles.actionBtnText, { fontFamily: fontAr("Bold") }]}>تواصل مع الدعم</Text>
                      </TouchableOpacity>
                    </Animated.View>

                    {/* 3 app circle buttons — appear on expand */}
                    <View style={{ flexDirection: "row-reverse", gap: 20, alignItems: "center", justifyContent: "center" }}>
                      {/* WhatsApp */}
                      <Animated.View style={{ opacity: wa_opacity, transform: [{ scale: wa_scale }] }}>
                        <TouchableOpacity
                          style={[styles.appCircleBtn, { backgroundColor: "#25D366", shadowColor: "#25D366" }]}
                          activeOpacity={0.8}
                          onPress={() => { collapseSupport(); setTimeout(() => Linking.openURL(socialLinks.whatsapp), 300); }}
                        >
                          <Feather name="phone" size={26} color={WHITE} />
                        </TouchableOpacity>
                        <Text style={[styles.appCircleLabel, { fontFamily: fontAr("SemiBold"), color: "#25D366" }]}>واتساب</Text>
                      </Animated.View>

                      {/* Telegram */}
                      <Animated.View style={{ opacity: tg_opacity, transform: [{ scale: tg_scale }] }}>
                        <TouchableOpacity
                          style={[styles.appCircleBtn, { backgroundColor: "#0088CC", shadowColor: "#0088CC" }]}
                          activeOpacity={0.8}
                          onPress={() => { collapseSupport(); setTimeout(() => Linking.openURL(socialLinks.telegram), 300); }}
                        >
                          <Feather name="send" size={26} color={WHITE} />
                        </TouchableOpacity>
                        <Text style={[styles.appCircleLabel, { fontFamily: fontAr("SemiBold"), color: "#0088CC" }]}>تيليكرام</Text>
                      </Animated.View>

                      {/* Instagram */}
                      <Animated.View style={{ opacity: ig_opacity, transform: [{ scale: ig_scale }] }}>
                        <TouchableOpacity
                          style={[styles.appCircleBtn, { backgroundColor: "#E1306C", shadowColor: "#E1306C" }]}
                          activeOpacity={0.8}
                          onPress={() => { collapseSupport(); setTimeout(() => Linking.openURL(socialLinks.instagram), 300); }}
                        >
                          <Feather name="instagram" size={26} color={WHITE} />
                        </TouchableOpacity>
                        <Text style={[styles.appCircleLabel, { fontFamily: fontAr("SemiBold"), color: "#E1306C" }]}>انستكرام</Text>
                      </Animated.View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: DARK + "25" }]}
                    activeOpacity={0.85}
                    onPress={() => { collapseSupport(); transition("download"); }}
                  >
                    <Feather name="rotate-ccw" size={16} color={DARK + "70"} style={{ marginLeft: 8 }} />
                    <Text style={[styles.actionBtnText, { fontFamily: fontAr("Bold"), color: DARK + "70" }]}>إعادة المحاولة</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHITE,
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SH * 0.5,
  },
  content: {
    flex: 1,
  },

  scrollContainer: {
    height: WORD_HEIGHT * VISIBLE_COUNT,
    overflow: "hidden",
    marginTop: SH * 0.06,
  },
  scrollTrack: {
    alignItems: "center",
  },
  wordRow: {
    justifyContent: "center",
    alignItems: "center",
  },
  wordRowInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  wordIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  wordText: {
    fontSize: 38,
    fontWeight: "800",
    color: DARK,
  },

  bottomBlob: {
    position: "absolute",
    bottom: 0,
    left: -SW * 0.2,
    right: -SW * 0.2,
    height: SH * 0.38,
    borderTopLeftRadius: SW,
    borderTopRightRadius: SW,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  blobCircle: {
    width: SW * 0.6,
    height: SW * 0.6,
    borderRadius: SW * 0.3,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 40,
  },

  landingBottom: {
    paddingHorizontal: 30,
    zIndex: 10,
  },
  landingTitle: {
    fontSize: 32,
    color: WHITE,
    textAlign: "right",
    marginBottom: 6,
  },
  landingSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "right",
    marginBottom: 24,
  },
  continueBtn: {
    backgroundColor: WHITE,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  continueBtnText: {
    fontSize: 16,
    color: DARK,
  },

  stepsTracker: {
    paddingHorizontal: 30,
    paddingTop: 20,
    gap: 16,
  },
  stepTrackerItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  stepTrackerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  stepTrackerLabel: {
    fontSize: 15,
    color: "#ccc",
  },

  stepContent: {
    paddingHorizontal: 30,
    paddingBottom: 20,
  },
  stepIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
    marginBottom: 14,
  },
  stepTitle: {
    fontSize: 28,
    color: DARK,
    textAlign: "right",
    marginBottom: 8,
  },
  stepDesc: {
    fontSize: 14,
    color: DARK + "80",
    textAlign: "right",
    lineHeight: 22,
  },

  bottomAction: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  actionBtn: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 50,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  actionBtnText: {
    fontSize: 16,
    color: WHITE,
  },

  udidPill: {
    backgroundColor: DARK,
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  udidText: {
    fontSize: 13,
    color: WHITE + "cc",
    flex: 1,
    textAlign: "left",
    letterSpacing: 0.5,
  },
  udidArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  noUdidText: {
    fontSize: 14,
    color: DARK + "80",
    textAlign: "center",
    lineHeight: 22,
  },

  centeredContent: {
    flex: 1,
  },

  checkingText: {
    fontSize: 15,
    color: DARK + "80",
    textAlign: "center",
  },

  resultIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 28,
    color: DARK,
    textAlign: "center",
    marginBottom: 8,
  },
  appCircleBtn: {
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
  appCircleLabel: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },

  resultDesc: {
    fontSize: 14,
    color: DARK + "80",
    textAlign: "center",
    lineHeight: 22,
  },

  // ── Setup steps (language / theme) ─────────────────────────────────────────
  setupStep: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    justifyContent: "space-between",
  },
  setupHeader: {
    marginBottom: 8,
    alignItems: "flex-end",
  },
  setupTitle: {
    fontSize: 34,
    color: DARK,
    textAlign: "right",
    marginBottom: 6,
  },
  setupSubtitle: {
    fontSize: 15,
    color: DARK + "60",
    textAlign: "right",
  },

  // Language cards
  langCards: {
    flexDirection: "row",
    gap: 14,
    flex: 1,
    alignItems: "center",
    marginVertical: 8,
  },
  langCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: DARK + "15",
    backgroundColor: WHITE,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: "relative",
  },
  langCardEmoji: {
    fontSize: 44,
  },
  langCardTitle: {
    fontSize: 22,
    color: DARK,
    textAlign: "center",
  },
  langCardSub: {
    fontSize: 13,
    color: DARK + "55",
    textAlign: "center",
  },

  // Theme cards
  themeCards: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
    alignItems: "center",
    marginVertical: 8,
  },
  themeCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: DARK + "15",
    backgroundColor: WHITE,
    paddingVertical: 24,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: "relative",
  },
  themeCardEmoji: {
    fontSize: 36,
  },
  themeCardLabel: {
    fontSize: 16,
    color: DARK,
    textAlign: "center",
  },

  // Check badge (top-left of card)
  cardCheckBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },

  // Shared note and button
  setupNote: {
    fontSize: 12,
    color: DARK + "45",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  setupNextBtn: {
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
  setupNextText: {
    fontSize: 17,
    color: WHITE,
  },
});
