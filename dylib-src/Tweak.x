/*
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║       Mismari Anti-Revoke & Protection Dylib v3.0                      ║
 * ║       Build: cd dylib-src && make                                      ║
 * ║       Requirements: Theos installed on macOS                           ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  MODULES:                                                              ║
 * ║  1.  Anti-Debugging       — ptrace + sysctl                           ║
 * ║  2.  OCSP Block           — NSURLSession + NSURLConnection hooks       ║
 * ║  3.  SSL Unpinning        — SecTrust hooks                            ║
 * ║  4.  Bundle ID Guard      — Sideload detection bypass                  ║
 * ║  5.  Fake Device Info     — UIDevice hooks (Anti-Ban/Tracking)         ║
 * ║  6.  File Path Shadow     — access/stat/lstat/fopen/open hooks         ║
 * ║  7.  (محذوف) Background AutoKill — كان يكسر تحميلات اليوتيوب/سبوتيفاي ║
 * ║  8.  URL Scheme Filter    — canOpenURL: JB app scheme blocking         ║
 * ║  9.  Env Variable Hide    — getenv hook (hides DYLD / Substrate vars)  ║
 * ║  10. Swizzle Ghost        — method_getImplementation camouflage        ║
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

%hook NSURLSession

- (NSURLSessionDataTask *)dataTaskWithRequest:(NSURLRequest *)request
                            completionHandler:(void (^)(NSData *, NSURLResponse *, NSError *))handler {
    if (msm_isRevocationHost(request.URL.host)) {
        if (handler) handler([NSData data], nil, nil);
        return nil;
    }
    return %orig;
}

- (NSURLSessionDataTask *)dataTaskWithURL:(NSURL *)url
                        completionHandler:(void (^)(NSData *, NSURLResponse *, NSError *))handler {
    if (msm_isRevocationHost(url.host)) {
        if (handler) handler([NSData data], nil, nil);
        return nil;
    }
    return %orig;
}

- (NSURLSessionDownloadTask *)downloadTaskWithRequest:(NSURLRequest *)request
                                    completionHandler:(void (^)(NSURL *, NSURLResponse *, NSError *))handler {
    if (msm_isRevocationHost(request.URL.host)) {
        if (handler) handler(nil, nil, nil);
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
        if (handler) handler(nil, [NSData data], nil);
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

%hook UIDevice

- (NSUUID *)identifierForVendor {
    return nil;
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

    MSM_STACK(p1, S_PATH1); /* /Library/MobileSubstrate */
    MSM_STACK(p2, S_PATH2); /* /var/lib/cydia */
    MSM_STACK(p3, S_PATH3); /* /usr/lib/tweaks */
    MSM_STACK(p4, S_PATH4); /* /var/jb */
    MSM_STACK(p5, S_PATH5); /* /usr/bin/cycript */
    MSM_STACK(p6, S_PATH6); /* /var/mobile/Applications */

    return (strstr(path, p1) ||
            strstr(path, p2) ||
            strstr(path, p3) ||
            strstr(path, p4) ||
            strstr(path, p5) ||
            strstr(path, p6));
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

    MSM_STACK(e1, S_ENV_DYLD);       /* DYLD_INSERT_LIBRARIES */
    MSM_STACK(e2, S_ENV_XCTEST);     /* _XCAppTest            */
    MSM_STACK(e3, S_ENV_SUBSTRATE);  /* MobileSubstrate       */
    MSM_STACK(e4, S_ENV_SUBSTITUTE); /* Substitute            */
    MSM_STACK(e5, S_ENV_SAFEMODE);   /* _MSSafeMode           */
    MSM_STACK(e6, S_ENV_LIBHOOKER);  /* LIBHOOKER             */
    MSM_STACK(e7, S_ENV_INJECTION);  /* INJECTION_BUNDLE      */

    /* مطابقة دقيقة أو جزئية (strstr) للمتغيرات المشبوهة */
    return (strcasecmp(name, e1) == 0 ||
            strcasecmp(name, e2) == 0 ||
            strstr(name, e3) != NULL   ||  /* أي متغير يحتوي MobileSubstrate */
            strstr(name, e4) != NULL   ||  /* أي متغير يحتوي Substitute */
            strcasecmp(name, e5) == 0 ||
            strcasecmp(name, e6) == 0 ||
            strcasecmp(name, e7) == 0);
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
static _Thread_local BOOL msm_inSwizzleQuery = NO;

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
/* MARK: INIT — تفعيل جميع الـ Hooks                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

%ctor {
    @autoreleasepool {
        %init; /* يفعّل modules 2-10 تلقائياً */
        /* Module 1 (Anti-Debug) يعمل عبر __attribute__((constructor)) منفصل */
    }
}
