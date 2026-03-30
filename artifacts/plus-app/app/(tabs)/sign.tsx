import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { useNavigation } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import AccountPanel from "@/components/AccountPanel";
import ProfileAvatar from "@/components/ProfileAvatar";
import SignUrlModal from "@/components/SignUrlModal";
import { useSettings } from "@/contexts/SettingsContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
const BASE_URL = API_DOMAIN ? `https://${API_DOMAIN}` : "";

function apiUrl(path: string) {
  return `${BASE_URL}/api${path}`;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface IpaInfo {
  name: string;
  bundleId: string;
  version: string;
  fileSize: number;
  iconBase64?: string;
}

interface SignJob {
  jobId: string;
  status: "pending" | "processing" | "done" | "error";
  originalName?: string | null;
  originalBundleId?: string | null;
  originalVersion?: string | null;
  customName?: string | null;
  customBundleId?: string | null;
  fileSize?: number;
  signedToken?: string | null;
  signedExpiresAt?: string | null;
  errorMessage?: string | null;
  itmsUrl?: string | null;
  createdAt: string;
  isExpired?: boolean;
}

interface HealthData {
  freeGB: number;
  totalGB: number;
  usedPct: number;
}

interface QuotaData {
  usedGB: number;
  limitGB: number;
  availableBytes: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function timeAgo(dateStr: string, isArabic: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isArabic ? "الآن" : "Just now";
  if (mins < 60) return isArabic ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isArabic ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isArabic ? `منذ ${days} يوم` : `${days}d ago`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, sub, colors, fontAr, isArabic }: any) {
  return (
    <View style={{ marginBottom: 20, alignItems: isArabic ? "flex-end" : "flex-start" }}>
      <Text style={{ color: colors.text, fontFamily: fontAr("Bold"), fontSize: 22, textAlign: isArabic ? "right" : "left" }}>{title}</Text>
      {sub ? <Text style={{ color: colors.textSecondary, fontFamily: fontAr("Regular"), fontSize: 13, marginTop: 3, textAlign: isArabic ? "right" : "left" }}>{sub}</Text> : null}
    </View>
  );
}

function HealthBar({ colors, fontAr, isArabic, code }: any) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [quota, setQuota] = useState<QuotaData | null>(null);

  useEffect(() => {
    fetch(apiUrl("/sign/health")).then(r => r.json()).then(setHealth).catch(() => {});
    if (code) {
      fetch(apiUrl(`/sign/personal/quota?code=${encodeURIComponent(code)}`))
        .then(r => r.json()).then(setQuota).catch(() => {});
    }
  }, [code]);

  const diskPct = health ? health.usedPct : 0;
  const quotaUsed = quota ? Math.min(1, 1 - quota.availableBytes / (4 * 1024 ** 3)) : 0;
  const TINT = "#9fbcff";

  return (
    <View style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={[styles.healthRow, isArabic && { flexDirection: "row-reverse" }]}>
        {/* Disk */}
        <View style={{ flex: 1 }}>
          <View style={[styles.healthLabelRow, isArabic && { flexDirection: "row-reverse" }]}>
            <Feather name="server" size={12} color={TINT} />
            <Text style={[styles.healthLabel, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
              {isArabic ? "السيرفر" : "Server"}
            </Text>
            {health && (
              <Text style={{ color: TINT, fontFamily: "Inter_600SemiBold", fontSize: 11, marginRight: "auto", marginLeft: "auto" }}>
                {`${health.freeGB} GB ${isArabic ? "متاح" : "free"}`}
              </Text>
            )}
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.barFill, { width: `${diskPct}%`, backgroundColor: diskPct > 80 ? "#ef4444" : TINT }]} />
          </View>
        </View>

        <View style={{ width: 1, backgroundColor: colors.separator, marginHorizontal: 14, alignSelf: "stretch" }} />

        {/* Quota */}
        <View style={{ flex: 1 }}>
          <View style={[styles.healthLabelRow, isArabic && { flexDirection: "row-reverse" }]}>
            <Feather name="user" size={12} color={TINT} />
            <Text style={[styles.healthLabel, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
              {isArabic ? "حصتك" : "Your Quota"}
            </Text>
            {quota && (
              <Text style={{ color: TINT, fontFamily: "Inter_600SemiBold", fontSize: 11, marginRight: "auto", marginLeft: "auto" }}>
                {`${(Number(quota.usedGB) || 0).toFixed(1)} / 4 GB`}
              </Text>
            )}
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.barFill, { width: `${quotaUsed * 100}%`, backgroundColor: quotaUsed > 0.8 ? "#f59e0b" : "#34c759" }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

function HistoryItem({ job, onReinstall, colors, fontAr, isArabic }: any) {
  const appName = job.customName || job.originalName || "—";
  const bundleId = job.customBundleId || job.originalBundleId || "—";
  const statusColor = job.status === "done" ? (job.isExpired ? "#64748b" : "#34c759") : job.status === "error" ? "#ef4444" : "#f59e0b";
  const TINT = "#9fbcff";

  return (
    <View style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isArabic && { flexDirection: "row-reverse" }]}>
      <View style={[styles.historyIcon, { backgroundColor: `${statusColor}18` }]}>
        <Feather name={job.status === "done" ? "check-circle" : job.status === "error" ? "x-circle" : "clock"} size={18} color={statusColor} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.historyName, { color: colors.text, fontFamily: /[\u0600-\u06FF]/.test(appName) ? fontAr("SemiBold") : "Inter_600SemiBold" }]} numberOfLines={1}>{appName}</Text>
        <Text style={[styles.historyBundle, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>{bundleId}</Text>
        <View style={[{ flexDirection: "row", gap: 8, alignItems: "center" }, isArabic && { flexDirection: "row-reverse" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={{ color: statusColor, fontSize: 11, fontFamily: fontAr("Regular") }}>
            {job.status === "done" ? (job.isExpired ? (isArabic ? "منتهي" : "Expired") : (isArabic ? "اكتمل" : "Done")) :
              job.status === "error" ? (isArabic ? "فشل" : "Failed") :
              isArabic ? "جارٍ..." : "In progress"}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: fontAr("Regular") }}>{timeAgo(job.createdAt, isArabic)}</Text>
          {job.fileSize ? <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: "Inter_400Regular" }}>{formatBytes(job.fileSize)}</Text> : null}
        </View>
      </View>
      {job.status === "done" && !job.isExpired && job.itmsUrl && (
        <TouchableOpacity
          style={[styles.reinstallBtn, { backgroundColor: `${TINT}18` }]}
          onPress={() => onReinstall(job.itmsUrl)}
          activeOpacity={0.7}
        >
          <Feather name="download" size={14} color={TINT} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

type Screen = "home" | "customize" | "signing" | "result" | "history";

export default function SignScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isWeb = Platform.OS === "web";
  const { colors, t, fontAr, isArabic, subscriptionCode, appName: brandName, appNameEn } = useSettings();

  const TINT = "#9fbcff";

  const [showAccount, setShowAccount] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");

  // URL flow state
  const [urlInput, setUrlInput] = useState("");
  const [ipaInfo, setIpaInfo] = useState<IpaInfo | null>(null);
  const [customName, setCustomName] = useState("");
  const [customBundle, setCustomBundle] = useState("");

  // Job polling
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<SignJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [signingStage, setSigningStage] = useState<"upload" | "pending" | "processing" | "done">("upload");
  const slowAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const animateProgress = useCallback((toValue: number, duration = 800) => {
    if (slowAnimRef.current) { slowAnimRef.current.stop(); slowAnimRef.current = null; }
    Animated.timing(progressAnim, { toValue, duration, useNativeDriver: false }).start();
  }, [progressAnim]);

  const startSlowProgress = useCallback((from: number, to: number, durationMs: number) => {
    if (slowAnimRef.current) { slowAnimRef.current.stop(); }
    progressAnim.setValue(from);
    const anim = Animated.timing(progressAnim, { toValue: to, duration: durationMs, useNativeDriver: false });
    slowAnimRef.current = anim;
    anim.start();
  }, [progressAnim]);

  // History
  const [history, setHistory] = useState<SignJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // ── Sliding panel state ───────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [panelVisible, setPanelVisible] = useState(false);
  const [panelScreen, setPanelScreen] = useState<Screen>("home");
  const panelOpenRef = useRef(false);

  // Refs to avoid stale closures in PanResponder (created once)
  const isArabicRef = useRef(isArabic);
  useEffect(() => { isArabicRef.current = isArabic; }, [isArabic]);
  const resetToHomeRef = useRef<() => void>(() => {});

  const panelPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        const isH = Math.abs(g.dx) > Math.abs(g.dy) + 5 && Math.abs(g.dx) > 15;
        if (!isH) return false;
        return isArabicRef.current ? g.dx < -10 : g.dx > 10;
      },
      onPanResponderMove: (_, g) => {
        if (isArabicRef.current) {
          if (g.dx < 0) slideAnim.setValue(g.dx);
        } else {
          if (g.dx > 0) slideAnim.setValue(g.dx);
        }
      },
      onPanResponderRelease: (_, g) => {
        const threshold = SCREEN_WIDTH * 0.28;
        const shouldClose = isArabicRef.current
          ? (g.dx < -threshold || g.vx < -0.5)
          : (g.dx > threshold || g.vx > 0.5);
        if (shouldClose) {
          const endX = isArabicRef.current ? -SCREEN_WIDTH : SCREEN_WIDTH;
          Animated.timing(slideAnim, { toValue: endX, duration: 200, useNativeDriver: true }).start(() => {
            resetToHomeRef.current();
          });
        } else {
          Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 300, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPoll(), []);

  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as any, () => {
      setShowAccount(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsub;
  }, [navigation]);

  const loadHistory = useCallback(async () => {
    if (!subscriptionCode) return;
    setHistoryLoading(true);
    try {
      const r = await fetch(apiUrl(`/sign/personal/history?code=${encodeURIComponent(subscriptionCode)}`));
      const data = await r.json();
      if (data.jobs) {
        // Fetch itmsUrl for non-expired done jobs
        const jobs: SignJob[] = await Promise.all(data.jobs.map(async (j: SignJob) => {
          if (j.status === "done" && !j.isExpired && j.signedToken) {
            try {
              const r2 = await fetch(apiUrl(`/sign/personal/job/${j.jobId}?code=${encodeURIComponent(subscriptionCode!)}`));
              const d2 = await r2.json();
              return { ...j, itmsUrl: d2.itmsUrl };
            } catch { return j; }
          }
          return j;
        }));
        setHistory(jobs);
      }
    } catch { /* silent */ }
    setHistoryLoading(false);
  }, [subscriptionCode]);

  useEffect(() => {
    if (screen === "home" || screen === "history") loadHistory();
  }, [screen]);

  const startPoll = useCallback((jobId: string, startProgress = 0.5) => {
    if (!subscriptionCode) return;
    stopPoll();
    // Start slow crawl from current progress to 90% over ~3 minutes
    animateProgress(startProgress, 600);
    setTimeout(() => {
      startSlowProgress(startProgress, 0.9, 180_000);
    }, 700);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(apiUrl(`/sign/personal/job/${jobId}?code=${encodeURIComponent(subscriptionCode!)}`));
        const data: SignJob = await r.json();
        setCurrentJob(data);
        if (data.status === "processing") {
          setSigningStage("processing");
        } else if (data.status === "pending") {
          setSigningStage("pending");
        }
        if (data.status === "done" || data.status === "error") {
          stopPoll();
          if (slowAnimRef.current) { slowAnimRef.current.stop(); slowAnimRef.current = null; }
          if (data.status === "done") animateProgress(1.0, 400);
          setScreen("result");
        }
      } catch { /* silent */ }
    }, 3000);
  }, [subscriptionCode, stopPoll, animateProgress, startSlowProgress]);

  // ── Called when SignUrlModal finishes analysis ─────────────────────────────
  const handleAnalyzedFromModal = useCallback((info: IpaInfo, url: string) => {
    setIpaInfo(info);
    setUrlInput(url);
    setCustomName("");
    setCustomBundle("");
    setScreen("customize");
  }, []);

  // ── Start Signing from URL ─────────────────────────────────────────────────
  const handleStartSign = useCallback(async () => {
    if (!subscriptionCode || !urlInput.trim()) return;
    progressAnim.setValue(0);
    setSigningStage("pending");
    setScreen("signing");
    animateProgress(0.15, 600);
    try {
      const r = await fetch(apiUrl("/sign/personal/start-url"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urlInput.trim(),
          code: subscriptionCode,
          customName: customName.trim() || undefined,
          customBundleId: customBundle.trim() || undefined,
          fileSize: ipaInfo?.fileSize || 0,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setCurrentJobId(data.jobId);
      setCurrentJob({ jobId: data.jobId, status: "pending", createdAt: new Date().toISOString() });
      startPoll(data.jobId, 0.45);
    } catch (err: any) {
      setCurrentJob({ jobId: "", status: "error", errorMessage: err.message, createdAt: new Date().toISOString() });
      setScreen("result");
    }
  }, [subscriptionCode, urlInput, customName, customBundle, ipaInfo, startPoll, animateProgress, progressAnim]);

  // ── Upload IPA ─────────────────────────────────────────────────────────────
  const handleUploadIpa = useCallback(async () => {
    if (!subscriptionCode) {
      Alert.alert(isArabic ? "يلزم الاشتراك" : "Subscription Required",
        isArabic ? "أدخل كود الاشتراك أولاً" : "Please enter your subscription code first");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["*/*"], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.name.toLowerCase().endsWith(".ipa")) {
        Alert.alert(isArabic ? "ملف غير صالح" : "Invalid File", isArabic ? "الرجاء اختيار ملف .ipa" : "Please choose an .ipa file");
        return;
      }

      progressAnim.setValue(0);
      setSigningStage("upload");
      setScreen("signing");
      animateProgress(0.05, 400);

      const formData = new FormData();
      formData.append("code", subscriptionCode);
      formData.append("file", { uri: asset.uri, name: asset.name, type: "application/octet-stream" } as any);

      // Use XHR for real upload progress
      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiUrl("/sign/personal/upload"));
        xhr.setRequestHeader("Accept", "application/json");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = e.loaded / e.total;
            // Upload maps to 5% → 45%
            animateProgress(0.05 + pct * 0.40, 200);
          }
        };
        xhr.onload = () => {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error("Invalid response")); }
        };
        xhr.onerror = () => reject(new Error(isArabic ? "فشل رفع الملف" : "Upload failed"));
        xhr.send(formData);
      });

      if (data.error) throw new Error(data.error);
      setSigningStage("pending");
      setCurrentJobId(data.jobId);
      setCurrentJob({ jobId: data.jobId, status: "pending", createdAt: new Date().toISOString() });
      startPoll(data.jobId, 0.50);
    } catch (err: any) {
      if (!err.message?.includes("canceled")) {
        setCurrentJob({ jobId: "", status: "error", errorMessage: err.message, createdAt: new Date().toISOString() });
        setScreen("result");
      } else {
        setScreen("home");
      }
    }
  }, [subscriptionCode, isArabic, startPoll, progressAnim, animateProgress]);

  const handleInstall = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert(isArabic ? "خطأ" : "Error", isArabic ? "تعذّر فتح الرابط" : "Could not open link");
    });
  }, [isArabic]);

  const handleCopyLink = useCallback(async (token: string) => {
    const manifestUrl = `${BASE_URL}/api/sign/manifest/${token}.plist`;
    await Clipboard.setStringAsync(manifestUrl);
    Alert.alert("", isArabic ? "تم نسخ الرابط ✓" : "Link copied ✓");
  }, [isArabic]);

  // ── Open panel whenever screen changes to non-home ───────────────────────
  useEffect(() => {
    if (screen !== "home") {
      setPanelScreen(screen);
      if (!panelOpenRef.current) {
        panelOpenRef.current = true;
        const startX = isArabic ? -SCREEN_WIDTH : SCREEN_WIDTH;
        slideAnim.setValue(startX);
        setPanelVisible(true);
        Animated.spring(slideAnim, { toValue: 0, damping: 24, stiffness: 280, useNativeDriver: true }).start();
      }
    }
  }, [screen, isArabic]);

  const resetToHome = useCallback(() => {
    stopPoll();
    if (slowAnimRef.current) { slowAnimRef.current.stop(); slowAnimRef.current = null; }
    progressAnim.setValue(0);
    setSigningStage("upload");
    setScreen("home");
    setShowUrlModal(false);
    setUrlInput("");
    setIpaInfo(null);
    setCustomName("");
    setCustomBundle("");
    setCurrentJob(null);
    setCurrentJobId(null);
    panelOpenRef.current = false;
    setPanelVisible(false);
  }, [stopPoll, progressAnim]);

  const closePanel = useCallback(() => {
    const endX = isArabicRef.current ? -SCREEN_WIDTH : SCREEN_WIDTH;
    Animated.timing(slideAnim, { toValue: endX, duration: 220, useNativeDriver: true }).start(() => {
      resetToHome();
    });
  }, [resetToHome]);

  useEffect(() => { resetToHomeRef.current = resetToHome; }, [resetToHome]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const paddingTop = isWeb ? 67 : insets.top;

  const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

  // Track progress value for percentage label
  const [progressPct, setProgressPct] = React.useState(0);
  React.useEffect(() => {
    const id = progressAnim.addListener(({ value }) => setProgressPct(Math.round(value * 100)));
    return () => progressAnim.removeListener(id);
  }, [progressAnim]);

  const signTitle = (
    <Text style={[styles.headerTitle, { color: colors.text, textAlign: isArabic ? "right" : "left" }]}>
      {isArabic
        ? <><Text style={{ fontFamily: fontAr("Bold") }}>{brandName} </Text><Text style={{ fontFamily: "Inter_700Bold" }}>Sign</Text></>
        : <><Text style={{ fontFamily: "Inter_700Bold" }}>{appNameEn} </Text><Text style={{ fontFamily: "Inter_700Bold" }}>Sign</Text></>
      }
    </Text>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop }]}>

      {/* ══ HOME HEADER (always visible behind the panel) ══════════════════ */}
      <View style={[styles.header, isArabic ? styles.headerRtl : {}]}>
        <View style={{ flex: 1, alignItems: isArabic ? "flex-end" : "flex-start" }}>
          {signTitle}
        </View>
        <TouchableOpacity style={[styles.profileButton, { backgroundColor: colors.card, overflow: "hidden" }]} onPress={() => setShowAccount(true)} activeOpacity={0.6}>
          <ProfileAvatar size={36} />
        </TouchableOpacity>
      </View>

      {/* ══ HOME SCROLL (always rendered behind panel) ══════════════════════ */}
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} bounces
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: isWeb ? 34 : 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <HealthBar colors={colors} fontAr={fontAr} isArabic={isArabic} code={subscriptionCode} />

        <View style={[styles.actionRow, isArabic && { flexDirection: "row-reverse" }]}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => setShowUrlModal(true)}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: `${TINT}18` }]}>
              <Feather name="link" size={22} color={TINT} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text, fontFamily: fontAr("Bold"), textAlign: "center", width: "100%" }]}>{t("signViaUrl")}</Text>
            <Text style={[styles.actionSub, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign: "center", width: "100%" }]}>{t("signViaUrlSub")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={handleUploadIpa}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: "#34c75918" }]}>
              <Feather name="upload" size={22} color="#34c759" />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text, fontFamily: fontAr("Bold"), textAlign: "center", width: "100%" }]}>{t("signUploadFile")}</Text>
            <Text style={[styles.actionSub, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign: "center", width: "100%" }]}>{t("signUploadFileSub")}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionHeader, isArabic && { flexDirection: "row-reverse" }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>{t("signHistory")}</Text>
          {history.length > 0 && (
            <TouchableOpacity onPress={() => setScreen("history")}>
              <Text style={{ color: TINT, fontFamily: fontAr("SemiBold"), fontSize: 13 }}>
                {isArabic ? "عرض الكل" : "See All"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {historyLoading ? (
          <ActivityIndicator size="small" color={TINT} style={{ marginTop: 20 }} />
        ) : history.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Feather name="pen-tool" size={32} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>{t("signHistoryEmpty")}</Text>
          </View>
        ) : (
          history.slice(0, 4).map(job => (
            <HistoryItem key={job.jobId} job={job} onReinstall={handleInstall} colors={colors} fontAr={fontAr} isArabic={isArabic} />
          ))
        )}
      </ScrollView>

      {/* ══ SLIDING PANEL — absolute, slides over home ══════════════════════ */}
      {panelVisible && (
        <Animated.View
          {...panelPanResponder.panHandlers}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.background, paddingTop, transform: [{ translateX: slideAnim }] },
          ]}
        >
          {/* Panel header: back button on the right in both languages */}
          <View style={[styles.header, { flexDirection: "row" }]}>
            <View style={{ flex: 1 }}>
              {signTitle}
            </View>
            <TouchableOpacity onPress={closePanel} style={[styles.backBtn, { backgroundColor: colors.card }]} activeOpacity={0.7}>
              <Feather name={isArabic ? "arrow-right" : "arrow-left"} size={16} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Panel scroll content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: isWeb ? 34 : 100 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── CUSTOMIZE ─────────────────────────────────────────────── */}
            {panelScreen === "customize" && ipaInfo && (
              <>
                <SectionHeader title={t("signInfoCard")} colors={colors} fontAr={fontAr} isArabic={isArabic} />
                <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={[styles.infoIconBig, { backgroundColor: `${TINT}15`, overflow: "hidden" }]}>
                    {ipaInfo.iconBase64
                      ? <Image
                          source={{ uri: `data:image/png;base64,${ipaInfo.iconBase64}` }}
                          style={{ width: 60, height: 60, borderRadius: 18 }}
                        />
                      : <Feather name="package" size={30} color={TINT} />
                    }
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    {[
                      { label: t("signAppName"), value: ipaInfo.name, mono: false },
                      { label: t("signBundleId"), value: ipaInfo.bundleId, mono: true },
                      { label: t("signVersion"), value: ipaInfo.version, mono: true },
                      { label: t("signFileSize"), value: formatBytes(ipaInfo.fileSize), mono: true },
                    ].map(row => (
                      <View key={row.label} style={[styles.infoRow, isArabic && { flexDirection: "row-reverse" }]}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>{row.label}</Text>
                        <Text
                          style={[styles.infoValue, {
                            color: colors.text,
                            fontFamily: row.mono || !hasArabic(row.value) ? "Inter_400Regular" : fontAr("SemiBold"),
                            textAlign: "left",
                          }]}
                          numberOfLines={1}
                        >{row.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold"), marginTop: 24, marginBottom: 12, textAlign: isArabic ? "right" : "left" }]}>
                  {t("signCustomize")}
                </Text>

                {[
                  { key: "customName", label: t("signCustomName"), hint: t("signCustomNameHint"), value: customName, set: setCustomName, placeholder: ipaInfo.name, mono: false },
                  { key: "customBundle", label: t("signCustomBundle"), hint: t("signCustomBundleHint"), value: customBundle, set: setCustomBundle, placeholder: ipaInfo.bundleId, mono: true },
                ].map(f => (
                  <View key={f.key} style={{ marginBottom: 16 }}>
                    <Text style={[styles.fieldLabel, { color: TINT, fontFamily: fontAr("SemiBold"), textAlign: isArabic ? "right" : "left" }]}>{f.label}</Text>
                    <Text style={[styles.fieldHint, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]}>{f.hint}</Text>
                    <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 6 }]}>
                      <TextInput
                        style={[styles.urlInput, { color: colors.text, fontFamily: f.mono ? "Inter_400Regular" : fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]}
                        placeholder={f.placeholder}
                        placeholderTextColor={colors.textSecondary + "50"}
                        value={f.value}
                        onChangeText={f.set}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                ))}

                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: TINT, marginTop: 8 }]} onPress={handleStartSign} activeOpacity={0.8}>
                  <Feather name="pen-tool" size={16} color="#000" />
                  <Text style={[styles.primaryBtnText, { color: "#000", fontFamily: fontAr("Bold") }]}>{t("signStartSign")}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── SIGNING ───────────────────────────────────────────────── */}
            {panelScreen === "signing" && (
              <View style={styles.centerBlock}>
                <View style={[styles.signingIcon, { backgroundColor: `${TINT}15` }]}>
                  <PulsingPen color={TINT} />
                </View>
                <Text style={[styles.signingTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
                  {signingStage === "upload"
                    ? (isArabic ? "جاري رفع الملف..." : "Uploading file...")
                    : signingStage === "pending"
                    ? t("signJobPending")
                    : t("signJobProcessing")}
                </Text>
                <Text style={[styles.signingHint, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                  {isArabic ? "قد يستغرق هذا بضع دقائق..." : "This may take a few minutes..."}
                </Text>

                {/* Progress bar */}
                <View style={[styles.progressTrack, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Animated.View
                    style={[styles.progressFill, {
                      backgroundColor: TINT,
                      width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                    }]}
                  />
                </View>

                {/* Percentage label */}
                <Text style={[styles.progressPct, { color: TINT, fontFamily: "Inter_700Bold" }]}>
                  {progressPct}%
                </Text>

                {/* Stage dots */}
                <View style={styles.stageDots}>
                  {(["upload", "pending", "processing"] as const).map((s) => (
                    <View
                      key={s}
                      style={[
                        styles.stageDot,
                        { backgroundColor: signingStage === s ? TINT : colors.card, borderColor: TINT },
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* ── RESULT ────────────────────────────────────────────────── */}
            {panelScreen === "result" && currentJob && (
              <>
                {currentJob.status === "done" ? (
                  <View style={styles.centerBlock}>
                    <View style={[styles.resultIcon, { backgroundColor: "#22c55e18" }]}>
                      <Feather name="check-circle" size={52} color="#22c55e" />
                    </View>
                    <Text style={[styles.signingTitle, { color: "#22c55e", fontFamily: fontAr("Bold") }]}>{t("signDone")}</Text>
                    <Text style={[styles.signingHint, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>{t("signExpiresIn")}</Text>
                    {currentJob.itmsUrl && (
                      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: TINT, marginTop: 28, alignSelf: "stretch" }]} onPress={() => handleInstall(currentJob.itmsUrl!)} activeOpacity={0.8}>
                        <Feather name="download" size={16} color="#000" />
                        <Text style={[styles.primaryBtnText, { color: "#000", fontFamily: fontAr("Bold") }]}>{t("signInstall")}</Text>
                      </TouchableOpacity>
                    )}
                    {currentJob.signedToken && (
                      <TouchableOpacity style={[styles.secondaryBtn, { borderColor: TINT, marginTop: 12, alignSelf: "stretch" }]} onPress={() => handleCopyLink(currentJob.signedToken!)} activeOpacity={0.8}>
                        <Feather name="copy" size={16} color={TINT} />
                        <Text style={[styles.secondaryBtnText, { color: TINT, fontFamily: fontAr("SemiBold") }]}>{t("signCopyLink")}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={styles.centerBlock}>
                    <View style={[styles.resultIcon, { backgroundColor: "#ef444418" }]}>
                      <Feather name="x-circle" size={52} color="#ef4444" />
                    </View>
                    <Text style={[styles.signingTitle, { color: "#ef4444", fontFamily: fontAr("Bold") }]}>{t("signFailed")}</Text>
                    <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: "#ef444430" }]}>
                      <Text style={[styles.errorText, { color: "#ef4444", fontFamily: "Inter_400Regular" }]}>
                        {currentJob.errorMessage || (isArabic ? "حدث خطأ غير معروف" : "An unknown error occurred")}
                      </Text>
                    </View>
                  </View>
                )}
                <TouchableOpacity style={[styles.ghostBtn, { borderColor: colors.cardBorder, marginTop: 20 }]} onPress={closePanel} activeOpacity={0.7}>
                  <Feather name="refresh-cw" size={14} color={colors.textSecondary} />
                  <Text style={[styles.ghostBtnText, { color: colors.textSecondary, fontFamily: fontAr("SemiBold") }]}>{t("signNewJob")}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── HISTORY ───────────────────────────────────────────────── */}
            {panelScreen === "history" && (
              <>
                <SectionHeader title={t("signHistory")} colors={colors} fontAr={fontAr} isArabic={isArabic} />
                {historyLoading ? (
                  <ActivityIndicator size="large" color={TINT} style={{ marginTop: 40 }} />
                ) : history.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Feather name="pen-tool" size={32} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>{t("signHistoryEmpty")}</Text>
                  </View>
                ) : history.map(job => (
                  <HistoryItem key={job.jobId} job={job} onReinstall={handleInstall} colors={colors} fontAr={fontAr} isArabic={isArabic} />
                ))}
              </>
            )}
          </ScrollView>
        </Animated.View>
      )}

      <AccountPanel visible={showAccount} onClose={() => setShowAccount(false)} />
      <SignUrlModal
        visible={showUrlModal}
        onClose={() => setShowUrlModal(false)}
        onAnalyzed={handleAnalyzedFromModal}
      />
    </View>
  );
}

// ── Pulsing Pen Animation ─────────────────────────────────────────────────────
function PulsingPen({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
    return () => scale.stopAnimation();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Feather name="pen-tool" size={44} color={color} />
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  headerRtl: { flexDirection: "row-reverse" },
  headerTitle: { fontSize: 28 },
  profileButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  healthCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  healthRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  healthLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 7 },
  healthLabel: { fontSize: 11 },
  barTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 3 },

  actionRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  actionCard: {
    flex: 1,
    borderRadius: 20,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    alignItems: "center",
  },
  actionIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 14, textAlign: "center" },
  actionSub: { fontSize: 11, textAlign: "center" },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 17 },

  emptyCard: {
    borderRadius: 20,
    padding: 36,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 12,
  },
  emptyText: { fontSize: 14, textAlign: "center" },

  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  historyIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  historyName: { fontSize: 14 },
  historyBundle: { fontSize: 11 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  reinstallBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  inputCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  urlInput: { flex: 1, paddingVertical: 12, fontSize: 14 },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 14,
  },
  primaryBtnText: { fontSize: 16 },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
  },
  secondaryBtnText: { fontSize: 15 },

  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  ghostBtnText: { fontSize: 14 },

  infoCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  infoIconBig: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { fontSize: 12, width: 75, flexShrink: 0 },
  infoValue: { fontSize: 13, flex: 1 },

  fieldLabel: { fontSize: 13, marginBottom: 2 },
  fieldHint: { fontSize: 11 },

  centerBlock: { alignItems: "center", paddingVertical: 20, gap: 12 },
  signingIcon: { width: 90, height: 90, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  signingTitle: { fontSize: 22, textAlign: "center" },
  signingHint: { fontSize: 14, textAlign: "center" },
  resultIcon: { width: 100, height: 100, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  errorCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 8, alignSelf: "stretch" },
  errorText: { fontSize: 13, textAlign: "center", lineHeight: 20 },

  progressTrack: {
    alignSelf: "stretch",
    height: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: { height: "100%", borderRadius: 10 },
  progressPct: { fontSize: 15, marginTop: 2 },
  stageDots: { flexDirection: "row", gap: 8, marginTop: 4 },
  stageDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
});
