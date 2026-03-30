import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/contexts/SettingsContext";

const MAIN_TABS = [
  { name: "index",  translationKey: "tabPlus"     as const, icon: "plus-square" },
  { name: "sign",   translationKey: "tabTV"        as const, icon: "pen-tool"   },
  { name: "search", translationKey: "headerSearch" as const, icon: "search"     },
];

const AI_TAB = { name: "ai", translationKey: "tabAi" as const, icon: "cpu" };

const isIOS = Platform.OS === "ios";

function Pill({
  children,
  isDark,
  style,
}: {
  children: React.ReactNode;
  isDark: boolean;
  style?: object;
}) {
  if (isIOS) {
    return (
      <BlurView
        intensity={90}
        tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterial"}
        style={[s.pill, style]}
      >
        {children}
      </BlurView>
    );
  }
  return (
    <View
      style={[
        s.pill,
        { backgroundColor: isDark ? "rgba(28,28,30,0.96)" : "rgba(255,255,255,0.97)" },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default function MismariTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, t, fontAr, isDark, isArabic } = useSettings();
  const insets = useSafeAreaInsets();

  const activeRoute = state.routes[state.index]?.name;
  const bottomPadding = Math.max(insets.bottom, 10);

  const activeColor  = isDark ? "#0A84FF" : "#007AFF";
  const inactiveColor = isDark ? "#8E8E93" : "#8E8E93";

  const navigate = (name: string) => {
    const route = state.routes.find(r => r.name === name);
    if (route) {
      navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    }
    navigation.navigate(name);
  };

  /* ── main tabs ordered by language ─────────────────────────────────────── */
  const mainTabs = isArabic ? [...MAIN_TABS].reverse() : MAIN_TABS;

  /* ── AI tab ─────────────────────────────────────────────────────────────── */
  const isAiActive = activeRoute === AI_TAB.name;
  const aiColor    = isAiActive ? activeColor : inactiveColor;
  const aiIconBg   = isAiActive
    ? activeColor
    : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const aiIconColor = isAiActive ? "#fff" : inactiveColor;

  const aiTab = (
    <Pressable
      onPress={() => navigate(AI_TAB.name)}
      style={s.tabItem}
    >
      <View style={[s.aiIconWrapper, { backgroundColor: aiIconBg }]}>
        <Feather name="cpu" size={17} color={aiIconColor} />
      </View>
      <Text style={[s.tabLabel, { color: aiColor, fontFamily: fontAr("Medium") }]} numberOfLines={1}>
        {t(AI_TAB.translationKey)}
      </Text>
    </Pressable>
  );

  /* ── main tab items ─────────────────────────────────────────────────────── */
  const mainTabItems = mainTabs.map(tab => {
    const isActive = activeRoute === tab.name;
    const tint = isActive ? activeColor : inactiveColor;
    return (
      <Pressable
        key={tab.name}
        onPress={() => navigate(tab.name)}
        style={s.tabItem}
      >
        <Feather name={tab.icon as any} size={22} color={tint} />
        <Text style={[s.tabLabel, { color: tint, fontFamily: fontAr("Medium") }]} numberOfLines={1}>
          {t(tab.translationKey)}
        </Text>
      </Pressable>
    );
  });

  return (
    <View style={[s.outerWrapper, { paddingBottom: bottomPadding }]}>
      {/*
        Row direction flips for Arabic so:
          LTR (English): [AI pill] — spacer — [Main pill]  → AI on left
          RTL (Arabic) : [Main pill] — spacer — [AI pill]  → AI on right
      */}
      <View style={[s.row, { flexDirection: isArabic ? "row-reverse" : "row" }]}>

        {/* ── AI pill (separate, smaller) ─────────────────────────────────── */}
        <Pill isDark={isDark} style={s.aiPill}>
          {aiTab}
        </Pill>

        {/* ── flex spacer pushes the two pills to opposite ends ───────────── */}
        <View style={s.spacer} />

        {/* ── Main tabs pill ───────────────────────────────────────────────── */}
        <Pill isDark={isDark} style={s.mainPill}>
          {mainTabItems}
        </Pill>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    /* no background — pills float above content */
  },
  row: {
    alignItems: "center",
  },

  /* ── shared pill ─────────────────────────────────────────────────────────── */
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    overflow: "hidden",
    paddingVertical: 6,
    paddingHorizontal: 10,
    // subtle shadow for floating effect
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  /* ── AI pill is narrower ─────────────────────────────────────────────────── */
  aiPill: {
    paddingHorizontal: 12,
  },

  /* ── Main pill ───────────────────────────────────────────────────────────── */
  mainPill: {
    paddingHorizontal: 4,
  },

  spacer: {
    flex: 1,
    minWidth: 12,
  },

  /* ── tab item inside a pill ─────────────────────────────────────────────── */
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 3,
    minWidth: 52,
  },

  /* ── AI icon circular badge ─────────────────────────────────────────────── */
  aiIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  tabLabel: {
    fontSize: 10,
  },
});
