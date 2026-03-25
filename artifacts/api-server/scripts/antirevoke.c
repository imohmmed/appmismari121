#include <string.h>
#include <strings.h>
#include <netdb.h>
#include <dlfcn.h>
#include <stddef.h>

static const char *blocked_domains[] = {
    "ocsp.apple.com",
    "ocsp2.apple.com",
    "valid.apple.com",
    "crl.apple.com",
    "certs.apple.com",
    "appattest.apple.com",
    "albert.apple.com",
    "ppq.apple.com",
    NULL
};

static int is_blocked(const char *hostname) {
    if (!hostname) return 0;
    size_t hlen = strlen(hostname);
    for (int i = 0; blocked_domains[i]; i++) {
        const char *dom = blocked_domains[i];
        size_t dlen = strlen(dom);
        if (hlen == dlen && strcasecmp(hostname, dom) == 0) return 1;
        if (hlen > dlen && hostname[hlen - dlen - 1] == '.'
            && strcasecmp(hostname + hlen - dlen, dom) == 0) return 1;
    }
    return 0;
}

typedef int (*getaddrinfo_t)(const char *, const char *,
                             const struct addrinfo *, struct addrinfo **);
typedef struct hostent *(*gethostbyname_t)(const char *);

static getaddrinfo_t   orig_getaddrinfo   = NULL;
static gethostbyname_t orig_gethostbyname = NULL;

int my_getaddrinfo(const char *hostname, const char *servname,
                   const struct addrinfo *hints, struct addrinfo **res) {
    if (is_blocked(hostname)) return EAI_FAIL;
    if (!orig_getaddrinfo)
        orig_getaddrinfo = (getaddrinfo_t)dlsym(RTLD_NEXT, "getaddrinfo");
    if (orig_getaddrinfo) return orig_getaddrinfo(hostname, servname, hints, res);
    return EAI_FAIL;
}

struct hostent *my_gethostbyname(const char *name) {
    if (is_blocked(name)) {
        h_errno = HOST_NOT_FOUND;
        return NULL;
    }
    if (!orig_gethostbyname)
        orig_gethostbyname = (gethostbyname_t)dlsym(RTLD_NEXT, "gethostbyname");
    if (orig_gethostbyname) return orig_gethostbyname(name);
    h_errno = HOST_NOT_FOUND;
    return NULL;
}

struct interpose_entry {
    const void *replacement;
    const void *replacee;
};

__attribute__((used))
__attribute__((section("__DATA,__interpose")))
static struct interpose_entry interposers[] = {
    { (const void *)&my_getaddrinfo,   (const void *)&getaddrinfo   },
    { (const void *)&my_gethostbyname, (const void *)&gethostbyname },
};
