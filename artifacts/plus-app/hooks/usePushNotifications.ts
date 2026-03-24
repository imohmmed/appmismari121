import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";
import { useSettings } from "@/contexts/SettingsContext";
import { saveNotification, setPendingOpenApp, type NotifType } from "@/utils/notificationStorage";

const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
const BASE_URL = API_DOMAIN ? `https://${API_DOMAIN}` : "";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerToken(code: string): Promise<void> {
  if (Platform.OS === "web") return;
  if (!BASE_URL) return;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId || projectId === "YOUR_EAS_PROJECT_ID") {
      console.warn("[push] No valid Expo projectId configured in app.json extra.eas.projectId — push notifications disabled.");
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    await fetch(`${BASE_URL}/api/subscriber/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, pushToken: token }),
    });
  } catch (err) {
    console.warn("[push] Registration failed:", err);
  }
}

function getNotifType(data: any): NotifType {
  if (data?.type === "app_added") return "app_added";
  if (data?.type === "app_updated") return "app_updated";
  return "broadcast";
}

export function usePushNotifications() {
  const { subscriptionCode, onboardingDone } = useSettings();
  const registered = useRef(false);
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!onboardingDone || !subscriptionCode || registered.current) return;
    registered.current = true;
    registerToken(subscriptionCode);

    // When notification arrives while app is open → save it
    notifListener.current = Notifications.addNotificationReceivedListener((notif) => {
      const content = notif.request.content;
      const data = content.data as any;
      const type = getNotifType(data);

      saveNotification({
        type,
        title: content.title || "",
        body: content.body || "",
        appId: data?.appId ? Number(data.appId) : undefined,
        appIcon: data?.appIcon || undefined,
      });
    });

    // When user taps a notification banner
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const content = response.notification.request.content;
        const data = content.data as any;
        const type = getNotifType(data);

        // Save the notification if not already saved (came from background/killed state)
        await saveNotification({
          type,
          title: content.title || "",
          body: content.body || "",
          appId: data?.appId ? Number(data.appId) : undefined,
          appIcon: data?.appIcon || undefined,
        });

        if (data?.appId) {
          const appId = Number(data.appId);
          // Store as pending so home tab opens it on focus
          await setPendingOpenApp(appId);
          // Navigate to home tab
          router.navigate("/(tabs)/");
        }
        // For broadcast messages: just navigate to notifications screen
        else {
          router.navigate("/notifications");
        }
      }
    );

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [onboardingDone, subscriptionCode]);
}
