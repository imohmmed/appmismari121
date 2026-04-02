// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Mismari Anti-Revoke v5 — Stable Minimal Build                          ║
// ║  Plain ObjC + fishhook (SecTrust only) — xcrun clang                   ║
// ║                                                                          ║
// ║  BUILD: make -f Makefile.plain release                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <Security/Security.h>
#import <dlfcn.h>

#include "fishhook.h"
#include "MSMStrings.h"

// ══════════════════════════════════════════════════════════════════════════════
// MARK: MODULE 1 — OCSP / CRL Block
// يحجب طلبات التحقق من إلغاء الشهادة → يمنع revoke
// ══════════════════════════════════════════════════════════════════════════════

static BOOL msm_isRevocationHost(NSString *host) {
    if (!host || host.length == 0) return NO;
    // الأدوات المعتمدة على comparestring يجب أن تكون safe
    if ([host hasSuffix:@"apple.com"] &&
        ([host hasPrefix:@"ocsp"]  ||
         [host hasPrefix:@"crl"]   ||
         [host hasPrefix:@"valid"] ||
         [host rangeOfString:@"ocsp"].location  != NSNotFound ||
         [host rangeOfString:@".crl."].location != NSNotFound)) {
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

static NSURLSessionDataTask *hook_dataTask(id self, SEL sel,
                                           NSURLRequest *req, id handler) {
    if (req && msm_isRevocationHost(req.URL.host.lowercaseString)) {
        void (^cb)(NSData *, NSURLResponse *, NSError *) = handler;
        if (cb) cb(msm_fakeOCSP(), msm_fakeResp(req.URL), nil);
        return nil;
    }
    if (!orig_dataTask) return nil;
    return orig_dataTask(self, sel, req, handler);
}

static NSURLSessionDataTask *hook_dataTaskURL(id self, SEL sel,
                                              NSURL *url, id handler) {
    if (url && msm_isRevocationHost(url.host.lowercaseString)) {
        void (^cb)(NSData *, NSURLResponse *, NSError *) = handler;
        if (cb) cb(msm_fakeOCSP(), msm_fakeResp(url), nil);
        return nil;
    }
    if (!orig_dataTaskURL) return nil;
    return orig_dataTaskURL(self, sel, url, handler);
}

static NSURLSessionDownloadTask *hook_downloadTask(id self, SEL sel,
                                                   NSURLRequest *req, id handler) {
    if (req && msm_isRevocationHost(req.URL.host.lowercaseString)) {
        void (^cb)(NSURL *, NSURLResponse *, NSError *) = handler;
        if (cb) cb(nil, msm_fakeResp(req.URL), nil);
        return nil;
    }
    if (!orig_downloadTask) return nil;
    return orig_downloadTask(self, sel, req, handler);
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
// MARK: MODULE 2 — SSL Unpinning (fishhook على SecTrust فقط)
// ══════════════════════════════════════════════════════════════════════════════

typedef OSStatus (*SecTrustEval_f)(SecTrustRef, SecTrustResultType *);
typedef bool     (*SecTrustEvalErr_f)(SecTrustRef, CFErrorRef *);

static SecTrustEval_f    orig_SecTrustEvaluate         = NULL;
static SecTrustEvalErr_f orig_SecTrustEvaluateWithError = NULL;

static OSStatus hook_SecTrustEvaluate(SecTrustRef t, SecTrustResultType *r) {
    // استدعِ الأصلي أولاً لتجنب الكراش
    OSStatus s = orig_SecTrustEvaluate ? orig_SecTrustEvaluate(t, r) : errSecSuccess;
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
// MARK: MODULE 3 — Bundle ID Guard
// يُعيد Bundle ID الأصلي لحماية الـ App Store receipts
// ══════════════════════════════════════════════════════════════════════════════

typedef NSString *(*bundleID_f)(id, SEL);
static bundleID_f orig_bundleIdentifier = NULL;
static NSString  *_msm_realBundleID    = nil;

static NSString *hook_bundleIdentifier(id self, SEL sel) {
    NSString *orig = orig_bundleIdentifier ? orig_bundleIdentifier(self, sel) : nil;
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
        installOCSPBlock();
        installSSLUnpin();
        installBundleIDGuard();
    }
}
