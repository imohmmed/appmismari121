// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Mismari Anti-Revoke + Full Bypass v7                                    ║
// ║  Plain ObjC — xcrun clang — NO Theos — NO MSHookFunction                ║
// ║  يشتغل على كل الأجهزة (جيلبريك وبدون)                                   ║
// ║                                                                          ║
// ║  BUILD: make -f Makefile.plain release                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <Security/Security.h>
#import <sys/stat.h>
#import <fcntl.h>
#import <dlfcn.h>
#import <errno.h>
#import <pthread.h>

#include "fishhook.h"
#include "MSMStrings.h"

// ══════════════════════════════════════════════════════════════════════════════
// MARK: Helpers — Jailbreak Path Detection
// ══════════════════════════════════════════════════════════════════════════════

static const char * const kJBPrefixes[] = {
    "/private/var/lib/apt",
    "/private/var/lib/cydia",
    "/private/var/stash",
    "/Library/MobileSubstrate",
    "/Library/PreferenceLoader",
    "/usr/lib/tweaks",
    "/usr/lib/TweakInject",
    "/usr/lib/substitute",
    "/usr/lib/substrate",
    "/var/jb/",
    "/var/LIB/",
    "/private/preboot/",
    NULL
};

static const char * const kJBExact[] = {
    "/Applications/Cydia.app",
    "/Applications/Sileo.app",
    "/Applications/Zebra.app",
    "/Applications/Filza.app",
    "/Applications/unc0ver.app",
    "/var/lib/cydia",
    "/var/stash",
    "/bin/bash",
    "/usr/sbin/sshd",
    "/usr/libexec/sftp-server",
    "/usr/bin/sshd",
    "/usr/bin/cycript",
    "/etc/apt",
    "/etc/ssh/sshd_config",
    "/private/etc/apt",
    "/private/etc/ssh/sshd_config",
    "/private/var/mobile/Library/SBSettings",
    NULL
};

static BOOL msm_isSuspiciousPath(const char *path) {
    if (!path || path[0] == '\0') return NO;
    for (int i = 0; kJBPrefixes[i]; i++)
        if (strncmp(path, kJBPrefixes[i], strlen(kJBPrefixes[i])) == 0) return YES;
    for (int i = 0; kJBExact[i]; i++)
        if (strcmp(path, kJBExact[i]) == 0) return YES;
    return NO;
}

static BOOL msm_isJBEnvKey(const char *name) {
    if (!name) return NO;
    static const char * const kBadEnv[] = {
        "DYLD_INSERT_LIBRARIES",
        "DYLD_LIBRARY_PATH",
        "DYLD_FRAMEWORK_PATH",
        "DYLD_FORCE_FLAT_NAMESPACE",
        "_MSSafeMode",
        "MSIgnoreEnvironment",
        NULL
    };
    for (int i = 0; kBadEnv[i]; i++)
        if (strcmp(name, kBadEnv[i]) == 0) return YES;
    return NO;
}

static BOOL msm_isRevocationHost(NSString *host) {
    if (!host || host.length == 0) return NO;
    host = host.lowercaseString;
    if (![host hasSuffix:@"apple.com"]) return NO;
    return ([host hasPrefix:@"ocsp"] ||
            [host hasPrefix:@"crl"]  ||
            [host hasPrefix:@"valid"] ||
            [host rangeOfString:@"ocsp"].location != NSNotFound ||
            [host rangeOfString:@"cert"].location != NSNotFound);
}

static NSData *msm_fakeOCSP(void) {
    static const uint8_t b[] = { 0x30, 0x03, 0x0A, 0x01, 0x00 };
    return [NSData dataWithBytes:b length:5];
}
static NSHTTPURLResponse *msm_fakeResp(NSURL *url) {
    if (!url) return nil;
    return [[NSHTTPURLResponse alloc]
        initWithURL:url statusCode:200 HTTPVersion:@"HTTP/1.1"
        headerFields:@{
            @"Content-Type":   @"application/ocsp-response",
            @"Content-Length": @"5",
            @"Cache-Control":  @"max-age=604800",
            @"Connection":     @"close",
        }];
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 1 — File Shadow  (stat / lstat / access / open / fopen)
// ══════════════════════════════════════════════════════════════════════════════

typedef int   (*stat_f)(const char *, struct stat *);
typedef int   (*lstat_f)(const char *, struct stat *);
typedef int   (*access_f)(const char *, int);
typedef int   (*open_f)(const char *, int, ...);
typedef FILE *(*fopen_f)(const char *, const char *);

static stat_f   orig_stat   = NULL;
static lstat_f  orig_lstat  = NULL;
static access_f orig_access = NULL;
static open_f   orig_open   = NULL;
static fopen_f  orig_fopen  = NULL;

// محرس ضد الاستدعاء العودي (open/fopen خطيرتان)
static _Thread_local int _msm_in_hook = 0;

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
static int hook_open(const char *path, int flags, ...) {
    if (!_msm_in_hook && msm_isSuspiciousPath(path)) { errno = ENOENT; return -1; }
    _msm_in_hook++;
    int ret = -1;
    if (orig_open) {
        va_list args; va_start(args, flags);
        mode_t mode = va_arg(args, mode_t);
        va_end(args);
        ret = orig_open(path, flags, mode);
    }
    _msm_in_hook--;
    return ret;
}
static FILE *hook_fopen(const char *path, const char *mode) {
    if (!_msm_in_hook && msm_isSuspiciousPath(path)) { errno = ENOENT; return NULL; }
    _msm_in_hook++;
    FILE *ret = orig_fopen ? orig_fopen(path, mode) : NULL;
    _msm_in_hook--;
    return ret;
}

static void installFileShadow(void) {
    struct rebinding hooks[] = {
        {"stat",   (void *)hook_stat,   (void **)&orig_stat},
        {"lstat",  (void *)hook_lstat,  (void **)&orig_lstat},
        {"access", (void *)hook_access, (void **)&orig_access},
        {"open",   (void *)hook_open,   (void **)&orig_open},
        {"fopen",  (void *)hook_fopen,  (void **)&orig_fopen},
    };
    rebind_symbols(hooks, 5);

    // NSFileManager swizzle
    Class cls = objc_getClass("NSFileManager");
    if (!cls) return;
    SEL s1 = sel_registerName("fileExistsAtPath:");
    Method m1 = class_getInstanceMethod(cls, s1);
    if (m1) {
        typedef BOOL (*fe_f)(id, SEL, NSString *);
        __block fe_f orig_fe = (fe_f)method_getImplementation(m1);
        IMP new_fe = imp_implementationWithBlock(^BOOL(id self, NSString *path) {
            if (path && msm_isSuspiciousPath(path.UTF8String)) return NO;
            return orig_fe(self, s1, path);
        });
        method_setImplementation(m1, new_fe);
    }
    SEL s2 = sel_registerName("fileExistsAtPath:isDirectory:");
    Method m2 = class_getInstanceMethod(cls, s2);
    if (m2) {
        typedef BOOL (*fed_f)(id, SEL, NSString *, BOOL *);
        __block fed_f orig_fed = (fed_f)method_getImplementation(m2);
        IMP new_fed = imp_implementationWithBlock(^BOOL(id self, NSString *path, BOOL *isDir) {
            if (path && msm_isSuspiciousPath(path.UTF8String)) {
                if (isDir) *isDir = NO;
                return NO;
            }
            return orig_fed(self, s2, path, isDir);
        });
        method_setImplementation(m2, new_fed);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 2 — getenv (إخفاء متغيرات DYLD)
// ══════════════════════════════════════════════════════════════════════════════

typedef char *(*getenv_f)(const char *);
static getenv_f orig_getenv = NULL;

static char *hook_getenv(const char *name) {
    if (msm_isJBEnvKey(name)) return NULL;
    return orig_getenv ? orig_getenv(name) : NULL;
}

static void installGetenvHook(void) {
    struct rebinding h[] = {
        {"getenv", (void *)hook_getenv, (void **)&orig_getenv},
    };
    rebind_symbols(h, 1);
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 3 — NSURLSession + NSURLConnection (OCSP / CRL Block)
// ══════════════════════════════════════════════════════════════════════════════

static void installOCSPBlock(void) {
    // — NSURLSession —
    Class sc = objc_getClass("NSURLSession");
    if (sc) {
        // dataTaskWithRequest:completionHandler:
        SEL s1 = sel_registerName("dataTaskWithRequest:completionHandler:");
        Method m1 = class_getInstanceMethod(sc, s1);
        if (m1) {
            typedef NSURLSessionDataTask *(*dt_f)(id, SEL, NSURLRequest *, id);
            __block dt_f orig = (dt_f)method_getImplementation(m1);
            IMP imp = imp_implementationWithBlock(^NSURLSessionDataTask *(id self, NSURLRequest *req, id handler) {
                if (req && msm_isRevocationHost(req.URL.host)) {
                    void (^cb)(NSData *, NSURLResponse *, NSError *) = handler;
                    if (cb) cb(msm_fakeOCSP(), msm_fakeResp(req.URL), nil);
                    return nil;
                }
                return orig(self, s1, req, handler);
            });
            method_setImplementation(m1, imp);
        }
        // dataTaskWithURL:completionHandler:
        SEL s2 = sel_registerName("dataTaskWithURL:completionHandler:");
        Method m2 = class_getInstanceMethod(sc, s2);
        if (m2) {
            typedef NSURLSessionDataTask *(*dtu_f)(id, SEL, NSURL *, id);
            __block dtu_f orig = (dtu_f)method_getImplementation(m2);
            IMP imp = imp_implementationWithBlock(^NSURLSessionDataTask *(id self, NSURL *url, id handler) {
                if (url && msm_isRevocationHost(url.host)) {
                    void (^cb)(NSData *, NSURLResponse *, NSError *) = handler;
                    if (cb) cb(msm_fakeOCSP(), msm_fakeResp(url), nil);
                    return nil;
                }
                return orig(self, s2, url, handler);
            });
            method_setImplementation(m2, imp);
        }
        // downloadTaskWithRequest:completionHandler:
        SEL s3 = sel_registerName("downloadTaskWithRequest:completionHandler:");
        Method m3 = class_getInstanceMethod(sc, s3);
        if (m3) {
            typedef NSURLSessionDownloadTask *(*down_f)(id, SEL, NSURLRequest *, id);
            __block down_f orig = (down_f)method_getImplementation(m3);
            IMP imp = imp_implementationWithBlock(^NSURLSessionDownloadTask *(id self, NSURLRequest *req, id handler) {
                if (req && msm_isRevocationHost(req.URL.host)) {
                    void (^cb)(NSURL *, NSURLResponse *, NSError *) = handler;
                    if (cb) cb(nil, msm_fakeResp(req.URL), nil);
                    return nil;
                }
                return orig(self, s3, req, handler);
            });
            method_setImplementation(m3, imp);
        }
    }

    // — NSURLConnection (Legacy) —
    Class cc = objc_getClass("NSURLConnection");
    if (cc) {
        // connectionWithRequest:delegate:
        SEL s4 = sel_registerName("connectionWithRequest:delegate:");
        Method m4 = class_getClassMethod(cc, s4);
        if (m4) {
            typedef id (*conn_f)(id, SEL, NSURLRequest *, id);
            __block conn_f orig = (conn_f)method_getImplementation(m4);
            IMP imp = imp_implementationWithBlock(^id(id self, NSURLRequest *req, id del) {
                if (req && msm_isRevocationHost(req.URL.host)) return nil;
                return orig(self, s4, req, del);
            });
            method_setImplementation(m4, imp);
        }
        // sendAsynchronousRequest:queue:completionHandler:
        SEL s5 = sel_registerName("sendAsynchronousRequest:queue:completionHandler:");
        Method m5 = class_getClassMethod(cc, s5);
        if (m5) {
            typedef void (*async_f)(id, SEL, NSURLRequest *, id, id);
            __block async_f orig = (async_f)method_getImplementation(m5);
            IMP imp = imp_implementationWithBlock(^void(id self, NSURLRequest *req, id queue, id handler) {
                if (req && msm_isRevocationHost(req.URL.host)) {
                    void (^cb)(NSURLResponse *, NSData *, NSError *) = handler;
                    if (cb) cb(msm_fakeResp(req.URL), msm_fakeOCSP(), nil);
                    return;
                }
                orig(self, s5, req, queue, handler);
            });
            method_setImplementation(m5, imp);
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 4 — SSL Unpinning (SecTrust fishhook)
// ══════════════════════════════════════════════════════════════════════════════

typedef OSStatus (*SecTrustEval_f)(SecTrustRef, SecTrustResultType *);
typedef bool     (*SecTrustEvalErr_f)(SecTrustRef, CFErrorRef *);
typedef OSStatus (*SecTrustGetRes_f)(SecTrustRef, SecTrustResultType *);

static SecTrustEval_f    orig_SecTrustEvaluate          = NULL;
static SecTrustEvalErr_f orig_SecTrustEvaluateWithError  = NULL;
static SecTrustGetRes_f  orig_SecTrustGetTrustResult     = NULL;

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
static OSStatus hook_SecTrustGetTrustResult(SecTrustRef t, SecTrustResultType *r) {
    if (orig_SecTrustGetTrustResult) orig_SecTrustGetTrustResult(t, r);
    if (r) *r = kSecTrustResultProceed;
    return errSecSuccess;
}

static void installSSLUnpin(void) {
    struct rebinding h[] = {
        {"SecTrustEvaluate",
         (void *)hook_SecTrustEvaluate,
         (void **)&orig_SecTrustEvaluate},
        {"SecTrustEvaluateWithError",
         (void *)hook_SecTrustEvaluateWithError,
         (void **)&orig_SecTrustEvaluateWithError},
        {"SecTrustGetTrustResult",
         (void *)hook_SecTrustGetTrustResult,
         (void **)&orig_SecTrustGetTrustResult},
    };
    rebind_symbols(h, 3);
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 5 — NSBundle (bundleIdentifier + infoDictionary)
// ══════════════════════════════════════════════════════════════════════════════

static NSString *_msm_realBundleID = nil;

static void installBundleGuard(void) {
    Class cls = objc_getClass("NSBundle");
    if (!cls) return;

    // bundleIdentifier
    SEL s1 = sel_registerName("bundleIdentifier");
    Method m1 = class_getInstanceMethod(cls, s1);
    if (m1) {
        typedef NSString *(*bid_f)(id, SEL);
        __block bid_f orig = (bid_f)method_getImplementation(m1);
        IMP imp = imp_implementationWithBlock(^NSString *(id self) {
            NSString *b = orig(self, s1);
            if (!_msm_realBundleID && b.length > 0)
                _msm_realBundleID = [b copy];
            return _msm_realBundleID ?: b;
        });
        method_setImplementation(m1, imp);
    }

    // infoDictionary — إرجاع bundleIdentifier الأصلي فيه
    SEL s2 = sel_registerName("infoDictionary");
    Method m2 = class_getInstanceMethod(cls, s2);
    if (m2) {
        typedef NSDictionary *(*info_f)(id, SEL);
        __block info_f orig = (info_f)method_getImplementation(m2);
        IMP imp = imp_implementationWithBlock(^NSDictionary *(id self) {
            NSDictionary *d = orig(self, s2);
            if (_msm_realBundleID && d[@"CFBundleIdentifier"]
                && ![d[@"CFBundleIdentifier"] isEqualToString:_msm_realBundleID]) {
                NSMutableDictionary *md = [d mutableCopy];
                md[@"CFBundleIdentifier"] = _msm_realBundleID;
                return [md copy];
            }
            return d;
        });
        method_setImplementation(m2, imp);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 6 — UIDevice (إخفاء معلومات الجيلبريك)
// UUID ديناميكي: يتغير مع كل جلسة تشغيل — لا يمكن تتبع الجهاز أو حظره
// ══════════════════════════════════════════════════════════════════════════════

static void installDeviceSpoof(void) {
    Class cls = objc_getClass("UIDevice");
    if (!cls) return;

    // model & localizedModel → "iPhone" (يخفي كشف الجيلبريك)
    for (NSString *selName in @[@"model", @"localizedModel"]) {
        SEL sel = NSSelectorFromString(selName);
        Method m = class_getInstanceMethod(cls, sel);
        if (m) {
            method_setImplementation(m, imp_implementationWithBlock(^NSString *(id self) {
                return @"iPhone";
            }));
        }
    }

    // identifierForVendor — عشوائي لكل جلسة تشغيل
    // يتغير مع كل فتح للتطبيق → لا يمكن تتبع الجهاز أو حظره
    SEL s3 = sel_registerName("identifierForVendor");
    Method m3 = class_getInstanceMethod(cls, s3);
    if (m3) {
        // نُولَّد UUID واحد عند التحميل الأول — ثابت خلال الجلسة لكن مختلف في كل launch
        static NSUUID *_sessionVendorID = nil;
        if (!_sessionVendorID) _sessionVendorID = [NSUUID UUID];
        NSUUID *captured = _sessionVendorID;
        method_setImplementation(m3, imp_implementationWithBlock(^NSUUID *(id self) {
            return captured;
        }));
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 7 — UIApplication (canOpenURL / openURL)
// ══════════════════════════════════════════════════════════════════════════════

static const char * const kJBSchemes[] = {
    "cydia", "sileo", "zbra", "filza",
    "undecimus", "unc0ver", "palera1n", "checkra1n",
    NULL
};

static BOOL msm_isJBScheme(NSString *s) {
    if (!s) return NO;
    const char *c = s.lowercaseString.UTF8String;
    for (int i = 0; kJBSchemes[i]; i++)
        if (strcmp(c, kJBSchemes[i]) == 0) return YES;
    return NO;
}

static void installURLFilter(void) {
    Class cls = objc_getClass("UIApplication");
    if (!cls) return;

    SEL s1 = sel_registerName("canOpenURL:");
    Method m1 = class_getInstanceMethod(cls, s1);
    if (m1) {
        typedef BOOL (*can_f)(id, SEL, NSURL *);
        __block can_f orig = (can_f)method_getImplementation(m1);
        IMP imp = imp_implementationWithBlock(^BOOL(id self, NSURL *url) {
            if (url && msm_isJBScheme(url.scheme)) return NO;
            return orig(self, s1, url);
        });
        method_setImplementation(m1, imp);
    }

    SEL s2 = sel_registerName("openURL:options:completionHandler:");
    Method m2 = class_getInstanceMethod(cls, s2);
    if (m2) {
        typedef void (*open_f)(id, SEL, NSURL *, NSDictionary *, id);
        __block open_f orig = (open_f)method_getImplementation(m2);
        IMP imp = imp_implementationWithBlock(^void(id self, NSURL *url, NSDictionary *opts, id cb) {
            if (url && msm_isJBScheme(url.scheme)) {
                void (^completion)(BOOL) = cb;
                if (completion) completion(NO);
                return;
            }
            orig(self, s2, url, opts, cb);
        });
        method_setImplementation(m2, imp);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 8 — UIPasteboard (حماية الحافظة)
// ══════════════════════════════════════════════════════════════════════════════

static void installPasteboardGuard(void) {
    Class cls = objc_getClass("UIPasteboard");
    if (!cls) return;

    // كل هذه الـ selectors تُرجع nil/NO/0
    NSArray *nilSelectors = @[
        @"string", @"strings", @"items", @"pasteboardItems",
        @"firstObject",
    ];
    NSArray *falseSelectors = @[
        @"hasStrings", @"hasURLs", @"hasImages", @"hasColors",
    ];
    NSArray *zeroSelectors = @[
        @"numberOfItems",
    ];

    for (NSString *name in nilSelectors) {
        SEL sel = NSSelectorFromString(name);
        Method m = class_getInstanceMethod(cls, sel);
        if (m) method_setImplementation(m, imp_implementationWithBlock(^id(id self) { return nil; }));
    }
    for (NSString *name in falseSelectors) {
        SEL sel = NSSelectorFromString(name);
        Method m = class_getInstanceMethod(cls, sel);
        if (m) method_setImplementation(m, imp_implementationWithBlock(^BOOL(id self) { return NO; }));
    }
    for (NSString *name in zeroSelectors) {
        SEL sel = NSSelectorFromString(name);
        Method m = class_getInstanceMethod(cls, sel);
        if (m) method_setImplementation(m, imp_implementationWithBlock(^NSInteger(id self) { return 0; }));
    }

    // detectPatternsForPatterns:completionHandler:
    SEL s9 = sel_registerName("detectPatternsForPatterns:completionHandler:");
    Method m9 = class_getInstanceMethod(cls, s9);
    if (m9) {
        method_setImplementation(m9, imp_implementationWithBlock(^void(id self, id patterns, id cb) {
            void (^completion)(NSSet *, NSError *) = cb;
            if (completion) completion([NSSet set], nil);
        }));
    }

    // detectValuesForPatterns:completionHandler:
    SEL s10 = sel_registerName("detectValuesForPatterns:completionHandler:");
    Method m10 = class_getInstanceMethod(cls, s10);
    if (m10) {
        method_setImplementation(m10, imp_implementationWithBlock(^void(id self, id patterns, id cb) {
            void (^completion)(NSDictionary *, NSError *) = cb;
            if (completion) completion(@{}, nil);
        }));
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 9 — NSUUID (UUID ديناميكي لكل جلسة)
// لا نُثبِّت UUID — كل launch يعطي UUID مختلف = لا حظر على الجهاز
// نُبقي UUIDString passthrough (الأصل) — نمنع فقط device fingerprinting
// عبر identifierForVendor الذي ثبّتناه في MODULE 6
// ══════════════════════════════════════════════════════════════════════════════

static void installUUIDSpoof(void) {
    // NSUUID.UUID و UUIDString يعملان بشكل طبيعي (عشوائي بالأصل)
    // نحن نتحكم بـ identifierForVendor فقط (MODULE 6) — هذا يكفي
    // لا نحتاج hook هنا — أي hook ثابت يُمكِّن tracking
    (void)0;
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 10 — DYLD Image Cloaking
// يُخفي اسم الدايلب من قوائم _dyld_image_count / _dyld_get_image_name
// ══════════════════════════════════════════════════════════════════════════════

typedef uint32_t    (*dyld_count_f)(void);
typedef const char *(*dyld_name_f)(uint32_t);

static dyld_count_f orig_dyld_count = NULL;
static dyld_name_f  orig_dyld_name  = NULL;

// الاسم الذي يظهر في قائمة الـ images والذي نريد إخفاءه
static const char kMySuffix[] = "antirevoke.dylib";
static const char kSubstrate[] = "MobileSubstrate";

static BOOL msm_shouldHideImage(const char *name) {
    if (!name) return NO;
    const char *p;
    if ((p = strrchr(name, '/')) != NULL) name = p + 1;
    return (strstr(name, kMySuffix) != NULL ||
            strstr(name, kSubstrate) != NULL);
}

static uint32_t hook_dyld_count(void) {
    uint32_t total = orig_dyld_count ? orig_dyld_count() : 0;
    uint32_t hidden = 0;
    for (uint32_t i = 0; i < total; i++) {
        const char *n = orig_dyld_name ? orig_dyld_name(i) : NULL;
        if (msm_shouldHideImage(n)) hidden++;
    }
    return total - hidden;
}
static const char *hook_dyld_name(uint32_t index) {
    uint32_t total = orig_dyld_count ? orig_dyld_count() : 0;
    uint32_t adj = 0;
    for (uint32_t i = 0; i < total; i++) {
        const char *n = orig_dyld_name ? orig_dyld_name(i) : NULL;
        if (msm_shouldHideImage(n)) continue;
        if (adj == index) return n;
        adj++;
    }
    return NULL;
}

static void installDYLDCloak(void) {
    struct rebinding h[] = {
        {"_dyld_image_count",    (void *)hook_dyld_count, (void **)&orig_dyld_count},
        {"_dyld_get_image_name", (void *)hook_dyld_name,  (void **)&orig_dyld_name},
    };
    rebind_symbols(h, 2);
}

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MAIN CONSTRUCTOR
// ══════════════════════════════════════════════════════════════════════════════

__attribute__((constructor)) __attribute__((visibility("hidden")))
static void MismariInit(void) {
    @autoreleasepool {
        // الترتيب مهم: C hooks أولاً ثم ObjC
        installGetenvHook();      // 2: getenv — مبكراً
        installFileShadow();      // 1: stat/lstat/access/open/fopen + NSFileManager
        installDYLDCloak();       // 10: إخفاء الدايلب من قائمة images
        installSSLUnpin();        // 4: SecTrust hooks
        installOCSPBlock();       // 3: NSURLSession + NSURLConnection
        installBundleGuard();     // 5: NSBundle
        installDeviceSpoof();     // 6: UIDevice
        installURLFilter();       // 7: UIApplication canOpenURL
        installPasteboardGuard(); // 8: UIPasteboard
        installUUIDSpoof();       // 9: NSUUID
    }
}
