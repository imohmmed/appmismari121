// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Mismari Anti-Revoke + JB Bypass v6                                      ║
// ║  Plain ObjC — xcrun clang — NO Theos                                    ║
// ║                                                                          ║
// ║  BUILD: make -f Makefile.plain release                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <Security/Security.h>
#import <sys/stat.h>
#import <dlfcn.h>
#import <errno.h>

#include "fishhook.h"
#include "MSMStrings.h"

// ══════════════════════════════════════════════════════════════════════════════
// MARK: Shared — Jailbreak Path Detection
// ══════════════════════════════════════════════════════════════════════════════

// مسارات الجيلبريك المشبوهة — مُقسَّمة لمجموعتين:
//   • prefix: كل مسار يبدأ بهذا المقطع
//   • exact:  مطابقة كاملة فقط
static const char * const kJBPrefixes[] = {
    "/private/var/lib/apt",
    "/private/var/lib/cydia",
    "/private/var/stash",
    "/private/var/mobile/Library/SBSettings",
    "/Library/MobileSubstrate",
    "/Library/PreferenceLoader",
    "/Library/MobileSafari",  // tweaks
    "/usr/lib/tweaks",
    "/usr/lib/TweakInject",
    "/usr/lib/substitute",
    "/usr/lib/substrate",
    "/var/jb/",
    "/var/LIB/",
    "/private/preboot/",
    "/private/var/containers/Bundle/tweakinject",
    NULL
};

static const char * const kJBExact[] = {
    "/Applications/Cydia.app",
    "/Applications/Sileo.app",
    "/Applications/Zebra.app",
    "/Applications/Filza.app",
    "/Applications/Evasi0n.app",
    "/Applications/unc0ver.app",
    "/var/lib/cydia",
    "/var/stash",
    "/bin/bash",
    "/bin/sh",
    "/usr/sbin/sshd",
    "/usr/libexec/sftp-server",
    "/usr/bin/sshd",
    "/usr/bin/cycript",
    "/etc/apt",
    "/etc/ssh/sshd_config",
    "/private/etc/apt",
    "/private/etc/ssh/sshd_config",
    NULL
};

static BOOL msm_isSuspiciousPath(const char *path) {
    if (!path || path[0] == '\0') return NO;

    // Prefix check
    for (int i = 0; kJBPrefixes[i] != NULL; i++) {
        const char *prefix = kJBPrefixes[i];
        size_t len = strlen(prefix);
        if (strncmp(path, prefix, len) == 0) return YES;
    }

    // Exact check
    for (int i = 0; kJBExact[i] != NULL; i++) {
        if (strcmp(path, kJBExact[i]) == 0) return YES;
    }

    return NO;
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 1 — File System Shadow
// يُخفي ملفات الجيلبريك عن فحوصات stat/lstat/access
// آمن: لا نُغلِّف open أو fopen (خطيرة جداً)
// ══════════════════════════════════════════════════════════════════════════════

typedef int (*stat_f)(const char *, struct stat *);
typedef int (*lstat_f)(const char *, struct stat *);
typedef int (*access_f)(const char *, int);

static stat_f   orig_stat   = NULL;
static lstat_f  orig_lstat  = NULL;
static access_f orig_access = NULL;

static int hook_stat(const char *path, struct stat *buf) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    return orig_stat ? orig_stat(path, buf) : -1;
}
static int hook_lstat(const char *path, struct stat *buf) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    return orig_lstat ? orig_lstat(path, buf) : -1;
}
static int hook_access(const char *path, int mode) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    return orig_access ? orig_access(path, mode) : -1;
}

// NSFileManager swizzle
typedef BOOL (*fileExists_f)(id, SEL, NSString *);
typedef BOOL (*fileExistsDir_f)(id, SEL, NSString *, BOOL *);
static fileExists_f    orig_fileExists    = NULL;
static fileExistsDir_f orig_fileExistsDir = NULL;

static BOOL hook_fileExists(id self, SEL sel, NSString *path) {
    if (path && msm_isSuspiciousPath(path.UTF8String)) return NO;
    return orig_fileExists ? orig_fileExists(self, sel, path) : NO;
}
static BOOL hook_fileExistsDir(id self, SEL sel, NSString *path, BOOL *isDir) {
    if (path && msm_isSuspiciousPath(path.UTF8String)) {
        if (isDir) *isDir = NO;
        return NO;
    }
    return orig_fileExistsDir ? orig_fileExistsDir(self, sel, path, isDir) : NO;
}

static void installFileShadow(void) {
    // fishhook على الدوال الآمنة فقط (stat/lstat/access)
    struct rebinding hooks[] = {
        {"stat",   (void *)hook_stat,   (void **)&orig_stat},
        {"lstat",  (void *)hook_lstat,  (void **)&orig_lstat},
        {"access", (void *)hook_access, (void **)&orig_access},
    };
    rebind_symbols(hooks, 3);

    // NSFileManager ObjC swizzle
    Class cls = objc_getClass("NSFileManager");
    if (!cls) return;

    SEL s1 = sel_registerName("fileExistsAtPath:");
    Method m1 = class_getInstanceMethod(cls, s1);
    if (m1) {
        orig_fileExists = (fileExists_f)method_getImplementation(m1);
        method_setImplementation(m1, (IMP)hook_fileExists);
    }
    SEL s2 = sel_registerName("fileExistsAtPath:isDirectory:");
    Method m2 = class_getInstanceMethod(cls, s2);
    if (m2) {
        orig_fileExistsDir = (fileExistsDir_f)method_getImplementation(m2);
        method_setImplementation(m2, (IMP)hook_fileExistsDir);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 2 — URL Scheme Filter (canOpenURL)
// يمنع كشف الجيلبريك عبر URL schemes
// ══════════════════════════════════════════════════════════════════════════════

static const char * const kJBSchemes[] = {
    "cydia", "sileo", "zbra", "filza",
    "undecimus", "unc0ver", "palera1n", "checkra1n",
    NULL
};

typedef BOOL (*canOpenURL_f)(id, SEL, NSURL *);
static canOpenURL_f orig_canOpenURL = NULL;

static BOOL hook_canOpenURL(id self, SEL sel, NSURL *url) {
    if (url) {
        const char *scheme = [url.scheme.lowercaseString UTF8String];
        if (scheme) {
            for (int i = 0; kJBSchemes[i] != NULL; i++) {
                if (strcmp(scheme, kJBSchemes[i]) == 0) return NO;
            }
        }
    }
    return orig_canOpenURL ? orig_canOpenURL(self, sel, url) : NO;
}

static void installURLSchemeFilter(void) {
    Class cls = objc_getClass("UIApplication");
    if (!cls) return;
    SEL sel = sel_registerName("canOpenURL:");
    Method m = class_getInstanceMethod(cls, sel);
    if (!m) return;
    orig_canOpenURL = (canOpenURL_f)method_getImplementation(m);
    method_setImplementation(m, (IMP)hook_canOpenURL);
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 3 — OCSP / CRL Block (Anti-Revoke)
// ══════════════════════════════════════════════════════════════════════════════

static BOOL msm_isRevocationHost(NSString *host) {
    if (!host || host.length == 0) return NO;
    if ([host hasSuffix:@"apple.com"] &&
        ([host hasPrefix:@"ocsp"] || [host hasPrefix:@"crl"] ||
         [host hasPrefix:@"valid"] ||
         [host rangeOfString:@"ocsp"].location != NSNotFound)) {
        return YES;
    }
    return NO;
}

static NSData *msm_fakeOCSP(void) {
    static const uint8_t kOCSP[] = { 0x30, 0x03, 0x0A, 0x01, 0x00 };
    return [NSData dataWithBytes:kOCSP length:5];
}

static NSHTTPURLResponse *msm_fakeResp(NSURL *url) {
    if (!url) return nil;
    return [[NSHTTPURLResponse alloc] initWithURL:url
                                       statusCode:200
                                      HTTPVersion:@"HTTP/1.1"
                                     headerFields:@{
        @"Content-Type":   @"application/ocsp-response",
        @"Content-Length": @"5",
        @"Cache-Control":  @"max-age=604800",
    }];
}

typedef NSURLSessionDataTask     *(*dataTask_f)(id, SEL, NSURLRequest *, id);
typedef NSURLSessionDataTask     *(*dataTaskURL_f)(id, SEL, NSURL *, id);
typedef NSURLSessionDownloadTask *(*downloadTask_f)(id, SEL, NSURLRequest *, id);

static dataTask_f     orig_dataTask     = NULL;
static dataTaskURL_f  orig_dataTaskURL  = NULL;
static downloadTask_f orig_downloadTask = NULL;

static NSURLSessionDataTask *hook_dataTask(id self, SEL sel, NSURLRequest *req, id handler) {
    if (req && msm_isRevocationHost(req.URL.host.lowercaseString)) {
        void (^cb)(NSData *, NSURLResponse *, NSError *) = handler;
        if (cb) cb(msm_fakeOCSP(), msm_fakeResp(req.URL), nil);
        return nil;
    }
    return orig_dataTask ? orig_dataTask(self, sel, req, handler) : nil;
}

static NSURLSessionDataTask *hook_dataTaskURL(id self, SEL sel, NSURL *url, id handler) {
    if (url && msm_isRevocationHost(url.host.lowercaseString)) {
        void (^cb)(NSData *, NSURLResponse *, NSError *) = handler;
        if (cb) cb(msm_fakeOCSP(), msm_fakeResp(url), nil);
        return nil;
    }
    return orig_dataTaskURL ? orig_dataTaskURL(self, sel, url, handler) : nil;
}

static NSURLSessionDownloadTask *hook_downloadTask(id self, SEL sel, NSURLRequest *req, id handler) {
    if (req && msm_isRevocationHost(req.URL.host.lowercaseString)) {
        void (^cb)(NSURL *, NSURLResponse *, NSError *) = handler;
        if (cb) cb(nil, msm_fakeResp(req.URL), nil);
        return nil;
    }
    return orig_downloadTask ? orig_downloadTask(self, sel, req, handler) : nil;
}

static void installOCSPBlock(void) {
    Class cls = objc_getClass("NSURLSession");
    if (!cls) return;

    SEL s1 = sel_registerName("dataTaskWithRequest:completionHandler:");
    Method m1 = class_getInstanceMethod(cls, s1);
    if (m1) {
        orig_dataTask = (dataTask_f)method_getImplementation(m1);
        method_setImplementation(m1, (IMP)hook_dataTask);
    }
    SEL s2 = sel_registerName("dataTaskWithURL:completionHandler:");
    Method m2 = class_getInstanceMethod(cls, s2);
    if (m2) {
        orig_dataTaskURL = (dataTaskURL_f)method_getImplementation(m2);
        method_setImplementation(m2, (IMP)hook_dataTaskURL);
    }
    SEL s3 = sel_registerName("downloadTaskWithRequest:completionHandler:");
    Method m3 = class_getInstanceMethod(cls, s3);
    if (m3) {
        orig_downloadTask = (downloadTask_f)method_getImplementation(m3);
        method_setImplementation(m3, (IMP)hook_downloadTask);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 4 — SSL Unpinning (SecTrust fishhook)
// ══════════════════════════════════════════════════════════════════════════════

typedef OSStatus (*SecTrustEval_f)(SecTrustRef, SecTrustResultType *);
typedef bool     (*SecTrustEvalErr_f)(SecTrustRef, CFErrorRef *);

static SecTrustEval_f    orig_SecTrustEvaluate         = NULL;
static SecTrustEvalErr_f orig_SecTrustEvaluateWithError = NULL;

static OSStatus hook_SecTrustEvaluate(SecTrustRef t, SecTrustResultType *r) {
    if (orig_SecTrustEvaluate) orig_SecTrustEvaluate(t, r);
    if (r) *r = kSecTrustResultProceed;
    return errSecSuccess;
}
static bool hook_SecTrustEvaluateWithError(SecTrustRef t, CFErrorRef *e) {
    if (orig_SecTrustEvaluateWithError) orig_SecTrustEvaluateWithError(t, e);
    if (e && *e) { CFRelease(*e); *e = NULL; }
    return true;
}

static void installSSLUnpin(void) {
    struct rebinding hooks[] = {
        {"SecTrustEvaluate",
         (void *)hook_SecTrustEvaluate,
         (void **)&orig_SecTrustEvaluate},
        {"SecTrustEvaluateWithError",
         (void *)hook_SecTrustEvaluateWithError,
         (void **)&orig_SecTrustEvaluateWithError},
    };
    rebind_symbols(hooks, 2);
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 5 — Bundle ID Guard
// يُعيد Bundle ID الأصلي للتطبيق (ضروري للتكرار)
// ══════════════════════════════════════════════════════════════════════════════

typedef NSString *(*bundleID_f)(id, SEL);
static bundleID_f orig_bundleIdentifier = NULL;
static NSString  *_msm_realBundleID    = nil;

static NSString *hook_bundleIdentifier(id self, SEL sel) {
    NSString *orig = orig_bundleIdentifier ? orig_bundleIdentifier(self, sel) : nil;
    // حفظ أول Bundle ID (هو الـ bundle ID اللي غيّره zsign)
    // نُعيده دائماً لمنع كشف التغيير
    if (!_msm_realBundleID && orig.length > 0)
        _msm_realBundleID = [orig copy];
    return _msm_realBundleID ?: orig;
}

static void installBundleIDGuard(void) {
    Class cls = objc_getClass("NSBundle");
    if (!cls) return;
    SEL sel = sel_registerName("bundleIdentifier");
    Method m = class_getInstanceMethod(cls, sel);
    if (!m) return;
    orig_bundleIdentifier = (bundleID_f)method_getImplementation(m);
    method_setImplementation(m, (IMP)hook_bundleIdentifier);
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MAIN CONSTRUCTOR
// ══════════════════════════════════════════════════════════════════════════════

__attribute__((constructor)) __attribute__((visibility("hidden")))
static void MismariInit(void) {
    @autoreleasepool {
        // 1. إخفاء ملفات الجيلبريك (stat/lstat/access + NSFileManager)
        installFileShadow();

        // 2. منع فتح URL schemes الجيلبريك (cydia://, sileo://, ...)
        installURLSchemeFilter();

        // 3. حجب OCSP/CRL (منع إلغاء التوقيع)
        installOCSPBlock();

        // 4. تجاوز SSL pinning
        installSSLUnpin();

        // 5. حماية Bundle ID (مهم للتكرار)
        installBundleIDGuard();
    }
}
