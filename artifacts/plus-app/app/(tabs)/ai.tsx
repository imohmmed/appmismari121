import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef } from "react";
import { View } from "react-native";

import { useSettings } from "@/contexts/SettingsContext";

export default function AiTabRedirect() {
  const router = useRouter();
  const { isDark } = useSettings();
  const isPushingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!isPushingRef.current) {
        isPushingRef.current = true;
        const timer = setTimeout(() => {
          router.push("/ai");
          setTimeout(() => { isPushingRef.current = false; }, 800);
        }, 50);
        return () => clearTimeout(timer);
      }
    }, [])
  );

  return <View style={{ flex: 1, backgroundColor: isDark ? "#000" : "#F0F2F5" }} />;
}
