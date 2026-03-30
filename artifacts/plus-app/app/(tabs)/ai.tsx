import { useFocusEffect, useRouter } from "expo-router";
import React, { useState, useCallback } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AiScreen from "../ai";
import { useSettings } from "@/contexts/SettingsContext";

function AiLockedScreen() {
  const { isDark, contactWhatsapp, contactInstagram, contactTelegram } = useSettings();
  const insets = useSafeAreaInsets();

  const bg = isDark ? "#2B283B" : "#F0F2F5";
  const card = isDark ? "#36334A" : "#FFFFFF";
  const border = isDark ? "#4A4760" : "#E5E7EB";
  const text = isDark ? "#FFFFFF" : "#111111";
  const sub = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";

  const open = (url: string) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  const contacts = [
    {
      key: "whatsapp",
      label: "واتساب",
      icon: "message-circle" as const,
      color: "#25D366",
      url: contactWhatsapp,
    },
    {
      key: "instagram",
      label: "إنستغرام",
      icon: "instagram" as const,
      color: "#E1306C",
      url: contactInstagram,
    },
    {
      key: "telegram",
      label: "تيليغرام",
      icon: "send" as const,
      color: "#229ED9",
      url: contactTelegram,
    },
  ].filter(c => !!c.url);

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top + 16 }]}>
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: card, borderColor: border }]}>
        <Feather name="lock" size={38} color={isDark ? "#9fbcff" : "#6B7FD4"} />
      </View>

      <Text style={[styles.title, { color: text, fontFamily: "Mestika-Bold" }]}>
        الذكاء الاصطناعي غير متاح
      </Text>
      <Text style={[styles.subtitle, { color: sub, fontFamily: "Mestika-Regular" }]}>
        هذه الميزة غير مفعّلة لاشتراكك حالياً.{"\n"}تواصل معنا لتفعيلها.
      </Text>

      {contacts.length > 0 && (
        <View style={styles.contacts}>
          {contacts.map(c => (
            <Pressable
              key={c.key}
              onPress={() => open(c.url)}
              style={({ pressed }) => [
                styles.contactBtn,
                { backgroundColor: card, borderColor: border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name={c.icon} size={20} color={c.color} />
              <Text style={[styles.contactLabel, { color: text, fontFamily: "Mestika-Medium" }]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  contacts: {
    width: "100%",
    gap: 12,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
  },
  contactLabel: {
    fontSize: 15,
  },
});

export default function AiTab() {
  const [visible, setVisible] = useState(false);
  const { isDark, aiActive } = useSettings();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => {
        setVisible(false);
      };
    }, [])
  );

  const handleClose = useCallback(() => {
    router.navigate("/");
  }, [router]);

  const bgColor = isDark ? "#2B283B" : "#F0F2F5";

  // aiActive === false means explicitly disabled
  if (aiActive === false) {
    return <AiLockedScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <Modal
        visible={visible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <AiScreen onClose={handleClose} />
      </Modal>
    </View>
  );
}
