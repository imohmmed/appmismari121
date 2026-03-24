#include <string.h>
#include <netdb.h>
#include <dlfcn.h>

static const char *blocked_hosts[] = {
    "ocsp.apple.com",
    "ocsp2.apple.com",
    "valid.apple.com",
    "crl.apple.com",
    "certs.apple.com",
    "appattest.apple.com",
    NULL
};

typedef int (*getaddrinfo_t)(const char *, const char *, const struct addrinfo *, struct addrinfo **);

int my_getaddrinfo(const char *hostname, const char *servname,
                   const struct addrinfo *hints, struct addrinfo **res) {
    if (hostname) {
        for (int i = 0; blocked_hosts[i]; i++) {
            if (strcmp(hostname, blocked_hosts[i]) == 0) {
                return EAI_FAIL;
            }
        }
    }
    getaddrinfo_t orig = (getaddrinfo_t)dlsym(RTLD_NEXT, "getaddrinfo");
    if (orig) return orig(hostname, servname, hints, res);
    return EAI_FAIL;
}

struct interpose_entry {
    const void *replacement;
    const void *replacee;
};

__attribute__((used))
__attribute__((section("__DATA,__interpose")))
static struct interpose_entry interpose_getaddrinfo = {
    (const void *)&my_getaddrinfo,
    (const void *)&getaddrinfo
};
