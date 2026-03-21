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

const SMM_APPS = [
  { id: 1, name: "Instagram++", descAr: "تحميل القصص والريلز", descEn: "Download stories & reels", icon: "instagram" },
  { id: 2, name: "WhatsApp++", descAr: "ميزات مخفية مفعّلة", descEn: "Hidden features unlocked", icon: "message-circle" },
  { id: 3, name: "Snapchat++", descAr: "حفظ السنابات والقصص", descEn: "Save snaps & stories", icon: "camera" },
  { id: 4, name: "TikTok++", descAr: "بدون إعلانات، تحميل الفيديو", descEn: "No ads, video download", icon: "video" },
  { id: 5, name: "Twitter++", descAr: "تحميل الفيديوهات والثريدات", descEn: "Download videos & threads", icon: "twitter" },
  { id: 6, name: "Facebook++", descAr: "ميزات محسّنة", descEn: "Enhanced features", icon: "facebook" },
  { id: 7, name: "Telegram++", descAr: "ميزات بريميوم مجانية", descEn: "Free premium features", icon: "send" },
  { id: 8, name: "Reddit++", descAr: "تصفح بدون إعلانات", descEn: "Ad-free browsing", icon: "message-square" },
];

export default function SmmScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { colors, t, fontAr, isArabic } = useSettings();
  const [showAccount, setShowAccount] = useState(false);

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, isArabic && { flexDirection: "row-reverse" }]}>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fontAr("Bold") }]}>
          {isArabic ? (
            <><Text style={{ fontFamily: "Inter_700Bold" }}>SMM</Text>{" مسماري"}</>
          ) : (
            <>{"Mismari "}<Text style={{ fontFamily: "Inter_700Bold" }}>SMM</Text></>
          )}
        </Text>
        <TouchableOpacity style={[styles.profileButton, { backgroundColor: colors.card }]} onPress={() => setShowAccount(true)} activeOpacity={0.6}>
          <Feather name="user" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={SMM_APPS}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: isWeb ? 34 : 80 }}
        contentInsetAdjustmentBehavior="automatic"
        ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: colors.separator }]} />}
        renderItem={({ item }) => (
          <Pressable style={styles.appRow}>
            <View style={[styles.appIcon, { backgroundColor: `${colors.tagTweaked}15` }]}>
              <Feather name={item.icon as any} size={22} color={colors.tagTweaked} />
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
        )}
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
