/*
 * substrate_shim.m — Mismari Substrate Shim
 *
 * يوفر MSHookFunction و MSHookMessageEx بدون Cydia Substrate
 * يعمل على الأجهزة غير الـ jailbreak عبر:
 *   - fishhook   → لـ C function hooks
 *   - ObjC runtime → لـ ObjC method hooks
 *
 * هذه الرموز "weak" — إذا كان Substrate موجود (jailbreak) يأخذ الأولوية تلقائياً
 */

#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#include <dlfcn.h>
#include <string.h>
#include <stdlib.h>
#include "fishhook.h"

/* ── MSHookMessageEx ────────────────────────────────────────────────────────
 * يُعدِّل تطبيق ObjC method باستخدام ObjC runtime مباشرةً
 * ─────────────────────────────────────────────────────────────────────────── */
__attribute__((visibility("default"))) __attribute__((weak))
void MSHookMessageEx(Class cls, SEL sel, IMP imp, IMP *result) {
    if (!cls || !sel || !imp) return;

    /* ابحث عن الـ method في الـ instance ثم في الـ class إذا لم تجده */
    Method method = class_getInstanceMethod(cls, sel);
    if (!method) method = class_getClassMethod(cls, sel);
    if (!method) return;

    /* احفظ الـ IMP الأصلية للمستدعي */
    if (result) *result = method_getImplementation(method);

    /* ضع الـ IMP الجديدة */
    method_setImplementation(method, imp);
}

/* ── MSHookFunction ─────────────────────────────────────────────────────────
 * يُعيد ربط C function في جداول الرموز عبر fishhook
 * يستخدم dladdr لاستخراج اسم الـ symbol من عنوانه
 * ─────────────────────────────────────────────────────────────────────────── */
__attribute__((visibility("default"))) __attribute__((weak))
void MSHookFunction(void *symbol, void *replace, void **result) {
    if (!symbol || !replace) return;

    /* احصل على اسم الـ symbol من عنوانه */
    Dl_info info;
    memset(&info, 0, sizeof(info));
    if (!dladdr(symbol, &info) || !info.dli_sname) {
        /* fallback: ضع العنوان الأصلي في result وتجاهل الـ hook */
        if (result) *result = symbol;
        return;
    }

    /* fishhook يتجاهل الـ underscore المبدئية (_access → "access") */
    const char *name = info.dli_sname;
    if (name[0] == '_') name++;

    /* أعِد ربط الـ symbol في كل الـ images المحملة */
    struct rebinding rb;
    rb.name        = name;
    rb.replacement = replace;
    rb.replaced    = result;
    rebind_symbols(&rb, 1);

    /* إذا لم يستطع fishhook الربط (symbol غير موجود في stubs)، احفظ الأصل */
    if (result && !*result) *result = symbol;
}
