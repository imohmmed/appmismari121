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

import { useSettings } from "@/contexts/SettingsContext";

const TAB_KEYS = [
  { name: "index",   translationKey: "tabPlus"    as const, icon: "plus-square"  },
  { name: "tv",      translationKey: "tabTV"       as const, icon: "pen-tool"    },
  { name: "smm",     translationKey: "tabSMM"      as const, icon: "message-square" },
  { name: "numbers", translationKey: "tabNumbers"  as const, icon: "bar-chart-2"  },
  { name: "search",  translationKey: "headerSearch" as const, icon: "search"      },
];

export default function MismariTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, t, fontAr, isDark, isArabic } = useSettings();

  const activeRoute = state.routes[state.index]?.name;

  const tabsForRender = isArabic ? [...TAB_KEYS].reverse() : TAB_KEYS;

  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";

  const tabsSection = (
    <View style={s.tabsContainer}>
      {tabsForRender.map((tab) => {
        const isActive = activeRoute === tab.name;
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
            style={s.tabItem}
          >
            <Feather
              name={tab.icon as any}
              size={20}
              color={isActive ? colors.tint : colors.tabIconDefault}
            />
            <Text
              style={[
                s.tabLabel,
                {
                  color: isActive ? colors.tint : colors.tabIconDefault,
                  fontFamily: fontAr("SemiBold"),
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

  const barContent = (
    <View style={s.barInner}>
      {tabsSection}
    </View>
  );

  const webGlassBg = isDark ? "rgba(43,40,59,0.85)" : "rgba(255,255,255,0.85)";

  if (isWeb) {
    return (
      <View style={s.barWrapper}>
        <View style={[s.glassBar, s.webGlass, { backgroundColor: webGlassBg }]}>{barContent}</View>
      </View>
    );
  }

  if (isIOS) {
    return (
      <View style={s.barWrapper}>
        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={s.glassBar}>
          {barContent}
        </BlurView>
      </View>
    );
  }

  return (
    <View style={s.barWrapper}>
      <View style={[s.glassBar, { backgroundColor: colors.background }]}>{barContent}</View>
    </View>
  );
}

const s = StyleSheet.create({
  barWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === "web" ? 12 : 28,
  },
  glassBar: {
    borderRadius: 28,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      web: {
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
      },
    }),
  },
  webGlass: {
    backdropFilter: "blur(20px)",
  },
  barInner: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    minHeight: 56,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(120,120,128,0.08)",
    borderRadius: 22,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
  },
});
