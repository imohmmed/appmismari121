/*
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║       Mismari Anti-Revoke & Protection Dylib v4.1                      ║
 * ║       Build: cd dylib-src && make release                             ║
 * ║       Requirements: Theos on macOS · Python3 (post-build patch)       ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  MODULES:                                                              ║
 * ║  1.  Anti-Debugging       — ptrace + sysctl                           ║
 * ║  2.  OCSP Block           — NSURLSession + NSURLConnection hooks       ║
 * ║       (Content-Type + Content-Length محددان بدقة — iOS لا يتجاوزه)    ║
 * ║  3.  SSL Unpinning        — SecTrust hooks                            ║
 * ║  4.  Bundle ID Guard      — Sideload detection bypass                  ║
 * ║  5.  Fake Device Info     — UIDevice + Keychain UUID (ثابت للأبد)     ║
 * ║  6.  File Path Shadow     — access/stat/lstat/fopen/open hooks         ║
 * ║  7.  (محذوف) Background AutoKill — كان يكسر تحميلات اليوتيوب/سبوتيفاي ║
 * ║  8.  URL Scheme Filter    — canOpenURL: JB app scheme blocking         ║
 * ║  9.  Env Variable Hide    — getenv hook (hides DYLD / Substrate vars)  ║
 * ║  10. Swizzle Ghost        — method_getImplementation camouflage        ║
 * ║  11. DYLD Image Cloaking  — _dyld_image_count/name/header hooks       ║
 * ║      يُخفي الدايلب من قائمة المكتبات — يتجاوز Hybrid Detection         ║
 * ║  12. Clipboard Guard      — UIPasteboard hooks (Privacy Shield)       ║
 * ║      يمنع TikTok/Facebook من قراءة الحافظة تلقائياً                   ║
 * ║  13. Safe Mode            — يدوي عبر Mismari+ (بدون استهلاك بطارية) ║
 * ║      ملف Documents/.msm_safemode موجود → لا hooks عند التشغيل        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Memory Safety:
 *  - MSM_STACK: Stack allocation — zero-overhead, auto-freed at scope end
 *  - MSM_S:     Heap allocation  — requires explicit free() by caller
 *  - High-frequency hooks (stat/access/getenv) use MSM_STACK exclusively
 */

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <Security/Security.h>
#import <objc/runtime.h>

#include <sys/types.h>
#include <sys/sysctl.h>
#define PT_DENY_ATTACH 31
extern int ptrace(int request, pid_t pid, caddr_t addr, int data);
#include <sys/stat.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <stdio.h>
#include <stdint.h>
#include <mach-o/dyld.h>

#include "MSMStrings.h"


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 1 — ANTI-DEBUGGING                                                   */
/* يمنع lldb / cycript / frida من الاتصال بالتطبيق — يعمل قبل main()         */
/* ─────────────────────────────────────────────────────────────────────────── */

__attribute__((constructor)) __attribute__((visibility("hidden")))
static void msm_antiDebug(void) {
    ptrace(PT_DENY_ATTACH, 0, 0, 0);

    int mib[4] = { CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid() };
    struct kinfo_proc info = {};
    size_t sz = sizeof(info);
    if (sysctl(mib, 4, &info, &sz, NULL, 0) == 0) {
        if (info.kp_proc.p_flag & P_TRACED) {
            exit(0);
        }
    }
}


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 2 — OCSP / CRL BLOCK (قلب الـ Anti-Revoke)                          */
/* يمنع iOS من التحقق إذا تم إلغاء الشهادة                                   */
/* ⚡ يستخدم MSM_STACK — لا memory leak بغض النظر عن عدد الاستدعاءات          */
/* ─────────────────────────────────────────────────────────────────────────── */

__attribute__((visibility("hidden")))
static BOOL msm_isRevocationHost(NSString *host) {
    if (!host) return NO;
    const char *h = [host.lowercaseString UTF8String];
    if (!h) return NO;

    /* Stack buffers — آمنة في الـ hooks عالية التكرار */
    MSM_STACK(d1, S_OCSP1);
    MSM_STACK(d2, S_OCSP2);
    MSM_STACK(d3, S_CRL);
    MSM_STACK(d4, S_VALID);

    if (strcasecmp(h, d1) == 0 || strcasecmp(h, d2) == 0 ||
        strcasecmp(h, d3) == 0 || strcasecmp(h, d4) == 0) {
        return YES;
    }

    /* فحص شامل لأي نطاق apple مرتبط بالـ OCSP / CRL */
    if (strstr(h, "apple.com") &&
        (strstr(h, "ocsp") || strstr(h, "crl") ||
         strstr(h, "valid") || strstr(h, "cert"))) {
        return YES;
    }

    return NO;
}

/* ── استجابة OCSP وهمية (iOS 17/18 لا يكرر الطلب إذا جاء 200 OK) ───────────── */
/*
 * OCSP Response RFC 6960 — minimal valid DER:
 *
 *   OCSPResponse ::= SEQUENCE {
 *     responseStatus  ENUMERATED { successful(0) }
 *   }
 *
 * Bytes: 30 03 0A 01 00
 *   30 = SEQUENCE tag
 *   03 = length 3
 *   0A = ENUMERATED tag
 *   01 = length 1
 *   00 = value 0 (successful)
 *
 * iOS اليمنى: يحتاج Content-Type وContent-Length الصحيحين
 * وإلا يتجاهل الـ response ويتصل بسيرفر Apple الحقيقي
 */
static NSData *msm_fakeOCSPData(void) {
    static const uint8_t kOCSPGood[] = { 0x30, 0x03, 0x0A, 0x01, 0x00 };
    return [NSData dataWithBytes:kOCSPGood length:sizeof(kOCSPGood)];
}

static NSHTTPURLResponse *msm_fakeOCSPResponse(NSURL *url) {
    /* Content-Length يجب أن يتطابق مع حجم الـ data بالضبط */
    NSDictionary *headers = @{
        @"Content-Type":   @"application/ocsp-response",
        @"Content-Length": @"5",
        @"Cache-Control":  @"max-age=604800",  /* أسبوع — iOS لا يُعيد الطلب */
        @"Connection":     @"close",
    };
    return [[NSHTTPURLResponse alloc] initWithURL:url
                                       statusCode:200
                                      HTTPVersion:@"HTTP/1.1"
                                     headerFields:headers];
}

%hook NSURLSession

- (NSURLSessionDataTask *)dataTaskWithRequest:(NSURLRequest *)request
                            completionHandler:(void (^)(NSData *, NSURLResponse *, NSError *))handler {
    if (msm_isRevocationHost(request.URL.host)) {
        if (handler) handler(msm_fakeOCSPData(), msm_fakeOCSPResponse(request.URL), nil);
        return nil;
    }
    return %orig;
}

- (NSURLSessionDataTask *)dataTaskWithURL:(NSURL *)url
                        completionHandler:(void (^)(NSData *, NSURLResponse *, NSError *))handler {
    if (msm_isRevocationHost(url.host)) {
        if (handler) handler(msm_fakeOCSPData(), msm_fakeOCSPResponse(url), nil);
        return nil;
    }
    return %orig;
}

- (NSURLSessionDownloadTask *)downloadTaskWithRequest:(NSURLRequest *)request
                                    completionHandler:(void (^)(NSURL *, NSURLResponse *, NSError *))handler {
    if (msm_isRevocationHost(request.URL.host)) {
        if (handler) handler(nil, msm_fakeOCSPResponse(request.URL), nil);
        return nil;
    }
    return %orig;
}

%end


%hook NSURLConnection

+ (NSURLConnection *)connectionWithRequest:(NSURLRequest *)request delegate:(id)delegate {
    if (msm_isRevocationHost(request.URL.host)) return nil;
    return %orig;
}

+ (void)sendAsynchronousRequest:(NSURLRequest *)request
                          queue:(NSOperationQueue *)queue
              completionHandler:(void (^)(NSURLResponse *, NSData *, NSError *))handler {
    if (msm_isRevocationHost(request.URL.host)) {
        if (handler) handler(msm_fakeOCSPResponse(request.URL), msm_fakeOCSPData(), nil);
        return;
    }
    %orig;
}

- (id)initWithRequest:(NSURLRequest *)request delegate:(id)delegate {
    if (msm_isRevocationHost(request.URL.host)) return nil;
    return %orig;
}

%end


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 3 — SSL UNPINNING                                                    */
/* يقبل أي شهادة SSL بغض النظر عن الـ Certificate Pinning                    */
/* ─────────────────────────────────────────────────────────────────────────── */

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
%hookf(OSStatus, SecTrustEvaluate, SecTrustRef trust, SecTrustResultType *result) {
    %orig;
    if (result) *result = kSecTrustResultProceed;
    return errSecSuccess;
}
#pragma clang diagnostic pop

%hookf(bool, SecTrustEvaluateWithError, SecTrustRef trust, CFErrorRef *error) {
    if (error) *error = NULL;
    return true;
}

%hookf(SecTrustResultType, SecTrustGetTrustResult, SecTrustRef trust, SecTrustResultType *result) {
    if (result) *result = kSecTrustResultProceed;
    return kSecTrustResultProceed;
}


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 4 — BUNDLE ID GUARD                                                  */
/* يمنع التطبيق من اكتشاف أنه مثبت خارج App Store                            */
/* ─────────────────────────────────────────────────────────────────────────── */

static NSString *_msm_bundleID = nil;

%hook NSBundle

- (NSString *)bundleIdentifier {
    NSString *orig = %orig;
    if (!_msm_bundleID && orig.length > 0) {
        _msm_bundleID = [orig copy];
    }
    return _msm_bundleID ?: orig;
}

- (NSDictionary *)infoDictionary {
    NSMutableDictionary *info = [%orig mutableCopy];
    if (_msm_bundleID) {
        info[@"CFBundleIdentifier"] = _msm_bundleID;
    }
    return info;
}

%end


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 5 — FAKE DEVICE INFO (Anti-Ban + Anti-Tracking)                      */
/* يعطي قيم وهمية — يمنع تتبع الجهاز وعمل Device Fingerprint دائم           */
/* ─────────────────────────────────────────────────────────────────────────── */

/*
 * msm_keychainUUID — يخزن UUID في الـ Keychain بدل NSUserDefaults
 *
 * لماذا Keychain أفضل؟
 *  - NSUserDefaults: تطبيقات البنوك / الألعاب تمسحه أو تفحص مفاتيحه
 *  - Keychain: محمي بـ Secure Enclave — لا يمكن فحص مفاتيحه من خارج التطبيق
 *  - يبقى ثابتاً حتى بعد حذف التطبيق وإعادة تثبيته (persistent across reinstalls)
 *  - يمنع اكتشاف حسابات جديدة (Anti-Smurfing) في الألعاب
 */
__attribute__((visibility("hidden")))
static NSUUID *msm_keychainUUID(NSString *account) {
    NSDictionary *query = @{
        (__bridge id)kSecClass:      (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrAccount: account,
        (__bridge id)kSecReturnData: @YES,
        (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitOne,
    };

    CFTypeRef result = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);

    if (status == errSecSuccess && result) {
        NSData   *data = (__bridge_transfer NSData *)result;
        NSString *str  = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        NSUUID   *uuid = [[NSUUID alloc] initWithUUIDString:str];
        if (uuid) return uuid;
        /* إذا كان المحتوى تالفاً → احذف وأنشئ جديد */
        SecItemDelete((__bridge CFDictionaryRef)query);
    }

    /* أنشئ UUID جديد واحفظه في Keychain */
    NSUUID  *fresh    = [NSUUID UUID];
    NSData  *uuidData = [[fresh UUIDString] dataUsingEncoding:NSUTF8StringEncoding];

    NSDictionary *addAttrs = @{
        (__bridge id)kSecClass:       (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrAccount:  account,
        (__bridge id)kSecValueData:    uuidData,
        /* يبقى بعد حذف التطبيق — يمنع اكتشاف الجهاز كـ "جهاز جديد" */
        (__bridge id)kSecAttrAccessible: (__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    };
    SecItemAdd((__bridge CFDictionaryRef)addAttrs, NULL);
    return fresh;
}

%hook UIDevice

- (NSUUID *)identifierForVendor {
    /*
     * nil يسبب Crash في تطبيقات تبني قاعدة بياناتها على IDFV.
     * UUID عشوائي مخزَّن في Keychain — ثابت حتى بعد حذف التطبيق.
     * مفتاح الـ Keychain مشفَّر XOR في الـ binary.
     */
    MSM_STACK(idfvKey, S_IDFV_KEY); /* "__msm_idfv__" */
    return msm_keychainUUID([NSString stringWithUTF8String:idfvKey]);
}

- (NSString *)name {
    return @"iPhone";
}

- (NSString *)model {
    return @"iPhone";
}

- (NSString *)localizedModel {
    return @"iPhone";
}

%end


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 6 — FILE PATH SHADOW                                                 */
/* يخفي مسارات Cydia / Substrate / Tweaks عن تطبيقات الكشف الذكية            */
/* ⚡ MSM_STACK — آمن حتى لو استُدعي آلاف المرات في الثانية                   */
/* ─────────────────────────────────────────────────────────────────────────── */

__attribute__((visibility("hidden")))
static BOOL msm_isSuspiciousPath(const char *path) {
    if (!path) return NO;

    /* ─── Classic JB paths ──────────────────────────────────────────────────── */
    MSM_STACK(p1, S_PATH1); /* /Library/MobileSubstrate */
    MSM_STACK(p2, S_PATH2); /* /var/lib/cydia           */
    MSM_STACK(p3, S_PATH3); /* /usr/lib/tweaks           */
    MSM_STACK(p4, S_PATH4); /* /var/jb                   */
    MSM_STACK(p5, S_PATH5); /* /usr/bin/cycript          */
    MSM_STACK(p6, S_PATH6); /* /var/mobile/Applications  */

    /* ─── Rootless JB (Dopamine / Palera1n / unc0ver iOS 15+) ──────────────── */
    MSM_STACK(p7,  S_PATH_PREBOOT); /* /private/preboot/        */
    MSM_STACK(p8,  S_PATH_JB_USR);  /* /var/jb/usr/             */
    MSM_STACK(p9,  S_PATH_JB_LIB);  /* /var/jb/Library/         */
    MSM_STACK(p10, S_PATH_DOTFILE); /* /.file (Dopamine marker) */

    return (strstr(path, p1)  ||
            strstr(path, p2)  ||
            strstr(path, p3)  ||
            strstr(path, p4)  ||
            strstr(path, p5)  ||
            strstr(path, p6)  ||
            strstr(path, p7)  ||
            strstr(path, p8)  ||
            strstr(path, p9)  ||
            strstr(path, p10));
}

%hookf(int, access, const char *path, int mode) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    return %orig;
}

%hookf(int, stat, const char *restrict path, struct stat *restrict buf) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    return %orig;
}

%hookf(int, lstat, const char *restrict path, struct stat *restrict buf) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    return %orig;
}

%hookf(FILE *, fopen, const char *path, const char *mode) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return NULL; }
    return %orig;
}

%hookf(int, open, const char *path, int flags) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    return %orig;
}


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 7 — (محذوف — Background AutoKill)                                    */
/* تم حذفه: كان يقطع Background Tasks بعد ثانيتين مما يكسر التحميلات         */
/* واليوتيوب وسبوتيفاي وأي تطبيق يستخدم Background Task بشكل شرعي            */
/* لا علاقة له بالـ Anti-Revoke — يزعج المستخدم أكثر مما يحميه               */
/* ─────────────────────────────────────────────────────────────────────────── */


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 8 — URL SCHEME FILTER (JB App Detection Bypass)                      */
/* يمنع Snapchat / PUBG / بنوك من اكتشاف تطبيقات الجيلبريك عبر URL Schemes   */
/*                                                                             */
/* آلية الكشف المُعطَّلة:                                                      */
/*   [[UIApplication sharedApplication] canOpenURL:[NSURL URLWithString:@"cydia://"]]  */
/*   → بدون الـ hook: YES (مكشوف)                                              */
/*   → مع الـ hook:   NO  (مخفي)                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

__attribute__((visibility("hidden")))
static BOOL msm_isJailbreakScheme(NSString *scheme) {
    if (!scheme) return NO;
    NSString *s = scheme.lowercaseString;

    /* Stack buffers — 9 Schemes مشفَّرة */
    MSM_STACK(sc1, S_SCHEME_CYDIA);
    MSM_STACK(sc2, S_SCHEME_UNDECIMUS);
    MSM_STACK(sc3, S_SCHEME_SILEO);
    MSM_STACK(sc4, S_SCHEME_FILZA);
    MSM_STACK(sc5, S_SCHEME_ZBRA);
    MSM_STACK(sc6, S_SCHEME_BLACKRA1N);
    MSM_STACK(sc7, S_SCHEME_CHECKRA1N);
    MSM_STACK(sc8, S_SCHEME_UNC0VER);
    MSM_STACK(sc9, S_SCHEME_PALERA1N);

    /* نُقارن فقط الـ scheme (بدون ://) */
    /* نقطع الـ :// من المتغير للمقارنة */
    const char *raw = [s UTF8String];
    if (!raw) return NO;

    /* نستخرج اسم الـ scheme (قبل :) */
    char schemeBuf[64] = {0};
    const char *colon = strchr(raw, ':');
    if (colon) {
        size_t schemeLen = (size_t)(colon - raw);
        if (schemeLen < sizeof(schemeBuf)) {
            memcpy(schemeBuf, raw, schemeLen);
        }
    } else {
        strncpy(schemeBuf, raw, sizeof(schemeBuf) - 1);
    }

    /* مقارنة مع قائمة الـ schemes المُشفَّرة (نُزيل :// من sc*) */
    #define SCHEME_MATCH(sc) \
        ({ char _s[64]={0}; const char *_c=strchr(sc,':'); \
           if(_c){memcpy(_s,sc,(size_t)(_c-sc));} else{strncpy(_s,sc,63);} \
           strcasecmp(schemeBuf, _s) == 0; })

    BOOL blocked = (SCHEME_MATCH(sc1) || SCHEME_MATCH(sc2) || SCHEME_MATCH(sc3) ||
                    SCHEME_MATCH(sc4) || SCHEME_MATCH(sc5) || SCHEME_MATCH(sc6) ||
                    SCHEME_MATCH(sc7) || SCHEME_MATCH(sc8) || SCHEME_MATCH(sc9));
    #undef SCHEME_MATCH

    return blocked;
}

%hook UIApplication

- (BOOL)canOpenURL:(NSURL *)url {
    if (!url) return %orig;
    if (msm_isJailbreakScheme(url.scheme)) return NO;
    return %orig;
}

- (void)openURL:(NSURL *)url options:(NSDictionary *)options
                   completionHandler:(void (^)(BOOL))handler {
    if (url && msm_isJailbreakScheme(url.scheme)) {
        if (handler) handler(NO);
        return;
    }
    %orig;
}

%end /* UIApplication */


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 9 — ENVIRONMENT VARIABLE HIDE                                        */
/* يُخفي متغيرات البيئة الخاصة بالجيلبريك — الطبقة الأعمق لتجاوز بنوك/ألعاب */
/*                                                                             */
/* يكتشف: DYLD_INSERT_LIBRARIES / MobileSubstrate / _MSSafeMode / LIBHOOKER  */
/* كل هذه دلائل مباشرة على وجود جيلبريك — نُخفيها كأنها لا تُوجد             */
/* ─────────────────────────────────────────────────────────────────────────── */

__attribute__((visibility("hidden")))
static BOOL msm_isJailbreakEnvVar(const char *name) {
    if (!name) return NO;

    MSM_STACK(e1, S_ENV_DYLD);         /* DYLD_INSERT_LIBRARIES */
    MSM_STACK(e2, S_ENV_XCTEST);       /* _XCAppTest            */
    MSM_STACK(e3, S_ENV_SUBSTRATE);    /* MobileSubstrate       */
    MSM_STACK(e4, S_ENV_SUBSTITUTE);   /* Substitute            */
    MSM_STACK(e5, S_ENV_SAFEMODE);     /* _MSSafeMode           */
    MSM_STACK(e6, S_ENV_LIBHOOKER);    /* LIBHOOKER             */
    MSM_STACK(e7, S_ENV_INJECTION);    /* INJECTION_BUNDLE      */
    MSM_STACK(e8, S_ENV_FRIDA);        /* frida                 */
    MSM_STACK(e9, S_ENV_FRIDA_SERVER); /* FRIDA_SERVER          */
    MSM_STACK(e10, S_ENV_FRIDA_GADGET);/* FRIDA_GADGET          */

    /* مطابقة دقيقة أو جزئية (strstr) للمتغيرات المشبوهة */
    return (strcasecmp(name, e1) == 0  ||
            strcasecmp(name, e2) == 0  ||
            strstr(name, e3) != NULL   ||  /* أي متغير يحتوي MobileSubstrate */
            strstr(name, e4) != NULL   ||  /* أي متغير يحتوي Substitute */
            strcasecmp(name, e5) == 0  ||
            strcasecmp(name, e6) == 0  ||
            strcasecmp(name, e7) == 0  ||
            strstr(name, e8) != NULL   ||  /* أي متغير يحتوي frida (case-sensitive أفضل لـ frida) */
            strcasecmp(name, e9) == 0  ||  /* FRIDA_SERVER */
            strcasecmp(name, e10) == 0);
}

%hookf(char *, getenv, const char *name) {
    if (msm_isJailbreakEnvVar(name)) return NULL;
    return %orig;
}


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 10 — METHOD SWIZZLING GHOST (Anti-Detection Bypass)                  */
/* يمنع تطبيقات Epic / Tencent من اكتشاف أننا عدّلنا دوالها بالـ Hook        */
/*                                                                             */
/* آلية الكشف المُعطَّلة:                                                      */
/*   IMP imp = method_getImplementation(m);                                    */
/*   dladdr(imp, &info) → يظهر اسم dylib مسمارينا → مكشوف!                   */
/*                                                                             */
/* الحل:                                                                       */
/*   نحصل على اسم الـ symbol → إذا كان _logos_method$ نبحث عن _logos_orig$   */
/*   ونرجع الـ IMP الأصلية للتطبيق — يرى نفسه غير مُعدَّل                    */
/* ─────────────────────────────────────────────────────────────────────────── */

/* Guard ضد الاستدعاء الدوراني (re-entrancy) */
/* ⚠️ NO _Thread_local — يولّد HAS_TLV_DESCRIPTORS → crash على أجهزة غير jailbreak */
/* volatile كافية لمنع التكرار على نفس الـ thread */
static volatile BOOL msm_inSwizzleQuery = NO;

%hookf(IMP, method_getImplementation, Method m) {
    /* منع الاستدعاء الدوراني */
    if (msm_inSwizzleQuery) return %orig;
    msm_inSwizzleQuery = YES;

    IMP imp = %orig;
    msm_inSwizzleQuery = NO;

    if (!imp) return imp;

    /* فحص: هل هذا الـ IMP يخصّ dylib مسماري؟ */
    Dl_info dl;
    memset(&dl, 0, sizeof(dl));
    if (!dladdr((void *)imp, &dl)) return imp;
    if (!dl.dli_sname)             return imp;

    /* Theos يُسمّي trampolines بـ _logos_method$ */
    MSM_STACK(logosMethod, S_LOGOS_METHOD);
    MSM_STACK(logosOrig,   S_LOGOS_ORIG);

    if (strncmp(dl.dli_sname, logosMethod, strlen(logosMethod)) != 0) {
        return imp; /* ليس hook مسماري — أرجع كما هو */
    }

    /* حوّل: _logos_method$Class$method  →  _logos_orig$Class$method */
    const char *suffix = dl.dli_sname + strlen(logosMethod);
    char origSymbol[256] = {0};
    snprintf(origSymbol, sizeof(origSymbol), "%s%s", logosOrig, suffix);

    /* ابحث عن الـ IMP الأصلية */
    void *origImp = dlsym(RTLD_DEFAULT, origSymbol);
    if (origImp) {
        return (IMP)origImp; /* أرجع الأصلية — التطبيق لا يرى أي تعديل */
    }

    return imp; /* لا يوجد أصلي محفوظ — أرجع الـ hook (أفضل من لا شيء) */
}


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 11 — DYLD IMAGE CLOAKING (إخفاء الدايلب من قائمة المكتبات)          */
/*                                                                             */
/* آلية الكشف المُعطَّلة (Hybrid Detection):                                  */
/*   uint32_t n = _dyld_image_count();                                        */
/*   for (i = 0; i < n; i++) {                                                */
/*       const char *name = _dyld_get_image_name(i);                         */
/*       if (strstr(name, ".dylib")) → مكتبة غير Apple = جيلبريك             */
/*   }                                                                         */
/*                                                                             */
/* الحل: نحفظ index الدايلب بدقة عبر dladdr على pointer داخلي —              */
/*   ثم نزيحه من العداد والقائمة كأنه غير موجود.                              */
/* ─────────────────────────────────────────────────────────────────────────── */

static uint32_t s_msm_self_index = UINT32_MAX;

/* يعمل قبل %init — يحفظ index الدايلب بدقة مطلقة عبر dladdr على نفسه */
__attribute__((constructor)) __attribute__((visibility("hidden")))
static void msm_cacheSelfIndex(void) {
    Dl_info dl;
    memset(&dl, 0, sizeof(dl));
    /* نُمرّر pointer على هذه الدالة نفسها — مضمون أنه داخل دايلبنا */
    if (!dladdr((void *)msm_cacheSelfIndex, &dl) || !dl.dli_fname) return;

    uint32_t n = _dyld_image_count();
    for (uint32_t i = 0; i < n; i++) {
        const char *name = _dyld_get_image_name(i);
        if (name && strcmp(name, dl.dli_fname) == 0) {
            s_msm_self_index = i;
            break;
        }
    }
}

/* ─── عدد المكتبات − 1 (يُخفي الدايلب من العداد) ──────────────────────── */
%hookf(uint32_t, _dyld_image_count) {
    uint32_t c = %orig;
    return (s_msm_self_index != UINT32_MAX && c > 0) ? c - 1 : c;
}

/* ─── إزاحة الـ index لتجاوز index الدايلب — كأنه غير موجود ────────────── */
%hookf(const char *, _dyld_get_image_name, uint32_t image_index) {
    if (s_msm_self_index != UINT32_MAX && image_index >= s_msm_self_index)
        return %orig(image_index + 1);
    return %orig;
}

%hookf(const struct mach_header *, _dyld_get_image_header, uint32_t image_index) {
    if (s_msm_self_index != UINT32_MAX && image_index >= s_msm_self_index)
        return %orig(image_index + 1);
    return %orig;
}

%hookf(intptr_t, _dyld_get_image_vmaddr_slide, uint32_t image_index) {
    if (s_msm_self_index != UINT32_MAX && image_index >= s_msm_self_index)
        return %orig(image_index + 1);
    return %orig;
}


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 12 — CLIPBOARD GUARD (Privacy Shield)                                */
/* يمنع التطبيقات من التجسس على الحافظة عند الفتح                            */
/*                                                                             */
/* التطبيقات المستهدفة: TikTok, Facebook, Instagram, Snapchat                 */
/* هذه التطبيقات تقرأ الحافظة تلقائياً لأغراض التتبع والتحليل                */
/*                                                                             */
/* الأثر: التطبيق لا يستطيع قراءة الحافظة — يحمي كلمات المرور والبيانات     */
/* ─────────────────────────────────────────────────────────────────────────── */

%hook UIPasteboard

/* المحتوى النصي
 * IMPORTANT: يجب إرجاع @"" وليس nil — بعض التطبيقات لا تفحص nil وتُكرَش
 * مثال: [pasteboardString length] على nil يعطي 0 لكن بعض التطبيقات تستخدم
 *        CFStringGetCharacters مباشرةً على القيمة بدون فحص null مسبقاً
 */
- (NSString *)string                        { return @""; }
- (NSArray<NSString *> *)strings            { return @[@""]; }

/* المحتوى المتنوع (items dictionary) */
- (NSArray<NSDictionary *> *)items          { return @[]; }
- (NSArray<NSDictionary *> *)pasteboardItems { return @[]; }

/* فحوصات الوجود — تُستخدم للكشف المسبق قبل القراءة */
- (BOOL)hasStrings  { return NO; }
- (BOOL)hasURLs     { return NO; }
- (BOOL)hasImages   { return NO; }
- (BOOL)hasColors   { return NO; }

/* عدد العناصر — يُستخدم في الفحص الأولي */
- (NSInteger)numberOfItems { return 0; }

/* iOS 14+ — الواجهة الجديدة للكشف عن الأنماط */
- (void)detectPatternsForPatterns:(NSSet *)patterns
                completionHandler:(void (^)(NSDictionary *, NSError *))handler {
    if (handler) handler(@{}, nil); /* لا أنماط مكتشفة */
}

- (void)detectValuesForPatterns:(NSSet *)patterns
               completionHandler:(void (^)(NSDictionary *, NSError *))handler {
    if (handler) handler(@{}, nil);
}

/* نسمح بالكتابة — المستخدم يستطيع نسخ نص (فقط القراءة محجوبة) */
/* setString: و setItems: و setObjects: لم تُعدَّل */

%end


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 13 — SAFE MODE (يدوي — بدون استهلاك بطارية)                         */
/*                                                                             */
/* كيفية التفعيل:                                                             */
/*   من تطبيق Mismari+ — زر "Safe Mode" في إعدادات الحماية                  */
/*   يُنشئ/يحذف ملف: Documents/.msm_safemode                                 */
/*   أو من Terminal: touch ~/Documents/.msm_safemode                          */
/*                                                                             */
/* لماذا يدوي وليس Gesture؟                                                   */
/*   الـ KVO على outputVolume يعمل باستمرار طوال حياة التطبيق               */
/*   → يستهلك بطارية + يُعقّد الكود + يحتاج AVFoundation.framework إضافياً  */
/*   → الملف أبسط وأكثر موثوقية — iOS لا يحذفه إلا مع حذف التطبيق          */
/*                                                                             */
/* الحالة عند التشغيل:                                                        */
/*   ملف موجود → return فوراً من %ctor — لا hooks — التطبيق نظيف تماماً     */
/*   ملف غير موجود → %init عادي                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

__attribute__((visibility("hidden")))
static BOOL msm_isSafeModeActive(void) {
    MSM_STACK(flagName, S_SAFEMODE_FLAG); /* ".msm_safemode" */
    NSString *docs = NSSearchPathForDirectoriesInDomains(
        NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
    NSString *path = [docs stringByAppendingPathComponent:
                      [NSString stringWithUTF8String:flagName]];
    return [[NSFileManager defaultManager] fileExistsAtPath:path];
}


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: INIT — تفعيل جميع الـ Hooks (Dynamic Injection)                     */
/*                                                                             */
/* %init(_ungrouped) = الحماية الأساسية دائماً (OCSP + SSL + Bundle ID)       */
/* الـ Hooks الإضافية تُفعَّل بناءً على نوع التطبيق:                          */
/*   → تطبيق ألعاب [game في الـ Bundle ID]: يحتاج File Path Shadow أكثر      */
/*   → تطبيق عادي: يحتاج Stealth Mode الكامل                                  */
/*                                                                             */
/* ملاحظة: حالياً كل الـ Hooks في _ungrouped — الـ %init الواحد يكفي        */
/* في المستقبل: يمكن تقسيمها لـ %group GameProtection و %group StealthMode   */
/* ─────────────────────────────────────────────────────────────────────────── */

%ctor {
    @autoreleasepool {
        /*
         * STEP 1 — Safe Mode check (لا overhead — fstat() واحدة فقط)
         * إذا كان الملف موجوداً → لا %init — التطبيق يعمل بدون أي Hook
         * يُفعَّل/يُعطَّل من Mismari+ بدون إعادة تثبيت الدايلب
         */
        if (msm_isSafeModeActive()) {
            NSLog(@"[Mismari] Safe Mode Active — Hooks Disabled for %@",
                  [[NSBundle mainBundle] bundleIdentifier]);
            return;
        }

        /*
         * STEP 2 — Dynamic Injection بناءً على نوع التطبيق
         *
         * الأمثل للمستقبل عند تقسيم الـ Hooks لـ Groups:
         *
         *   NSString *bid = [[NSBundle mainBundle] bundleIdentifier].lowercaseString;
         *   %init(_ungrouped);   // الحماية الأساسية: OCSP + SSL + Bundle ID Guard
         *   if ([bid containsString:@"game"] || [bid containsString:@"arcade"])
         *       %init(GameProtection);
         *   else
         *       %init(StealthMode);
         *
         * حالياً: %init واحد يُفعِّل كل الـ Hooks (Modules 2-12)
         */
        %init;

        /* Module 1 (Anti-Debug) + Module 11 cache يعملان عبر __attribute__((constructor)) */
    }
}
