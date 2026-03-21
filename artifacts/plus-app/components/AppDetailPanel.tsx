import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import GlassBackButton from "@/components/GlassBackButton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HEADER_COLLAPSE_POINT = 120;

type AppData = {
  id: number;
  name: string;
  desc: string;
  category: string;
  tag: string;
  icon: string;
  catKey?: string;
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

function getTagColor(tag: string) {
  switch (tag) {
    case "tweaked": return Colors.light.tagTweaked;
    case "modded": return Colors.light.tagModded;
    case "hacked": return Colors.light.tagHacked;
    default: return Colors.light.tint;
  }
}

function maskPhone(phone: string) {
  if (phone.length < 8) return phone;
  return phone.slice(0, -7) + " *** " + phone.slice(-4);
}

function StarRow({ rating, size = 14, color = "#FFD700" }: { rating: number; size?: number; color?: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((sv) => (
        <Feather key={sv} name="star" size={size} color={sv <= rating ? color : Colors.light.separator} />
      ))}
    </View>
  );
}

function TapToRate({ onRate }: { onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <View style={st.tapToRate}>
      <Text style={st.tapToRateLabel}>اضغط للتقييم</Text>
      <View style={st.tapStars}>
        {[1, 2, 3, 4, 5].map((v) => (
          <Pressable key={v} onPress={() => { setHover(v); onRate(v); }}>
            <Feather name="star" size={32} color={v <= hover ? "#FFD700" : Colors.light.separator} />
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

function RelatedAppsRow({ apps, onPress }: { apps: AppData[]; onPress?: (app: AppData) => void }) {
  const pages = chunkArray(apps.slice(0, 9), 3);
  const pageW = SCREEN_WIDTH - 80;
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
      renderItem={({ item: chunk }) => (
        <View style={{ width: pageW }}>
          {chunk.map((a, idx) => {
            const tc = getTagColor(a.tag);
            return (
              <View key={a.id}>
                <Pressable style={st.relatedRow} onPress={() => onPress?.(a)}>
                  <View style={[st.relatedIcon, { backgroundColor: `${tc}15` }]}>
                    <Feather name={a.icon as any} size={24} color={tc} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={st.relatedName} numberOfLines={1}>{a.name}</Text>
                    <Text style={st.relatedDesc} numberOfLines={1}>{a.desc}</Text>
                  </View>
                  <Pressable style={st.relatedGetBtn}>
                    <Text style={st.relatedGetText}>تحميل</Text>
                  </Pressable>
                </Pressable>
                {idx < chunk.length - 1 && <View style={st.relatedDivider} />}
              </View>
            );
          })}
        </View>
      )}
    />
  );
}

const MOCK_USER = {
  name: "أحمد المسماري",
  phone: "+964 770 123 4567",
};

const MOCK_REVIEWS: Review[] = [
  { id: 1, name: "أحمد", phone: "+964 770 123 4567", rating: 5, text: "تطبيق ممتاز! يعمل بشكل مثالي بدون أي مشاكل.", date: "قبل يومين" },
  { id: 2, name: "سارة", phone: "+964 771 234 5678", rating: 4, text: "ميزات رائعة، تجربة سلسة جداً.", date: "قبل أسبوع" },
];

const APP_SIZES: Record<string, string> = {
  "تواصل اجتماعي": "85", "ذكاء اصطناعي": "142", "تعديل": "210",
  "ألعاب": "320", "تطبيقات بلس": "95", "تلفزيون": "130", "تطوير": "65",
  "Social Media": "85", "Ai": "142", "Edit": "210",
  "Games": "320", "Tweaked Apps": "95", "TV , LIVE": "130", "Develop": "65",
};

function GlassGetButton({ small }: { small?: boolean }) {
  const isWeb = Platform.OS === "web";
  if (small) {
    if (isWeb) {
      return (
        <Pressable style={st.glassGetSmallWeb}>
          <Text style={st.glassGetSmallText}>تحميل</Text>
        </Pressable>
      );
    }
    return (
      <Pressable style={st.glassGetSmallWrap}>
        <View style={st.glassGetSmallInner}>
          <Text style={st.glassGetSmallText}>تحميل</Text>
        </View>
      </Pressable>
    );
  }
  return null;
}

export default function AppDetailPanel({ app, onClose, onCategoryPress, relatedApps = [], onRelatedAppPress }: AppDetailProps) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const tagColor = getTagColor(app.tag);
  const scrollY = useRef(new Animated.Value(0)).current;

  const [descExpanded, setDescExpanded] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(0);

  const fullDesc = `${app.desc}. هذا إصدار ${app.tag === "tweaked" ? "بلس" : app.tag === "modded" ? "معدّل" : "مهكر"} من ${app.name} مع ميزات بريميوم مفعّلة. التثبيت مباشر بدون جيلبريك. تحديثات مستمرة ودعم فني مع اشتراكك. متوافق مع أحدث إصدارات iOS. بدون إلغاء - نحافظ على الشهادات محدّثة. الميزات تشمل جميع المحتوى المميز، إزالة الإعلانات، وتعديلات حصرية غير متوفرة في التطبيق الأصلي.`;

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const submitReview = () => {
    if (!reviewText.trim() || reviewRating === 0) return;
    setReviews([{
      id: Date.now(), name: MOCK_USER.name, phone: MOCK_USER.phone,
      rating: reviewRating, text: reviewText, date: "الآن",
    }, ...reviews]);
    setReviewText(""); setReviewRating(0);
  };

  const appSize = APP_SIZES[app.category] || "100";

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
    <View style={[st.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={st.navBar}>
        <GlassBackButton onPress={onClose} />
        <Animated.View style={[st.stickyCenter, { opacity: stickyOpacity, transform: [{ translateY: stickyTranslate }] }]}>
          <View style={[st.stickyIcon, { backgroundColor: `${tagColor}15` }]}>
            <Feather name={app.icon as any} size={18} color={tagColor} />
          </View>
        </Animated.View>
        <Animated.View style={{ opacity: stickyOpacity }}>
          <Pressable style={st.stickyGetBtn}>
            <Text style={st.stickyGetText}>تحميل</Text>
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
          <View style={[st.bigIcon, { backgroundColor: `${tagColor}12` }]}>
            <Feather name={app.icon as any} size={48} color={tagColor} />
          </View>
          <View style={st.heroInfo}>
            <Text style={st.appName} numberOfLines={2}>{app.name}</Text>
            <Text style={st.appSubtitle}>{app.desc}</Text>
            <View style={st.heroButtons}>
              <Pressable style={st.repeatBtn}>
                <Feather name="repeat" size={14} color={Colors.light.tint} />
                <Text style={st.repeatText}>إعادة</Text>
              </Pressable>
              <Pressable style={st.getBtn}>
                <Text style={st.getBtnText}>تحميل</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={st.infoBoxRow}>
          <View style={st.infoBox}>
            <Text style={st.infoBoxLabel}>التقييم</Text>
            <Text style={st.infoBoxValue}>{avgRating}</Text>
            <StarRow rating={Math.round(Number(avgRating))} size={10} />
          </View>
          <View style={st.infoBoxDivider} />
          <View style={st.infoBox}>
            <Text style={st.infoBoxLabel}>الحجم</Text>
            <Text style={st.infoBoxValue}>{appSize}</Text>
            <Text style={st.infoBoxSub}>م.ب</Text>
          </View>
          <View style={st.infoBoxDivider} />
          <Pressable
            style={st.infoBox}
            onPress={() => app.catKey && onCategoryPress?.(app.catKey)}
          >
            <Text style={st.infoBoxLabel}>القسم</Text>
            <Feather name="grid" size={18} color={Colors.light.tint} style={{ marginVertical: 2 }} />
            <Text style={[st.infoBoxSub, { color: Colors.light.tint }]}>{app.category}</Text>
          </Pressable>
          <View style={st.infoBoxDivider} />
          <View style={st.infoBox}>
            <Text style={st.infoBoxLabel}>التحديث</Text>
            <Text style={st.infoBoxValue}>3</Text>
            <Text style={st.infoBoxSub}>أيام</Text>
          </View>
        </View>

        <View style={st.section}>
          <Text style={st.sectionTitle}>الوصف</Text>
          <Text style={st.descText} numberOfLines={descExpanded ? undefined : 3}>
            {fullDesc}
          </Text>
          <Pressable onPress={() => setDescExpanded(!descExpanded)}>
            <Text style={st.readMore}>{descExpanded ? "عرض أقل" : "قراءة المزيد..."}</Text>
          </Pressable>
        </View>

        <View style={st.dividerFull} />

        <View style={st.section}>
          <Text style={st.sectionTitle}>التقييمات والمراجعات</Text>
          <View style={st.ratingOverview}>
            <Text style={st.bigRating}>{avgRating}</Text>
            <View style={{ gap: 4 }}>
              <StarRow rating={Math.round(Number(avgRating))} size={18} />
              <Text style={st.ratingCount}>{reviews.length} تقييم</Text>
            </View>
          </View>

          {reviews.map((review) => (
            <View key={review.id} style={st.reviewCard}>
              <View style={st.reviewHeader}>
                <View style={st.reviewerAvatar}>
                  <Text style={st.reviewerInitial}>{review.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.reviewerName}>{review.name}</Text>
                  <Text style={st.reviewerPhone}>{maskPhone(review.phone)}</Text>
                </View>
                <Text style={st.reviewDate}>{review.date}</Text>
              </View>
              <StarRow rating={review.rating} size={12} />
              <Text style={st.reviewText}>{review.text}</Text>
            </View>
          ))}

          <TapToRate onRate={setReviewRating} />

          <View style={st.writeReviewSection}>
            <Text style={st.writeReviewTitle}>اكتب مراجعة</Text>
            <TextInput style={[st.input, { height: 80, textAlignVertical: "top" }]} placeholder="اكتب مراجعتك هنا..." placeholderTextColor={Colors.light.textSecondary} value={reviewText} onChangeText={setReviewText} multiline />
            <Pressable style={[st.submitBtn, (!reviewText.trim() || reviewRating === 0) && st.submitBtnDisabled]} onPress={submitReview}>
              <Text style={st.submitBtnText}>إرسال المراجعة</Text>
            </Pressable>
          </View>
        </View>

        {relatedApps.length > 0 && (
          <>
            <View style={st.dividerFull} />
            <View style={st.section}>
              <View style={st.sectionHeaderRow}>
                <Text style={st.sectionTitle}>قد يعجبك أيضاً</Text>
                <Feather name="chevron-left" size={18} color={Colors.light.textSecondary} />
              </View>
            </View>
            <RelatedAppsRow apps={relatedApps} onPress={onRelatedAppPress} />
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

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
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stickyGetText: {
    fontSize: 14,
    fontFamily: "Mestika-Bold",
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
    color: Colors.light.text,
  },
  appSubtitle: {
    fontSize: 13,
    fontFamily: "Mestika-Regular",
    color: Colors.light.textSecondary,
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
    backgroundColor: Colors.light.card,
  },
  repeatText: {
    fontSize: 13,
    fontFamily: "Mestika-Bold",
    color: Colors.light.tint,
  },
  getBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
  },
  getBtnText: {
    fontSize: 13,
    fontFamily: "Mestika-Bold",
    color: "#FFF",
  },

  glassGetSmallWeb: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(200,200,210,0.35)",
    backdropFilter: "blur(20px)",
    ...Platform.select({ web: { boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }),
  },
  glassGetSmallWrap: {
    borderRadius: 16,
    overflow: "hidden",
  },
  glassGetSmallInner: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  glassGetSmallText: {
    fontSize: 14,
    fontFamily: "Mestika-Bold",
    color: Colors.light.tint,
  },

  infoBoxRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 24,
  },
  infoBox: { flex: 1, alignItems: "center", gap: 2 },
  infoBoxDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.light.separator, marginVertical: 4 },
  infoBoxLabel: { fontSize: 10, fontFamily: "Mestika-SemiBold", color: Colors.light.textSecondary, letterSpacing: 0.5 },
  infoBoxValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.light.text },
  infoBoxSub: { fontSize: 11, fontFamily: "Mestika-Regular", color: Colors.light.textSecondary },

  section: { paddingHorizontal: 20, marginBottom: 8, paddingTop: 16 },
  sectionTitle: { fontSize: 20, fontFamily: "Mestika-Bold", color: Colors.light.text, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  descText: { fontSize: 15, fontFamily: "Mestika-Regular", color: Colors.light.textSecondary, lineHeight: 22 },
  readMore: { fontSize: 15, fontFamily: "Mestika-SemiBold", color: Colors.light.tint, marginTop: 6, marginBottom: 8 },
  dividerFull: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.light.separator, marginHorizontal: 20, marginVertical: 8 },

  ratingOverview: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  bigRating: { fontSize: 48, fontFamily: "Inter_700Bold", color: Colors.light.text },
  ratingCount: { fontSize: 13, fontFamily: "Mestika-Regular", color: Colors.light.textSecondary },

  reviewCard: { backgroundColor: Colors.light.card, borderRadius: 14, padding: 14, marginBottom: 10, gap: 6 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  reviewerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.light.tint, alignItems: "center", justifyContent: "center" },
  reviewerInitial: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  reviewerName: { fontSize: 15, fontFamily: "Mestika-SemiBold", color: Colors.light.text },
  reviewerPhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  reviewDate: { fontSize: 12, fontFamily: "Mestika-Regular", color: Colors.light.textSecondary },
  reviewText: { fontSize: 14, fontFamily: "Mestika-Regular", color: Colors.light.text, lineHeight: 20 },

  tapToRate: { alignItems: "center", gap: 8, marginVertical: 16 },
  tapToRateLabel: { fontSize: 15, fontFamily: "Mestika-SemiBold", color: Colors.light.text },
  tapStars: { flexDirection: "row", gap: 12 },

  writeReviewSection: { gap: 10, marginTop: 8 },
  writeReviewTitle: { fontSize: 17, fontFamily: "Mestika-Bold", color: Colors.light.text },
  input: { backgroundColor: Colors.light.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Mestika-Regular", color: Colors.light.text, textAlign: "right" as const },
  submitBtn: { backgroundColor: Colors.light.tint, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 16, fontFamily: "Mestika-Bold", color: "#FFF" },

  relatedRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  relatedIcon: { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  relatedName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  relatedDesc: { fontSize: 13, fontFamily: "Mestika-Regular", color: Colors.light.textSecondary },
  relatedGetBtn: { backgroundColor: Colors.light.card, paddingHorizontal: 22, paddingVertical: 7, borderRadius: 18 },
  relatedGetText: { fontSize: 15, fontFamily: "Mestika-Bold", color: Colors.light.tint },
  relatedDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.light.separator, marginLeft: 68 },
});
