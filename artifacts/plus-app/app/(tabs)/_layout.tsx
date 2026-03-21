import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";

import MismariTabBar from "@/components/MismariTabBar";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "plus.app", selected: "plus.app.fill" }} />
        <Label>PLUS+</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tv">
        <Icon sf={{ default: "play.tv", selected: "play.tv.fill" }} />
        <Label>TV</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="smm">
        <Icon sf={{ default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }} />
        <Label>SMM</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="numbers">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Numbers</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search">
        <Icon sf="magnifyingglass" />
        <Label>Search</Label>
      </NativeTabs.Trigger>
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
