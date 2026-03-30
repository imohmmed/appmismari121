import { useFocusEffect } from "expo-router";
import React, { useState, useCallback } from "react";
import { Modal, View } from "react-native";

import AiScreen from "../ai";
import { useSettings } from "@/contexts/SettingsContext";

export default function AiTab() {
  const [visible, setVisible] = useState(false);
  const { isDark } = useSettings();

  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => {
        setVisible(false);
      };
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#000" : "#F0F2F5" }}>
      <Modal
        visible={visible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
      >
        <AiScreen />
      </Modal>
    </View>
  );
}
