/*
 * fishhook — Facebook Inc. (MIT License)
 * https://github.com/facebook/fishhook
 * Rebinds symbols in lazy symbol stubs (works without jailbreak)
 */

#pragma once
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

struct rebinding {
    const char *name;
    void       *replacement;
    void      **replaced;
};

int rebind_symbols(struct rebinding rebindings[], size_t rebindings_nel);
int rebind_symbols_image(void *header, intptr_t slide,
                         struct rebinding rebindings[], size_t rebindings_nel);

#ifdef __cplusplus
}
#endif
