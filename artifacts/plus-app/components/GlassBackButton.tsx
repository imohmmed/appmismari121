import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import Colors from "@/constants/colors";

type GlassBackButtonProps = {
  onPress: () => void;
};

export default function GlassBackButton({ onPress }: GlassBackButtonProps) {
  const isWeb = Platform.OS === "web";

  if (isWeb) {
    return (
      <Pressable onPress={onPress} style={styles.webButton}>
        <Feather name="chevron-left" size={20} color={Colors.light.text} />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      <BlurView intensity={60} tint="light" style={styles.blur}>
        <Feather name="chevron-left" size={20} color={Colors.light.text} />
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  blur: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  webButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200, 200, 210, 0.35)",
    backdropFilter: "blur(20px)",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.6)",
      },
    }),
  },
});
