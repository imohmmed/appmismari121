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

const TV_APPS = [
  { id: 1, name: "Netflix", desc: "All content unlocked", icon: "film", tag: "modded" },
  { id: 2, name: "Disney+", desc: "Disney, Marvel & more", icon: "play-circle", tag: "modded" },
  { id: 3, name: "HBO Max", desc: "Premium content", icon: "tv", tag: "modded" },
  { id: 4, name: "Amazon Prime", desc: "Movies & series", icon: "video", tag: "modded" },
  { id: 5, name: "Shahid VIP", desc: "Arabic content", icon: "film", tag: "tweaked" },
  { id: 6, name: "OSN+", desc: "Middle East streaming", icon: "play-circle", tag: "tweaked" },
  { id: 7, name: "IPTV Pro", desc: "Live TV channels", icon: "tv", tag: "hacked" },
  { id: 8, name: "Starz Play", desc: "Movies & series", icon: "video", tag: "modded" },
];

function getTagColor(tag: string) {
  switch (tag) {
    case "tweaked": return Colors.light.tagTweaked;
    case "hacked": return Colors.light.tagHacked;
    default: return Colors.light.tagModded;
  }
}

export default function TvScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mismari TV</Text>
      </View>
      <FlatList
        data={TV_APPS}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: isWeb ? 34 : 100 }}
        contentInsetAdjustmentBehavior="automatic"
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderItem={({ item }) => {
          const tagColor = getTagColor(item.tag);
          return (
            <Pressable style={styles.appRow}>
              <View style={[styles.appIcon, { backgroundColor: `${tagColor}15` }]}>
                <Feather name={item.icon as any} size={22} color={tagColor} />
              </View>
              <View style={styles.appInfo}>
                <Text style={styles.appName}>{item.name}</Text>
                <Text style={styles.appDesc}>{item.desc}</Text>
              </View>
              <Pressable style={styles.getButton}>
                <Text style={styles.getButtonText}>Get</Text>
              </Pressable>
            </Pressable>
          );
        }}
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
