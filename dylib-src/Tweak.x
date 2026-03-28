/*
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║       Mismari Anti-Revoke & Protection Dylib v2.0                      ║
 * ║       Build: cd dylib-src && make                                      ║
 * ║       Requirements: Theos installed on macOS                           ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  MODULES:                                                              ║
 * ║  1. Anti-Debugging      — ptrace + sysctl                             ║
 * ║  2. OCSP Block          — NSURLSession + NSURLConnection hooks         ║
 * ║  3. SSL Unpinning       — SecTrust hooks                              ║
 * ║  4. Bundle ID Guard     — Sideload detection bypass                    ║
 * ║  5. Fake Device Info    — UIDevice hooks                               ║
 * ║  6. File Path Shadow    — access/stat/fopen hooks                      ║
 * ║  7. Background AutoKill — UIApplication background task control        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <Security/Security.h>
#import <objc/runtime.h>

#include <sys/ptrace.h>
#include <sys/sysctl.h>
#include <sys/stat.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>

#include "MSMStrings.h"

/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 1 — ANTI-DEBUGGING                                                   */
/* يمنع lldb / cycript / frida من الاتصال بالتطبيق                            */
/* يعمل قبل main() مباشرةً                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

__attribute__((constructor)) __attribute__((visibility("hidden")))
static void msm_antiDebug(void) {
    /* Block any debugger from attaching */
    ptrace(PT_DENY_ATTACH, 0, 0, 0);

    /* sysctl double-check */
    int mib[4] = { CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid() };
    struct kinfo_proc info = {};
    size_t sz = sizeof(info);
    if (sysctl(mib, 4, &info, &sz, NULL, 0) == 0) {
        if (info.kp_proc.p_flag & P_TRACED) {
            exit(0); /* هرب إذا اكتُشفت */
        }
    }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 2 — OCSP / CRL BLOCK (قلب الـ Anti-Revoke)                          */
/* يمنع iOS من التحقق إذا تم إلغاء الشهادة                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

__attribute__((visibility("hidden")))
static BOOL msm_isRevocationHost(NSString *host) {
    if (!host) return NO;
    NSString *h = host.lowercaseString;

    char *d1 = MSM_S(S_OCSP1);
    char *d2 = MSM_S(S_OCSP2);
    char *d3 = MSM_S(S_CRL);
    char *d4 = MSM_S(S_VALID);

    BOOL blocked = ([h isEqualToString:@(d1)] ||
                    [h isEqualToString:@(d2)] ||
                    [h isEqualToString:@(d3)] ||
                    [h isEqualToString:@(d4)] ||
                    [h hasSuffix:@".apple.com"] == NO ? NO :  /* فقط apple */
                    ([h containsString:@"ocsp"] || [h containsString:@"crl"]));

    if (d1) free(d1); if (d2) free(d2); if (d3) free(d3); if (d4) free(d4);
    return blocked;
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
/* يقبل أي شهادة SSL — يعمل الـ Ad-Blocker بسلاسة                            */
/* ─────────────────────────────────────────────────────────────────────────── */

%hookf(OSStatus, SecTrustEvaluate, SecTrustRef trust, SecTrustResultType *result) {
    %orig;
    if (result) *result = kSecTrustResultProceed;
    return errSecSuccess;
}

%hookf(bool, SecTrustEvaluateWithError, SecTrustRef trust, CFErrorRef *error) {
    if (error) *error = NULL;
    return true;
}

/* iOS 15+ API */
%hookf(SecTrustResultType, SecTrustGetTrustResult, SecTrustRef trust, SecTrustResultType *result) {
    if (result) *result = kSecTrustResultProceed;
    return kSecTrustResultProceed;
}


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 4 — BUNDLE ID GUARD (Sideload Detection Bypass)                      */
/* يمنع التطبيق من اكتشاف أنه مثبت خارج App Store                            */
/* ─────────────────────────────────────────────────────────────────────────── */

static NSString *_msm_bundleID = nil;

%hook NSBundle

- (NSString *)bundleIdentifier {
    NSString *orig = %orig;
    /* احفظ الـ Bundle ID الأصلي أول مرة */
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
/* يعطي قيم وهمية لأي تطبيق يحاول تتبع جهازك أو عمل Device Ban               */
/* ─────────────────────────────────────────────────────────────────────────── */

%hook UIDevice

/* إخفاء IDFV — يمنع تتبع الجهاز */
- (NSUUID *)identifierForVendor {
    return nil; /* nil يمنع التطبيق من بناء fingerprint دائم */
}

/* اسم جهاز جنيريك */
- (NSString *)name {
    return @"iPhone";
}

/* إخفاء موديل الجهاز الحقيقي */
- (NSString *)model {
    return @"iPhone";
}

- (NSString *)localizedModel {
    return @"iPhone";
}

/* iOS version — أبقِها حقيقية لتجنب الكشف */
/* لا تعدّل systemVersion */

%end


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: 6 — FILE PATH SHADOW (Jailbreak & Injection Detection Bypass)        */
/* يخفي مسارات MobileSubstrate / Cydia / Tweaks عن التطبيقات الذكية           */
/* ─────────────────────────────────────────────────────────────────────────── */

__attribute__((visibility("hidden")))
static BOOL msm_isSuspiciousPath(const char *path) {
    if (!path) return NO;

    char *p1 = MSM_S(S_PATH1); /* /Library/MobileSubstrate */
    char *p2 = MSM_S(S_PATH2); /* /var/lib/cydia */
    char *p3 = MSM_S(S_PATH3); /* /usr/lib/tweaks */
    char *p4 = MSM_S(S_PATH4); /* /var/jb */
    char *p5 = MSM_S(S_PATH5); /* /usr/bin/cycript */
    char *p6 = MSM_S(S_PATH6); /* /var/mobile/Applications */

    BOOL bad = (p1 && strstr(path, p1)) ||
               (p2 && strstr(path, p2)) ||
               (p3 && strstr(path, p3)) ||
               (p4 && strstr(path, p4)) ||
               (p5 && strstr(path, p5)) ||
               (p6 && strstr(path, p6));

    if (p1) free(p1); if (p2) free(p2); if (p3) free(p3);
    if (p4) free(p4); if (p5) free(p5); if (p6) free(p6);
    return bad;
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
/* MARK: 7 — BACKGROUND TASK AUTO-KILL                                        */
/* ينهي العمليات غير الضرورية في الخلفية فور خروج المستخدم                   */
/* يقلل استهلاك البطارية ويمنع النظام من Flagging التطبيق                     */
/* ─────────────────────────────────────────────────────────────────────────── */

%hook UIApplication

- (UIBackgroundTaskIdentifier)beginBackgroundTaskWithExpirationHandler:(void (^)(void))handler {
    UIBackgroundTaskIdentifier task = %orig;
    if (task != UIBackgroundTaskInvalid) {
        __weak UIApplication *weakSelf = self;
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)),
            dispatch_get_main_queue(),
            ^{
                [weakSelf endBackgroundTask:task];
            }
        );
    }
    return task;
}

- (UIBackgroundTaskIdentifier)beginBackgroundTaskWithName:(NSString *)name
                                        expirationHandler:(void (^)(void))handler {
    UIBackgroundTaskIdentifier task = %orig;
    if (task != UIBackgroundTaskInvalid) {
        __weak UIApplication *weakSelf = self;
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)),
            dispatch_get_main_queue(),
            ^{
                [weakSelf endBackgroundTask:task];
            }
        );
    }
    return task;
}

%end


/* ─────────────────────────────────────────────────────────────────────────── */
/* MARK: INIT — تفعيل جميع الـ Hooks                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

%ctor {
    @autoreleasepool {
        %init; /* يفعّل جميع الـ hooks تلقائياً */
    }
}
