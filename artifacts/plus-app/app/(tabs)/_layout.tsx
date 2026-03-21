import { Tabs } from "expo-router";
import React from "react";

import MismariTabBar from "@/components/MismariTabBar";

export default function TabLayout() {
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
