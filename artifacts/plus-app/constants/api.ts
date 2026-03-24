const PRODUCTION_DOMAIN = "app.mismari.com";

export function getApiDomain(): string {
  const envDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (envDomain && envDomain !== "undefined" && envDomain.includes(".")) {
    return envDomain;
  }
  return PRODUCTION_DOMAIN;
}

export function getApiBase(): string {
  return `https://${getApiDomain()}`;
}
