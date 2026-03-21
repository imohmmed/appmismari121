import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

const SMM_APPS = [
  { id: 1, name: "Instagram++", desc: "Download stories & reels", icon: "instagram" },
  { id: 2, name: "WhatsApp++", desc: "Hidden features unlocked", icon: "message-circle" },
  { id: 3, name: "Snapchat++", desc: "Save snaps & stories", icon: "camera" },
  { id: 4, name: "TikTok++", desc: "No ads, download videos", icon: "video" },
  { id: 5, name: "Twitter++", desc: "Download videos & threads", icon: "twitter" },
  { id: 6, name: "Facebook++", desc: "Enhanced features", icon: "facebook" },
  { id: 7, name: "Telegram++", desc: "Premium features free", icon: "send" },
  { id: 8, name: "Reddit++", desc: "Ad-free browsing", icon: "message-square" },
];

export default function SmmScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mismari SMM</Text>
      </View>
      <FlatList
        data={SMM_APPS}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: isWeb ? 34 : 100 }}
        contentInsetAdjustmentBehavior="automatic"
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderItem={({ item }) => (
          <Pressable style={styles.appRow}>
            <View style={[styles.appIcon, { backgroundColor: `${Colors.light.tagTweaked}15` }]}>
              <Feather name={item.icon as any} size={22} color={Colors.light.tagTweaked} />
            </View>
            <View style={styles.appInfo}>
              <Text style={styles.appName}>{item.name}</Text>
              <Text style={styles.appDesc}>{item.desc}</Text>
            </View>
            <Pressable style={styles.getButton}>
              <Text style={styles.getButtonText}>Get</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.light.text },
  appRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14 },
  appIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  appInfo: { flex: 1, gap: 3 },
  appName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  appDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  getButton: { backgroundColor: Colors.light.card, paddingHorizontal: 22, paddingVertical: 7, borderRadius: 18 },
  getButtonText: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.tint },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.light.separator, marginLeft: 66 },
});
