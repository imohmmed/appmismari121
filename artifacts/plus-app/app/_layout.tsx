import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { I18nManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SettingsProvider } from "@/contexts/SettingsContext";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com"}`);

I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false, presentation: "modal", gestureEnabled: true }} />
      <Stack.Screen name="category/[id]" options={{ headerShown: false, presentation: "modal", gestureEnabled: true }} />
      <Stack.Screen name="section/[type]" options={{ headerShown: false, presentation: "modal", gestureEnabled: true }} />
      <Stack.Screen name="ai" options={{ headerShown: false, gestureEnabled: false, animation: "fade" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    "Mestika-Regular": require("../assets/fonts/Mestika-Regular.otf"),
    "Mestika-Medium": require("../assets/fonts/Mestika-Medium.otf"),
    "Mestika-SemiBold": require("../assets/fonts/Mestika-SemiBold.otf"),
    "Mestika-Bold": require("../assets/fonts/Mestika-Bold.otf"),
    "Mestika-ExtraBold": require("../assets/fonts/Mestika-ExtraBold.otf"),
    "Mestika-Black": require("../assets/fonts/Mestika-Black.otf"),
    "Mestika-Light": require("../assets/fonts/Mestika-Light.otf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <SettingsProvider>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </SettingsProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
