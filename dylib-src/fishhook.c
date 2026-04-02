/*
 * fishhook — Facebook Inc. (MIT License)
 * Rebinds lazy symbol stubs in Mach-O images.
 * Works on non-jailbroken iOS — no Substrate needed.
 */

#include "fishhook.h"
#include <dlfcn.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/types.h>
#include <mach/mach.h>
#include <mach-o/dyld.h>
#include <mach-o/loader.h>
#include <mach-o/nlist.h>

#ifdef __LP64__
typedef struct mach_header_64    mach_header_t;
typedef struct segment_command_64 segment_command_t;
typedef struct section_64        section_t;
typedef struct nlist_64          nlist_t;
#define LC_SEGMENT_ARCH_DEP      LC_SEGMENT_64
#else
typedef struct mach_header       mach_header_t;
typedef struct segment_command   segment_command_t;
typedef struct section           section_t;
typedef struct nlist             nlist_t;
#define LC_SEGMENT_ARCH_DEP      LC_SEGMENT
#endif

/* ── Internal types ──────────────────────────────────────────────────────── */

struct rebindings_entry {
    struct rebinding   *rebindings;
    size_t              rebindings_nel;
    struct rebindings_entry *next;
};

static struct rebindings_entry *_rebindings_head = NULL;

/* ── Perform rebinding in one image ─────────────────────────────────────── */

static void perform_rebinding_with_section(struct rebindings_entry *rebindings,
                                           section_t *section,
                                           intptr_t slide,
                                           nlist_t *symtab,
                                           char *strtab,
                                           uint32_t *indirect_symtab) {
    uint32_t *indirect_symbol_indices = indirect_symtab + section->reserved1;
    void    **indirect_symbol_bindings = (void**)((uintptr_t)slide + section->addr);

    for (uint32_t i = 0; i < section->size / sizeof(void *); i++) {
        uint32_t symtab_index = indirect_symbol_indices[i];
        if (symtab_index == INDIRECT_SYMBOL_ABS  ||
            symtab_index == INDIRECT_SYMBOL_LOCAL ||
            symtab_index == (INDIRECT_SYMBOL_LOCAL | INDIRECT_SYMBOL_ABS)) {
            continue;
        }

        uint32_t strtab_offset = symtab[symtab_index].n_un.n_strx;
        char    *symbol_name   = strtab + strtab_offset;

        if (symbol_name[0] == '\0') continue;

        /* Symbol names start with '_' in Mach-O; fishhook skips it */
        const char *name = (symbol_name[0] == '_') ? symbol_name + 1 : symbol_name;

        struct rebindings_entry *cur = rebindings;
        while (cur) {
            for (size_t j = 0; j < cur->rebindings_nel; j++) {
                if (strcmp(name, cur->rebindings[j].name) != 0) continue;

                if (cur->rebindings[j].replaced &&
                    indirect_symbol_bindings[i] != cur->rebindings[j].replacement) {
                    *(cur->rebindings[j].replaced) = indirect_symbol_bindings[i];
                }

                /* Make page writable, replace pointer, restore protection */
                vm_address_t addr  = (vm_address_t)&indirect_symbol_bindings[i];
                vm_size_t    pgsize = vm_page_size;
                mach_port_t  task  = mach_task_self();

                vm_address_t aligned = addr & ~(pgsize - 1);
                vm_protect(task, aligned, pgsize, 0, VM_PROT_READ|VM_PROT_WRITE|VM_PROT_COPY);
                indirect_symbol_bindings[i] = cur->rebindings[j].replacement;
                vm_protect(task, aligned, pgsize, 0, VM_PROT_READ|VM_PROT_EXECUTE);
            }
            cur = cur->next;
        }
    }
}

static void rebind_symbols_for_image(struct rebindings_entry *rebindings,
                                     const struct mach_header *header,
                                     intptr_t slide) {
    Dl_info info;
    if (dladdr(header, &info) == 0) return;

    segment_command_t *cur_seg_cmd         = NULL;
    segment_command_t *linkedit_segment    = NULL;
    struct symtab_command    *symtab_cmd   = NULL;
    struct dysymtab_command  *dysymtab_cmd = NULL;

    uintptr_t cur = (uintptr_t)header + sizeof(mach_header_t);
    for (uint32_t i = 0; i < header->ncmds; i++,
            cur += cur_seg_cmd->cmdsize) {

        cur_seg_cmd = (segment_command_t *)cur;

        if (cur_seg_cmd->cmd == LC_SEGMENT_ARCH_DEP) {
            if (strcmp(((segment_command_t *)cur)->segname, SEG_LINKEDIT) == 0)
                linkedit_segment = (segment_command_t *)cur;
        } else if (cur_seg_cmd->cmd == LC_SYMTAB) {
            symtab_cmd = (struct symtab_command *)cur;
        } else if (cur_seg_cmd->cmd == LC_DYSYMTAB) {
            dysymtab_cmd = (struct dysymtab_command *)cur;
        }
    }

    if (!linkedit_segment || !symtab_cmd || !dysymtab_cmd) return;

    uintptr_t linkedit_base = (uintptr_t)slide
                            + linkedit_segment->vmaddr
                            - linkedit_segment->fileoff;

    nlist_t  *symtab       = (nlist_t *)(linkedit_base + symtab_cmd->symoff);
    char     *strtab       = (char   *)(linkedit_base + symtab_cmd->stroff);
    uint32_t *indirect_symtab = (uint32_t *)(linkedit_base + dysymtab_cmd->indirectsymoff);

    cur = (uintptr_t)header + sizeof(mach_header_t);
    for (uint32_t i = 0; i < header->ncmds; i++,
            cur += cur_seg_cmd->cmdsize) {

        cur_seg_cmd = (segment_command_t *)cur;
        if (cur_seg_cmd->cmd != LC_SEGMENT_ARCH_DEP) continue;

        for (uint32_t j = 0; j < cur_seg_cmd->nsects; j++) {
            section_t *sect = (section_t *)(cur + sizeof(segment_command_t))
                            + j;
            uint32_t section_type = sect->flags & SECTION_TYPE;

            if (section_type == S_LAZY_SYMBOL_POINTERS ||
                section_type == S_NON_LAZY_SYMBOL_POINTERS) {
                perform_rebinding_with_section(rebindings, sect, slide,
                                               symtab, strtab, indirect_symtab);
            }
        }
    }
}

/* ── dyld image callback ─────────────────────────────────────────────────── */

static void _rebind_symbols_for_image(const struct mach_header *header,
                                      intptr_t slide) {
    rebind_symbols_for_image(_rebindings_head, header, slide);
}

/* ── Public API ─────────────────────────────────────────────────────────── */

int rebind_symbols_image(void *header, intptr_t slide,
                         struct rebinding rebindings[],
                         size_t rebindings_nel) {
    struct rebindings_entry *entry = malloc(sizeof(struct rebindings_entry));
    if (!entry) return -1;

    entry->rebindings     = malloc(sizeof(struct rebinding) * rebindings_nel);
    if (!entry->rebindings) { free(entry); return -1; }

    memcpy(entry->rebindings, rebindings, sizeof(struct rebinding) * rebindings_nel);
    entry->rebindings_nel = rebindings_nel;
    entry->next           = NULL;

    rebind_symbols_for_image(entry, (const struct mach_header *)header, slide);

    free(entry->rebindings);
    free(entry);
    return 0;
}

int rebind_symbols(struct rebinding rebindings[], size_t rebindings_nel) {
    struct rebindings_entry *new_entry = malloc(sizeof(struct rebindings_entry));
    if (!new_entry) return -1;

    new_entry->rebindings = malloc(sizeof(struct rebinding) * rebindings_nel);
    if (!new_entry->rebindings) { free(new_entry); return -1; }

    memcpy(new_entry->rebindings, rebindings,
           sizeof(struct rebinding) * rebindings_nel);
    new_entry->rebindings_nel = rebindings_nel;
    new_entry->next           = _rebindings_head;
    _rebindings_head          = new_entry;

    _dyld_register_func_for_add_image(_rebind_symbols_for_image);

    uint32_t n = _dyld_image_count();
    for (uint32_t i = 0; i < n; i++) {
        rebind_symbols_for_image(new_entry,
                                 _dyld_get_image_header(i),
                                 _dyld_get_image_vmaddr_slide(i));
    }

    return 0;
}
