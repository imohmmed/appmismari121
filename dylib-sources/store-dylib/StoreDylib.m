// ╔══════════════════════════════════════════════════════════════════════════╗
// ║          Mismari Store Dylib — حقنة المتجر الخاصة                       ║
// ║          مصممة حصرياً لتطبيق Mismari+ (المتجر فقط)                     ║
// ║          لا تُحقن في تطبيقات المستخدمين                                 ║
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

#include "fishhook.h"

// ─── إعدادات المتجر ───────────────────────────────────────────────────────────
// رابط فحص التحديث — يجيب بـ JSON: {"version":"1.2.3","notes":"..."}
static NSString *const kUpdateCheckURL  = @"https://app.mismari.com/api/settings";
static NSString *const kUpdateKey       = @"storeVersion";
static NSString *const kVersionKey      = @"MSStoreDylibVersion";         // UserDefaults
static NSString *const kCrashCountKey  = @"MSStoreCrashCount";
static NSString *const kLastRunKey      = @"MSStoreLastRunSuccess";
static NSString *const kWelcomeMsgKey  = @"MSStoreWelcomedVersion";

static NSString *const kBundleIdOriginal = @"com.mismari.app";
static NSInteger const kSafeModeCrashLimit = 3;
static NSInteger const kSafeModeResetSec   = 8;    // ثوانٍ للتشغيل الناجح

// ─── متغيرات Safe Mode ────────────────────────────────────────────────────────
static BOOL gSafeModeEnabled = NO;

// ─── قائمة مسارات الجيلبريك المخفية ─────────────────────────────────────────
static const char *kJailbreakPaths[] = {
    "/Applications/Cydia.app",
    "/Applications/blackra1n.app",
    "/Applications/FakeCarrier.app",
    "/Applications/Icy.app",
    "/Applications/IntelliScreen.app",
    "/Applications/MxTube.app",
    "/Applications/RockApp.app",
    "/Applications/SBSettings.app",
    "/Applications/Sileo.app",
    "/Applications/Zebra.app",
    "/Library/MobileSubstrate/MobileSubstrate.dylib",
    "/Library/MobileSubstrate/DynamicLibraries/LiveClock.plist",
    "/Library/MobileSubstrate/DynamicLibraries/Veency.plist",
    "/private/var/lib/apt",
    "/private/var/lib/cydia",
    "/private/var/mobile/Library/SBSettings/Themes",
    "/private/var/stash",
    "/private/var/tmp/cydia.log",
    "/usr/bin/sshd",
    "/usr/libexec/sftp-server",
    "/usr/sbin/sshd",
    "/etc/apt",
    "/bin/bash",
    "/bin/sh",
    NULL
};

static BOOL isJailbreakPath(const char *path) {
    if (!path) return NO;
    for (int i = 0; kJailbreakPaths[i] != NULL; i++) {
        if (strcmp(path, kJailbreakPaths[i]) == 0) return YES;
    }
    return NO;
}

// ─── 1. JB Bypass — C-level hooks (stat / access / open) ─────────────────────
typedef int (*stat_func)(const char *, struct stat *);
typedef int (*lstat_func)(const char *, struct stat *);
typedef int (*access_func)(const char *, int);
typedef int (*open_func)(const char *, int, ...);

static stat_func   orig_stat   = NULL;
static lstat_func  orig_lstat  = NULL;
static access_func orig_access = NULL;
static open_func   orig_open   = NULL;

static int hook_stat(const char *path, struct stat *buf) {
    if (!gSafeModeEnabled && isJailbreakPath(path)) {
        errno = ENOENT;
        return -1;
    }
    return orig_stat(path, buf);
}

static int hook_lstat(const char *path, struct stat *buf) {
    if (!gSafeModeEnabled && isJailbreakPath(path)) {
        errno = ENOENT;
        return -1;
    }
    return orig_lstat(path, buf);
}

static int hook_access(const char *path, int mode) {
    if (!gSafeModeEnabled && isJailbreakPath(path)) {
        errno = ENOENT;
        return -1;
    }
    return orig_access(path, mode);
}

static int hook_open(const char *path, int flags, ...) {
    if (!gSafeModeEnabled && isJailbreakPath(path)) {
        errno = ENOENT;
        return -1;
    }
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode_t mode = va_arg(args, int);
        va_end(args);
        return orig_open(path, flags, mode);
    }
    return orig_open(path, flags);
}

static void installJBBypass(void) {
    struct rebinding hooks[] = {
        {"stat",    (void *)hook_stat,    (void **)&orig_stat},
        {"lstat",   (void *)hook_lstat,   (void **)&orig_lstat},
        {"access",  (void *)hook_access,  (void **)&orig_access},
        {"open",    (void *)hook_open,    (void **)&orig_open},
    };
    rebind_symbols(hooks, sizeof(hooks) / sizeof(hooks[0]));
    NSLog(@"[MismariStore] ✅ JB Bypass installed");
}

// ─── 2. NSFileManager Protection — Swizzle ───────────────────────────────────
static BOOL (*orig_fileExistsAtPath)(id, SEL, NSString *) = NULL;
static BOOL (*orig_fileExistsAtPathIsDir)(id, SEL, NSString *, BOOL *) = NULL;

static BOOL hook_fileExistsAtPath(id self, SEL sel, NSString *path) {
    if (!gSafeModeEnabled && path) {
        if (isJailbreakPath([path UTF8String])) return NO;
    }
    return orig_fileExistsAtPath(self, sel, path);
}

static BOOL hook_fileExistsAtPathIsDir(id self, SEL sel, NSString *path, BOOL *isDir) {
    if (!gSafeModeEnabled && path) {
        if (isJailbreakPath([path UTF8String])) {
            if (isDir) *isDir = NO;
            return NO;
        }
    }
    return orig_fileExistsAtPathIsDir(self, sel, path, isDir);
}

static void installNSFileManagerProtection(void) {
    Class cls = [NSFileManager class];

    SEL sel1 = @selector(fileExistsAtPath:);
    Method m1 = class_getInstanceMethod(cls, sel1);
    orig_fileExistsAtPath = (BOOL(*)(id, SEL, NSString *))method_getImplementation(m1);
    method_setImplementation(m1, (IMP)hook_fileExistsAtPath);

    SEL sel2 = @selector(fileExistsAtPath:isDirectory:);
    Method m2 = class_getInstanceMethod(cls, sel2);
    orig_fileExistsAtPathIsDir = (BOOL(*)(id, SEL, NSString *, BOOL *))method_getImplementation(m2);
    method_setImplementation(m2, (IMP)hook_fileExistsAtPathIsDir);

    NSLog(@"[MismariStore] ✅ NSFileManager protection installed");
}

// ─── 3. Bundle ID Masking — يضمن ثبات الـ Bundle ID ─────────────────────────
// يُعيد دائماً الـ Bundle ID الأصلي حتى لو حاول أحد تغييره
static NSString *(*orig_bundleIdentifier)(id, SEL) = NULL;

static NSString *hook_bundleIdentifier(id self, SEL sel) {
    if (gSafeModeEnabled) return orig_bundleIdentifier(self, sel);
    // فقط للـ Main Bundle
    if (self == [NSBundle mainBundle]) {
        return kBundleIdOriginal;
    }
    return orig_bundleIdentifier(self, sel);
}

static void installBundleIDMask(void) {
    Class cls = [NSBundle class];
    SEL sel = @selector(bundleIdentifier);
    Method m = class_getInstanceMethod(cls, sel);
    if (m) {
        orig_bundleIdentifier = (NSString*(*)(id, SEL))method_getImplementation(m);
        method_setImplementation(m, (IMP)hook_bundleIdentifier);
        NSLog(@"[MismariStore] ✅ Bundle ID masking installed → %@", kBundleIdOriginal);
    }
}

// ─── 4. Auto-Update Check ─────────────────────────────────────────────────────
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

        NSString *title   = @"🔔 تحديث جديد لمسماري+";
        NSString *message = [NSString stringWithFormat:
            @"الإصدار %@ متاح الآن.\n%@\n\nهل تريد التحديث؟",
            newVersion, notes ?: @""];

        UIAlertController *alert = [UIAlertController
            alertControllerWithTitle:title
            message:message
            preferredStyle:UIAlertControllerStyleAlert];

        [alert addAction:[UIAlertAction actionWithTitle:@"تحديث الآن" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a) {
            NSURL *url = [NSURL URLWithString:@"https://app.mismari.com"];
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

static void checkForUpdate(void) {
    if (gSafeModeEnabled) return;

    NSURL *url = [NSURL URLWithString:kUpdateCheckURL];
    NSURLSessionDataTask *task = [[NSURLSession sharedSession]
        dataTaskWithURL:url
        completionHandler:^(NSData *data, NSURLResponse *resp, NSError *err) {
            if (err || !data) return;

            NSError *jsonErr = nil;
            NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:&jsonErr];
            if (!json || jsonErr) return;

            NSString *remoteVersion = json[kUpdateKey];
            if (!remoteVersion || ![remoteVersion isKindOfClass:[NSString class]]) return;

            NSString *currentBuild = [[NSBundle mainBundle] infoDictionary][@"CFBundleShortVersionString"];
            if (!currentBuild) return;

            // مقارنة بسيطة بالـ string — يمكن تطويرها لاحقاً
            if (![remoteVersion isEqualToString:currentBuild]) {
                NSString *notes = json[@"storeNotes"] ?: @"تحسينات وإصلاحات.";
                NSLog(@"[MismariStore] 🔔 Update available: %@ → %@", currentBuild, remoteVersion);
                showUpdateAlert(remoteVersion, notes);
            }
        }];
    [task resume];
}

static void installAutoUpdateChecker(void) {
    // أول فحص بعد 5 ثوانٍ من الفتح
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 5LL * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
        checkForUpdate();
    });

    // ثم كل 30 دقيقة
    NSTimer *timer = [NSTimer scheduledTimerWithTimeInterval:30 * 60
                                                       target:[NSBlockOperation blockOperationWithBlock:^{ checkForUpdate(); }]
                                                     selector:@selector(main)
                                                     userInfo:nil
                                                      repeats:YES];
    [[NSRunLoop mainRunLoop] addTimer:timer forMode:NSRunLoopCommonModes];
    NSLog(@"[MismariStore] ✅ Auto-update checker installed (every 30 min)");
}

// ─── 5. Safe Mode — حماية من الـ Crashes المتكررة ────────────────────────────
static void evaluateSafeMode(void) {
    NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];

    // هل التطبيق نجح في الـ run الأخير؟
    NSDate *lastSuccess = [ud objectForKey:kLastRunKey];
    NSInteger crashCount = [ud integerForKey:kCrashCountKey];

    if (!lastSuccess) {
        // أول تشغيل
        crashCount = 0;
    } else {
        NSTimeInterval diff = [[NSDate date] timeIntervalSinceDate:lastSuccess];
        if (diff < kSafeModeResetSec) {
            // تشغيل سريع = احتمال crash
            crashCount++;
            NSLog(@"[MismariStore] ⚠️ Crash count: %ld", (long)crashCount);
        } else {
            // تشغيل طويل = ناجح → reset
            crashCount = 0;
        }
    }

    [ud setInteger:crashCount forKey:kCrashCountKey];
    [ud setObject:[NSDate date] forKey:kLastRunKey];
    [ud synchronize];

    if (crashCount >= kSafeModeCrashLimit) {
        gSafeModeEnabled = YES;
        NSLog(@"[MismariStore] 🛡️ SAFE MODE ACTIVATED — hooks disabled (%ld crashes)", (long)crashCount);

        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2LL * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
            UIWindow *window = [UIApplication sharedApplication].keyWindow;
            if (!window || !window.rootViewController) return;

            UIAlertController *alert = [UIAlertController
                alertControllerWithTitle:@"🛡️ وضع الأمان"
                message:@"تم اكتشاف مشكلة في المتجر. تم تفعيل وضع الأمان تلقائياً لحماية بياناتك.\n\nالمتجر الآن يعمل في الوضع الأساسي."
                preferredStyle:UIAlertControllerStyleAlert];

            [alert addAction:[UIAlertAction actionWithTitle:@"حسناً" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a) {
                // إعادة ضبط العداد بعد موافقة المستخدم
                [[NSUserDefaults standardUserDefaults] setInteger:0 forKey:kCrashCountKey];
                [[NSUserDefaults standardUserDefaults] synchronize];
            }]];

            UIViewController *top = window.rootViewController;
            while (top.presentedViewController) top = top.presentedViewController;
            [top presentViewController:alert animated:YES completion:nil];
        });
    }
}

// ─── 6. Welcome Message — رسالة الترحيب ─────────────────────────────────────
static void showWelcomeIfNeeded(void) {
    if (gSafeModeEnabled) return;

    NSString *currentBuild = [[NSBundle mainBundle] infoDictionary][@"CFBundleShortVersionString"] ?: @"1.0";
    NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
    NSString *lastWelcomed = [ud stringForKey:kWelcomeMsgKey];

    if ([lastWelcomed isEqualToString:currentBuild]) return;

    // إصدار جديد لم يُرحَّب به بعد
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

        [alert addAction:[UIAlertAction actionWithTitle:@"ابدأ الآن" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a) {
            [[NSUserDefaults standardUserDefaults] setObject:currentBuild forKey:kWelcomeMsgKey];
            [[NSUserDefaults standardUserDefaults] synchronize];
        }]];

        UIViewController *top = window.rootViewController;
        while (top.presentedViewController) top = top.presentedViewController;
        [top presentViewController:alert animated:YES completion:nil];
    });
}

// ─── نقطة الدخول الرئيسية ─────────────────────────────────────────────────────
__attribute__((constructor))
static void MismariStoreDylibInit(void) {
    NSLog(@"[MismariStore] ═══════════════════════════════════════");
    NSLog(@"[MismariStore]  Mismari Store Dylib — جاري التحميل");
    NSLog(@"[MismariStore] ═══════════════════════════════════════");

    // ① تقييم Safe Mode أولاً — قبل أي شيء
    evaluateSafeMode();

    if (gSafeModeEnabled) {
        NSLog(@"[MismariStore] 🛡️ Safe Mode: تخطي جميع الـ Hooks");
        return;
    }

    // ② تثبيت الـ Hooks
    installJBBypass();
    installNSFileManagerProtection();
    installBundleIDMask();

    // ③ ميزات UI — بعد تحميل الـ App
    dispatch_async(dispatch_get_main_queue(), ^{
        showWelcomeIfNeeded();
        installAutoUpdateChecker();
    });

    NSLog(@"[MismariStore] ✅ جميع الميزات تم تفعيلها بنجاح");
    NSLog(@"[MismariStore] ═══════════════════════════════════════");
}
