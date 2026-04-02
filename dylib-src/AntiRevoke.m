// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Mismari Anti-Revoke Dylib — بدون Theos / Logos                         ║
// ║  Plain ObjC + fishhook — يُبنى بـ xcrun clang مباشرة                   ║
// ║                                                                          ║
// ║  البناء:                                                                 ║
// ║    make -f Makefile.plain                                                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <Security/Security.h>
#import <dlfcn.h>
#import <sys/stat.h>
#import <sys/sysctl.h>
#import <sys/types.h>
#import <fcntl.h>
#import <errno.h>
#import <mach-o/dyld.h>
// ptrace غير موجود كـ header في iOS SDK — نُعرّفه يدوياً
#define PT_DENY_ATTACH 31
extern int ptrace(int, pid_t, caddr_t, int);

#include "fishhook.h"
#include "MSMStrings.h"

// ══════════════════════════════════════════════════════════════════════════════
// MARK: Helpers — OCSP detection
// ══════════════════════════════════════════════════════════════════════════════

__attribute__((visibility("hidden")))
static BOOL msm_isRevocationHost(NSString *host) {
    if (!host) return NO;
    const char *h = [host.lowercaseString UTF8String];
    if (!h) return NO;
    MSM_STACK(d1, S_OCSP1);
    MSM_STACK(d2, S_OCSP2);
    MSM_STACK(d3, S_CRL);
    MSM_STACK(d4, S_VALID);
    if (strcasecmp(h, d1) == 0 || strcasecmp(h, d2) == 0 ||
        strcasecmp(h, d3) == 0 || strcasecmp(h, d4) == 0) return YES;
    if (strstr(h, "apple.com") &&
        (strstr(h, "ocsp") || strstr(h, "crl") ||
         strstr(h, "valid") || strstr(h, "cert"))) return YES;
    return NO;
}

__attribute__((visibility("hidden")))
static NSData *msm_fakeOCSPData(void) {
    static const uint8_t kOCSP[] = { 0x30, 0x03, 0x0A, 0x01, 0x00 };
    return [NSData dataWithBytes:kOCSP length:sizeof(kOCSP)];
}

__attribute__((visibility("hidden")))
static NSHTTPURLResponse *msm_fakeOCSPResponse(NSURL *url) {
    NSDictionary *h = @{
        @"Content-Type":   @"application/ocsp-response",
        @"Content-Length": @"5",
        @"Cache-Control":  @"max-age=604800",
    };
    return [[NSHTTPURLResponse alloc] initWithURL:url
                                       statusCode:200
                                      HTTPVersion:@"HTTP/1.1"
                                     headerFields:h];
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: JB path detection
// ══════════════════════════════════════════════════════════════════════════════

__attribute__((visibility("hidden")))
static BOOL msm_isSuspiciousPath(const char *path) {
    if (!path) return NO;
    MSM_STACK(p1, S_PATH1);
    MSM_STACK(p2, S_PATH2);
    MSM_STACK(p3, S_PATH3);
    MSM_STACK(p4, S_PATH4);
    MSM_STACK(p5, S_PATH5);
    MSM_STACK(p6, S_PATH6);
    MSM_STACK(p7,  S_PATH_PREBOOT);
    MSM_STACK(p8,  S_PATH_JB_USR);
    MSM_STACK(p9,  S_PATH_JB_LIB);
    MSM_STACK(p10, S_PATH_DOTFILE);
    return (strstr(path, p1)  || strstr(path, p2)  ||
            strstr(path, p3)  || strstr(path, p4)  ||
            strstr(path, p5)  || strstr(path, p6)  ||
            strstr(path, p7)  || strstr(path, p8)  ||
            strstr(path, p9)  || strstr(path, p10));
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 2 — OCSP Block (NSURLSession swizzle)
// ══════════════════════════════════════════════════════════════════════════════

static NSURLSessionDataTask *(*orig_dataTaskWithRequest)(id, SEL, NSURLRequest *, id) = NULL;
static NSURLSessionDataTask *(*orig_dataTaskWithURL)(id, SEL, NSURL *, id)            = NULL;
static NSURLSessionDownloadTask *(*orig_downloadTaskWithRequest)(id, SEL, NSURLRequest *, id) = NULL;

static NSURLSessionDataTask *hook_dataTaskWithRequest(id self, SEL sel,
    NSURLRequest *request, id handler) {
    if (msm_isRevocationHost(request.URL.host)) {
        void (^cb)(NSData *, NSURLResponse *, NSError *) = handler;
        if (cb) cb(msm_fakeOCSPData(), msm_fakeOCSPResponse(request.URL), nil);
        return nil;
    }
    return orig_dataTaskWithRequest(self, sel, request, handler);
}

static NSURLSessionDataTask *hook_dataTaskWithURL(id self, SEL sel,
    NSURL *url, id handler) {
    if (msm_isRevocationHost(url.host)) {
        void (^cb)(NSData *, NSURLResponse *, NSError *) = handler;
        if (cb) cb(msm_fakeOCSPData(), msm_fakeOCSPResponse(url), nil);
        return nil;
    }
    return orig_dataTaskWithURL(self, sel, url, handler);
}

static NSURLSessionDownloadTask *hook_downloadTaskWithRequest(id self, SEL sel,
    NSURLRequest *request, id handler) {
    if (msm_isRevocationHost(request.URL.host)) {
        void (^cb)(NSURL *, NSURLResponse *, NSError *) = handler;
        if (cb) cb(nil, msm_fakeOCSPResponse(request.URL), nil);
        return nil;
    }
    return orig_downloadTaskWithRequest(self, sel, request, handler);
}

static void installOCSPBlock(void) {
    Class cls = objc_getClass("NSURLSession");
    if (!cls) return;

    SEL s1 = sel_registerName("dataTaskWithRequest:completionHandler:");
    Method m1 = class_getInstanceMethod(cls, s1);
    if (m1) {
        orig_dataTaskWithRequest = (NSURLSessionDataTask *(*)(id,SEL,NSURLRequest*,id))
            method_getImplementation(m1);
        method_setImplementation(m1, (IMP)hook_dataTaskWithRequest);
    }

    SEL s2 = sel_registerName("dataTaskWithURL:completionHandler:");
    Method m2 = class_getInstanceMethod(cls, s2);
    if (m2) {
        orig_dataTaskWithURL = (NSURLSessionDataTask *(*)(id,SEL,NSURL*,id))
            method_getImplementation(m2);
        method_setImplementation(m2, (IMP)hook_dataTaskWithURL);
    }

    SEL s3 = sel_registerName("downloadTaskWithRequest:completionHandler:");
    Method m3 = class_getInstanceMethod(cls, s3);
    if (m3) {
        orig_downloadTaskWithRequest = (NSURLSessionDownloadTask *(*)(id,SEL,NSURLRequest*,id))
            method_getImplementation(m3);
        method_setImplementation(m3, (IMP)hook_downloadTaskWithRequest);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 3 — SSL Unpinning (fishhook)
// ══════════════════════════════════════════════════════════════════════════════

typedef OSStatus (*SecTrustEvaluate_f)(SecTrustRef, SecTrustResultType *);
typedef bool (*SecTrustEvaluateWithError_f)(SecTrustRef, CFErrorRef *);

static SecTrustEvaluate_f          orig_SecTrustEvaluate          = NULL;
static SecTrustEvaluateWithError_f orig_SecTrustEvaluateWithError  = NULL;

static OSStatus hook_SecTrustEvaluate(SecTrustRef trust, SecTrustResultType *result) {
    OSStatus r = orig_SecTrustEvaluate(trust, result);
    if (result) *result = kSecTrustResultProceed;
    return errSecSuccess;
}

static bool hook_SecTrustEvaluateWithError(SecTrustRef trust, CFErrorRef *error) {
    if (error) *error = NULL;
    return true;
}

static void installSSLUnpin(void) {
    struct rebinding hooks[] = {
        {"SecTrustEvaluate",          (void *)hook_SecTrustEvaluate,
                                      (void **)&orig_SecTrustEvaluate},
        {"SecTrustEvaluateWithError", (void *)hook_SecTrustEvaluateWithError,
                                      (void **)&orig_SecTrustEvaluateWithError},
    };
    rebind_symbols(hooks, 2);
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 4 — Bundle ID Guard
// ══════════════════════════════════════════════════════════════════════════════

static NSString *(*orig_bundleIdentifier)(id, SEL)      = NULL;
static NSDictionary *(*orig_infoDictionary)(id, SEL)    = NULL;
static NSString *_msm_bundleID = nil;

static NSString *hook_bundleIdentifier(id self, SEL sel) {
    NSString *orig = orig_bundleIdentifier(self, sel);
    if (!_msm_bundleID && orig.length > 0) _msm_bundleID = [orig copy];
    return _msm_bundleID ?: orig;
}

static NSDictionary *hook_infoDictionary(id self, SEL sel) {
    NSDictionary *orig = orig_infoDictionary(self, sel);
    if (!orig) return orig;
    NSMutableDictionary *info = [orig mutableCopy];
    if (_msm_bundleID) info[@"CFBundleIdentifier"] = _msm_bundleID;
    return info;
}

static void installBundleIDGuard(void) {
    Class cls = objc_getClass("NSBundle");
    if (!cls) return;

    SEL s1 = sel_registerName("bundleIdentifier");
    Method m1 = class_getInstanceMethod(cls, s1);
    if (m1) {
        orig_bundleIdentifier = (NSString *(*)(id,SEL))method_getImplementation(m1);
        method_setImplementation(m1, (IMP)hook_bundleIdentifier);
    }

    SEL s2 = sel_registerName("infoDictionary");
    Method m2 = class_getInstanceMethod(cls, s2);
    if (m2) {
        orig_infoDictionary = (NSDictionary *(*)(id,SEL))method_getImplementation(m2);
        method_setImplementation(m2, (IMP)hook_infoDictionary);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 6 — File Path Shadow (fishhook)
// ══════════════════════════════════════════════════════════════════════════════

typedef int (*stat_f)(const char *, struct stat *);
typedef int (*lstat_f)(const char *, struct stat *);
typedef int (*access_f)(const char *, int);
typedef int (*open_f)(const char *, int, ...);

static stat_f   orig_stat   = NULL;
static lstat_f  orig_lstat  = NULL;
static access_f orig_access = NULL;
static open_f   orig_open   = NULL;

static int hook_stat(const char *path, struct stat *buf) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    return orig_stat(path, buf);
}
static int hook_lstat(const char *path, struct stat *buf) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    return orig_lstat(path, buf);
}
static int hook_access(const char *path, int mode) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    return orig_access(path, mode);
}
static int hook_open(const char *path, int flags, ...) {
    if (msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    if (flags & O_CREAT) {
        va_list args; va_start(args, flags);
        mode_t mode = va_arg(args, int); va_end(args);
        return orig_open(path, flags, mode);
    }
    return orig_open(path, flags);
}

static BOOL (*orig_fileExistsAtPath)(id, SEL, NSString *)           = NULL;
static BOOL (*orig_fileExistsAtPathIsDir)(id, SEL, NSString *, BOOL*) = NULL;

static BOOL hook_fileExistsAtPath(id self, SEL sel, NSString *path) {
    if (path && msm_isSuspiciousPath([path UTF8String])) return NO;
    return orig_fileExistsAtPath(self, sel, path);
}
static BOOL hook_fileExistsAtPathIsDir(id self, SEL sel, NSString *path, BOOL *isDir) {
    if (path && msm_isSuspiciousPath([path UTF8String])) {
        if (isDir) *isDir = NO;
        return NO;
    }
    return orig_fileExistsAtPathIsDir(self, sel, path, isDir);
}

static void installFileShadow(void) {
    struct rebinding hooks[] = {
        {"stat",   (void *)hook_stat,   (void **)&orig_stat},
        {"lstat",  (void *)hook_lstat,  (void **)&orig_lstat},
        {"access", (void *)hook_access, (void **)&orig_access},
        {"open",   (void *)hook_open,   (void **)&orig_open},
    };
    rebind_symbols(hooks, 4);

    Class fmcls = objc_getClass("NSFileManager");
    if (fmcls) {
        SEL s1 = sel_registerName("fileExistsAtPath:");
        Method m1 = class_getInstanceMethod(fmcls, s1);
        if (m1) {
            orig_fileExistsAtPath = (BOOL(*)(id,SEL,NSString*))method_getImplementation(m1);
            method_setImplementation(m1, (IMP)hook_fileExistsAtPath);
        }
        SEL s2 = sel_registerName("fileExistsAtPath:isDirectory:");
        Method m2 = class_getInstanceMethod(fmcls, s2);
        if (m2) {
            orig_fileExistsAtPathIsDir = (BOOL(*)(id,SEL,NSString*,BOOL*))method_getImplementation(m2);
            method_setImplementation(m2, (IMP)hook_fileExistsAtPathIsDir);
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 8 — URL Scheme Filter (canOpenURL)
// ══════════════════════════════════════════════════════════════════════════════

static BOOL (*orig_canOpenURL)(id, SEL, NSURL *) = NULL;

static BOOL hook_canOpenURL(id self, SEL sel, NSURL *url) {
    if (!url) return NO;
    NSString *scheme = url.scheme.lowercaseString;
    MSM_STACK(s1, S_SCHEME_CYDIA);
    MSM_STACK(s2, S_SCHEME_SILEO);
    MSM_STACK(s3, S_SCHEME_ZBRA);
    MSM_STACK(s4, S_SCHEME_FILZA);
    MSM_STACK(s5, S_SCHEME_UNC0VER);
    MSM_STACK(s6, S_SCHEME_PALERA1N);
    const char *sc = [scheme UTF8String];
    if (!sc) return orig_canOpenURL(self, sel, url);
    if (strcmp(sc, s1) == 0 || strcmp(sc, s2) == 0 ||
        strcmp(sc, s3) == 0 || strcmp(sc, s4) == 0 ||
        strcmp(sc, s5) == 0 || strcmp(sc, s6) == 0) return NO;
    return orig_canOpenURL(self, sel, url);
}

static void installURLSchemeFilter(void) {
    Class cls = objc_getClass("UIApplication");
    if (!cls) return;
    SEL sel = sel_registerName("canOpenURL:");
    Method m = class_getInstanceMethod(cls, sel);
    if (m) {
        orig_canOpenURL = (BOOL(*)(id,SEL,NSURL*))method_getImplementation(m);
        method_setImplementation(m, (IMP)hook_canOpenURL);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 9 — getenv hide (fishhook)
// ══════════════════════════════════════════════════════════════════════════════

typedef char *(*getenv_f)(const char *);
static getenv_f orig_getenv = NULL;

static BOOL msm_isSuspiciousEnv(const char *name) {
    if (!name) return NO;
    MSM_STACK(e1, S_ENV_DYLD);           /* DYLD_INSERT_LIBRARIES */
    MSM_STACK(e2, S_ENV_SUBSTRATE);      /* MobileSubstrate */
    MSM_STACK(e3, S_ENV_SUBSTITUTE);     /* Substitute */
    MSM_STACK(e4, S_ENV_LIBHOOKER);      /* LIBHOOKER */
    MSM_STACK(e5, S_ENV_FRIDA);          /* frida */
    MSM_STACK(e6, S_ENV_FRIDA_SERVER);   /* FRIDA_SERVER */
    MSM_STACK(e7, S_ENV_FRIDA_GADGET);   /* FRIDA_GADGET */
    return (strcasecmp(name, e1) == 0  ||
            strstr(name, e2) != NULL   || strstr(name, e3) != NULL  ||
            strcasecmp(name, e4) == 0  || strstr(name, e5) != NULL  ||
            strcasecmp(name, e6) == 0  || strcasecmp(name, e7) == 0);
}

static char *hook_getenv(const char *name) {
    if (msm_isSuspiciousEnv(name)) return NULL;
    return orig_getenv(name);
}

static void installEnvHide(void) {
    struct rebinding hooks[] = {
        {"getenv", (void *)hook_getenv, (void **)&orig_getenv},
    };
    rebind_symbols(hooks, 1);
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 11 — DYLD Image Cloaking
// ══════════════════════════════════════════════════════════════════════════════

static uint32_t s_self_index = UINT32_MAX;

__attribute__((constructor)) __attribute__((visibility("hidden")))
static void msm_cacheSelfIndex(void) {
    Dl_info dl;
    memset(&dl, 0, sizeof(dl));
    if (!dladdr((void *)msm_cacheSelfIndex, &dl) || !dl.dli_fname) return;
    uint32_t n = _dyld_image_count();
    for (uint32_t i = 0; i < n; i++) {
        const char *name = _dyld_get_image_name(i);
        if (name && strcmp(name, dl.dli_fname) == 0) {
            s_self_index = i;
            break;
        }
    }
}

typedef uint32_t     (*dyld_count_f)(void);
typedef const char * (*dyld_name_f)(uint32_t);
typedef const struct mach_header *(*dyld_header_f)(uint32_t);
typedef intptr_t     (*dyld_slide_f)(uint32_t);

static dyld_count_f  orig_dyld_count  = NULL;
static dyld_name_f   orig_dyld_name   = NULL;
static dyld_header_f orig_dyld_header = NULL;
static dyld_slide_f  orig_dyld_slide  = NULL;

static uint32_t hook_dyld_count(void) {
    uint32_t c = orig_dyld_count();
    return (s_self_index != UINT32_MAX && c > 0) ? c - 1 : c;
}
static const char *hook_dyld_name(uint32_t idx) {
    if (s_self_index != UINT32_MAX && idx >= s_self_index) idx++;
    return orig_dyld_name(idx);
}
static const struct mach_header *hook_dyld_header(uint32_t idx) {
    if (s_self_index != UINT32_MAX && idx >= s_self_index) idx++;
    return orig_dyld_header(idx);
}
static intptr_t hook_dyld_slide(uint32_t idx) {
    if (s_self_index != UINT32_MAX && idx >= s_self_index) idx++;
    return orig_dyld_slide(idx);
}

static void installDYLDCloaking(void) {
    struct rebinding hooks[] = {
        {"_dyld_image_count",         (void *)hook_dyld_count,  (void **)&orig_dyld_count},
        {"_dyld_get_image_name",      (void *)hook_dyld_name,   (void **)&orig_dyld_name},
        {"_dyld_get_image_header",    (void *)hook_dyld_header, (void **)&orig_dyld_header},
        {"_dyld_get_image_vmaddr_slide",(void *)hook_dyld_slide, (void **)&orig_dyld_slide},
    };
    rebind_symbols(hooks, 4);
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 1 — Anti-Debug (تأجيل لما بعد main لتجنب crash مبكر)
// ══════════════════════════════════════════════════════════════════════════════

// ملاحظة: ptrace(PT_DENY_ATTACH) من constructor (قبل main) يسبب crash على iOS
// لذا يُشغَّل عبر dispatch_async بعد تهيئة التطبيق بالكامل
static void msm_doAntiDebug(void) {
    ptrace(PT_DENY_ATTACH, 0, 0, 0);
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MAIN INIT — تفعيل جميع الـ Hooks
// ══════════════════════════════════════════════════════════════════════════════

__attribute__((constructor)) __attribute__((visibility("hidden")))
static void MismariAntiRevokeInit(void) {
    @autoreleasepool {
        installOCSPBlock();
        installSSLUnpin();
        installBundleIDGuard();
        installFileShadow();
        installURLSchemeFilter();
        installEnvHide();
        installDYLDCloaking();
        // ptrace يُشغَّل بعد تهيئة الـ main queue لتجنب crash مبكر
        dispatch_async(dispatch_get_main_queue(), ^{
            msm_doAntiDebug();
        });
    }
}
