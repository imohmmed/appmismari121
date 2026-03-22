import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";

import { useSettings } from "@/contexts/SettingsContext";

const { width: SW, height: SH } = Dimensions.get("window");

const BLUE = "#9fbcff";
const BLUE_DARK = "#6fa8ff";
const ORANGE = "#FF8A50";
const ORANGE_DARK = "#E67A3C";
const PURPLE = "#B07DFF";
const PURPLE_DARK = "#9A60F0";
const GREEN = "#34C759";
const DARK = "#2b283b";
const WHITE = "#ffffff";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type Step = "landing" | "download" | "install" | "udid" | "checking" | "result";

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
  const { setOnboardingDone, setDeviceUdid, deviceUdid, fontAr } = useSettings();

  const [step, setStep] = useState<Step>("landing");
  const [activeWord, setActiveWord] = useState(0);
  const [udid, setUdid] = useState(deviceUdid || "");
  const [checkResult, setCheckResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [socialLinks, setSocialLinks] = useState({ whatsapp: "", telegram: "", instagram: "" });
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Fetch contact links from admin settings
  useEffect(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;
    fetch(`https://${domain}/api/settings`)
      .then(r => r.json())
      .then(data => setSocialLinks({
        whatsapp: data.whatsapp || "",
        telegram: data.telegram || "",
        instagram: data.instagram || "",
      }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (params.udid) {
      setUdid(params.udid);
      setDeviceUdid(params.udid);
      setStep("udid");
    }
  }, [params.udid]);

  // Keep deeplink listener as fallback
  useEffect(() => {
    const sub = Linking.addEventListener("url", (event) => {
      const parsed = Linking.parse(event.url);
      if (parsed.queryParams?.udid) {
        const u = parsed.queryParams.udid as string;
        setUdid(u);
        setDeviceUdid(u);
        setStep("udid");
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

  async function handleDownloadProfile() {
    // Generate a session token — server stores UDID under this token when callback fires
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const url = `${API_BASE}/api/profile/enroll?source=app&token=${encodeURIComponent(token)}`;

    let foundUdid = false;

    // Build a poll function that can be reused (started before AND after browser closes)
    function startPolling(maxSeconds: number): ReturnType<typeof setInterval> {
      let count = 0;
      return setInterval(async () => {
        if (foundUdid) return;
        count++;
        if (count > maxSeconds) return;
        try {
          // _t busts any proxy/CDN cache — Replit dev proxy ignores Cache-Control on GET
          const r = await fetch(
            `${API_BASE}/api/profile/udid-check?token=${encodeURIComponent(token)}&_t=${Date.now()}`,
            { cache: "no-store" }
          );
          const data = await r.json();
          if (data.found && data.udid) {
            foundUdid = true;
            setUdid(data.udid);
            setDeviceUdid(data.udid);
            WebBrowser.dismissBrowser();
            setTimeout(() => transition("udid"), 300);
          }
        } catch {}
      }, 1000);
    }

    // Start polling BEFORE opening browser so we catch the UDID as soon as it arrives
    const prePoll = startPolling(90);

    await WebBrowser.openBrowserAsync(url, {
      dismissButtonStyle: "done",
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });

    // Browser closed — clear the pre-poll and show install step
    clearInterval(prePoll);

    if (foundUdid) return; // Already found while browser was open — done!

    // Continue polling for 60 MORE seconds after browser closes.
    // iOS sometimes fires the callback just AFTER the user closes the browser
    // (e.g. after "Profile Installation Failed" tap-OK → close).
    setIsPolling(true);
    transition("install");
    const postPoll = startPolling(60);

    // Auto-clear when found or after 60s
    const guard = setInterval(() => {
      if (foundUdid) { clearInterval(postPoll); clearInterval(guard); setIsPolling(false); }
    }, 500);
    setTimeout(() => { clearInterval(postPoll); clearInterval(guard); setIsPolling(false); }, 62000);
  }

  async function handleCheckDevice() {
    setStep("checking");
    fadeAnim.setValue(1);
    try {
      const res = await fetch(`${API_BASE}/api/enroll/check?udid=${encodeURIComponent(udid)}`);
      const data = await res.json();
      if (data.found) {
        setCheckResult({ success: true, message: "جهازك مسجّل وجاهز!" });
      } else {
        setCheckResult({ success: false, message: "هذا الجهاز غير مسجّل. تواصل مع المسؤول." });
      }
    } catch {
      setCheckResult({ success: false, message: "تعذّر الاتصال بالخادم" });
    }
    setStep("result");
  }

  function handleFinish() {
    setOnboardingDone(true);
    router.replace("/(tabs)");
  }

  const stepColors = {
    landing: [BLUE, BLUE_DARK],
    download: [BLUE, BLUE_DARK],
    install: [ORANGE, ORANGE_DARK],
    udid: [PURPLE, PURPLE_DARK],
    checking: [BLUE, BLUE_DARK],
    result: [GREEN, "#2DBE4E"],
  };

  const gradColors = stepColors[step] || stepColors.landing;

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
                {step === "install" && isPolling && "تم استلام طلبك. إذا ظهرت رسالة خطأ في الإعدادات فلا تقلق — سيتم الكشف عن جهازك تلقائياً."}
                {step === "install" && !isPolling && "اذهب إلى الإعدادات ← عام ← إدارة VPN والأجهزة وقم بتثبيت الملف الذي حمّلته."}
                {step === "udid" && "تم الكشف عن معرّف جهازك الفريد. اضغط إرسال للتحقق من اشتراكك."}
              </Text>
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

              {step === "install" && isPolling && (
                <View style={{ alignItems: "center", gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: 0.7 }}>
                    <ActivityIndicator size="small" color={ORANGE} />
                    <Text style={[styles.stepDesc, { fontFamily: fontAr("Regular"), marginBottom: 0 }]}>
                      جارٍ الكشف عن معرّف جهازك...
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: DARK, marginTop: 4 }]}
                    activeOpacity={0.85}
                    onPress={() => transition("udid")}
                  >
                    <Feather name="check-circle" size={18} color={WHITE} style={{ marginLeft: 8 }} />
                    <Text style={[styles.actionBtnText, { fontFamily: fontAr("Bold") }]}>تم التثبيت يدوياً</Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === "install" && !isPolling && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: DARK }]}
                  activeOpacity={0.85}
                  onPress={() => transition("udid")}
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
                <View style={{ gap: 12, width: "100%" }}>
                  <Text style={[styles.supportLabel, { fontFamily: fontAr("SemiBold") }]}>
                    تواصل مع الدعم للاشتراك
                  </Text>
                  <View style={styles.supportRow}>
                    {socialLinks.whatsapp ? (
                      <TouchableOpacity
                        style={[styles.supportBtn, { backgroundColor: "#25D366" }]}
                        activeOpacity={0.85}
                        onPress={() => Linking.openURL(socialLinks.whatsapp)}
                      >
                        <Feather name="phone" size={20} color={WHITE} />
                        <Text style={[styles.supportBtnText, { fontFamily: fontAr("Bold") }]}>واتساب</Text>
                      </TouchableOpacity>
                    ) : null}
                    {socialLinks.telegram ? (
                      <TouchableOpacity
                        style={[styles.supportBtn, { backgroundColor: "#0088CC" }]}
                        activeOpacity={0.85}
                        onPress={() => Linking.openURL(socialLinks.telegram)}
                      >
                        <Feather name="send" size={20} color={WHITE} />
                        <Text style={[styles.supportBtnText, { fontFamily: fontAr("Bold") }]}>تيليكرام</Text>
                      </TouchableOpacity>
                    ) : null}
                    {socialLinks.instagram ? (
                      <TouchableOpacity
                        style={[styles.supportBtn, { backgroundColor: "#E1306C" }]}
                        activeOpacity={0.85}
                        onPress={() => Linking.openURL(socialLinks.instagram)}
                      >
                        <Feather name="instagram" size={20} color={WHITE} />
                        <Text style={[styles.supportBtnText, { fontFamily: fontAr("Bold") }]}>انستكرام</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#FF3B30" + "22", borderWidth: 1, borderColor: "#FF3B3060" }]}
                    activeOpacity={0.85}
                    onPress={() => transition("download")}
                  >
                    <Feather name="rotate-ccw" size={18} color="#FF3B30" style={{ marginLeft: 8 }} />
                    <Text style={[styles.actionBtnText, { fontFamily: fontAr("Bold"), color: "#FF3B30" }]}>إعادة المحاولة</Text>
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
  supportLabel: {
    fontSize: 15,
    color: DARK + "90",
    textAlign: "center",
    marginBottom: 4,
  },
  supportRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    gap: 10,
  },
  supportBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  supportBtnText: {
    fontSize: 13,
    color: WHITE,
  },

  resultDesc: {
    fontSize: 14,
    color: DARK + "80",
    textAlign: "center",
    lineHeight: 22,
  },
});
