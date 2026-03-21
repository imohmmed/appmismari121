import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import GlassBackButton from "@/components/GlassBackButton";

type AppDetailProps = {
  app: {
    name: string;
    desc: string;
    category: string;
    tag: string;
    icon: string;
  };
  onClose: () => void;
};

function getTagColor(tag: string) {
  switch (tag) {
    case "tweaked": return Colors.light.tagTweaked;
    case "modded": return Colors.light.tagModded;
    case "hacked": return Colors.light.tagHacked;
    default: return Colors.light.tint;
  }
}

export default function AppDetailPanel({ app, onClose }: AppDetailProps) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const tagColor = getTagColor(app.tag);

  return (
    <View style={[styles.container, { paddingTop: isWeb ? 67 : insets.top }]}>
      <View style={styles.navBar}>
        <GlassBackButton onPress={onClose} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 : 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.heroSection}>
          <View style={[styles.bigIcon, { backgroundColor: `${tagColor}15` }]}>
            <Feather name={app.icon as any} size={48} color={tagColor} />
          </View>
          <Text style={styles.appTitle}>{app.name}</Text>
          <Text style={styles.appCategory}>{app.category}</Text>
          <View style={[styles.tagBadge, { backgroundColor: `${tagColor}15` }]}>
            <Text style={[styles.tagText, { color: tagColor }]}>{app.tag}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.getButtonLarge}>
            <Text style={styles.getButtonLargeText}>GET</Text>
          </Pressable>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descText}>{app.desc}</Text>
          <Text style={styles.descText}>
            This is a {app.tag} version of {app.name} with premium features unlocked. 
            Install directly without jailbreak. Regular updates and support included.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category</Text>
            <Text style={styles.infoValue}>{app.category}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={[styles.infoValue, { color: tagColor }]}>{app.tag}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Compatibility</Text>
            <Text style={styles.infoValue}>iOS 15.0+</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Size</Text>
            <Text style={styles.infoValue}>~120 MB</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  heroSection: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 24,
    gap: 8,
  },
  bigIcon: {
    width: 100,
    height: 100,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  appCategory: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  tagBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  actionRow: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  getButtonLarge: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  getButtonLargeText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  infoSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 12,
  },
  descText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
  },
});
