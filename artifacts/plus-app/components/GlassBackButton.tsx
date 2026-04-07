import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { useSettings } from "@/contexts/SettingsContext";

type GlassBackButtonProps = {
  onPress: () => void;
};

export default function GlassBackButton({ onPress }: GlassBackButtonProps) {
  const isWeb = Platform.OS === "web";
  const { colors, isDark, isArabic } = useSettings();
  const icon = isArabic ? "chevron-right" : "chevron-left";

  if (isWeb) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.webButton,
          isDark
            ? { backgroundColor: "rgba(60, 60, 80, 0.45)" }
            : { backgroundColor: "rgba(200, 200, 210, 0.35)" },
        ]}
      >
        <Feather name={icon} size={20} color={colors.text} />
      </Pressable>
    );
  }

  return (
    <View style={styles.shadowWrapper}>
      <Pressable onPress={onPress} style={styles.clipWrapper}>
        <BlurView
          intensity={85}
          tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
          style={styles.blur}
        >
          <View style={styles.borderLayer}>
            <Feather name={icon} size={20} color={isDark ? "#ffffff" : "#1c1c1e"} />
          </View>
        </BlurView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  clipWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  blur: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  borderLayer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.45)",
  },
  webButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(20px)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.4)",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.6)",
      },
    }),
  },
});
