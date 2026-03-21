import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";

import MismariTabBar from "@/components/MismariTabBar";
import { useSettings } from "@/contexts/SettingsContext";

function NativeTabLayout() {
  const { t, isArabic } = useSettings();

  const tabTriggers = [
    <NativeTabs.Trigger key="index" name="index">
      <Icon sf={{ default: "plus.app", selected: "plus.app.fill" }} />
      <Label>{t("tabPlus")}</Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="tv" name="tv">
      <Icon sf={{ default: "play.tv", selected: "play.tv.fill" }} />
      <Label>{t("tabTV")}</Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="smm" name="smm">
      <Icon sf={{ default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }} />
      <Label>{t("tabSMM")}</Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="numbers" name="numbers">
      <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
      <Label>{t("tabNumbers")}</Label>
    </NativeTabs.Trigger>,
  ];

  const searchTrigger = (
    <NativeTabs.Trigger key="search" name="search" role="search">
      <Icon sf="magnifyingglass" />
      <Label>{t("headerSearch")}</Label>
    </NativeTabs.Trigger>
  );

  const orderedChildren = isArabic
    ? [...[...tabTriggers].reverse(), searchTrigger]
    : [...tabTriggers, searchTrigger];

  return (
    <NativeTabs>
      {orderedChildren}
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <MismariTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tv" />
      <Tabs.Screen name="smm" />
      <Tabs.Screen name="numbers" />
      <Tabs.Screen name="search" />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
