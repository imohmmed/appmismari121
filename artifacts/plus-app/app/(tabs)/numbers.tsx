import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

const STATS = [
  { label: "إجمالي التطبيقات", value: "+8,000", icon: "smartphone", color: Colors.light.tint },
  { label: "الأقسام", value: "8", icon: "grid", color: "#AF52DE" },
  { label: "التحميلات", value: "+250 ألف", icon: "download", color: Colors.light.success },
  { label: "المستخدمون النشطون", value: "+15 ألف", icon: "users", color: Colors.light.tagModded },
];

const TOP_APPS = [
  { rank: 1, name: "Netflix", downloads: "30 ألف", trend: "+12%" },
  { rank: 2, name: "YouTube Premium", downloads: "25 ألف", trend: "+8%" },
  { rank: 3, name: "Spotify++", downloads: "22 ألف", trend: "+15%" },
  { rank: 4, name: "TikTok++", downloads: "20 ألف", trend: "+5%" },
  { rank: 5, name: "Instagram++", downloads: "18 ألف", trend: "+10%" },
];

export default function NumbersScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>مسماري NUM.</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 80 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.statsGrid}>
          {STATS.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                <Feather name={stat.icon as any} size={20} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الأكثر تحميلاً</Text>
          {TOP_APPS.map((app) => (
            <View key={app.rank} style={styles.rankRow}>
              <Text style={styles.rankNumber}>#{app.rank}</Text>
              <View style={styles.rankInfo}>
                <Text style={styles.rankName}>{app.name}</Text>
                <Text style={styles.rankDownloads}>{app.downloads} تحميل</Text>
              </View>
              <View style={styles.trendBadge}>
                <Feather name="trending-up" size={12} color={Colors.light.success} />
                <Text style={styles.trendText}>{app.trend}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 32, fontFamily: "Mestika-Bold", color: Colors.light.text },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  statCard: {
    width: "47%" as any,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.light.text },
  statLabel: { fontSize: 13, fontFamily: "Mestika-Regular", color: Colors.light.textSecondary },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 20, fontFamily: "Mestika-Bold", color: Colors.light.text, marginBottom: 16 },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.separator,
    gap: 14,
  },
  rankNumber: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.tint, width: 30 },
  rankInfo: { flex: 1, gap: 2 },
  rankName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  rankDownloads: { fontSize: 13, fontFamily: "Mestika-Regular", color: Colors.light.textSecondary },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${Colors.light.success}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.success },
});
