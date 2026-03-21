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
  { label: "Total Apps", value: "8,000+", icon: "smartphone", color: Colors.light.tint },
  { label: "Categories", value: "8", icon: "grid", color: Colors.light.tagTweaked },
  { label: "Downloads", value: "250K+", icon: "download", color: Colors.light.success },
  { label: "Active Users", value: "15K+", icon: "users", color: Colors.light.tintSecondary },
];

const TOP_APPS = [
  { rank: 1, name: "Netflix", downloads: "30K", trend: "+12%" },
  { rank: 2, name: "YouTube Premium", downloads: "25K", trend: "+8%" },
  { rank: 3, name: "Spotify++", downloads: "22K", trend: "+15%" },
  { rank: 4, name: "TikTok++", downloads: "20K", trend: "+5%" },
  { rank: 5, name: "Instagram++", downloads: "18K", trend: "+10%" },
];

export default function NumbersScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Numbers</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.statsGrid}>
          {STATS.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                <Feather name={stat.icon as any} size={20} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Downloads</Text>
          {TOP_APPS.map((app) => (
            <View key={app.rank} style={styles.rankRow}>
              <Text style={styles.rankNumber}>#{app.rank}</Text>
              <View style={styles.rankInfo}>
                <Text style={styles.rankName}>{app.name}</Text>
                <Text style={styles.rankDownloads}>{app.downloads} downloads</Text>
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
  headerTitle: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.light.text },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    width: "47%" as any,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    gap: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 16,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.cardBorder,
    gap: 14,
  },
  rankNumber: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.tint,
    width: 30,
  },
  rankInfo: { flex: 1, gap: 2 },
  rankName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  rankDownloads: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${Colors.light.success}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.success },
});
