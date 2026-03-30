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

const TAB_KEYS = [
  { name: "index",   translationKey: "tabPlus"      as const, icon: "plus-square" },
  { name: "sign",    translationKey: "tabTV"         as const, icon: "pen-tool"   },
  { name: "search",  translationKey: "headerSearch"  as const, icon: "search"     },
  { name: "ai",      translationKey: "tabAi"         as const, icon: "cpu"        },
];

export default function MismariTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, t, fontAr, isDark, isArabic } = useSettings();
  const insets = useSafeAreaInsets();

  const activeRoute = state.routes[state.index]?.name;

  const tabsForRender = isArabic ? [...TAB_KEYS].reverse() : TAB_KEYS;

  const isIOS = Platform.OS === "ios";

  const aiAccent = isDark ? "#0A84FF" : "#007AFF";

  const tabsRow = (
    <View style={s.tabsRow}>
      {tabsForRender.map((tab) => {
        const isActive = activeRoute === tab.name;
        const isAiTab = tab.name === "ai";

        const tintColor = isActive
          ? (isDark ? "#0A84FF" : "#007AFF")
          : (isDark ? "#8E8E93" : "#999");

        return (
          <Pressable
            key={tab.name}
            onPress={() => {
              const route = state.routes.find(r => r.name === tab.name);
              if (route) {
                navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              }
              navigation.navigate(tab.name);
            }}
            style={[s.tabItem, isAiTab && s.aiTabItem]}
          >
            {isAiTab ? (
              <View style={[s.aiIconWrapper, { backgroundColor: isActive ? aiAccent : (isDark ? "#1c1c1e" : "#e8e8e8") }]}>
                <Feather name="cpu" size={18} color={isActive ? "#fff" : (isDark ? "#8E8E93" : "#888")} />
              </View>
            ) : (
              <Feather
                name={tab.icon as any}
                size={22}
                color={tintColor}
              />
            )}
            <Text
              style={[
                s.tabLabel,
                {
                  color: isAiTab ? (isActive ? aiAccent : (isDark ? "#8E8E93" : "#999")) : tintColor,
                  fontFamily: fontAr("Medium"),
                },
              ]}
              numberOfLines={1}
            >
              {t(tab.translationKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const bottomPadding = Math.max(insets.bottom, 8);

  if (isIOS) {
    return (
      <View style={[s.wrapper, { paddingBottom: bottomPadding }]}>
        <View style={s.separator} />
        <BlurView
          intensity={98}
          tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterial"}
          style={[s.blurContainer, { paddingBottom: bottomPadding }]}
        >
          {tabsRow}
        </BlurView>
      </View>
    );
  }

  return (
    <View style={[s.wrapper, { paddingBottom: bottomPadding }]}>
      <View style={s.separator} />
      <View style={[s.fallbackContainer, {
        backgroundColor: isDark ? "#1C1C1E" : "#F8F8F8",
        paddingBottom: bottomPadding,
      }]}>
        {tabsRow}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  blurContainer: {
    overflow: "hidden",
  },
  fallbackContainer: {
    overflow: "hidden",
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 6,
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 3,
  },
  aiTabItem: {
    gap: 4,
  },
  aiIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
  },
});
