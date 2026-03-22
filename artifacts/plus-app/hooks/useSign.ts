import { useState, useCallback } from "react";
import { Linking, Alert, Platform } from "react-native";

const getBase = () => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : "";
};

export type SignState = "idle" | "signing" | "opening" | "done" | "error";

export interface SignResult {
  itmsUrl: string;
  manifestUrl: string;
  appName: string;
  appVersion?: string;
  bundleId?: string;
  newBundleId?: string;
}

export function useSign() {
  const [state, setState] = useState<SignState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignResult | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setResult(null);
  }, []);

  const openItmsUrl = useCallback(async (itmsUrl: string) => {
    setState("opening");
    if (Platform.OS === "web") {
      Alert.alert("التثبيت", "هذه الميزة متاحة على أجهزة iOS فقط");
      setState("idle");
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(itmsUrl);
      if (canOpen) {
        await Linking.openURL(itmsUrl);
        setState("done");
      } else {
        setError("تعذّر فتح رابط التثبيت. تأكد أنك على جهاز iOS.");
        setState("error");
      }
    } catch (e: any) {
      setError(e?.message || "فشل فتح رابط التثبيت");
      setState("error");
    }
  }, []);

  const signAndInstall = useCallback(async (
    subscriptionCode: string,
    appId: number,
  ): Promise<boolean> => {
    if (!subscriptionCode?.trim()) {
      setError("الكود مطلوب");
      setState("error");
      return false;
    }
    const base = getBase();
    if (!base) {
      setError("خطأ في الاتصال بالسيرفر");
      setState("error");
      return false;
    }

    setState("signing");
    setError(null);
    setResult(null);

    try {
      const resp = await fetch(`${base}/sign/app/${encodeURIComponent(subscriptionCode)}/${appId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "فشل التوقيع");
        setState("error");
        return false;
      }
      const signResult: SignResult = data;
      setResult(signResult);
      await openItmsUrl(signResult.itmsUrl);
      return true;
    } catch (e: any) {
      setError(e?.message || "فشل الاتصال بالسيرفر");
      setState("error");
      return false;
    }
  }, [openItmsUrl]);

  const cloneAndInstall = useCallback(async (
    subscriptionCode: string,
    appId: number,
    newName?: string,
  ): Promise<boolean> => {
    if (!subscriptionCode?.trim()) {
      setError("الكود مطلوب");
      setState("error");
      return false;
    }
    const base = getBase();
    if (!base) {
      setError("خطأ في الاتصال بالسيرفر");
      setState("error");
      return false;
    }

    setState("signing");
    setError(null);
    setResult(null);

    try {
      const resp = await fetch(`${base}/sign/clone/${encodeURIComponent(subscriptionCode)}/${appId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: newName?.trim() || undefined }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "فشل التكرار");
        setState("error");
        return false;
      }
      const signResult: SignResult = data;
      setResult(signResult);
      await openItmsUrl(signResult.itmsUrl);
      return true;
    } catch (e: any) {
      setError(e?.message || "فشل الاتصال بالسيرفر");
      setState("error");
      return false;
    }
  }, [openItmsUrl]);

  const signStore = useCallback(async (subscriptionCode: string): Promise<boolean> => {
    if (!subscriptionCode?.trim()) {
      setError("الكود مطلوب");
      setState("error");
      return false;
    }
    const base = getBase();
    if (!base) {
      setError("خطأ في الاتصال بالسيرفر");
      setState("error");
      return false;
    }

    setState("signing");
    setError(null);
    setResult(null);

    try {
      const resp = await fetch(`${base}/sign/store/${encodeURIComponent(subscriptionCode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "فشل تحميل المتجر");
        setState("error");
        return false;
      }
      const signResult: SignResult = data;
      setResult(signResult);
      await openItmsUrl(signResult.itmsUrl);
      return true;
    } catch (e: any) {
      setError(e?.message || "فشل الاتصال بالسيرفر");
      setState("error");
      return false;
    }
  }, [openItmsUrl]);

  return {
    state,
    error,
    result,
    reset,
    signAndInstall,
    cloneAndInstall,
    signStore,
    isLoading: state === "signing" || state === "opening",
  };
}
