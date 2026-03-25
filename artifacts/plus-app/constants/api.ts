const PRODUCTION_DOMAIN = "app.mismari.com";

export function getApiDomain(): string {
  return PRODUCTION_DOMAIN;
}

export function getApiBase(): string {
  return `https://${PRODUCTION_DOMAIN}`;
}
