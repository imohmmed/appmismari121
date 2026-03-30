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

/**
 * A pill-shaped container that uses BlurView on iOS and a solid bg on Android.
 *
 * KEY FIX: BlurView doesn't support borderRadius on its own on iOS.
 * Solution: Wrap BlurView (or View) inside a clipping View that carries
 * the borderRadius + overflow:"hidden", so corners are properly rounded.
 */
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
      /*
       * iOS: Two-layer trick for rounded blur + visible shadow:
       *   1. shadowWrap  — carries the shadow (NO overflow:hidden, so shadow isn't clipped)
       *   2. clipWrap    — carries borderRadius + overflow:hidden so blur is rounded
       *   3. BlurView    — fills clipWrap
       */
      <View style={[s.shadowWrap, style]}>
        <View style={s.clipWrap}>
          <BlurView
            intensity={80}
            tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterial"}
            style={s.pillInner}
          >
            {children}
          </BlurView>
        </View>
      </View>
    );
  }

  // Android / other: single View with solid semi-transparent bg + elevation
  return (
    <View
      style={[
        s.shadowWrap,
        s.clipWrap,
        s.pillInner,
        { backgroundColor: isDark ? "rgba(36,36,40,0.96)" : "rgba(255,255,255,0.96)" },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default function MismariTabBar({ state, navigation }: BottomTabBarProps) {
  const { t, fontAr, isDark, isArabic } = useSettings();
  const insets = useSafeAreaInsets();

  const activeRoute   = state.routes[state.index]?.name;
  const bottomPadding = Math.max(insets.bottom, 10);

  const activeColor   = isDark ? "#0A84FF" : "#007AFF";
  const inactiveColor = isDark ? "#8E8E93" : "#8E8E93";

  const navigate = (name: string) => {
    const route = state.routes.find(r => r.name === name);
    if (route) {
      navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    }
    navigation.navigate(name);
  };

  /* ── The row direction is always LTR (row):
       Layout: [AI pill] — spacer — [Main pill]
         • English: AI on LEFT,  main tabs on RIGHT  ✓
         • Arabic:  AI on LEFT,  main tabs on RIGHT  ✓
       What DOES change for Arabic is the ORDER of tabs INSIDE the main pill
       (reversed, so Plus+ is on the rightmost position).
  ──────────────────────────────────────────────────────────────────────────── */

  /* ── main tabs ordered by language ─────────────────────────────────────── */
  const mainTabs = isArabic ? [...MAIN_TABS].reverse() : MAIN_TABS;

  /* ── AI tab ─────────────────────────────────────────────────────────────── */
  const isAiActive  = activeRoute === AI_TAB.name;
  const aiColor     = isAiActive ? activeColor : inactiveColor;
  const aiIconBg    = isAiActive
    ? activeColor
    : isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)";
  const aiIconColor = isAiActive ? "#fff" : inactiveColor;

  return (
    <View style={[s.outerWrapper, { paddingBottom: bottomPadding }]}>

      {/* Single horizontal row — always left-to-right */}
      <View style={s.row}>

        {/* ── AI pill ──────────────────────────────────────────────────────── */}
        <Pill isDark={isDark}>
          <Pressable
            onPress={() => navigate(AI_TAB.name)}
            style={s.tabItem}
            android_ripple={{ color: "transparent" }}
          >
            <View style={[s.aiIconWrapper, { backgroundColor: aiIconBg }]}>
              <Feather name="cpu" size={17} color={aiIconColor} />
            </View>
            <Text
              style={[s.tabLabel, { color: aiColor, fontFamily: fontAr("Medium") }]}
              numberOfLines={1}
            >
              {t(AI_TAB.translationKey)}
            </Text>
          </Pressable>
        </Pill>

        {/* ── Spacer pushes the two pills to opposite ends ─────────────────── */}
        <View style={s.spacer} />

        {/* ── Main tabs pill ───────────────────────────────────────────────── */}
        <Pill isDark={isDark} style={s.mainPillExtra}>
          {mainTabs.map(tab => {
            const isActive = activeRoute === tab.name;
            const tint = isActive ? activeColor : inactiveColor;
            return (
              <Pressable
                key={tab.name}
                onPress={() => navigate(tab.name)}
                style={s.tabItem}
                android_ripple={{ color: "transparent" }}
              >
                <Feather name={tab.icon as any} size={22} color={tint} />
                <Text
                  style={[s.tabLabel, { color: tint, fontFamily: fontAr("Medium") }]}
                  numberOfLines={1}
                >
                  {t(tab.translationKey)}
                </Text>
              </Pressable>
            );
          })}
        </Pill>

      </View>
    </View>
  );
}

const RADIUS = 24;

const s = StyleSheet.create({
  outerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  spacer: {
    flex: 1,
    minWidth: 10,
  },

  /* ── shadowWrap: carries shadow only (no overflow:hidden so shadow shows) ── */
  shadowWrap: {
    borderRadius: RADIUS,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.10,
        shadowRadius: 14,
      },
      android: {
        elevation: 6,
      },
    }),
  },

  /* ── clipWrap: clips children to borderRadius (no shadow here) ───────────── */
  clipWrap: {
    borderRadius: RADIUS,
    overflow: "hidden",
  },

  /* ── inner content row of the pill ─────────────────────────────────────── */
  pillInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },

  /* ── a bit more horizontal padding for the main (wider) pill ────────────── */
  mainPillExtra: {
    paddingHorizontal: 2,
  },

  /* ── single tab item inside a pill ─────────────────────────────────────── */
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    paddingHorizontal: 12,
    gap: 3,
    minWidth: 54,
  },

  /* ── AI icon rounded square badge ──────────────────────────────────────── */
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
