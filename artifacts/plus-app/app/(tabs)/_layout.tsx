import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs, Redirect } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import React, { useEffect, useState, useRef } from "react";

import MismariTabBar from "@/components/MismariTabBar";
import ExpiredSubscriptionOverlay from "@/components/ExpiredSubscriptionOverlay";
import { useSettings } from "@/contexts/SettingsContext";

function NativeTabLayout() {
  const { t, isArabic } = useSettings();

  const tabTriggers = [
    <NativeTabs.Trigger key="index" name="index">
      <Icon sf={{ default: "plus.app", selected: "plus.app.fill" }} />
      <Label>{t("tabPlus")}</Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="sign" name="sign">
      <Icon sf={{ default: "signature", selected: "signature" }} />
      <Label>{t("tabTV")}</Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="search" name="search">
      <Icon sf={{ default: "magnifyingglass", selected: "magnifyingglass" }} />
      <Label>{t("headerSearch")}</Label>
    </NativeTabs.Trigger>,
  ];

  const orderedChildren = isArabic
    ? [...tabTriggers].reverse()
    : tabTriggers;

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
      <Tabs.Screen name="sign" />
      <Tabs.Screen name="search" />
    </Tabs>
  );
}

export default function TabLayout() {
  const { onboardingDone, deviceUdid } = useSettings();
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkSubscription = async () => {
    if (!deviceUdid) return;
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;
    try {
      const res = await fetch(`https://${domain}/api/enroll/check?udid=${encodeURIComponent(deviceUdid)}`);
      const data = await res.json();
      if (!data.found) {
        setSubscriptionExpired(true);
        return;
      }
      const sub = data.subscriber;
      const expired =
        sub.isActive === "false" ||
        (sub.expiresAt && new Date(sub.expiresAt) < new Date());
      setSubscriptionExpired(expired);
    } catch {
      // network error — don't block the user
    }
  };

  useEffect(() => {
    if (!onboardingDone || !deviceUdid) return;
    checkSubscription();
    intervalRef.current = setInterval(checkSubscription, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onboardingDone, deviceUdid]);

  if (!onboardingDone) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      {isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />}
      <ExpiredSubscriptionOverlay visible={subscriptionExpired} />
    </>
  );
}
