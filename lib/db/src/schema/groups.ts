import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  certName: text("cert_name").notNull().unique(),

  // ─── Group Type ─────────────────────────────────────────────────────────
  // "appstore_connect" = uses Apple API (issuerId + keyId + privateKey)
  // "test_certificate" = uses p12 + mobileprovision files
  groupType: text("group_type").notNull().default("appstore_connect"),

  // ─── App Store Connect fields (appstore_connect only) ───────────────────
  issuerId: text("issuer_id").default(""),
  keyId: text("key_id").default(""),
  privateKey: text("private_key").default(""),
  email: text("email").notNull().default(""),

  // ─── Test Certificate fields (test_certificate only) ────────────────────
  certCommonName: text("cert_common_name"),       // from p12: CN
  teamId: text("team_id"),                        // from mobileprovision: TeamIdentifier
  teamName: text("team_name"),                    // from mobileprovision: TeamName
  certExpiresAt: text("cert_expires_at"),         // ISO date string from mobileprovision
  bundleId: text("bundle_id"),                    // from mobileprovision: AppIDName / Entitlements
  provisionedUdids: text("provisioned_udids"),    // JSON array of UDIDs
  provisionedUdidCount: integer("provisioned_udid_count").default(0),
  p12Data: text("p12_data"),                      // base64 encoded p12 file
  p12Password: text("p12_password"),              // password for p12
  mobileprovisionData: text("mobileprovision_data"), // base64 encoded mobileprovision
  provisionName: text("provision_name"),          // mobileprovision Name field

  // ─── Local stats cache (Primary Reference) ─────────────────────────────
  iphoneOfficialCount: integer("iphone_official_count").notNull().default(0),
  iphoneMacCount: integer("iphone_mac_count").notNull().default(0),
  ipadCount: integer("ipad_count").notNull().default(0),
  // ─── Store IPA (signed store app for this group) ────────────────────────
  storeIpaPath: text("store_ipa_path"),      // legacy: uploaded file path (kept for backward compat)
  ipaUrl: text("ipa_url"),                  // direct HTTPS link to the signed .ipa file
  ipaDownloadToken: text("ipa_download_token").unique(), // secure random token embedded in download URL
  downloadSlug: text("download_slug").unique(), // short random slug for the public download page

  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncNote: text("last_sync_note").default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Group = typeof groupsTable.$inferSelect;
export type InsertGroup = typeof groupsTable.$inferInsert;
