import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";
import AccountPanel from "@/components/AccountPanel";

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
  const { colors, t, fontAr, isArabic } = useSettings();
  const [showAccount, setShowAccount] = useState(false);

  const STATS = [
    { label: t("totalApps"), value: "+8,000", icon: "smartphone", color: colors.tint },
    { label: t("categories"), value: "8", icon: "grid", color: "#AF52DE" },
    { label: t("downloads"), value: "+250K", icon: "download", color: colors.success },
    { label: t("activeUsers"), value: "+15K", icon: "users", color: colors.tagModded },
  ];

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, isArabic && { flexDirection: "row-reverse" }]}>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold"), writingDirection: "ltr" }]}>
          {isArabic ? "مسماري " : "Mismari "}
          <Text style={{ fontFamily: "Inter_700Bold" }}>NUM</Text>
        </Text>
        <TouchableOpacity style={[styles.profileButton, { backgroundColor: colors.card }]} onPress={() => setShowAccount(true)} activeOpacity={0.6}>
          <Feather name="user" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 80 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.statsGrid}>
          {STATS.map((stat) => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                <Feather name={stat.icon as any} size={20} color={stat.color} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
            {t("mostDownloaded")}
          </Text>
          {TOP_APPS.map((app) => (
            <View key={app.rank} style={[styles.rankRow, { borderBottomColor: colors.separator }]}>
              <Text style={[styles.rankNumber, { color: colors.tint }]}>#{app.rank}</Text>
              <View style={styles.rankInfo}>
                <Text style={[styles.rankName, { color: colors.text }]}>{app.name}</Text>
                <Text style={[styles.rankDownloads, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                  {app.downloads} {t("downloadCount")}
                </Text>
              </View>
              <View style={[styles.trendBadge, { backgroundColor: `${colors.success}15` }]}>
                <Feather name="trending-up" size={12} color={colors.success} />
                <Text style={[styles.trendText, { color: colors.success }]}>{app.trend}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <AccountPanel visible={showAccount} onClose={() => setShowAccount(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 28 },
  profileButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  statCard: {
    width: "47%" as any,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12 },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, marginBottom: 16 },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  rankNumber: { fontSize: 16, fontFamily: "Inter_700Bold", width: 30 },
  rankInfo: { flex: 1, gap: 2 },
  rankName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  rankDownloads: { fontSize: 12 },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
