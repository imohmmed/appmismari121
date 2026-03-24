# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Website**: React + Vite (dark purple Arabic RTL theme)
- **Mobile App**: Expo SDK 54 with expo-router tabs
- **Arabic Font**: Mestika typeface (Regular, Medium, SemiBold, Bold, ExtraBold, Black, Light) for all Arabic text in mobile app; Inter kept for English app names and numbers

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (port 8080)
│   ├── store-website/      # React website at "/" - Arabic RTL, dark purple theme
│   ├── plus-app/           # Expo mobile app at "/plus-app/"
│   └── mockup-sandbox/     # Component preview server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- **categories**: id (serial PK), name, slug, description, icon, sortOrder
- **apps**: id (serial PK), name, description, version, size, iconUrl, downloadUrl, categoryId, isFeatured, isHot, type (tweaked/modded/hacked), bundleId, isHidden, isTestMode, status, createdAt
- **plans**: id (serial PK), name, slug, price, duration, features, excludedFeatures (nullable array), isPopular, sortOrder
- **subscriptions**: id (serial PK), email, planId, udid, phone, deviceType, subscriberName, groupName, status, expiresAt, createdAt
- **featured_banners**: id (serial PK), title, description, image, link, sortOrder, isActive, createdAt
- **settings**: id (serial PK), key (unique), value, updatedAt

Seeded with 20 sample apps, 8 categories, 2 plans.

## API Routes

All routes prefixed with `/api`:
- `GET /api/apps` - List apps (filter by category, type, search)
- `GET /api/apps/featured` - Featured apps
- `GET /api/apps/hot` - Hot/trending apps
- `GET /api/categories` - List categories
- `GET /api/subscriptions/plans` - Subscription plans
- `POST /api/subscriptions/activate` - Activate subscription
- `POST /api/admin/login` - Admin login (admin/admin123)
- `GET /api/admin/stats` - Dashboard stats
- CRUD: `POST/PUT/DELETE /api/admin/apps`, `POST/PUT/DELETE /api/admin/categories`
- CRUD: `GET/POST/PUT/DELETE /api/admin/featured` - Featured banners
- `GET/PUT /api/admin/settings` - Site settings (key-value pairs)
- `GET /api/admin/plans` - List subscription plans
- `POST /api/admin/plans` - Create plan

## Admin Panel Pages

All admin pages are dark-themed (#1a1a2e bg, #22223a cards, #2a2a45 borders) with RTL layout:
- `/admin` - Dashboard (stats cards, system status, quick summary)
- `/admin/apps` - Apps management (table, 3-dot menu, search, bulk actions)
- `/admin/featured` - Featured banners (add/edit/delete banners with image/title/desc/link)
- `/admin/subscribers` - Subscriber management (table, search, bulk WhatsApp)
- `/admin/groups` - Subscriber groups + Anti-Revoke dylib injection + batch signing
- `/admin/categories` - Category management
- `/admin/subcodes` - Subscription codes
- `/admin/requests` - Subscription requests
- `/admin/packages` - Subscription packages/plans (card display)
- `/admin/purchases` - Purchase history (stats + table)
- `/admin/notifications` - Push notification sender + history
- `/admin/downloads` - Download statistics and analytics
- `/admin/settings` - Maintenance mode toggle + site settings

## Mobile App (plus-app)

3 tabs: PLUS+ (home/index), Sign (sign.tsx), Search
- Uses Apple Liquid Glass tab bar (NativeTabs) on iOS 26+, BlurView fallback for older
- Home tab has category pills, featured carousel, trending/most-downloaded/recently-added sections
- Search is a separate tab with category browsing and app search
- **Bundle ID**: `com.mismari.app`
- **Deep Link Scheme**: `mismari://`

### Push Notifications
- `expo-notifications` installed and configured in app.json
- `hooks/usePushNotifications.ts` — registers device token, posts to `/api/subscriber/push-token`
- Hook called in `_layout.tsx` TabLayout after `onboardingDone` check
- Backend: `lib/pushNotifications.ts` with `notifyAppAdded()`, `notifyAppUpdated()`, `sendBroadcast()`
- Push notifications sent automatically when admin adds/updates an app
- Admin can broadcast manual push notifications from `/admin/notifications` page
- Push API: Expo Push API (`exp.host`), batches of 100, `ExponentPushToken[...]` format

### Notifications Inbox (`app/notifications.tsx`)
- `utils/notificationStorage.ts` — AsyncStorage JSON array (max 100); methods: `saveNotification()`, `getNotifications()`, `markAllRead()`, `getUnreadCount()`, `clearAll()`, `setPendingOpenApp()`, `consumePendingOpenApp()`
- `utils/openAppSignal.ts` — module-level signal; `registerOpenAppHandler()` / `emitOpenApp()`; used by home tab to open AppDetailPanel when notification is tapped
- Inbox screen has 3 tabs: الكل (all) / رسائل (broadcast) / تطبيقات (app_added + app_updated)
- Notification tap: if has `appId` → emits openApp signal + navigates home; if broadcast → navigates to notifications list
- Bell icon in home tab header shows unread count badge; navigates to `/notifications`
- `consumePendingOpenApp()` checked on home tab mount to open apps from killed-state notification taps

### Onboarding Flow (`app/onboarding.tsx`)
Multi-step animated onboarding:
1. **Landing**: Animated cycling words (سريع, آمن, موثوق, محدّث) with blue gradient blob, Continue button
2. **Download Profile**: Opens `/api/profile/enroll?source=app` in browser → iOS prompts to install mobileconfig
3. **Install Profile**: Instructions to install in Settings → General → VPN & Device Management
4. **Your UDID**: Deep link `mismari://onboarding?udid=xxx` returns UDID → user submits for verification
5. **Checking**: API call to `/api/enroll/check?udid=xxx` to verify subscription
6. **Result**: Success → enter store, or Error → skip

Colors per step: Blue (#9fbcff), Orange (#FF8A50), Purple (#B07DFF)
- Onboarding state persisted via `@mismari_onboarding_done` in AsyncStorage
- UDID persisted via `@mismari_device_udid`
- Tabs layout checks `onboardingDone` and redirects if needed

### Theme & Localization System
- **SettingsContext** (`contexts/SettingsContext.tsx`): Manages language (AR/EN), theme mode (light/dark/system), onboardingDone, deviceUdid
- **Colors**: Light mode (white bg, dark text) and Dark mode (#2B283B bg, white text, #9FBCFF secondary)
- **Translations**: Full AR/EN in `constants/translations.ts` with `t(key)` helper
- **Font**: Arabic text → Mestika-{weight} via `fontAr()`, English → Inter
- **Persistence**: AsyncStorage keys `@mismari_language`, `@mismari_theme`, `@mismari_onboarding_done`, `@mismari_device_udid`, `@mismari_profile_photo`
- **SettingsPanel**: Accessible from Account panel → Settings, with language & appearance togglers
- **AccountPanel**: Bottom-sheet with subscriber name/phone (fetched from API by subscription code), profile photo picker (expo-image-picker, stored in context+AsyncStorage), download-store button, menu with "حسابي" opening MyAccountModal
- **MyAccountModal**: Full subscriber details sheet (bilingual, read-only) — name, phone, email, UDID, device type, group, subscription/expiry dates, active status badge
- **ProfileAvatar**: Shared component — shows profile photo or feather user icon; used in all 4 tab headers
- All screens use `useSettings()` hook for dynamic colors, translations, and font selection
- Public API endpoint `GET /api/subscriber/me?code=XXX` returns subscriber details (no auth required)

### Anti-Revoke Dylib Injection System
- Admin uploads `.dylib` file via Groups page → stored at `uploads/dylibs/antirevoke.dylib`
- API endpoints: `POST /admin/dylib/upload`, `GET /admin/dylib/status`, `DELETE /admin/dylib`
- **Batch signing**: `POST /admin/groups/sign-all` — downloads IPA from URL, signs for each test_certificate group with p12+mobileprovision, injects dylib via zsign `-l` flag, saves signed IPAs to `uploads/SignedStore/`, updates group's `ipaUrl` and `downloadSlug`
- **Auto-injection**: All individual app/store/clone signing also injects dylib automatically if present
- Signed IPAs served at `GET /admin/signed-store/:filename`
- URL validation blocks SSRF (localhost, internal hosts, non-http protocols)

## Website (store-website)

Arabic RTL React site with dark purple theme:
- Hero section, app listings with filters, subscription plans
- Admin dashboard at /admin with dark theme matching screenshots
- 14 admin pages with full sidebar navigation
- Admin credentials: env vars ADMIN_USERNAME/ADMIN_PASSWORD (default: admin/admin123)
- `/activate` — subscription code activation flow (multi-step: code → download → registration → success)
- `/subscriber/:id` — subscriber profile page
- `/enroll` — UDID enrollment via mobileconfig

## Subscription Code Activation Flow

Multi-step page at `/activate`:
1. User enters subscription code → API validates → returns group info
2. If group has Store IPA uploaded → shows `itms-services://` download link
3. User fills registration form (name, phone, email, UDID, device type)
4. Data saved to subscription record → success page with subscriber profile link

Admin Groups page includes:
- Store IPA upload per group (stores to `uploads/StoreIPA/`)
- Copy itms-services download link button
- Copy activation page URL button

Key API endpoints:
- `POST /api/activate/validate` — validate code, return group info + download link
- `POST /api/activate/complete` — save user info to subscription
- `GET /api/groups/:certName/manifest.plist` — dynamic OTA plist for itms-services
- `POST /api/admin/groups/:id/store-ipa` — upload signed store IPA
- `DELETE /api/admin/groups/:id/store-ipa` — remove store IPA
- `GET /api/admin/groups/:certName/download-link` — get itms-services URL

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files during typecheck; JS bundling handled by esbuild/tsx/vite
- **Project references** — package A depends on B → A's tsconfig lists B in references

## Root Scripts

- `pnpm run build` — typecheck + recursive build
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/api-server` (`@workspace/api-server`)
Express 5 API server with routes in `src/routes/`.

### `artifacts/store-website` (`@workspace/store-website`)
React + Vite website with Arabic RTL support, dark purple theme, admin dashboard.

### `artifacts/plus-app` (`@workspace/plus-app`)
Expo SDK 54 mobile app with 5 tabs, Apple Liquid Glass support, dark theme.

### `lib/db` (`@workspace/db`)
Drizzle ORM with PostgreSQL. Schema: categories, apps, plans, subscriptions, featured_banners, settings.

### `lib/api-spec` (`@workspace/api-spec`)
OpenAPI 3.1 spec + Orval codegen config.

### `lib/api-zod` (`@workspace/api-zod`)
Generated Zod schemas from OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)
Generated React Query hooks and fetch client.

### `scripts` (`@workspace/scripts`)
Utility scripts. Run via `pnpm --filter @workspace/scripts run <script>`.
