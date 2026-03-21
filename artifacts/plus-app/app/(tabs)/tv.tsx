import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";
import AccountPanel from "@/components/AccountPanel";

const TV_APPS = [
  { id: 1, name: "Netflix", descAr: "جميع المحتوى مفتوح", descEn: "All content unlocked", icon: "film", tag: "modded" },
  { id: 2, name: "Disney+", descAr: "ديزني، مارفل والمزيد", descEn: "Disney, Marvel & more", icon: "play-circle", tag: "modded" },
  { id: 3, name: "HBO Max", descAr: "محتوى بريميوم", descEn: "Premium content", icon: "tv", tag: "modded" },
  { id: 4, name: "Amazon Prime", descAr: "أفلام ومسلسلات", descEn: "Movies & series", icon: "video", tag: "modded" },
  { id: 5, name: "Shahid VIP", descAr: "محتوى عربي", descEn: "Arabic content", icon: "film", tag: "tweaked" },
  { id: 6, name: "OSN+", descAr: "بث الشرق الأوسط", descEn: "Middle East streaming", icon: "play-circle", tag: "tweaked" },
  { id: 7, name: "IPTV Pro", descAr: "قنوات تلفزيونية مباشرة", descEn: "Live TV channels", icon: "tv", tag: "hacked" },
  { id: 8, name: "Starz Play", descAr: "أفلام ومسلسلات", descEn: "Movies & series", icon: "video", tag: "modded" },
];

export default function TvScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { colors, t, fontAr, isArabic } = useSettings();
  const [showAccount, setShowAccount] = useState(false);

  function getTagColor(tag: string) {
    switch (tag) {
      case "tweaked": return colors.tagTweaked;
      case "hacked": return colors.tagHacked;
      default: return colors.tagModded;
    }
  }

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, isArabic && { flexDirection: "row-reverse" }]}>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold"), writingDirection: "ltr" }]}>
          {isArabic ? "مسماري " : "Mismari "}
          <Text style={{ fontFamily: "Inter_700Bold" }}>TV</Text>
        </Text>
        <TouchableOpacity style={[styles.profileButton, { backgroundColor: colors.card }]} onPress={() => setShowAccount(true)} activeOpacity={0.6}>
          <Feather name="user" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={TV_APPS}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: isWeb ? 34 : 80 }}
        contentInsetAdjustmentBehavior="automatic"
        ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: colors.separator }]} />}
        renderItem={({ item }) => {
          const tagColor = getTagColor(item.tag);
          return (
            <Pressable style={styles.appRow}>
              <View style={[styles.appIcon, { backgroundColor: `${tagColor}15` }]}>
                <Feather name={item.icon as any} size={22} color={tagColor} />
              </View>
              <View style={styles.appInfo}>
                <Text style={[styles.appName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.appDesc, { color: colors.textSecondary, fontFamily: fontAr("Regular") }]}>
                  {isArabic ? item.descAr : item.descEn}
                </Text>
              </View>
              <Pressable style={[styles.getButton, { backgroundColor: colors.card }]}>
                <Text style={[styles.getButtonText, { color: colors.tint, fontFamily: fontAr("Bold") }]}>
                  {t("download")}
                </Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
      <AccountPanel visible={showAccount} onClose={() => setShowAccount(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 28 },
  profileButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  appRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14 },
  appIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  appInfo: { flex: 1, gap: 3 },
  appName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  appDesc: { fontSize: 12 },
  getButton: { paddingHorizontal: 22, paddingVertical: 7, borderRadius: 18 },
  getButtonText: { fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 66 },
});
