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
  { name: "index",   translationKey: "tabPlus"    as const, icon: "plus-square"  },
  { name: "sign",    translationKey: "tabTV"       as const, icon: "pen-tool"    },
  { name: "search",  translationKey: "headerSearch" as const, icon: "search"      },
];

export default function MismariTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, t, fontAr, isDark, isArabic } = useSettings();
  const insets = useSafeAreaInsets();

  const activeRoute = state.routes[state.index]?.name;

  const tabsForRender = isArabic ? [...TAB_KEYS].reverse() : TAB_KEYS;

  const isIOS = Platform.OS === "ios";

  const tabsRow = (
    <View style={s.tabsRow}>
      {tabsForRender.map((tab) => {
        const isActive = activeRoute === tab.name;
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
            style={s.tabItem}
          >
            <Feather
              name={tab.icon as any}
              size={22}
              color={tintColor}
            />
            <Text
              style={[
                s.tabLabel,
                {
                  color: tintColor,
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
  tabLabel: {
    fontSize: 10,
  },
});
