import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { useSettings } from "@/contexts/SettingsContext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_KEYS = [
  { name: "index", translationKey: "tabPlus" as const, icon: "plus-square" },
  { name: "tv", translationKey: "tabTV" as const, icon: "tv" },
  { name: "smm", translationKey: "tabSMM" as const, icon: "message-square" },
  { name: "numbers", translationKey: "tabNumbers" as const, icon: "bar-chart-2" },
];

const springConfig = LayoutAnimation.create(
  350,
  LayoutAnimation.Types.spring,
  LayoutAnimation.Properties.scaleXY
);

export default function MismariTabBar({ state, navigation }: BottomTabBarProps) {
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchText, setSearchText] = useState("");
  const searchInputRef = useRef<TextInput>(null);
  const { colors, t, fontAr, isDark, isArabic } = useSettings();

  const activeRoute = state.routes[state.index]?.name;

  const enterSearchMode = () => {
    LayoutAnimation.configureNext(springConfig);
    setIsSearchMode(true);
    const searchIdx = state.routes.findIndex((r) => r.name === "search");
    if (searchIdx >= 0) navigation.navigate("search");
    setTimeout(() => searchInputRef.current?.focus(), 400);
  };

  const exitSearchMode = () => {
    searchInputRef.current?.blur();
    LayoutAnimation.configureNext(springConfig);
    setIsSearchMode(false);
    setSearchText("");
    const homeIdx = state.routes.findIndex((r) => r.name === "index");
    if (homeIdx >= 0) navigation.navigate("index");
  };

  const navigateToTab = (routeName: string) => {
    if (isSearchMode) return;
    navigation.navigate(routeName);
  };

  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";

  const searchButton = isSearchMode ? (
    <View style={s.searchExpanded}>
      <Feather name="search" size={18} color={colors.textSecondary} />
      <TextInput
        ref={searchInputRef}
        style={[s.searchInput, { color: colors.text, fontFamily: fontAr("Regular"), textAlign: "left" }]}
        placeholder={t("searchPlaceholder")}
        placeholderTextColor={colors.textSecondary}
        value={searchText}
        onChangeText={setSearchText}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {searchText.length > 0 && (
        <Pressable onPress={() => setSearchText("")}>
          <Feather name="x-circle" size={16} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  ) : (
    <Pressable onPress={enterSearchMode} style={s.searchBtn}>
      <Feather name="search" size={20} color={colors.tint} />
    </Pressable>
  );

  const homeButton = isSearchMode ? (
    <Pressable onPress={exitSearchMode} style={s.homeBtn}>
      <Feather name="home" size={20} color={colors.tint} />
    </Pressable>
  ) : null;

  const tabsSection = !isSearchMode ? (
    <View style={s.tabsContainer}>
      {TAB_KEYS.map((tab) => {
        const isActive = activeRoute === tab.name;
        return (
          <Pressable
            key={tab.name}
            onPress={() => navigateToTab(tab.name)}
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
  ) : null;

  const tabsForRender = isArabic ? [...TAB_KEYS].reverse() : TAB_KEYS;

  const tabsSectionAr = !isSearchMode ? (
    <View style={s.tabsContainer}>
      {tabsForRender.map((tab) => {
        const isActive = activeRoute === tab.name;
        return (
          <Pressable
            key={tab.name}
            onPress={() => navigateToTab(tab.name)}
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
  ) : null;

  const barContent = (
    <View style={s.barInner}>
      {isArabic ? (
        <>
          {searchButton}
          {homeButton}
          {tabsSectionAr}
        </>
      ) : (
        <>
          {homeButton}
          {tabsSection}
          {searchButton}
        </>
      )}
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 6,
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

  homeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(120,120,128,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(120,120,128,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchExpanded: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(120,120,128,0.08)",
    borderRadius: 22,
    paddingHorizontal: 14,
    gap: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: 44,
  },
});
