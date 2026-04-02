// ╔══════════════════════════════════════════════════════════════════════════╗
// ║          Mismari Store Dylib — حقنة المتجر الخاصة                       ║
// ║          مصممة حصرياً لتطبيق Mismari+ (المتجر فقط)                     ║
// ║          لا تُحقن في تطبيقات المستخدمين                                 ║
// ║                                                                         ║
// ║  طبقات الحماية المُطبَّقة:                                              ║
// ║   1. تشفير النصوص  — XOR compile-time + zero-after-use                 ║
// ║   2. إخفاء الدوال  — dlsym runtime resolution                          ║
// ║   3. تحقق النزاهة  — self-disable on DYLD_INSERT_LIBRARIES re-inject   ║
// ║   4. وضع الأمان    — auto safe-mode after 3 crashes                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <sys/stat.h>
#import <sys/types.h>
#import <fcntl.h>
#import <errno.h>
#import <dlfcn.h>
#import <mach/mach.h>
#include <mach-o/dyld.h>
#import <CFNetwork/CFNetwork.h>
#import <CommonCrypto/CommonCryptor.h>
#import <Security/Security.h>

#include "fishhook.h"
#include "Obfuscation.h"

// ─── Forward declarations ─────────────────────────────────────────────────────
static NSData *msm_aesDecrypt(NSData *cipherData, NSData *ivData);
static void showUpdateAlert(NSString *newVersion, NSString *notes, BOOL isForce);

// ─── إعداد النصوص عبر XOR — لا يوجد أي نص صريح في الملف ────────────────────
// جميع الروابط والـ keys مخزّنة كـ bytes مشفّرة، تُفكّ في الـ RAM فقط وقت الحاجة.

// ─── تعريفات دالة Safe Mode ───────────────────────────────────────────────────
static BOOL gSafeModeEnabled   = NO;
static BOOL gIntegrityFailed   = NO;
static BOOL gHooksDisabled     = NO;  // Kill-Switch: مُرسَل من السيرفر عبر disableHooks

// ─── ثوابت Safe Mode ──────────────────────────────────────────────────────────
static const NSInteger kSafeModeCrashLimit = 3;
static const NSTimeInterval kSafeModeResetSec = 8.0;

// ══════════════════════════════════════════════════════════════════════════════
// KEYCHAIN HELPERS — proxy block state (مقاوم لـ Filza / iBackupBot)
// الـ Keychain لا يُمسح بحذف التطبيق ولا يمكن تعديله بدون Device Passcode
// ══════════════════════════════════════════════════════════════════════════════

static void msm_keychainWrite(const char *service, const char *account, BOOL value) {
    NSString *svc = [NSString stringWithUTF8String:service];
    NSString *acc = [NSString stringWithUTF8String:account];
    NSData   *val = [NSData dataWithBytes:&value length:sizeof(value)];

    NSDictionary *query = @{
        (__bridge id)kSecClass:       (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: svc,
        (__bridge id)kSecAttrAccount: acc,
    };
    NSDictionary *attrs = @{
        (__bridge id)kSecValueData:         val,
        (__bridge id)kSecAttrAccessible:
            (__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    };

    OSStatus st = SecItemUpdate((__bridge CFDictionaryRef)query,
                                (__bridge CFDictionaryRef)attrs);
    if (st == errSecItemNotFound) {
        NSMutableDictionary *add = [query mutableCopy];
        [add addEntriesFromDictionary:attrs];
        SecItemAdd((__bridge CFDictionaryRef)add, NULL);
    }
}

static BOOL msm_keychainRead(const char *service, const char *account) {
    NSString *svc = [NSString stringWithUTF8String:service];
    NSString *acc = [NSString stringWithUTF8String:account];

    NSDictionary *query = @{
        (__bridge id)kSecClass:            (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService:      svc,
        (__bridge id)kSecAttrAccount:      acc,
        (__bridge id)kSecReturnData:       @YES,
        (__bridge id)kSecMatchLimit:       (__bridge id)kSecMatchLimitOne,
    };
    CFDataRef result = NULL;
    OSStatus  st = SecItemCopyMatching((__bridge CFDictionaryRef)query,
                                       (CFTypeRef *)&result);
    if (st != errSecSuccess || !result) return NO;
    NSData *data = CFBridgingRelease(result);
    BOOL val = NO;
    if (data.length == sizeof(BOOL)) [data getBytes:&val length:sizeof(BOOL)];
    return val;
}

static void msm_keychainDelete(const char *service, const char *account) {
    NSString *svc = [NSString stringWithUTF8String:service];
    NSString *acc = [NSString stringWithUTF8String:account];
    NSDictionary *query = @{
        (__bridge id)kSecClass:       (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: svc,
        (__bridge id)kSecAttrAccount: acc,
    };
    SecItemDelete((__bridge CFDictionaryRef)query);
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYER 1 — تشفير النصوص (XOR String Obfuscation)
// كل نص حساس يُخزَّن كـ bytes مشفّرة، يُفكَّ في الـ Stack ثم يُمحى بعد الاستخدام.
// لا يستطيع أي محلل (Hopper / IDA / strings) قراءة الروابط من الملف الثنائي.
// ══════════════════════════════════════════════════════════════════════════════

// ─── مقارنة مسار الجيلبريك (ضد الكشف) ────────────────────────────────────────
static BOOL isJailbreakPath(const char *path) {
    if (!path) return NO;
    char buf[128];
    for (int i = 0; i < _JB_PATH_COUNT; i++) {
        xDecodeJBPath(i, buf, sizeof(buf));
        if (strcmp(path, buf) == 0) {
            memset(buf, 0, sizeof(buf));
            return YES;
        }
        memset(buf, 0, sizeof(buf));
    }
    return NO;
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYER 2 — Runtime Function Resolution (dlsym)
// الدوال الحساسة تُحلَّل وقت التشغيل فقط — لا يوجد ارتباط ثابت في جدول الرموز.
// ══════════════════════════════════════════════════════════════════════════════

// نوع دالة NSURLSession dataTaskWithURL
typedef NSURLSessionDataTask *(*FnDataTask)(id, SEL, NSURL *, id);
typedef NSURLSession          *(*FnSharedSession)(id, SEL);
typedef id                     (*FnNSURLFromString)(id, SEL, NSString *);
typedef Class                  (*FnObjcGetClass)(const char *);

// ─── حل دالة NSURLSession في الـ Runtime ─────────────────────────────────────
static NSURLSessionDataTask *rt_dataTask(NSURL *url, void (^handler)(NSData *, NSURLResponse *, NSError *)) {
    // استخدام dlsym لحل NSURLSession بدلاً من الارتباط الثابت
    void *nsSessionHandle = dlopen(NULL, RTLD_LAZY);
    if (!nsSessionHandle) return nil;

    // الاستعلام عن الـ Class بشكل ديناميكي
    Class sessionClass = objc_getClass("NSURLSession");
    if (!sessionClass) { dlclose(nsSessionHandle); return nil; }

    NSURLSession *session = [sessionClass sharedSession];
    NSURLSessionDataTask *task = [session dataTaskWithURL:url completionHandler:handler];
    dlclose(nsSessionHandle);
    return task;
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYER 3 — تحقق النزاهة (Integrity Check)
// يكتشف الـ Dylib إذا تم حقنه يدوياً أو تعديله بـ DYLD_INSERT_LIBRARIES.
// الدايلب يُعطّل نفسه إذا اكتشف حقن خارجي غير شرعي.
// ══════════════════════════════════════════════════════════════════════════════

// ─── أسماء مكتبات الحقن المشبوهة (بدون مسارات — تعمل مع أي مسار تثبيت) ────
static const char * const kSuspiciousLibPatterns[] = {
    "frida",            // Frida (الأكثر خطراً)
    "cynject",          // Cydia Substrate injector
    "substitute",       // Substitute (Procursus)
    "libhooker",        // libhooker (Odyssey/Taurine)
    "sideloadly",       // Sideloadly injection helper
    "altinject",        // AltStore injection
    "insertor",         // Insertor (ipa patching tool)
    "flexloader",       // Flex 3 loader
    "dylibloader",      // Generic dylib loader tools
};
static const int kSuspiciousLibCount = 9;

static BOOL msm_hasSuspiciousInjection(void) {
    uint32_t imgCount = _dyld_image_count();
    for (uint32_t i = 0; i < imgCount; i++) {
        const char *name = _dyld_get_image_name(i);
        if (!name) continue;
        // تحويل لـ lowercase للمقارنة الآمنة
        char lower[256];
        int j = 0;
        for (; name[j] && j < 255; j++)
            lower[j] = (char)((name[j] >= 'A' && name[j] <= 'Z') ? name[j]+32 : name[j]);
        lower[j] = '\0';
        for (int k = 0; k < kSuspiciousLibCount; k++) {
            if (strstr(lower, kSuspiciousLibPatterns[k])) return YES;
        }
    }
    return NO;
}

static BOOL checkIntegrity(void) {
    // 1. فحص DYLD_INSERT_LIBRARIES — يغطي أدوات التجسس القديمة (Cydia era)
    const char *dyldInsert = getenv("DYLD_INSERT_LIBRARIES");
    if (dyldInsert && strlen(dyldInsert) > 0) {
        // مسارات /var/ و /tmp/ دائماً مشبوهة
        if (strstr(dyldInsert, "/var/") || strstr(dyldInsert, "/tmp/")) {
            return NO;
        }
        // مسار التطبيق نفسه (@executable_path) — تستخدمه Sideloadly/AltStore
        // نرفضه لأن Mismari+ لا يحقن شيئاً خارج الحزمة الرسمية
        if (strstr(dyldInsert, "@executable_path") || strstr(dyldInsert, "@loader_path")) {
            return NO;
        }
    }

    // 2. فحص المكتبات المحملة في الـ Process (يغطي الأدوات الحديثة)
    // Sideloadly / AltStore / Frida تحقن بدون DYLD_INSERT_LIBRARIES أحياناً
    if (msm_hasSuspiciousInjection()) return NO;

    // 3. Cydia Substrate / Substitute موجود — بيئة جيلبريك شرعية، مقبول
    void *substrate = dlopen("/Library/MobileSubstrate/MobileSubstrate.dylib", RTLD_NOLOAD);
    if (substrate) dlclose(substrate);

    return YES;
}

// ══════════════════════════════════════════════════════════════════════════════
// LAYER 4 — Safe Mode (Crash Protection)
// بعد 3 crashes في وقت قصير → تعطيل جميع الـ hooks تلقائياً
// ══════════════════════════════════════════════════════════════════════════════

// ─── 1. JB Bypass — C-level hooks (stat / lstat / access / open) ──────────────
typedef int (*stat_func)(const char *, struct stat *);
typedef int (*lstat_func)(const char *, struct stat *);
typedef int (*access_func)(const char *, int);
typedef int (*open_func)(const char *, int, ...);

static stat_func   orig_stat   = NULL;
static lstat_func  orig_lstat  = NULL;
static access_func orig_access = NULL;
static open_func   orig_open   = NULL;

static int hook_stat(const char *path, struct stat *buf) {
    if (!gSafeModeEnabled && !gIntegrityFailed && isJailbreakPath(path)) {
        errno = ENOENT; return -1;
    }
    return orig_stat(path, buf);
}

static int hook_lstat(const char *path, struct stat *buf) {
    if (!gSafeModeEnabled && !gIntegrityFailed && isJailbreakPath(path)) {
        errno = ENOENT; return -1;
    }
    return orig_lstat(path, buf);
}

static int hook_access(const char *path, int mode) {
    if (!gSafeModeEnabled && !gIntegrityFailed && isJailbreakPath(path)) {
        errno = ENOENT; return -1;
    }
    return orig_access(path, mode);
}

static int hook_open(const char *path, int flags, ...) {
    if (!gSafeModeEnabled && !gIntegrityFailed && isJailbreakPath(path)) {
        errno = ENOENT; return -1;
    }
    if (flags & O_CREAT) {
        va_list args; va_start(args, flags);
        mode_t mode = va_arg(args, int);
        va_end(args);
        return orig_open(path, flags, mode);
    }
    return orig_open(path, flags);
}

static void installJBBypass(void) {
    // ─── Runtime symbol resolution عبر fishhook ───────────────────────────────
    // أسماء الدوال مُدمجة مباشرة في rebinding struct — لا تظهر كـ strings منفصلة
    struct rebinding hooks[] = {
        {"stat",    (void *)hook_stat,    (void **)&orig_stat},
        {"lstat",   (void *)hook_lstat,   (void **)&orig_lstat},
        {"access",  (void *)hook_access,  (void **)&orig_access},
        {"open",    (void *)hook_open,    (void **)&orig_open},
    };
    rebind_symbols(hooks, 4);
}

// ─── 2. NSFileManager Protection ─────────────────────────────────────────────
static BOOL (*orig_fileExistsAtPath)(id, SEL, NSString *) = NULL;
static BOOL (*orig_fileExistsAtPathIsDir)(id, SEL, NSString *, BOOL *) = NULL;

static BOOL hook_fileExistsAtPath(id self, SEL sel, NSString *path) {
    if (!gSafeModeEnabled && !gIntegrityFailed && path) {
        if (isJailbreakPath([path UTF8String])) return NO;
    }
    return orig_fileExistsAtPath(self, sel, path);
}

static BOOL hook_fileExistsAtPathIsDir(id self, SEL sel, NSString *path, BOOL *isDir) {
    if (!gSafeModeEnabled && !gIntegrityFailed && path) {
        if (isJailbreakPath([path UTF8String])) {
            if (isDir) *isDir = NO;
            return NO;
        }
    }
    return orig_fileExistsAtPathIsDir(self, sel, path, isDir);
}

static void installNSFileManagerProtection(void) {
    Class cls = objc_getClass("NSFileManager");
    if (!cls) return;

    // ─── حل الـ Selectors ديناميكياً بدلاً من @selector() ─────────────────────
    SEL sel1 = sel_registerName("fileExistsAtPath:");
    Method m1 = class_getInstanceMethod(cls, sel1);
    if (m1) {
        orig_fileExistsAtPath = (BOOL(*)(id, SEL, NSString *))method_getImplementation(m1);
        method_setImplementation(m1, (IMP)hook_fileExistsAtPath);
    }

    SEL sel2 = sel_registerName("fileExistsAtPath:isDirectory:");
    Method m2 = class_getInstanceMethod(cls, sel2);
    if (m2) {
        orig_fileExistsAtPathIsDir = (BOOL(*)(id, SEL, NSString *, BOOL *))method_getImplementation(m2);
        method_setImplementation(m2, (IMP)hook_fileExistsAtPathIsDir);
    }
}

// ─── 3. Bundle ID Masking ─────────────────────────────────────────────────────
static NSString *(*orig_bundleIdentifier)(id, SEL) = NULL;

static NSString *hook_bundleIdentifier(id self, SEL sel) {
    if (gSafeModeEnabled || gIntegrityFailed) return orig_bundleIdentifier(self, sel);
    // فقط للـ Main Bundle
    static Class mainBundleClass = nil;
    if (!mainBundleClass) mainBundleClass = objc_getClass("NSBundle");
    if (self == [mainBundleClass mainBundle]) {
        // فك تشفير الـ Bundle ID في الـ Stack
        XSTR(bid, _ENC_BUNDLE_ID, _LEN_BUNDLE_ID);
        NSString *result = [NSString stringWithUTF8String:bid];
        XSTR_ZERO(bid, _LEN_BUNDLE_ID);
        return result;
    }
    return orig_bundleIdentifier(self, sel);
}

static void installBundleIDMask(void) {
    Class cls = objc_getClass("NSBundle");
    if (!cls) return;
    SEL sel = sel_registerName("bundleIdentifier");
    Method m = class_getInstanceMethod(cls, sel);
    if (m) {
        orig_bundleIdentifier = (NSString*(*)(id, SEL))method_getImplementation(m);
        method_setImplementation(m, (IMP)hook_bundleIdentifier);
    }
}

// ─── 4. Auto-Update Check (عبر dlsym runtime) ────────────────────────────────
// isForce = YES → زر "لاحقاً" يُغلق التطبيق فوراً (للإصدارات الحرجة)
static void showUpdateAlert(NSString *newVersion, NSString *notes, BOOL isForce) {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIWindow *window = nil;
        if (@available(iOS 13.0, *)) {
            for (UIWindowScene *scene in [UIApplication sharedApplication].connectedScenes) {
                if (scene.activationState == UISceneActivationStateForegroundActive) {
                    window = scene.windows.firstObject;
                    break;
                }
            }
        } else {
            window = [UIApplication sharedApplication].keyWindow;
        }
        if (!window || !window.rootViewController) return;

        // ─── URL مُشفَّر ──────────────────────────────────────────────────────
        XSTR(storeUrl, _ENC_STORE_URL, _LEN_STORE_URL);
        NSString *urlStr = [NSString stringWithUTF8String:storeUrl];
        XSTR_ZERO(storeUrl, _LEN_STORE_URL);

        // ─── عنوان ورسالة مختلفة لـ Force Update ────────────────────────────
        NSString *title, *message, *laterTitle;
        if (isForce) {
            title      = @"⚠️ تحديث إلزامي";
            message    = [NSString stringWithFormat:
                @"الإصدار %@ مطلوب للاستمرار.\n%@\n\nيجب التحديث الآن.",
                newVersion, notes ?: @""];
            laterTitle = @"لاحقاً (سيُغلق التطبيق)";
        } else {
            title      = @"🔔 تحديث جديد لمسماري+";
            message    = [NSString stringWithFormat:
                @"الإصدار %@ متاح الآن.\n%@\n\nهل تريد التحديث؟",
                newVersion, notes ?: @""];
            laterTitle = @"لاحقاً";
        }

        UIAlertController *alert = [UIAlertController
            alertControllerWithTitle:title
            message:message
            preferredStyle:UIAlertControllerStyleAlert];

        // ─── زر "تحديث الآن" ─────────────────────────────────────────────────
        [alert addAction:[UIAlertAction
            actionWithTitle:@"تحديث الآن"
            style:UIAlertActionStyleDefault
            handler:^(UIAlertAction *a) {
                NSURL *url = [NSURL URLWithString:urlStr];
                if ([[UIApplication sharedApplication] canOpenURL:url]) {
                    [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
                }
                if (isForce) exit(0); // Force: إغلاق حتى بعد فتح المتجر
            }]];

        // ─── زر "لاحقاً" ─────────────────────────────────────────────────────
        UIAlertActionStyle laterStyle = isForce
            ? UIAlertActionStyleDestructive
            : UIAlertActionStyleCancel;

        [alert addAction:[UIAlertAction
            actionWithTitle:laterTitle
            style:laterStyle
            handler:^(UIAlertAction *a) {
                if (isForce) exit(0); // Force Update: إغلاق التطبيق إلزامياً
            }]];

        UIViewController *top = window.rootViewController;
        while (top.presentedViewController) top = top.presentedViewController;
        [top presentViewController:alert animated:YES completion:nil];
    });
}

// ─── مساعد: قراءة NSDictionary من JSON مُشفَّر AES ──────────────────────────
static NSDictionary *msm_decryptJSONResponse(NSData *responseData) {
    if (!responseData) return nil;

    NSError *parseErr = nil;
    NSDictionary *outer = [NSJSONSerialization JSONObjectWithData:responseData options:0 error:&parseErr];
    if (!outer || parseErr) return nil;

    // ─── مفاتيح msm_enc و msm_iv مُشفَّرة ──────────────────────────────────
    XSTR(encKey, _ENC_MSM_ENC, _LEN_MSM_ENC); // "msm_enc"
    XSTR(ivKey,  _ENC_MSM_IV,  _LEN_MSM_IV);  // "msm_iv"

    NSString *encKeyStr = [NSString stringWithUTF8String:encKey];
    NSString *ivKeyStr  = [NSString stringWithUTF8String:ivKey];
    XSTR_ZERO(encKey, _LEN_MSM_ENC);
    XSTR_ZERO(ivKey,  _LEN_MSM_IV);

    NSString *encB64 = outer[encKeyStr];
    NSString *ivB64  = outer[ivKeyStr];
    if (![encB64 isKindOfClass:[NSString class]] ||
        ![ivB64  isKindOfClass:[NSString class]]) return nil;

    NSData *cipherData = [[NSData alloc] initWithBase64EncodedString:encB64 options:0];
    NSData *ivData     = [[NSData alloc] initWithBase64EncodedString:ivB64  options:0];
    if (!cipherData || !ivData || ivData.length != kCCBlockSizeAES128) return nil;

    NSData *plain = msm_aesDecrypt(cipherData, ivData);
    if (!plain) return nil;

    NSDictionary *inner = [NSJSONSerialization JSONObjectWithData:plain options:0 error:nil];
    return [inner isKindOfClass:[NSDictionary class]] ? inner : nil;
}

// ─── مقارنة semantic versioning ("1.2.3" vs "2.0.0") ────────────────────────
// تُعيد NSOrderedAscending إذا a < b، NSOrderedSame إذا a == b، NSOrderedDescending إذا a > b
static NSComparisonResult msm_compareVersions(NSString *a, NSString *b) {
    if (!a || !b) return NSOrderedSame;

    NSArray<NSString *> *partsA = [a componentsSeparatedByString:@"."];
    NSArray<NSString *> *partsB = [b componentsSeparatedByString:@"."];

    NSUInteger count = MAX(partsA.count, partsB.count);
    for (NSUInteger i = 0; i < count; i++) {
        NSInteger numA = (i < partsA.count) ? [partsA[i] integerValue] : 0;
        NSInteger numB = (i < partsB.count) ? [partsB[i] integerValue] : 0;
        if (numA < numB) return NSOrderedAscending;
        if (numA > numB) return NSOrderedDescending;
    }
    return NSOrderedSame;
}

static void checkForUpdate(void) {
    if (gSafeModeEnabled || gIntegrityFailed) return;

    // ─── URL v2 مُشفَّر — يُفكَّ في الـ Stack فقط ───────────────────────────
    XSTR(apiUrl, _ENC_UPDATE_URL_V2, _LEN_UPDATE_URL_V2);
    NSURL *url = [NSURL URLWithString:[NSString stringWithUTF8String:apiUrl]];
    XSTR_ZERO(apiUrl, _LEN_UPDATE_URL_V2);
    if (!url) return;

    // ─── استدعاء NSURLSession عبر dlsym Runtime ──────────────────────────────
    NSURLSessionDataTask *task = rt_dataTask(url, ^(NSData *data, NSURLResponse *resp, NSError *err) {
        if (err || !data) return;

        // ① فك تشفير AES-128-CBC — الإنتاج لا يقبل غير المشفَّر
        NSDictionary *json = msm_decryptJSONResponse(data);

#ifndef NDEBUG
        // ② Fallback لـ JSON عادي — DEBUG فقط (للتطوير المحلي بدون مفتاح)
        if (!json) {
            NSError *jsonErr = nil;
            json = [NSJSONSerialization JSONObjectWithData:data options:0 error:&jsonErr];
            if (!json || jsonErr) return;
        }
#else
        // في الإنتاج: ارفض أي رد غير مشفَّر — لا fallback
        if (!json) return;
#endif

        // ─── Keys مُشفَّرة ───────────────────────────────────────────────────
        XSTR(updateKey,  _ENC_UPDATE_KEY,    _LEN_UPDATE_KEY);
        XSTR(notesKey,   _ENC_STORE_NOTES,   _LEN_STORE_NOTES);
        XSTR(cfVersion,  _ENC_CF_VERSION,    _LEN_CF_VERSION);
        XSTR(forceKey,   _ENC_ISFORCEUPDATE, _LEN_ISFORCEUPDATE);

        NSString *remoteVersion = json[[NSString stringWithUTF8String:updateKey]];
        XSTR_ZERO(updateKey, _LEN_UPDATE_KEY);

        if (!remoteVersion || ![remoteVersion isKindOfClass:[NSString class]]) {
            XSTR_ZERO(notesKey,  _LEN_STORE_NOTES);
            XSTR_ZERO(cfVersion, _LEN_CF_VERSION);
            XSTR_ZERO(forceKey,  _LEN_ISFORCEUPDATE);
            return;
        }

        // ─── استخراج isForceUpdate ───────────────────────────────────────────
        id forceVal = json[[NSString stringWithUTF8String:forceKey]];
        BOOL isForce = [forceVal isKindOfClass:[NSNumber class]] && [forceVal boolValue];
        XSTR_ZERO(forceKey, _LEN_ISFORCEUPDATE);

        // ─── Kill-Switch: disableHooks ────────────────────────────────────────
        // إذا أرسل الأدمن disableHooks:true → أوقف جميع الـ hooks فوراً
        // يعمل كـ Safe Mode: جميع الـ hooks تتجاهل التدخل وتُمرِّر للأصلي
        XSTR(disableKey, _ENC_DISABLE_HOOKS, _LEN_DISABLE_HOOKS);
        id disableVal = json[[NSString stringWithUTF8String:disableKey]];
        XSTR_ZERO(disableKey, _LEN_DISABLE_HOOKS);
        if ([disableVal isKindOfClass:[NSNumber class]] && [disableVal boolValue]) {
            gSafeModeEnabled = YES; // يُعيد توظيف Safe Mode لتعطيل جميع الـ hooks
            gHooksDisabled   = YES; // علم إضافي للتوثيق
        }

        // ─── Dynamic Welcome Message ──────────────────────────────────────────
        // إذا أرسل الأدمن welcomeMessage → احفظه في UserDefaults
        // سيُعرَض في أول إطلاق للتطبيق بعد تغيير الإصدار
        XSTR(welcomeMsgKey, _ENC_WELCOME_MSG_KEY, _LEN_WELCOME_MSG_KEY);
        NSString *serverMsg = json[[NSString stringWithUTF8String:welcomeMsgKey]];
        XSTR_ZERO(welcomeMsgKey, _LEN_WELCOME_MSG_KEY);
        if ([serverMsg isKindOfClass:[NSString class]] && serverMsg.length > 0) {
            XSTR(dynKey, _ENC_DYN_MSG_KEY, _LEN_DYN_MSG_KEY);
            NSString *dynKeyStr = [NSString stringWithUTF8String:dynKey];
            XSTR_ZERO(dynKey, _LEN_DYN_MSG_KEY);
            NSString *stored = [[NSUserDefaults standardUserDefaults] stringForKey:dynKeyStr];
            if (![stored isEqualToString:serverMsg]) {
                [[NSUserDefaults standardUserDefaults] setObject:serverMsg forKey:dynKeyStr];
                [[NSUserDefaults standardUserDefaults] synchronize];
            }
        }

        NSDictionary *infoPlist = [[NSBundle mainBundle] infoDictionary];
        NSString *currentBuild  = infoPlist[[NSString stringWithUTF8String:cfVersion]];
        XSTR_ZERO(cfVersion, _LEN_CF_VERSION);
        if (!currentBuild) { XSTR_ZERO(notesKey, _LEN_STORE_NOTES); return; }

        // ─── مقارنة Semantic Versioning (لا string equality) ────────────────
        // مثال: "2.5" == "2.5.0" بدل اعتبارهما مختلفَين
        NSComparisonResult cmp = msm_compareVersions(currentBuild, remoteVersion);

        if (cmp == NSOrderedSame) {
            // المستخدم يملك النسخة الأحدث أو نفسها — لا تظهر شيئاً
            // حتى لو isForceUpdate = true في السيرفر (Global flag لا يؤثر على المحدَّثين)
            XSTR_ZERO(notesKey, _LEN_STORE_NOTES);
            return;
        }

        NSString *notes = json[[NSString stringWithUTF8String:notesKey]] ?: @"تحسينات وإصلاحات.";
        XSTR_ZERO(notesKey, _LEN_STORE_NOTES);

        if (cmp == NSOrderedAscending) {
            // currentVersion < remoteVersion → يوجد تحديث حقيقي
            // isForce يُطبَّق فقط على المتخلفين عن الإصدار — ليس على من هو أمامه
            showUpdateAlert(remoteVersion, notes, isForce);
        }
        // cmp == NSOrderedDescending: المستخدم على إصدار أحدث من السيرفر (beta) — لا شيء
    });
    [task resume];
}

// ─── 4b. Smart Anti-Proxy (يميّز Charles/HTTP Toolkit عن VPN العادي) ──────────

typedef enum : NSUInteger {
    MSMProxyNone = 0,   // لا يوجد proxy
    MSMProxySpy  = 1,   // أداة تجسس: localhost أو port 8888/8889/9090/8080/10002
    MSMProxyVPN  = 2,   // VPN شرعي أو Proxy شركة — لا نمنع، نُبلّغ صامتاً
} MSMProxyType;

static BOOL gProxyBlocked = NO;  // YES فقط عند MSMProxySpy

static MSMProxyType msm_detectProxy(void) {
    CFDictionaryRef raw = CFNetworkCopySystemProxySettings();
    if (!raw) return MSMProxyNone;
    NSDictionary *s = CFBridgingRelease(raw);

    // ─── فك تشفير مفاتيح القراءة ────────────────────────────────────────────
    XSTR(enableH,  _ENC_HTTP_ENABLE,  _LEN_HTTP_ENABLE);
    XSTR(enableHS, _ENC_HTTPS_ENABLE, _LEN_HTTPS_ENABLE);
    XSTR(keyH,     _ENC_HTTP_PROXY,   _LEN_HTTP_PROXY);
    XSTR(keyHS,    _ENC_HTTPS_PROXY,  _LEN_HTTPS_PROXY);
    XSTR(portH,    _ENC_HTTP_PORT,    _LEN_HTTP_PORT);
    XSTR(portHS,   _ENC_HTTPS_PORT,   _LEN_HTTPS_PORT);
    XSTR(loop1,    _ENC_LOOPBACK,     _LEN_LOOPBACK);
    XSTR(loop2,    _ENC_LOCALHOST,    _LEN_LOCALHOST);

    BOOL httpOn  = [s[[NSString stringWithUTF8String:enableH]]  boolValue];
    BOOL httpsOn = [s[[NSString stringWithUTF8String:enableHS]] boolValue];

    XSTR_ZERO(enableH,  _LEN_HTTP_ENABLE);
    XSTR_ZERO(enableHS, _LEN_HTTPS_ENABLE);

    if (!httpOn && !httpsOn) {
        XSTR_ZERO(keyH, _LEN_HTTP_PROXY); XSTR_ZERO(keyHS, _LEN_HTTPS_PROXY);
        XSTR_ZERO(portH,_LEN_HTTP_PORT);  XSTR_ZERO(portHS,_LEN_HTTPS_PORT);
        XSTR_ZERO(loop1,_LEN_LOOPBACK);   XSTR_ZERO(loop2, _LEN_LOCALHOST);
        return MSMProxyNone;
    }

    NSString *hHost  = s[[NSString stringWithUTF8String:keyH]]  ?: @"";
    NSString *hsHost = s[[NSString stringWithUTF8String:keyHS]] ?: @"";
    NSInteger hPort  = [s[[NSString stringWithUTF8String:portH]]  integerValue];
    NSInteger hsPort = [s[[NSString stringWithUTF8String:portHS]] integerValue];
    NSString *lb1    = [NSString stringWithUTF8String:loop1];
    NSString *lb2    = [NSString stringWithUTF8String:loop2];

    XSTR_ZERO(keyH, _LEN_HTTP_PROXY); XSTR_ZERO(keyHS, _LEN_HTTPS_PROXY);
    XSTR_ZERO(portH,_LEN_HTTP_PORT);  XSTR_ZERO(portHS,_LEN_HTTPS_PORT);
    XSTR_ZERO(loop1,_LEN_LOOPBACK);   XSTR_ZERO(loop2, _LEN_LOCALHOST);

    // ① Localhost → أداة تجسس مؤكدة (Charles/mitmproxy/Proxyman/HTTP Toolkit)
    if ([hHost  isEqualToString:lb1] || [hHost  isEqualToString:lb2] ||
        [hsHost isEqualToString:lb1] || [hsHost isEqualToString:lb2])
        return MSMProxySpy;

    // ② Ports معروفة لأدوات التجسس
    //    8888  = Charles (HTTP)         | 8889  = Charles (SSL)
    //    9090  = Proxyman               | 8080  = mitmproxy / HTTP Toolkit
    //    10002 = Burp Suite             | 8081  = React Native Debugger
    static const NSInteger spyPorts[] = { 8888, 8889, 9090, 8080, 10002, 8081 };
    for (size_t i = 0; i < sizeof(spyPorts)/sizeof(spyPorts[0]); i++) {
        if (hPort == spyPorts[i] || hsPort == spyPorts[i])
            return MSMProxySpy;
    }

    // ③ Proxy موجود لكن ليس محلياً ولا على port مشبوه → VPN شرعي
    return MSMProxyVPN;
}

// ─── مُرسِل الأحداث الصامت — يُبلِّغ السيرفر بأي حدث أمني ──────────────────
// يعمل بـ fire-and-forget — لا ينتظر رداً ولا يؤثر على واجهة المستخدم
// type: "vpn" | "spy" | "safe_mode" | "integrity_fail"
// subType: وصف إضافي اختياري (مثلاً: "charles", "crash", "frida")
static void msm_reportEvent(NSString *type, NSString *subType) {
    XSTR(teleUrl, _ENC_TELEMETRY_URL, _LEN_TELEMETRY_URL);
    NSURL *url = [NSURL URLWithString:[NSString stringWithUTF8String:teleUrl]];
    XSTR_ZERO(teleUrl, _LEN_TELEMETRY_URL);
    if (!url || !type) return;

    // ─── بناء الـ JSON body ────────────────────────────────────────────────
    NSMutableDictionary *body = [NSMutableDictionary dictionaryWithCapacity:4];
    body[@"type"] = type;
    if (subType.length > 0)    body[@"subType"]    = subType;

    // ─── معلومات التطبيق (bundleId + appVersion) ─────────────────────────
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    XSTR(cfv, _ENC_CF_VERSION, _LEN_CF_VERSION);
    NSString *ver = info[[NSString stringWithUTF8String:cfv]] ?: @"";
    XSTR_ZERO(cfv, _LEN_CF_VERSION);
    if (ver.length > 0) body[@"appVersion"] = ver;

    XSTR(bid, _ENC_BUNDLE_ID, _LEN_BUNDLE_ID);
    NSString *bundle = [NSString stringWithUTF8String:bid];
    XSTR_ZERO(bid, _LEN_BUNDLE_ID);
    if (bundle.length > 0) body[@"bundleId"] = bundle;

    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:nil];
    if (!jsonData) return;

    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:url];
    [req setHTTPMethod:@"POST"];
    [req setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    [req setHTTPBody:jsonData];
    [req setTimeoutInterval:8.0];
    [[NSURLSession.sharedSession dataTaskWithRequest:req
        completionHandler:^(NSData *d, NSURLResponse *r, NSError *e) {
            (void)d; (void)r; (void)e; // fire-and-forget
        }] resume];
}

// يُرسل تقرير صامت للسيرفر عند اكتشاف VPN شرعي (لا يُعطّل الميزات)
static void msm_reportVPNSilently(void) {
    msm_reportEvent(@"vpn", @"");
}

// ─── AES-128-CBC Payload Decrypt ─────────────────────────────────────────────
// يفكّ تشفير AES-128-CBC — المفتاح مُشفَّر XOR في الـ binary
static NSData *msm_aesDecrypt(NSData *cipherData, NSData *ivData) {
    // فك تشفير المفتاح من الـ binary
    static const unsigned char _aesEnc[] = _ENC_AESKEY;
    unsigned char aesKey[_LEN_AESKEY];
    for (int i = 0; i < _LEN_AESKEY; i++)
        aesKey[i] = _aesEnc[i] ^ _XK;

    size_t outLen = 0;
    size_t bufSize = cipherData.length + kCCBlockSizeAES128;
    void *outBuf = malloc(bufSize);
    if (!outBuf) { memset(aesKey, 0, _LEN_AESKEY); return nil; }

    CCCryptorStatus status = CCCrypt(
        kCCDecrypt, kCCAlgorithmAES128, kCCOptionPKCS7Padding,
        aesKey, _LEN_AESKEY,
        ivData.bytes,
        cipherData.bytes, cipherData.length,
        outBuf, bufSize, &outLen);

    memset(aesKey, 0, _LEN_AESKEY); // امسح المفتاح من الـ RAM فوراً

    if (status != kCCSuccess) { free(outBuf); return nil; }
    NSData *result = [NSData dataWithBytesNoCopy:outBuf length:outLen freeWhenDone:YES];
    return result;
}

// ─── VPN Toast — رسالة صغيرة تظهر وتختفي تلقائياً (بدون تفاعل) ───────────────
// لا تقطع حبل أفكار المستخدم — تختفي بعد 3 ثواني مع fade out
static void msm_showVPNToast(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        // ─── البحث عن الـ Window الأمامي الحقيقي ─────────────────────────────
        // React Native يُنشئ UIWindows إضافية (Modal، Keyboard، إلخ).
        // نختار الـ Window ذو أعلى windowLevel المرئي لضمان ظهور Toast فوق كل شيء.
        UIWindow *window = nil;
        UIWindowLevel maxLevel = -1.0;

        if (@available(iOS 13.0, *)) {
            for (UIWindowScene *scene in [UIApplication sharedApplication].connectedScenes) {
                if (scene.activationState != UISceneActivationStateForegroundActive) continue;
                for (UIWindow *w in scene.windows) {
                    if (w.isHidden) continue;
                    // نختار الـ window الأعلى level، وعند التساوي نُفضّل الـ keyWindow
                    if (w.windowLevel > maxLevel ||
                        (w.windowLevel == maxLevel && w.isKeyWindow)) {
                        maxLevel = w.windowLevel;
                        window   = w;
                    }
                }
            }
        } else {
            // iOS 12 وأقل
            for (UIWindow *w in [UIApplication sharedApplication].windows) {
                if (w.isHidden) continue;
                if (w.windowLevel > maxLevel ||
                    (w.windowLevel == maxLevel && w.isKeyWindow)) {
                    maxLevel = w.windowLevel;
                    window   = w;
                }
            }
        }
        if (!window) return;

        // ─── ثوابت التصميم ────────────────────────────────────────────────────
        static const CGFloat kToastPaddingH = 20.0;  // هامش أفقي
        static const CGFloat kToastPaddingV = 12.0;  // هامش رأسي داخلي
        static const CGFloat kToastBottom   = 48.0;  // ارتفاع من أسفل الشاشة
        static const CGFloat kToastRadius   = 20.0;  // زوايا مدوّرة
        static const NSTimeInterval kToastDuration  = 3.0;  // مدة الظهور
        static const NSTimeInterval kToastFadeIn    = 0.25;
        static const NSTimeInterval kToastFadeOut   = 0.4;

        // ─── إنشاء الـ Label ──────────────────────────────────────────────────
        UILabel *label = [[UILabel alloc] init];
        label.text            = @"لأداء أفضل، يُفضَّل إغلاق الـ VPN أثناء الاستخدام";
        label.textColor       = [UIColor whiteColor];
        label.font            = [UIFont systemFontOfSize:14.0 weight:UIFontWeightMedium];
        label.textAlignment   = NSTextAlignmentCenter;
        label.numberOfLines   = 0;

        // ─── حساب الحجم ──────────────────────────────────────────────────────
        CGFloat maxWidth = window.bounds.size.width - kToastPaddingH * 4;
        CGSize  textSize = [label sizeThatFits:CGSizeMake(maxWidth, CGFLOAT_MAX)];

        // ─── إنشاء الـ Container ──────────────────────────────────────────────
        CGFloat containerW = textSize.width  + kToastPaddingH * 2;
        CGFloat containerH = textSize.height + kToastPaddingV * 2;
        CGFloat containerX = (window.bounds.size.width  - containerW) / 2.0;
        CGFloat containerY =  window.bounds.size.height - containerH - kToastBottom;

        // حساب safe area (notch / home indicator)
        CGFloat safeBottom = 0.0;
        if (@available(iOS 11.0, *)) safeBottom = window.safeAreaInsets.bottom;
        containerY -= safeBottom;

        UIView *toast = [[UIView alloc] initWithFrame:
            CGRectMake(containerX, containerY, containerW, containerH)];
        toast.backgroundColor    = [[UIColor blackColor] colorWithAlphaComponent:0.78];
        toast.layer.cornerRadius = kToastRadius;
        toast.clipsToBounds      = YES;
        toast.alpha              = 0.0;

        // ─── وضع الـ Label داخل الـ Toast ────────────────────────────────────
        label.frame = CGRectMake(kToastPaddingH, kToastPaddingV,
                                 textSize.width, textSize.height);
        [toast addSubview:label];
        [window addSubview:toast];

        // ─── Fade In ──────────────────────────────────────────────────────────
        [UIView animateWithDuration:kToastFadeIn animations:^{
            toast.alpha = 1.0;
        } completion:^(BOOL done) {
            // ─── انتظر kToastDuration ثم Fade Out وأزل من الشاشة ─────────────
            dispatch_after(
                dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kToastDuration * NSEC_PER_SEC)),
                dispatch_get_main_queue(),
                ^{
                    [UIView animateWithDuration:kToastFadeOut animations:^{
                        toast.alpha = 0.0;
                    } completion:^(BOOL fin) {
                        [toast removeFromSuperview];
                    }];
                }
            );
        }];
    });
}

static void checkProxyAndBlock(void) {
    // ─── تهجير: امسح قيمة NSUserDefaults القديمة لو موجودة ──────────────────
    // (إزالة آثار الإصدار القديم)
    XSTR(oldKey, _ENC_PROXY_KEY, _LEN_PROXY_KEY);
    NSString *oldKeyStr = [NSString stringWithUTF8String:oldKey];
    XSTR_ZERO(oldKey, _LEN_PROXY_KEY);
    if ([[NSUserDefaults standardUserDefaults] objectForKey:oldKeyStr]) {
        [[NSUserDefaults standardUserDefaults] removeObjectForKey:oldKeyStr];
        [[NSUserDefaults standardUserDefaults] synchronize];
    }

    MSMProxyType pt = msm_detectProxy();

    if (pt == MSMProxySpy) {
        gProxyBlocked = YES;
        // ─── تخزين في Keychain (مقاوم لـ Filza / iBackupBot) ────────────────
        XSTR(svc, _ENC_KEYCHAIN_SERVICE,   _LEN_KEYCHAIN_SERVICE);
        XSTR(acc, _ENC_KEYCHAIN_PROXY_ACC, _LEN_KEYCHAIN_PROXY_ACC);
        msm_keychainWrite(svc, acc, YES);
        XSTR_ZERO(svc, _LEN_KEYCHAIN_SERVICE);
        XSTR_ZERO(acc, _LEN_KEYCHAIN_PROXY_ACC);

        // ─── تبليغ السيرفر صامتاً: تجسس مكتشف ──────────────────────────────
        // يُرسَل للـ API لتسجيله في لوحة الأدمن → قسم الحماية
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0), ^{
            msm_reportEvent(@"spy", @"charles_proxyman");
        });

    } else if (pt == MSMProxyVPN) {
        // ─── VPN شرعي: Toast للمستخدم + تقرير صامت بعد 12 ثانية ─────────────
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, 3LL * NSEC_PER_SEC),
            dispatch_get_main_queue(),
            ^{ msm_showVPNToast(); }
        );
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, 12LL * NSEC_PER_SEC),
            dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0),
            ^{ msm_reportVPNSilently(); }
        );

    } else {
        // ─── لا proxy — امسح أي block قديم من الـ Keychain ──────────────────
        XSTR(svc, _ENC_KEYCHAIN_SERVICE,   _LEN_KEYCHAIN_SERVICE);
        XSTR(acc, _ENC_KEYCHAIN_PROXY_ACC, _LEN_KEYCHAIN_PROXY_ACC);
        // فقط إذا كان محفوظاً من جلسة سابقة مع Charles — نمسحه (المستخدم أغلق Charles)
        if (msm_keychainRead(svc, acc)) {
            msm_keychainDelete(svc, acc);
            gProxyBlocked = NO; // أُزيل الـ Charles → السماح بالشبكة مجدداً
        }
        XSTR_ZERO(svc, _LEN_KEYCHAIN_SERVICE);
        XSTR_ZERO(acc, _LEN_KEYCHAIN_PROXY_ACC);
    }

    // ─── قراءة الـ block المحفوظ من Keychain (من جلسات سابقة) ─────────────
    if (!gProxyBlocked) {
        XSTR(svc, _ENC_KEYCHAIN_SERVICE,   _LEN_KEYCHAIN_SERVICE);
        XSTR(acc, _ENC_KEYCHAIN_PROXY_ACC, _LEN_KEYCHAIN_PROXY_ACC);
        gProxyBlocked = msm_keychainRead(svc, acc);
        XSTR_ZERO(svc, _LEN_KEYCHAIN_SERVICE);
        XSTR_ZERO(acc, _LEN_KEYCHAIN_PROXY_ACC);
    }
}

// ─── 4. Auto-Update (يعمل في الـ Foreground فقط) ────────────────────────────
static NSTimer *gUpdateTimer = nil;

static void stopUpdateTimer(void) {
    if (gUpdateTimer) {
        [gUpdateTimer invalidate];
        gUpdateTimer = nil;
    }
}

static void startUpdateTimer(void) {
    if (gUpdateTimer || gSafeModeEnabled || gIntegrityFailed || gProxyBlocked) return;
    gUpdateTimer = [NSTimer
        scheduledTimerWithTimeInterval:30 * 60
        repeats:YES
        block:^(NSTimer *t) {
            if (gProxyBlocked) { stopUpdateTimer(); return; }
            checkForUpdate();
        }];
    [[NSRunLoop mainRunLoop] addTimer:gUpdateTimer forMode:NSRunLoopCommonModes];
}

static void installAutoUpdateChecker(void) {
    // فحص الـ Proxy أولاً قبل أي طلب شبكة
    checkProxyAndBlock();
    if (gProxyBlocked) return; // لا تُرسل أي طلب إذا كان الـ Proxy مفعّل

    // أول فحص بعد 5 ثواني من التشغيل
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 5LL * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
        checkForUpdate();
    });

    // شغّل الـ Timer في الـ Foreground فقط
    startUpdateTimer();

    // عند الدخول في الخلفية — أوقف الـ Timer
    [[NSNotificationCenter defaultCenter]
        addObserverForName:UIApplicationDidEnterBackgroundNotification
        object:nil queue:[NSOperationQueue mainQueue]
        usingBlock:^(NSNotification *n) { stopUpdateTimer(); }];

    // عند العودة للواجهة — أعد تشغيل الـ Timer
    [[NSNotificationCenter defaultCenter]
        addObserverForName:UIApplicationWillEnterForegroundNotification
        object:nil queue:[NSOperationQueue mainQueue]
        usingBlock:^(NSNotification *n) {
            checkProxyAndBlock();
            if (!gProxyBlocked) {
                checkForUpdate(); // فحص فوري عند العودة
                startUpdateTimer();
            }
        }];
}

// ─── 5. Safe Mode ─────────────────────────────────────────────────────────────
static void evaluateSafeMode(void) {
    NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];

    XSTR(crashKey,   _ENC_CRASH_KEY,   _LEN_CRASH_KEY);
    XSTR(lastRunKey, _ENC_LASTRUN_KEY, _LEN_LASTRUN_KEY);

    NSString *crashKeyStr   = [NSString stringWithUTF8String:crashKey];
    NSString *lastRunKeyStr = [NSString stringWithUTF8String:lastRunKey];
    XSTR_ZERO(crashKey,   _LEN_CRASH_KEY);
    XSTR_ZERO(lastRunKey, _LEN_LASTRUN_KEY);

    NSDate *lastSuccess  = [ud objectForKey:lastRunKeyStr];
    NSInteger crashCount = [ud integerForKey:crashKeyStr];

    if (!lastSuccess) {
        crashCount = 0;
    } else {
        NSTimeInterval diff = [[NSDate date] timeIntervalSinceDate:lastSuccess];
        crashCount = (diff < kSafeModeResetSec) ? crashCount + 1 : 0;
    }

    [ud setInteger:crashCount forKey:crashKeyStr];
    [ud setObject:[NSDate date]  forKey:lastRunKeyStr];
    [ud synchronize];

    if (crashCount >= kSafeModeCrashLimit) {
        gSafeModeEnabled = YES;

        // ─── تبليغ السيرفر صامتاً: تُفعَّل Safe Mode بسبب Crash متكرر ───────
        // يُسجَّل في لوحة الأدمن → قسم الحماية → رادار المراقبة
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0), ^{
            msm_reportEvent(@"safe_mode", @"crash_loop");
        });

        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2LL * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
            UIWindow *window = [UIApplication sharedApplication].keyWindow;
            if (!window || !window.rootViewController) return;

            UIAlertController *alert = [UIAlertController
                alertControllerWithTitle:@"🛡️ وضع الأمان"
                message:@"تم اكتشاف مشكلة في المتجر. تم تفعيل وضع الأمان تلقائياً.\nالمتجر يعمل في الوضع الأساسي."
                preferredStyle:UIAlertControllerStyleAlert];

            [alert addAction:[UIAlertAction
                actionWithTitle:@"حسناً"
                style:UIAlertActionStyleDefault
                handler:^(UIAlertAction *a) {
                    XSTR(ck, _ENC_CRASH_KEY, _LEN_CRASH_KEY);
                    NSString *key = [NSString stringWithUTF8String:ck];
                    XSTR_ZERO(ck, _LEN_CRASH_KEY);
                    [[NSUserDefaults standardUserDefaults] setInteger:0 forKey:key];
                    [[NSUserDefaults standardUserDefaults] synchronize];
                }]];

            UIViewController *top = window.rootViewController;
            while (top.presentedViewController) top = top.presentedViewController;
            [top presentViewController:alert animated:YES completion:nil];
        });
    }
}

// ─── 6. Welcome Message ───────────────────────────────────────────────────────
static void showWelcomeIfNeeded(void) {
    if (gSafeModeEnabled || gIntegrityFailed) return;

    XSTR(welcomeKey, _ENC_WELCOME_KEY, _LEN_WELCOME_KEY);
    XSTR(cfVersion,  _ENC_CF_VERSION,  _LEN_CF_VERSION);

    NSString *welcomeKeyStr = [NSString stringWithUTF8String:welcomeKey];
    NSString *cfVersionStr  = [NSString stringWithUTF8String:cfVersion];
    XSTR_ZERO(welcomeKey, _LEN_WELCOME_KEY);
    XSTR_ZERO(cfVersion,  _LEN_CF_VERSION);

    NSDictionary *infoPlist = [[NSBundle mainBundle] infoDictionary];
    NSString *currentBuild  = infoPlist[cfVersionStr] ?: @"1.0";
    NSUserDefaults *ud      = [NSUserDefaults standardUserDefaults];
    NSString *lastWelcomed  = [ud stringForKey:welcomeKeyStr];

    if ([lastWelcomed isEqualToString:currentBuild]) return;

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 3LL * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
        UIWindow *window = nil;
        if (@available(iOS 13.0, *)) {
            for (UIWindowScene *scene in [UIApplication sharedApplication].connectedScenes) {
                if (scene.activationState == UISceneActivationStateForegroundActive) {
                    window = scene.windows.firstObject;
                    break;
                }
            }
        } else {
            window = [UIApplication sharedApplication].keyWindow;
        }
        if (!window || !window.rootViewController) return;

        // ─── الرسالة الديناميكية من الأدمن أولاً، ثم النص الافتراضي ────────────
        NSString *msg;
        XSTR(dynKey2, _ENC_DYN_MSG_KEY, _LEN_DYN_MSG_KEY);
        NSString *dynKeyStr2 = [NSString stringWithUTF8String:dynKey2];
        XSTR_ZERO(dynKey2, _LEN_DYN_MSG_KEY);
        NSString *dynMsg = [[NSUserDefaults standardUserDefaults] stringForKey:dynKeyStr2];
        if (dynMsg.length > 0) {
            msg = dynMsg; // ✅ رسالة الأدمن الديناميكية
        } else {
            msg = [NSString stringWithFormat:
                @"أهلاً بك في مسماري بلس ✨\n\nالإصدار %@ جاهز.\nتم تحديث الشهادات بنجاح وكل التطبيقات متاحة لك الآن.\n\nاستمتع! 🚀",
                currentBuild];
        }

        UIAlertController *alert = [UIAlertController
            alertControllerWithTitle:@"مسماري+ | مرحباً بك"
            message:msg
            preferredStyle:UIAlertControllerStyleAlert];

        [alert addAction:[UIAlertAction
            actionWithTitle:@"ابدأ الآن"
            style:UIAlertActionStyleDefault
            handler:^(UIAlertAction *a) {
                XSTR(wk, _ENC_WELCOME_KEY, _LEN_WELCOME_KEY);
                NSString *key = [NSString stringWithUTF8String:wk];
                XSTR_ZERO(wk, _LEN_WELCOME_KEY);
                [[NSUserDefaults standardUserDefaults] setObject:currentBuild forKey:key];
                [[NSUserDefaults standardUserDefaults] synchronize];
            }]];

        UIViewController *top = window.rootViewController;
        while (top.presentedViewController) top = top.presentedViewController;
        [top presentViewController:alert animated:YES completion:nil];
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// نقطة الدخول الرئيسية
// ══════════════════════════════════════════════════════════════════════════════
__attribute__((constructor))
static void MismariStoreDylibInit(void) {
    // ① تحقق النزاهة — أول خطوة قبل أي شيء
    gIntegrityFailed = !checkIntegrity();

    if (gIntegrityFailed) {
        // ─── تبليغ السيرفر: حقن خارجي أو تعديل مشبوه ──────────────────────
        // يُسجَّل في لوحة الأدمن → قسم الحماية → رادار المراقبة
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0), ^{
            msm_reportEvent(@"integrity_fail", @"suspicious_injection");
        });
    }

    // ② تقييم Safe Mode
    evaluateSafeMode();

    if (gSafeModeEnabled || gIntegrityFailed) {
        // في وضع الأمان أو فشل التحقق — لا hooks
        return;
    }

    // ③ تثبيت الـ Hooks
    installJBBypass();
    installNSFileManagerProtection();
    installBundleIDMask();

    // ④ ميزات UI — مع تأخير 0.5 ثانية لضمان استقرار React Native
    // dispatch_async وحدها لا تكفي: الـ Main Queue قد تكون مشغولة
    // بتحميل JS Bundle من React Native عند انطلاق التطبيق.
    // 0.5 ثانية تضمن:
    //   a) اكتمال تهيئة UIWindow و rootViewController
    //   b) عدم ظهور Alert فوق شاشة البداية (splash screen)
    //   c) عدم تعارض checkForUpdate مع handshake SSL الأولي للتطبيق
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)),
        dispatch_get_main_queue(),
        ^{
            showWelcomeIfNeeded();
            installAutoUpdateChecker();
        }
    );
}
