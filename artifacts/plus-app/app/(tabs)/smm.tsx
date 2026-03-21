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
  { id: 1, name: "Instagram++", desc: "تحميل القصص والريلز", icon: "instagram" },
  { id: 2, name: "WhatsApp++", desc: "ميزات مخفية مفعّلة", icon: "message-circle" },
  { id: 3, name: "Snapchat++", desc: "حفظ السنابات والقصص", icon: "camera" },
  { id: 4, name: "TikTok++", desc: "بدون إعلانات، تحميل الفيديو", icon: "video" },
  { id: 5, name: "Twitter++", desc: "تحميل الفيديوهات والثريدات", icon: "twitter" },
  { id: 6, name: "Facebook++", desc: "ميزات محسّنة", icon: "facebook" },
  { id: 7, name: "Telegram++", desc: "ميزات بريميوم مجانية", icon: "send" },
  { id: 8, name: "Reddit++", desc: "تصفح بدون إعلانات", icon: "message-square" },
];

export default function SmmScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>مسماري SMM</Text>
      </View>
      <FlatList
        data={SMM_APPS}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: isWeb ? 34 : 80 }}
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
              <Text style={styles.getButtonText}>تحميل</Text>
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
  headerTitle: { fontSize: 32, fontFamily: "Mestika-Bold", color: Colors.light.text },
  appRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14 },
  appIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  appInfo: { flex: 1, gap: 3 },
  appName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  appDesc: { fontSize: 13, fontFamily: "Mestika-Regular", color: Colors.light.textSecondary },
  getButton: { backgroundColor: Colors.light.card, paddingHorizontal: 22, paddingVertical: 7, borderRadius: 18 },
  getButtonText: { fontSize: 15, fontFamily: "Mestika-Bold", color: Colors.light.tint },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.light.separator, marginLeft: 66 },
});
