import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import Colors from "@/constants/colors";

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
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : Colors.light.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: Colors.light.cardBorder,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: Colors.light.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "PLUS+",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="plus.app" tintColor={color} size={24} />
            ) : (
              <Feather name="plus-square" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="tv"
        options={{
          title: "TV",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="play.tv" tintColor={color} size={24} />
            ) : (
              <Feather name="tv" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="smm"
        options={{
          title: "SMM",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="bubble.left.and.bubble.right" tintColor={color} size={24} />
            ) : (
              <Feather name="message-square" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="numbers"
        options={{
          title: "Numbers",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar" tintColor={color} size={24} />
            ) : (
              <Feather name="bar-chart-2" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="magnifyingglass" tintColor={color} size={24} />
            ) : (
              <Feather name="search" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
