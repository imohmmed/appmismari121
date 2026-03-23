import { Feather, FontAwesome } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";
import type { ThemeColors } from "@/constants/colors";
import GlassBackButton from "@/components/GlassBackButton";
import AppIconImg from "@/components/AppIconImg";
import { useSign } from "@/hooks/useSign";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HEADER_COLLAPSE_POINT = 120;

type AppData = {
  id: number;
  name: string;
  descAr?: string;
  descEn?: string;
  desc?: string;
  category: string;
  categoryNameAr?: string;
  tag: string;
  icon: string;
  catKey?: string;
  categoryId?: number;
  size?: string | null;
  createdAt?: string | null;
};

type Review = {
  id: number;
  name: string;
  phone: string;
  rating: number;
  text: string;
  date: string;
};

type AppDetailProps = {
  app: AppData;
  onClose: () => void;
  onCategoryPress?: (catKey: string) => void;
  relatedApps?: AppData[];
  onRelatedAppPress?: (app: AppData) => void;
};

const CAT_TRANSLATION_KEY: Record<string, string> = {
  social: "social",
  ai: "ai",
  edit: "edit",
  games: "games",
  tweaked: "tweakedApps",
  tv: "tv",
  develop: "develop",
};

function getTagColor(tag: string, colors: ThemeColors) {
  switch (tag) {
    case "tweaked": return colors.tagTweaked;
    case "modded": return colors.tagModded;
    case "hacked": return colors.tagHacked;
    default: return colors.tint;
  }
}

function maskPhone(phone: string) {
  if (phone.length < 8) return phone;
  return phone.slice(0, -7) + " *** " + phone.slice(-4);
}

function StarRow({ rating, size = 14, color = "#FFD700" }: { rating: number; size?: number; color?: string }) {
  const { colors } = useSettings();
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((sv) => {
        const filled = sv <= Math.floor(rating);
        const half = !filled && sv === Math.ceil(rating) && rating % 1 >= 0.25;
        return (
          <FontAwesome
            key={sv}
            name={filled ? "star" : half ? "star-half-o" : "star-o"}
            size={size}
            color={filled || half ? color : colors.separator}
          />
        );
      })}
    </View>
  );
}

function TapToRate({ onRate }: { onRate: (r: number) => void }) {
  const [selected, setSelected] = useState(0);
  const { colors, t, fontAr } = useSettings();
  return (
    <View style={st.tapToRate}>
      <Text style={[st.tapToRateLabel, { color: colors.text, fontFamily: fontAr("SemiBold") }]}>{t("tapToRate")}</Text>
      <View style={st.tapStars}>
        {[1, 2, 3, 4, 5].map((v) => (
          <Pressable key={v} onPress={() => { setSelected(v); onRate(v); }}>
            <FontAwesome
              name={v <= selected ? "star" : "star-o"}
              size={32}
              color={v <= selected ? "#FFD700" : colors.separator}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}


function RelatedAppsRow({ apps, onPress }: { apps: AppData[]; onPress: (app: AppData) => void }) {
  const { colors, t, fontAr, isArabic } = useSettings();
  const pages = chunkArray(apps.slice(0, 30), 3);
  const pageW = SCREEN_WIDTH - 80;
  // For Arabic: mirror the list horizontally so it scrolls RTL naturally
  const mirrorStyle = isArabic ? { transform: [{ scaleX: -1 }] } as const : undefined;
  return (
    <FlatList
      data={pages}
      horizontal
      pagingEnabled={false}
      snapToInterval={pageW + 16}
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
      keyExtractor={(_, i) => i.toString()}
      style={mirrorStyle}
      renderItem={({ item: chunk }) => (
        <View style={[{ width: pageW }, mirrorStyle]}>
          {chunk.map((a, idx) => {
            const desc = isArabic ? (a.descAr || a.desc || "") : (a.descEn || a.desc || "");
            return (
              <View key={a.id}>
                <Pressable
                  style={({ pressed }) => [st.relatedRow, pressed && { opacity: 0.7 }]}
                  onPress={() => onPress(a)}
                >
                  {isArabic ? (
                    // RTL layout: [تحميل LEFT] [Name+Desc MIDDLE] [Icon RIGHT]
                    <>
                      <Pressable style={[st.relatedGetBtn, { backgroundColor: colors.card }]} onPress={() => onPress(a)}>
                        <Text style={[st.relatedGetText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{t("download")}</Text>
                      </Pressable>
                      <View style={{ flex: 1, gap: 3, alignItems: "flex-end" }}>
                        <Text style={[st.relatedName, { color: colors.text, textAlign: "right" }]} numberOfLines={1}>{a.name}</Text>
                        <Text style={[st.relatedDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign: "right" }]} numberOfLines={1}>{desc}</Text>
                      </View>
                      <AppIconImg icon={a.icon} size={56} borderRadius={14} />
                    </>
                  ) : (
                    // LTR layout: [Icon LEFT] [Name+Desc MIDDLE] [Get RIGHT]
                    <>
                      <AppIconImg icon={a.icon} size={56} borderRadius={14} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={[st.relatedName, { color: colors.text }]} numberOfLines={1}>{a.name}</Text>
                        <Text style={[st.relatedDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]} numberOfLines={1}>{desc}</Text>
                      </View>
                      <Pressable style={[st.relatedGetBtn, { backgroundColor: colors.card }]} onPress={() => onPress(a)}>
                        <Text style={[st.relatedGetText, { color: colors.tint }]}>{t("download")}</Text>
                      </Pressable>
                    </>
                  )}
                </Pressable>
                {idx < chunk.length - 1 && <View style={[st.relatedDivider, { backgroundColor: colors.separator }]} />}
              </View>
            );
          })}
        </View>
      )}
    />
  );
}

const MOCK_USER_AR = { name: "أحمد المسماري", phone: "+964 770 123 4567" };
const MOCK_USER_EN = { name: "Ahmed Al-Mismari", phone: "+964 770 123 4567" };

const MOCK_REVIEWS_AR: Review[] = [
  { id: 1, name: "أحمد", phone: "+964 770 123 4567", rating: 5, text: "تطبيق ممتاز! يعمل بشكل مثالي بدون أي مشاكل.", date: "قبل يومين" },
  { id: 2, name: "سارة", phone: "+964 771 234 5678", rating: 4, text: "ميزات رائعة، تجربة سلسة جداً.", date: "قبل أسبوع" },
];
const MOCK_REVIEWS_EN: Review[] = [
  { id: 1, name: "Ahmed", phone: "+964 770 123 4567", rating: 5, text: "Excellent app! Works perfectly without any issues.", date: "2 days ago" },
  { id: 2, name: "Sara", phone: "+964 771 234 5678", rating: 4, text: "Great features, very smooth experience.", date: "1 week ago" },
];

const APP_SIZES: Record<string, string> = {
  social: "85", ai: "142", edit: "210",
  games: "320", tweaked: "95", tv: "130", develop: "65",
};

export default function AppDetailPanel({ app, onClose, onCategoryPress, relatedApps = [], onRelatedAppPress }: AppDetailProps) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { colors, t, fontAr, isArabic, subscriptionCode, setSubscriptionCode } = useSettings();
  const tagColor = getTagColor(app.tag, colors);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { signAndInstall, cloneAndInstall, isLoading, error: signError, state: signState, reset: resetSign, queuePosition } = useSign();

  const mockUser = isArabic ? MOCK_USER_AR : MOCK_USER_EN;
  const [descExpanded, setDescExpanded] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(isArabic ? MOCK_REVIEWS_AR : MOCK_REVIEWS_EN);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [codeInput, setCodeInput] = useState(subscriptionCode);
  const [cloneName, setCloneName] = useState("");
  const [pendingAction, setPendingAction] = useState<"download" | "clone" | null>(null);
  // ─── Nested app stack (قد يعجبك أيضاً → full Modal + stack navigation) ──
  const [nestedStack, setNestedStack] = useState<AppData[]>([]);
  const nestedSlide = useRef(new Animated.Value(0)).current;
  const nestedTouchX = useRef(0);
  const nestedClosing = useRef(false);

  const OFFSCREEN = isArabic ? -SCREEN_WIDTH : SCREEN_WIDTH;

  const openNested = useCallback((a: AppData) => {
    nestedSlide.setValue(OFFSCREEN);
    setNestedStack(prev => [...prev, a]);
    Animated.spring(nestedSlide, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }, [OFFSCREEN, nestedSlide]);

  const closeNestedTopRef = useRef<() => void>(() => {});

  const closeNestedTop = useCallback(() => {
    if (nestedClosing.current) return;
    nestedClosing.current = true;
    Animated.timing(nestedSlide, {
      toValue: OFFSCREEN,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      nestedClosing.current = false;
      setNestedStack(prev => {
        const next = prev.slice(0, -1);
        if (next.length > 0) nestedSlide.setValue(0);
        return next;
      });
    });
  }, [OFFSCREEN, nestedSlide]);

  useEffect(() => { closeNestedTopRef.current = closeNestedTop; }, [closeNestedTop]);

  const nestedPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        nestedTouchX.current = evt.nativeEvent.pageX;
        return false;
      },
      onMoveShouldSetPanResponder: (_, g) => {
        const edge = 52;
        if (isArabic) {
          return nestedTouchX.current >= SCREEN_WIDTH - edge && g.dx < -10 && Math.abs(g.dy) < Math.abs(g.dx);
        }
        return nestedTouchX.current <= edge && g.dx > 10 && Math.abs(g.dy) < Math.abs(g.dx);
      },
      onPanResponderMove: (_, g) => {
        if (isArabic) { if (g.dx < 0) nestedSlide.setValue(g.dx); }
        else { if (g.dx > 0) nestedSlide.setValue(g.dx); }
      },
      onPanResponderRelease: (_, g) => {
        const threshold = SCREEN_WIDTH * 0.3;
        const should = isArabic
          ? g.dx < -threshold || g.vx < -0.8
          : g.dx > threshold || g.vx > 0.8;
        if (should) { closeNestedTopRef.current(); }
        else { Animated.spring(nestedSlide, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start(); }
      },
    })
  ).current;

  const handleDownload = () => {
    if (!subscriptionCode) {
      setPendingAction("download");
      setCodeInput("");
      setShowCodeModal(true);
    } else {
      resetSign();
      signAndInstall(subscriptionCode, app.id);
    }
  };

  const handleClone = () => {
    if (!subscriptionCode) {
      setPendingAction("clone");
      setCodeInput("");
      setShowCodeModal(true);
    } else {
      setCloneName("");
      setShowCloneModal(true);
    }
  };

  const handleSaveCode = () => {
    const trimmed = codeInput.trim().toUpperCase();
    if (!trimmed) return;
    setSubscriptionCode(trimmed);
    setShowCodeModal(false);
    if (pendingAction === "download") {
      resetSign();
      signAndInstall(trimmed, app.id);
    } else if (pendingAction === "clone") {
      setCloneName("");
      setShowCloneModal(true);
    }
    setPendingAction(null);
  };

  const handleCloneConfirm = () => {
    setShowCloneModal(false);
    resetSign();
    cloneAndInstall(subscriptionCode, app.id, cloneName);
  };

  const queueText = queuePosition > 2
    ? `${isArabic ? "في الطابور — رقمك" : "Queue position:"} ${queuePosition}`
    : null;

  const signingLabel = queueText ?? (isArabic ? "جارٍ التوقيع..." : "Signing...");
  const downloadBtnLabel = signState === "signing" ? signingLabel : signState === "opening" ? t("installing") : t("download");
  const cloneBtnLabel    = signState === "signing" ? signingLabel : signState === "opening" ? t("installing") : t("retry");

  const appDesc = isArabic ? (app.descAr || app.desc || "") : (app.descEn || app.desc || "");
  const catName = app.category || (app as any).categoryName || "";
  const catNameAr = app.categoryNameAr || (app as any).categoryNameAr || "";
  const catTransKey = CAT_TRANSLATION_KEY[app.catKey || ""] || CAT_TRANSLATION_KEY[catName] || catName;
  const catLabel = isArabic ? (catNameAr || t(catTransKey as any) || catName) : (t(catTransKey as any) || catName);

  const fullDescAr = `${app.descAr || app.desc}. هذا إصدار ${app.tag === "tweaked" ? "بلس" : app.tag === "modded" ? "معدّل" : "مهكر"} من ${app.name} مع ميزات بريميوم مفعّلة. التثبيت مباشر بدون جيلبريك. تحديثات مستمرة ودعم فني مع اشتراكك. متوافق مع أحدث إصدارات iOS. بدون إلغاء - نحافظ على الشهادات محدّثة.`;
  const fullDescEn = `${app.descEn || app.desc}. This is a ${app.tag} version of ${app.name} with premium features unlocked. Direct install without jailbreak. Continuous updates and support with your subscription. Compatible with latest iOS versions. No revokes - certificates kept up to date.`;
  const fullDesc = isArabic ? fullDescAr : fullDescEn;

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const submitReview = () => {
    if (!reviewText.trim() || reviewRating === 0) return;
    setReviews([{
      id: Date.now(), name: mockUser.name, phone: mockUser.phone,
      rating: reviewRating, text: reviewText, date: t("now"),
    }, ...reviews]);
    setReviewText(""); setReviewRating(0);
  };

  const rawSize = APP_SIZES[app.catKey || ""] || APP_SIZES[app.category] || null;
  const appSize = app.size || rawSize || "—";
  const showMbLabel = !app.size && !!rawSize;
  const updateDays = app.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(app.createdAt).getTime()) / 86400000))
    : null;

  const stickyOpacity = scrollY.interpolate({
    inputRange: [HEADER_COLLAPSE_POINT - 20, HEADER_COLLAPSE_POINT + 10],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const stickyTranslate = scrollY.interpolate({
    inputRange: [HEADER_COLLAPSE_POINT - 20, HEADER_COLLAPSE_POINT + 10],
    outputRange: [-10, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={[st.container, { paddingTop: isWeb ? 67 : insets.top, backgroundColor: colors.background }]}>
      <View style={[st.navBar, isArabic && { flexDirection: "row-reverse" }]}>
        <GlassBackButton onPress={onClose} />
        <Animated.View style={[st.stickyCenter, { opacity: stickyOpacity, transform: [{ translateY: stickyTranslate }] }]}>
          <View style={[st.stickyIcon, { backgroundColor: `${tagColor}15`, overflow: "hidden" }]}>
            <AppIconImg icon={app.icon} size={30} borderRadius={8} />
          </View>
        </Animated.View>
        <Animated.View style={{ opacity: stickyOpacity }}>
          <Pressable
            style={[st.stickyGetBtn, { backgroundColor: colors.tint, opacity: isLoading ? 0.6 : 1 }]}
            onPress={handleDownload}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={[st.stickyGetText, { fontFamily: fontAr("Bold") }]}>{downloadBtnLabel}</Text>
            }
          </Pressable>
        </Animated.View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 80 }}
        contentInsetAdjustmentBehavior="automatic"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <View style={st.heroRow}>
          <View style={[st.bigIcon, { backgroundColor: `${tagColor}12`, overflow: "hidden" }]}>
            <AppIconImg icon={app.icon} size={110} borderRadius={26} />
          </View>
          <View style={st.heroInfo}>
            <Text style={[st.appName, { color: colors.text }]} numberOfLines={2}>{app.name}</Text>
            <Text style={[st.appSubtitle, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>{appDesc}</Text>
            <View style={st.heroButtons}>
              <Pressable
                style={[st.repeatBtn, { backgroundColor: colors.card, opacity: isLoading ? 0.5 : 1 }]}
                onPress={handleClone}
                disabled={isLoading}
              >
                {isLoading && signState === "signing"
                  ? <ActivityIndicator size="small" color={colors.tint} />
                  : <Feather name="repeat" size={14} color={colors.tint} />
                }
                <Text style={[st.repeatText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>{cloneBtnLabel}</Text>
              </Pressable>
              <Pressable
                style={[st.getBtn, { backgroundColor: colors.tint, opacity: isLoading ? 0.6 : 1 }]}
                onPress={handleDownload}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={[st.getBtnText, { fontFamily: fontAr("Bold") }]}>{downloadBtnLabel}</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[st.infoBoxRow, { backgroundColor: colors.card }]}>
          <View style={st.infoBox}>
            <Text style={[st.infoBoxLabel, { color: colors.textSecondary, fontFamily: fontAr("SemiBold") }]}>{t("rating")}</Text>
            <Text style={[st.infoBoxValue, { color: colors.text }]}>{avgRating}</Text>
            <StarRow rating={Math.round(Number(avgRating))} size={10} />
          </View>
          <View style={[st.infoBoxDivider, { backgroundColor: colors.separator }]} />
          <View style={st.infoBox}>
            <Text style={[st.infoBoxLabel, { color: colors.textSecondary, fontFamily: fontAr("SemiBold") }]}>{t("size")}</Text>
            <Text style={[st.infoBoxValue, { color: colors.text }]}>{appSize}</Text>
            {showMbLabel && <Text style={[st.infoBoxSub, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>{t("mb")}</Text>}
          </View>
          <View style={[st.infoBoxDivider, { backgroundColor: colors.separator }]} />
          <Pressable
            style={st.infoBox}
            onPress={() => (app.catKey || app.categoryId) && onCategoryPress?.(app.catKey || String(app.categoryId || ""))}
          >
            <Text style={[st.infoBoxLabel, { color: colors.textSecondary, fontFamily: fontAr("SemiBold") }]}>{t("category")}</Text>
            <Feather name="grid" size={18} color={colors.tint} style={{ marginVertical: 2 }} />
            <Text style={[st.infoBoxSub, { color: colors.tint, fontFamily: fontAr("Regular") }]}>{catLabel}</Text>
          </Pressable>
          <View style={[st.infoBoxDivider, { backgroundColor: colors.separator }]} />
          <View style={st.infoBox}>
            <Text style={[st.infoBoxLabel, { color: colors.textSecondary, fontFamily: fontAr("SemiBold") }]}>{t("update")}</Text>
            <Text style={[st.infoBoxValue, { color: colors.text }]}>{updateDays !== null ? updateDays : "—"}</Text>
            <Text style={[st.infoBoxSub, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>{updateDays !== null ? t("days") : ""}</Text>
          </View>
        </View>

        <View style={[st.section, isArabic && { alignItems: "flex-end" }]}>
          <Text style={[st.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold"), textAlign: isArabic ? "right" : "left", alignSelf: "stretch" }]}>{t("description")}</Text>
          <Text style={[st.descText, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left", alignSelf: "stretch", writingDirection: isArabic ? "rtl" : "ltr" }]} numberOfLines={descExpanded ? undefined : 3}>
            {fullDesc}
          </Text>
          <Pressable onPress={() => setDescExpanded(!descExpanded)} style={{ alignSelf: isArabic ? "flex-end" : "flex-start" }}>
            <Text style={[st.readMore, { color: colors.tint, fontFamily: fontAr("SemiBold") }]}>{descExpanded ? t("showLess") : t("readMore")}</Text>
          </Pressable>
        </View>

        <View style={[st.dividerFull, { backgroundColor: colors.separator }]} />

        <View style={[st.section, isArabic && { alignItems: "flex-end" }]}>
          <Text style={[st.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold"), textAlign: isArabic ? "right" : "left", alignSelf: "stretch" }]}>{t("ratingsReviews")}</Text>
          <View style={[st.ratingOverview, isArabic && { flexDirection: "row-reverse", alignSelf: "flex-end" }]}>
            <Text style={[st.bigRating, { color: colors.text }]}>{avgRating}</Text>
            <View style={[{ gap: 4 }, isArabic && { alignItems: "flex-end" }]}>
              <StarRow rating={Math.round(Number(avgRating))} size={18} />
              <Text style={[st.ratingCount, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>{reviews.length} {t("reviews")}</Text>
            </View>
          </View>

          {reviews.map((review) => (
            <View key={review.id} style={[st.reviewCard, { backgroundColor: colors.card, alignSelf: "stretch" }]}>
              <View style={[st.reviewHeader, isArabic && { flexDirection: "row-reverse" }]}>
                <View style={[st.reviewerAvatar, { backgroundColor: colors.tint }]}>
                  <Text style={st.reviewerInitial}>{review.name[0]}</Text>
                </View>
                <View style={[{ flex: 1 }, isArabic && { alignItems: "flex-end" }]}>
                  <Text style={[st.reviewerName, { color: colors.text, fontFamily: fontAr("SemiBold") }]}>{review.name}</Text>
                  <Text style={[st.reviewerPhone, { color: colors.textSecondary }]}>{maskPhone(review.phone)}</Text>
                </View>
                <Text style={[st.reviewDate, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>{review.date}</Text>
              </View>
              <View style={isArabic ? { alignItems: "flex-end" } : undefined}>
                <StarRow rating={review.rating} size={12} />
              </View>
              <Text style={[st.reviewText, { color: colors.text, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left", writingDirection: isArabic ? "rtl" : "ltr" }]}>{review.text}</Text>
            </View>
          ))}

          <View style={{ alignSelf: "stretch" }}>
            <TapToRate onRate={setReviewRating} />
          </View>

          <View style={[st.writeReviewSection, { alignSelf: "stretch" }]}>
            <Text style={[st.writeReviewTitle, { color: colors.text, fontFamily: fontAr("Bold"), textAlign: isArabic ? "right" : "left" }]}>{t("writeReview")}</Text>
            <TextInput
              style={[st.input, { height: 80, textAlignVertical: "top", backgroundColor: colors.card, color: colors.text, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left", writingDirection: isArabic ? "rtl" : "ltr" }]}
              placeholder={t("reviewPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
            />
            <Pressable style={[st.submitBtn, { backgroundColor: colors.tint }, (!reviewText.trim() || reviewRating === 0) && st.submitBtnDisabled]} onPress={submitReview}>
              <Text style={[st.submitBtnText, { fontFamily: fontAr("Bold") }]}>{t("submitReview")}</Text>
            </Pressable>
          </View>
        </View>

        {relatedApps.length > 0 && (
          <>
            <View style={[st.dividerFull, { backgroundColor: colors.separator }]} />
            <View style={[st.section, isArabic && { alignItems: "flex-end" }]}>
              <Text style={[st.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold"), textAlign: isArabic ? "right" : "left", alignSelf: "stretch" }]}>{t("youMayLike")}</Text>
            </View>
            <RelatedAppsRow
              apps={relatedApps}
              onPress={onRelatedAppPress ?? openNested}
            />
          </>
        )}
      </Animated.ScrollView>

      {/* ── Code Entry Modal ── */}
      <Modal visible={showCodeModal} transparent animationType="fade" onRequestClose={() => setShowCodeModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={st.modalOverlay}>
          <View style={[st.modalBox, { backgroundColor: colors.background, borderColor: colors.separator }]}>
            <Text style={[st.modalTitle, { color: colors.text, fontFamily: fontAr("Bold"), textAlign: isArabic ? "right" : "left" }]}>{t("enterCode")}</Text>
            <Text style={[st.modalHint, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]}>{t("codeHint")}</Text>
            <TextInput
              value={codeInput}
              onChangeText={setCodeInput}
              placeholder="XXXX-XXXX-XXXX"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[st.modalInput, {
                color: colors.text,
                backgroundColor: colors.card,
                borderColor: colors.separator,
                fontFamily: "Inter_500Medium",
                textAlign: "center",
              }]}
            />
            {signError && (
              <Text style={[st.modalError, { fontFamily: fontAr("Regular") }]}>{signError}</Text>
            )}
            <View style={[st.modalBtns, isArabic && { flexDirection: "row-reverse" }]}>
              <Pressable style={[st.modalCancelBtn, { borderColor: colors.separator }]} onPress={() => setShowCodeModal(false)}>
                <Text style={[{ color: colors.textSecondary, fontFamily: fontAr("Medium") }]}>إلغاء</Text>
              </Pressable>
              <Pressable style={[st.modalConfirmBtn, { backgroundColor: colors.tint }]} onPress={handleSaveCode}>
                <Text style={[{ color: "#fff", fontFamily: fontAr("Bold") }]}>{t("saveCode")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Clone Modal ── */}
      <Modal visible={showCloneModal} transparent animationType="fade" onRequestClose={() => setShowCloneModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={st.modalOverlay}>
          <View style={[st.modalBox, { backgroundColor: colors.background, borderColor: colors.separator }]}>
            <Text style={[st.modalTitle, { color: colors.text, fontFamily: fontAr("Bold"), textAlign: isArabic ? "right" : "left" }]}>{t("cloneTitle")}</Text>
            <Text style={[st.modalHint, { color: colors.textSecondary, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]}>
              {isArabic ? `سيتم إنشاء نسخة جديدة من ${app.name} بـ Bundle ID مختلف` : `A new copy of ${app.name} will be created with a different Bundle ID`}
            </Text>
            <TextInput
              value={cloneName}
              onChangeText={setCloneName}
              placeholder={isArabic ? `${app.name} 2` : `${app.name} 2`}
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              style={[st.modalInput, {
                color: colors.text,
                backgroundColor: colors.card,
                borderColor: colors.separator,
                fontFamily: fontAr("Regular"),
                textAlign: isArabic ? "right" : "left",
              }]}
            />
            <View style={[st.modalBtns, isArabic && { flexDirection: "row-reverse" }]}>
              <Pressable style={[st.modalCancelBtn, { borderColor: colors.separator }]} onPress={() => setShowCloneModal(false)}>
                <Text style={[{ color: colors.textSecondary, fontFamily: fontAr("Medium") }]}>إلغاء</Text>
              </Pressable>
              <Pressable style={[st.modalConfirmBtn, { backgroundColor: colors.tint }]} onPress={handleCloneConfirm}>
                <Text style={[{ color: "#fff", fontFamily: fontAr("Bold") }]}>{t("cloneBtn")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Nested stack: absoluteFill with zIndex > navBar(10), no Modal so tab bar stays visible ── */}
      <View
        style={[StyleSheet.absoluteFill, { zIndex: 20 }]}
        pointerEvents={nestedStack.length > 0 ? "box-none" : "none"}
      >
        {nestedStack.length > 0 && (
          <>
            {/* Layer below: previous stack item (visible when top animates out) */}
            {nestedStack.length > 1 && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
                <AppDetailPanel
                  app={nestedStack[nestedStack.length - 2]}
                  onClose={closeNestedTop}
                  relatedApps={relatedApps.filter(a => a.id !== nestedStack[nestedStack.length - 2].id)}
                  onRelatedAppPress={openNested}
                />
              </View>
            )}
            {/* Top item: slides in from side, swipe-to-dismiss */}
            <Animated.View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, transform: [{ translateX: nestedSlide }] }]}
              {...nestedPan.panHandlers}
            >
              <AppDetailPanel
                app={nestedStack[nestedStack.length - 1]}
                onClose={closeNestedTop}
                relatedApps={relatedApps.filter(a => a.id !== nestedStack[nestedStack.length - 1].id)}
                onRelatedAppPress={openNested}
              />
            </Animated.View>
          </>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  stickyCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stickyIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyGetBtn: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stickyGetText: {
    fontSize: 14,
    color: "#FFF",
  },

  heroRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 20,
    marginTop: 4,
  },
  bigIcon: {
    width: 110,
    height: 110,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  appName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  appSubtitle: {
    fontSize: 13,
    marginBottom: 8,
  },
  heroButtons: {
    flexDirection: "row",
    gap: 10,
  },
  repeatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  repeatText: {
    fontSize: 13,
  },
  getBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 18,
  },
  getBtnText: {
    fontSize: 13,
    color: "#FFF",
  },

  infoBoxRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 24,
  },
  infoBox: { flex: 1, alignItems: "center", gap: 2 },
  infoBoxDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  infoBoxLabel: { fontSize: 10, letterSpacing: 0.5 },
  infoBoxValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  infoBoxSub: { fontSize: 11 },

  section: { paddingHorizontal: 20, marginBottom: 8, paddingTop: 16 },
  sectionTitle: { fontSize: 20, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  descText: { fontSize: 15, lineHeight: 22 },
  readMore: { fontSize: 15, marginTop: 6, marginBottom: 8 },
  dividerFull: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginVertical: 8 },

  ratingOverview: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  bigRating: { fontSize: 48, fontFamily: "Inter_700Bold" },
  ratingCount: { fontSize: 13 },

  reviewCard: { borderRadius: 14, padding: 14, marginBottom: 10, gap: 6 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  reviewerAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  reviewerInitial: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  reviewerName: { fontSize: 15 },
  reviewerPhone: { fontSize: 12, fontFamily: "Inter_400Regular" },
  reviewDate: { fontSize: 12 },
  reviewText: { fontSize: 14, lineHeight: 20 },

  tapToRate: { alignItems: "center", gap: 8, marginVertical: 16 },
  tapToRateLabel: { fontSize: 15 },
  tapStars: { flexDirection: "row", gap: 12 },

  writeReviewSection: { gap: 10, marginTop: 8 },
  writeReviewTitle: { fontSize: 17 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 16, color: "#FFF" },

  relatedRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  relatedIcon: { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  relatedName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  relatedDesc: { fontSize: 13 },
  relatedGetBtn: { paddingHorizontal: 22, paddingVertical: 7, borderRadius: 18 },
  relatedGetText: { fontSize: 15 },
  relatedDivider: { height: StyleSheet.hairlineWidth, marginLeft: 68 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    gap: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalHint: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.7,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 15,
    letterSpacing: 1.5,
  },
  modalError: {
    fontSize: 12,
    color: "#ff6b6b",
    textAlign: "center",
  },
  modalBtns: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  modalConfirmBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
});
