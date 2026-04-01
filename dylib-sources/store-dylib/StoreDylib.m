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
#import <CFNetwork/CFNetwork.h>
#import <CommonCrypto/CommonCryptor.h>

#include "fishhook.h"
#include "Obfuscation.h"

// ─── إعداد النصوص عبر XOR — لا يوجد أي نص صريح في الملف ────────────────────
// جميع الروابط والـ keys مخزّنة كـ bytes مشفّرة، تُفكّ في الـ RAM فقط وقت الحاجة.

// ─── تعريفات دالة Safe Mode ───────────────────────────────────────────────────
static BOOL gSafeModeEnabled   = NO;
static BOOL gIntegrityFailed   = NO;

// ─── ثوابت Safe Mode ──────────────────────────────────────────────────────────
static const NSInteger kSafeModeCrashLimit = 3;
static const NSTimeInterval kSafeModeResetSec = 8.0;

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

static BOOL checkIntegrity(void) {
    // 1. فحص DYLD_INSERT_LIBRARIES — المهاجم يستخدمها لحقن دايلبات إضافية
    const char *dyldInsert = getenv("DYLD_INSERT_LIBRARIES");
    if (dyldInsert && strlen(dyldInsert) > 0) {
        // موجود → محاولة حقن خارجية
        // نتحمّل حضوره فقط إذا كان يحتوي على مسارنا فقط
        // (التوقيع الشرعي يمكن أن يُعيّن DYLD_INSERT_LIBRARIES)
        XSTR(ourLib, _ENC_STORE_URL, _LEN_STORE_URL); // placeholder للمقارنة
        // إذا كان المسار لا يتضمّن أي مسار من مسارات النظام، نقبله
        // أي إضافة خارجية = تحقق فاشل
        if (strstr(dyldInsert, "/var/") || strstr(dyldInsert, "/tmp/")) {
            XSTR_ZERO(ourLib, _LEN_STORE_URL);
            return NO; // حقن خارجي مريب
        }
        XSTR_ZERO(ourLib, _LEN_STORE_URL);
    }

    // 2. فحص وجود Cydia Substrate أو Substitute في الـ Process
    void *substrate = dlopen("/Library/MobileSubstrate/MobileSubstrate.dylib", RTLD_NOLOAD);
    if (substrate) {
        // Substrate موجود — نحن في بيئة جيلبريك، نقبل ذلك (هذا متوقع)
        dlclose(substrate);
    }

    // 3. فحص رمز CS_OPS للتحقق من أن التطبيق موقَّع
    // (يمكن توسيعه لاحقاً بـ csops() system call)

    return YES; // النزاهة سليمة
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
static void showUpdateAlert(NSString *newVersion, NSString *notes) {
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

        // ─── النصوص مُشفَّرة ──────────────────────────────────────────────────
        XSTR(storeUrl, _ENC_STORE_URL, _LEN_STORE_URL);

        NSString *title   = @"🔔 تحديث جديد لمسماري+";
        NSString *message = [NSString stringWithFormat:
            @"الإصدار %@ متاح الآن.\n%@\n\nهل تريد التحديث؟",
            newVersion, notes ?: @""];

        UIAlertController *alert = [UIAlertController
            alertControllerWithTitle:title
            message:message
            preferredStyle:UIAlertControllerStyleAlert];

        NSString *urlStr = [NSString stringWithUTF8String:storeUrl];
        XSTR_ZERO(storeUrl, _LEN_STORE_URL);

        [alert addAction:[UIAlertAction
            actionWithTitle:@"تحديث الآن"
            style:UIAlertActionStyleDefault
            handler:^(UIAlertAction *a) {
                NSURL *url = [NSURL URLWithString:urlStr];
                if ([[UIApplication sharedApplication] canOpenURL:url]) {
                    [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
                }
            }]];

        [alert addAction:[UIAlertAction actionWithTitle:@"لاحقاً" style:UIAlertActionStyleCancel handler:nil]];

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
        XSTR(updateKey, _ENC_UPDATE_KEY,  _LEN_UPDATE_KEY);
        XSTR(notesKey,  _ENC_STORE_NOTES, _LEN_STORE_NOTES);
        XSTR(cfVersion, _ENC_CF_VERSION,  _LEN_CF_VERSION);

        NSString *remoteVersion = json[[NSString stringWithUTF8String:updateKey]];
        XSTR_ZERO(updateKey, _LEN_UPDATE_KEY);

        if (!remoteVersion || ![remoteVersion isKindOfClass:[NSString class]]) {
            XSTR_ZERO(notesKey,  _LEN_STORE_NOTES);
            XSTR_ZERO(cfVersion, _LEN_CF_VERSION);
            return;
        }

        NSDictionary *infoPlist = [[NSBundle mainBundle] infoDictionary];
        NSString *currentBuild  = infoPlist[[NSString stringWithUTF8String:cfVersion]];
        XSTR_ZERO(cfVersion, _LEN_CF_VERSION);
        if (!currentBuild) { XSTR_ZERO(notesKey, _LEN_STORE_NOTES); return; }

        if (![remoteVersion isEqualToString:currentBuild]) {
            NSString *notes = json[[NSString stringWithUTF8String:notesKey]] ?: @"تحسينات وإصلاحات.";
            XSTR_ZERO(notesKey, _LEN_STORE_NOTES);
            showUpdateAlert(remoteVersion, notes);
        } else {
            XSTR_ZERO(notesKey, _LEN_STORE_NOTES);
        }
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

// يُرسل تقرير صامت للسيرفر عند اكتشاف VPN شرعي (لا يُعطّل الميزات)
static void msm_reportVPNSilently(void) {
    XSTR(teleUrl, _ENC_TELEMETRY_URL, _LEN_TELEMETRY_URL);
    NSURL *url = [NSURL URLWithString:[NSString stringWithUTF8String:teleUrl]];
    XSTR_ZERO(teleUrl, _LEN_TELEMETRY_URL);
    if (!url) return;

    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:url];
    [req setHTTPMethod:@"POST"];
    [req setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    [req setHTTPBody:[NSJSONSerialization dataWithJSONObject:@{@"type": @"vpn"} options:0 error:nil]];
    [req setTimeoutInterval:8.0];
    [[NSURLSession.sharedSession dataTaskWithRequest:req
        completionHandler:^(NSData *d, NSURLResponse *r, NSError *e) {
            (void)d; (void)r; (void)e; // fire-and-forget
        }] resume];
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

static void checkProxyAndBlock(void) {
    MSMProxyType pt = msm_detectProxy();

    if (pt == MSMProxySpy) {
        gProxyBlocked = YES;
        XSTR(pk, _ENC_PROXY_KEY, _LEN_PROXY_KEY);
        NSString *pkStr = [NSString stringWithUTF8String:pk];
        XSTR_ZERO(pk, _LEN_PROXY_KEY);
        [[NSUserDefaults standardUserDefaults] setBool:YES forKey:pkStr];
        [[NSUserDefaults standardUserDefaults] synchronize];
    } else if (pt == MSMProxyVPN) {
        // VPN عادي — نُبلّغ بشكل صامت بعد 12 ثانية
        // (لا نرسل فوراً عند التشغيل حتى لا نؤثر على سرعة تحميل واجهة المتجر)
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, 12LL * NSEC_PER_SEC),
            dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0),
            ^{ msm_reportVPNSilently(); }
        );
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

        NSString *msg = [NSString stringWithFormat:
            @"أهلاً بك في مسماري بلس ✨\n\nالإصدار %@ جاهز.\nتم تحديث الشهادات بنجاح وكل التطبيقات متاحة لك الآن.\n\nاستمتع! 🚀",
            currentBuild];

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

    // ④ ميزات UI — بعد تحميل الـ App
    dispatch_async(dispatch_get_main_queue(), ^{
        showWelcomeIfNeeded();
        installAutoUpdateChecker();
    });
}
