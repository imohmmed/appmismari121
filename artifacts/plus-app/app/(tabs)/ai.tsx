import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";

import { useSettings } from "@/contexts/SettingsContext";

export default function AiTab() {
  const router = useRouter();
  const { isDark } = useSettings();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/ai");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return <View style={{ flex: 1, backgroundColor: isDark ? "#000" : "#F0F2F5" }} />;
}
