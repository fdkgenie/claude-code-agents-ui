# Multi Custom Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the hardcoded single-`custom`-provider constraint so users can configure multiple named Anthropic-compatible providers.

**Architecture:** Extend in-place — no schema changes. Remove `name: 'custom'` hardcoding from API routes, composable, startup plugin, and Settings UI. Replace the single provider form in Settings with an accordion list keyed by user-defined slugs.

**Tech Stack:** Nuxt 3, Vue 3 Composition API, Nitro server routes, `~/.claude/providers.json`

---

## Files Changed

| File | Action |
|------|--------|
| `server/plugins/providers.ts` | Modify — register all non-builtIn providers |
| `server/api/v2/providers/config.put.ts` | Modify — remove hardcoded `name: 'custom'`, add slug validation |
| `server/api/v2/providers/custom.delete.ts` | Delete |
| `server/api/v2/providers/[name].delete.ts` | Create — dynamic route for deleting any provider |
| `app/composables/useProviderConfig.ts` | Modify — replace single-provider API with multi-provider |
| `app/pages/settings.vue` | Modify — replace single form with accordion list |

---

### Task 1: Update startup plugin to register all custom providers

**Files:**
- Modify: `server/plugins/providers.ts`

- [ ] **Step 1: Replace the single-provider lookup with a loop**

Open `server/plugins/providers.ts`. Replace the entire file content with:

```typescript
// server/plugins/providers.ts
import { providerRegistry } from '../utils/providers/registry'
import { getProviderConfig } from '../utils/providers/providerConfig'
import { CustomAnthropicProvider, customProviderInfo } from '../utils/providers/customProvider'

export default defineNitroPlugin(async () => {
  try {
    const config = await getProviderConfig()

    for (const entry of config.providers) {
      if (!entry.builtIn && entry.baseUrl && entry.authToken) {
        providerRegistry.register(new CustomAnthropicProvider(entry), customProviderInfo(entry))
        console.log('[providers] Registered provider:', entry.name, '-', entry.displayName)
      }
    }

    if (providerRegistry.has(config.defaultProvider)) {
      providerRegistry.setDefault(config.defaultProvider)
    }
  }
  catch (err) {
    console.error('[providers] Failed to load providers.json:', err)
  }
})
```

- [ ] **Step 2: Verify dev server starts without errors**

Run: `bun run dev`
Expected: No `[providers]` errors in console. If `providers.json` has an existing `custom` entry, you should see `[providers] Registered provider: custom - <displayName>`.

- [ ] **Step 3: Commit**

```bash
git add server/plugins/providers.ts
git commit -m "feat: register all custom providers on startup"
```

---

### Task 2: Update config.put.ts to support arbitrary provider names

**Files:**
- Modify: `server/api/v2/providers/config.put.ts`

- [ ] **Step 1: Rewrite the route**

Replace the entire file with:

```typescript
// server/api/v2/providers/config.put.ts
import { providerRegistry } from '../../../utils/providers/registry'
import { getProviderConfig, saveProviderConfig } from '../../../utils/providers/providerConfig'
import { CustomAnthropicProvider, customProviderInfo } from '../../../utils/providers/customProvider'
import type { ProviderEntry } from '../../../utils/providers/providerConfig'

const SLUG_REGEX = /^[a-z0-9-]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody<{ entry?: ProviderEntry; defaultProvider?: string }>(event)

  const config = await getProviderConfig()

  if (body.entry) {
    const entry = { ...body.entry }

    if (!entry.name || !SLUG_REGEX.test(entry.name)) {
      throw createError({ statusCode: 400, message: 'Invalid slug. Use lowercase letters, numbers, and hyphens only.' })
    }
    if (entry.name === 'claude') {
      throw createError({ statusCode: 400, message: 'Cannot override built-in provider.' })
    }

    // '__unchanged__' sentinel: keep existing auth token
    if (entry.authToken === '__unchanged__') {
      const existing = config.providers.find(p => p.name === entry.name)
      entry.authToken = existing?.authToken
    }

    const idx = config.providers.findIndex(p => p.name === entry.name)
    if (idx >= 0) {
      config.providers[idx] = entry
    }
    else {
      config.providers.push(entry)
    }

    if (entry.baseUrl && entry.authToken) {
      providerRegistry.register(new CustomAnthropicProvider(entry), customProviderInfo(entry))
    }
  }

  if (body.defaultProvider) {
    config.defaultProvider = body.defaultProvider
    if (providerRegistry.has(body.defaultProvider)) {
      providerRegistry.setDefault(body.defaultProvider)
    }
  }

  await saveProviderConfig(config)
  return { ok: true }
})
```

- [ ] **Step 2: Verify typecheck passes for this file**

Run: `bun run typecheck 2>&1 | grep "config.put"`
Expected: No errors referencing `config.put.ts`.

- [ ] **Step 3: Commit**

```bash
git add server/api/v2/providers/config.put.ts
git commit -m "feat: config.put supports arbitrary provider name slugs"
```

---

### Task 3: Replace custom.delete.ts with dynamic [name].delete.ts

**Files:**
- Delete: `server/api/v2/providers/custom.delete.ts`
- Create: `server/api/v2/providers/[name].delete.ts`

- [ ] **Step 1: Create the dynamic route file**

Create `server/api/v2/providers/[name].delete.ts`:

```typescript
// server/api/v2/providers/[name].delete.ts
import { providerRegistry } from '../../../utils/providers/registry'
import { getProviderConfig, saveProviderConfig } from '../../../utils/providers/providerConfig'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')

  if (!name || name === 'claude') {
    throw createError({ statusCode: 400, message: 'Cannot delete built-in provider.' })
  }

  const config = await getProviderConfig()
  config.providers = config.providers.filter(p => p.name !== name)

  if (config.defaultProvider === name) {
    config.defaultProvider = 'claude'
    providerRegistry.setDefault('claude')
  }

  await saveProviderConfig(config)
  providerRegistry.deregister(name)

  return { ok: true }
})
```

- [ ] **Step 2: Delete the old hardcoded file**

```bash
rm server/api/v2/providers/custom.delete.ts
```

- [ ] **Step 3: Verify dev server still starts**

Run: `bun run dev`
Expected: No errors. Route `DELETE /api/v2/providers/:name` is now active.

- [ ] **Step 4: Commit**

```bash
git add server/api/v2/providers/[name].delete.ts
git rm server/api/v2/providers/custom.delete.ts
git commit -m "feat: replace custom.delete with dynamic [name].delete route"
```

---

### Task 4: Update useProviderConfig composable

**Files:**
- Modify: `app/composables/useProviderConfig.ts`

The old API exposed `saveCustomEntry`, `removeCustomProvider`, `customEntry` (single). Replace with `saveProvider`, `removeProvider`, `customProviders` (array).

- [ ] **Step 1: Rewrite the composable**

Replace the entire file with:

```typescript
// app/composables/useProviderConfig.ts
import type { ProviderConfig, ProviderEntry } from '~/types'

export function useProviderConfig() {
  const config = useState<ProviderConfig | null>('providerConfig', () => null)
  const selectedProvider = useState<string>('selectedProvider', () => 'claude')
  const loading = useState('providerConfigLoading', () => false)

  async function load() {
    loading.value = true
    try {
      const data = await $fetch<ProviderConfig>('/api/v2/providers/config')
      config.value = data
      selectedProvider.value = data.defaultProvider
    }
    finally {
      loading.value = false
    }
  }

  /** Save (create or update) a provider entry. entry.name is the slug. */
  async function saveProvider(entry: ProviderEntry) {
    loading.value = true
    try {
      await $fetch('/api/v2/providers/config', {
        method: 'PUT',
        body: { entry },
      })
      await load()
    }
    finally {
      loading.value = false
    }
  }

  /** Delete a custom provider by slug. */
  async function removeProvider(name: string) {
    loading.value = true
    try {
      await $fetch(`/api/v2/providers/${name}`, { method: 'DELETE' })
      await load()
    }
    finally {
      loading.value = false
    }
  }

  /** Switch the active provider and persist as default. */
  async function switchProvider(providerName: string) {
    selectedProvider.value = providerName
    await $fetch('/api/v2/providers/config', {
      method: 'PUT',
      body: { defaultProvider: providerName },
    })
  }

  const customProviders = computed(
    () => config.value?.providers.filter(p => !p.builtIn) ?? [],
  )

  const hasCustomProvider = computed(() => customProviders.value.length > 0)

  const providers = computed(() => config.value?.providers ?? [])

  return {
    config,
    selectedProvider,
    loading,
    load,
    saveProvider,
    removeProvider,
    switchProvider,
    customProviders,
    hasCustomProvider,
    providers,
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck 2>&1 | grep "useProviderConfig"`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useProviderConfig.ts
git commit -m "feat: useProviderConfig supports multiple custom providers"
```

---

### Task 5: Rewrite Settings UI — accordion list for multiple providers

**Files:**
- Modify: `app/pages/settings.vue`

This task has two parts: (A) update the `<script setup>` block, (B) update the template block.

#### Part A — Script

- [ ] **Step 1: Replace the Custom Provider script block**

In `app/pages/settings.vue`, find and replace the entire "Custom Provider" script section (lines 6–69):

**Find (old):**
```typescript
// Custom Provider
const {
  load: loadProviders,
  saveCustomEntry,
  removeCustomProvider,
  customEntry,
  hasCustomProvider,
  loading: providerLoading,
} = useProviderConfig()

onMounted(() => {
  loadProviders()
})

const providerForm = reactive({
  displayName: '',
  baseUrl: '',
  authToken: '',
  modelMappings: { opus: '', sonnet: '', haiku: '' },
})
const showAuthToken = ref(false)
const providerSaveError = ref('')

watch(customEntry, (entry) => {
  if (entry) {
    providerForm.displayName = entry.displayName
    providerForm.baseUrl = entry.baseUrl ?? ''
    providerForm.authToken = '__unchanged__'
    providerForm.modelMappings.opus = entry.modelMappings?.opus ?? ''
    providerForm.modelMappings.sonnet = entry.modelMappings?.sonnet ?? ''
    providerForm.modelMappings.haiku = entry.modelMappings?.haiku ?? ''
  }
}, { immediate: true })

async function handleSaveProvider() {
  providerSaveError.value = ''
  if (!providerForm.baseUrl) { providerSaveError.value = 'Base URL is required'; return }
  if (!providerForm.authToken) { providerSaveError.value = 'Auth Token is required'; return }
  try {
    new URL(providerForm.baseUrl)
  }
  catch {
    providerSaveError.value = 'Base URL must be a valid URL'
    return
  }
  await saveCustomEntry({
    displayName: providerForm.displayName || 'Custom Provider',
    baseUrl: providerForm.baseUrl,
    authToken: providerForm.authToken,
    modelMappings: {
      ...(providerForm.modelMappings.opus ? { opus: providerForm.modelMappings.opus } : {}),
      ...(providerForm.modelMappings.sonnet ? { sonnet: providerForm.modelMappings.sonnet } : {}),
      ...(providerForm.modelMappings.haiku ? { haiku: providerForm.modelMappings.haiku } : {}),
    },
  })
}

async function handleRemoveProvider() {
  await removeCustomProvider()
  providerForm.displayName = ''
  providerForm.baseUrl = ''
  providerForm.authToken = ''
  providerForm.modelMappings = { opus: '', sonnet: '', haiku: '' }
}
```

**Replace with (new):**
```typescript
// Custom Providers
const {
  load: loadProviders,
  saveProvider,
  removeProvider,
  customProviders,
  loading: providerLoading,
} = useProviderConfig()

onMounted(() => {
  loadProviders()
})

interface ProviderFormState {
  displayName: string
  baseUrl: string
  authToken: string
  modelMappings: { opus: string; sonnet: string; haiku: string }
  error: string
  showToken: boolean
}

const providerForms = reactive<Record<string, ProviderFormState>>({})
const openAccordions = ref<Set<string>>(new Set())
const confirmDelete = ref<string | null>(null)

function makeEmptyForm(): ProviderFormState {
  return { displayName: '', baseUrl: '', authToken: '', modelMappings: { opus: '', sonnet: '', haiku: '' }, error: '', showToken: false }
}

watch(customProviders, (providers) => {
  // Add/update forms for existing providers
  for (const p of providers) {
    if (!providerForms[p.name]) {
      providerForms[p.name] = {
        displayName: p.displayName,
        baseUrl: p.baseUrl ?? '',
        authToken: '__unchanged__',
        modelMappings: { opus: p.modelMappings?.opus ?? '', sonnet: p.modelMappings?.sonnet ?? '', haiku: p.modelMappings?.haiku ?? '' },
        error: '',
        showToken: false,
      }
    }
  }
  // Remove forms for deleted providers (keep __new__ if present)
  for (const key of Object.keys(providerForms)) {
    if (key !== '__new__' && !providers.find(p => p.name === key)) {
      delete providerForms[key]
      openAccordions.value.delete(key)
    }
  }
}, { immediate: true })

function addNewProvider() {
  if (!providerForms.__new__) {
    providerForms.__new__ = makeEmptyForm()
  }
  openAccordions.value = new Set([...openAccordions.value, '__new__'])
}

function toggleAccordion(slug: string) {
  const s = new Set(openAccordions.value)
  if (s.has(slug)) { s.delete(slug) } else { s.add(slug) }
  openAccordions.value = s
}

function closeAccordion(slug: string) {
  openAccordions.value = new Set([...openAccordions.value].filter(s => s !== slug))
}

function cancelNewProvider() {
  delete providerForms.__new__
  closeAccordion('__new__')
}

async function handleSaveProvider(slug: string) {
  const form = providerForms[slug]
  if (!form) return
  form.error = ''

  const isNew = slug === '__new__'
  const effectiveSlug = isNew ? form.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : slug

  if (isNew) {
    if (!effectiveSlug || !/^[a-z0-9-]+$/.test(effectiveSlug)) {
      form.error = 'Provider Name is required and must contain letters/numbers only'
      return
    }
    if (customProviders.value.find(p => p.name === effectiveSlug)) {
      form.error = `Slug "${effectiveSlug}" already exists`
      return
    }
  }
  if (!form.baseUrl) { form.error = 'Base URL is required'; return }
  if (!form.authToken) { form.error = 'Auth Token is required'; return }
  try { new URL(form.baseUrl) } catch { form.error = 'Base URL must be a valid URL'; return }

  await saveProvider({
    name: effectiveSlug,
    displayName: form.displayName || effectiveSlug,
    baseUrl: form.baseUrl,
    authToken: form.authToken,
    modelMappings: {
      ...(form.modelMappings.opus ? { opus: form.modelMappings.opus } : {}),
      ...(form.modelMappings.sonnet ? { sonnet: form.modelMappings.sonnet } : {}),
      ...(form.modelMappings.haiku ? { haiku: form.modelMappings.haiku } : {}),
    },
  })

  if (isNew) {
    cancelNewProvider()
  } else {
    closeAccordion(slug)
  }
}

async function handleRemoveProvider(slug: string) {
  if (confirmDelete.value !== slug) {
    confirmDelete.value = slug
    return
  }
  confirmDelete.value = null
  await removeProvider(slug)
}
```

#### Part B — Template

- [ ] **Step 2: Replace the Custom Provider template section**

In `app/pages/settings.vue`, find and replace the `<!-- Custom Provider -->` block (the full `<div>` from line 571 to line 652):

**Find (old):**
```html
      <!-- Custom Provider -->
      <div class="rounded-xl p-5 space-y-4 bg-card">
        <h3 class="text-section-title">Custom Provider</h3>
        <p class="text-[12px] text-meta">
          Configure an Anthropic-compatible API endpoint to use instead of Claude.
        </p>

        <div class="space-y-3">
          <div class="space-y-1">
            <label class="text-[12px] font-medium text-body">Provider Name</label>
            <input v-model="providerForm.displayName" class="field-input" placeholder="My Custom Provider" />
          </div>

          <div class="space-y-1">
            <label class="text-[12px] font-medium text-body">Base URL <span class="text-error">*</span></label>
            <input v-model="providerForm.baseUrl" class="field-input" placeholder="https://example.me" />
          </div>

          <div class="space-y-1">
            <label class="text-[12px] font-medium text-body">Auth Token <span class="text-error">*</span></label>
            <div class="relative">
              <input
                v-model="providerForm.authToken"
                :type="showAuthToken ? 'text' : 'password'"
                class="field-input pr-10"
                placeholder="sk-***"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-meta hover:text-body transition-colors"
                @click="showAuthToken = !showAuthToken"
              >
                <UIcon :name="showAuthToken ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-3.5" />
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-[12px] font-medium text-body">
              Model Mappings
              <span class="font-normal text-meta">(optional — empty = use default Claude model)</span>
            </p>
            <div class="grid grid-cols-3 gap-2">
              <div class="space-y-1">
                <label class="text-[11px] text-meta">Opus →</label>
                <input v-model="providerForm.modelMappings.opus" class="field-input text-[12px]" placeholder="claude-opus-4" />
              </div>
              <div class="space-y-1">
                <label class="text-[11px] text-meta">Sonnet →</label>
                <input v-model="providerForm.modelMappings.sonnet" class="field-input text-[12px]" placeholder="claude-sonnet-4" />
              </div>
              <div class="space-y-1">
                <label class="text-[11px] text-meta">Haiku →</label>
                <input v-model="providerForm.modelMappings.haiku" class="field-input text-[12px]" placeholder="claude-haiku-4" />
              </div>
            </div>
          </div>

          <p v-if="providerSaveError" class="text-[12px] text-error">{{ providerSaveError }}</p>

          <div class="flex justify-between pt-1">
            <button
              v-if="hasCustomProvider"
              type="button"
              class="text-[12px] text-error hover:opacity-80 transition-opacity"
              :disabled="providerLoading"
              @click="handleRemoveProvider"
            >
              Remove Provider
            </button>
            <div v-else />

            <UButton
              size="sm"
              :loading="providerLoading"
              @click="handleSaveProvider"
            >
              Save Provider
            </UButton>
          </div>
        </div>
      </div>
```

**Replace with (new):**
```html
      <!-- Custom Providers -->
      <div class="rounded-xl p-5 space-y-4 bg-card">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-section-title">Custom Providers</h3>
            <p class="text-[12px] text-meta mt-0.5">
              Add Anthropic-compatible API endpoints as selectable providers in chat.
            </p>
          </div>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            style="background: var(--surface-raised); color: var(--text-secondary); border: 1px solid var(--border-subtle);"
            @click="addNewProvider"
          >
            <UIcon name="i-lucide-plus" class="size-3.5" />
            Add Provider
          </button>
        </div>

        <!-- Accordion list -->
        <div class="space-y-2">
          <!-- Existing providers -->
          <div
            v-for="p in customProviders"
            :key="p.name"
            class="rounded-lg overflow-hidden"
            style="border: 1px solid var(--border-subtle);"
          >
            <!-- Accordion header -->
            <button
              type="button"
              class="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
              style="background: var(--surface-raised);"
              @click="toggleAccordion(p.name)"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  :name="openAccordions.has(p.name) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                  class="size-3.5 shrink-0"
                  style="color: var(--text-secondary);"
                />
                <span class="text-[13px] font-medium" style="color: var(--text-primary);">{{ p.displayName }}</span>
                <span class="text-[11px] font-mono" style="color: var(--text-tertiary);">{{ p.name }}</span>
              </div>
              <button
                type="button"
                class="text-[11px] px-2 py-0.5 rounded transition-colors"
                :class="confirmDelete === p.name ? 'text-white bg-red-500' : 'text-error hover:opacity-80'"
                :disabled="providerLoading"
                @click.stop="handleRemoveProvider(p.name)"
              >
                {{ confirmDelete === p.name ? 'Confirm?' : 'Delete' }}
              </button>
            </button>

            <!-- Accordion body -->
            <div v-if="openAccordions.has(p.name) && providerForms[p.name]" class="px-4 py-3 space-y-3" style="border-top: 1px solid var(--border-subtle);">
              <div class="space-y-1">
                <label class="text-[12px] font-medium text-body">Display Name</label>
                <input v-model="providerForms[p.name].displayName" class="field-input" :placeholder="p.name" />
              </div>
              <div class="space-y-1">
                <label class="text-[12px] font-medium text-body">Slug <span class="text-meta font-normal">(readonly)</span></label>
                <input :value="p.name" class="field-input opacity-60" readonly />
              </div>
              <div class="space-y-1">
                <label class="text-[12px] font-medium text-body">Base URL <span class="text-error">*</span></label>
                <input v-model="providerForms[p.name].baseUrl" class="field-input" placeholder="https://example.me" />
              </div>
              <div class="space-y-1">
                <label class="text-[12px] font-medium text-body">Auth Token <span class="text-error">*</span></label>
                <div class="relative">
                  <input
                    v-model="providerForms[p.name].authToken"
                    :type="providerForms[p.name].showToken ? 'text' : 'password'"
                    class="field-input pr-10"
                    placeholder="sk-***"
                  />
                  <button
                    type="button"
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-meta hover:text-body transition-colors"
                    @click="providerForms[p.name].showToken = !providerForms[p.name].showToken"
                  >
                    <UIcon :name="providerForms[p.name].showToken ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-3.5" />
                  </button>
                </div>
              </div>
              <div class="space-y-2">
                <p class="text-[12px] font-medium text-body">
                  Model Mappings
                  <span class="font-normal text-meta">(optional)</span>
                </p>
                <div class="grid grid-cols-3 gap-2">
                  <div class="space-y-1">
                    <label class="text-[11px] text-meta">Opus →</label>
                    <input v-model="providerForms[p.name].modelMappings.opus" class="field-input text-[12px]" placeholder="claude-opus-4" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[11px] text-meta">Sonnet →</label>
                    <input v-model="providerForms[p.name].modelMappings.sonnet" class="field-input text-[12px]" placeholder="claude-sonnet-4" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[11px] text-meta">Haiku →</label>
                    <input v-model="providerForms[p.name].modelMappings.haiku" class="field-input text-[12px]" placeholder="claude-haiku-4" />
                  </div>
                </div>
              </div>
              <p v-if="providerForms[p.name].error" class="text-[12px] text-error">{{ providerForms[p.name].error }}</p>
              <div class="flex justify-end pt-1">
                <UButton size="sm" :loading="providerLoading" @click="handleSaveProvider(p.name)">
                  Save
                </UButton>
              </div>
            </div>
          </div>

          <!-- New provider form -->
          <div
            v-if="providerForms.__new__"
            class="rounded-lg overflow-hidden"
            style="border: 1px solid var(--border-subtle);"
          >
            <button
              type="button"
              class="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
              style="background: var(--surface-raised);"
              @click="toggleAccordion('__new__')"
            >
              <UIcon
                :name="openAccordions.has('__new__') ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="size-3.5 shrink-0"
                style="color: var(--text-secondary);"
              />
              <span class="text-[13px] font-medium" style="color: var(--text-tertiary);">New Provider</span>
            </button>

            <div v-if="openAccordions.has('__new__')" class="px-4 py-3 space-y-3" style="border-top: 1px solid var(--border-subtle);">
              <div class="space-y-1">
                <label class="text-[12px] font-medium text-body">Provider Name <span class="text-error">*</span> <span class="font-normal text-meta">(used as slug: lowercase alphanumeric + hyphens)</span></label>
                <input v-model="providerForms.__new__.displayName" class="field-input" placeholder="My Provider" />
              </div>
              <div class="space-y-1">
                <label class="text-[12px] font-medium text-body">Base URL <span class="text-error">*</span></label>
                <input v-model="providerForms.__new__.baseUrl" class="field-input" placeholder="https://example.me" />
              </div>
              <div class="space-y-1">
                <label class="text-[12px] font-medium text-body">Auth Token <span class="text-error">*</span></label>
                <div class="relative">
                  <input
                    v-model="providerForms.__new__.authToken"
                    :type="providerForms.__new__.showToken ? 'text' : 'password'"
                    class="field-input pr-10"
                    placeholder="sk-***"
                  />
                  <button
                    type="button"
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-meta hover:text-body transition-colors"
                    @click="providerForms.__new__.showToken = !providerForms.__new__.showToken"
                  >
                    <UIcon :name="providerForms.__new__.showToken ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-3.5" />
                  </button>
                </div>
              </div>
              <div class="space-y-2">
                <p class="text-[12px] font-medium text-body">
                  Model Mappings
                  <span class="font-normal text-meta">(optional)</span>
                </p>
                <div class="grid grid-cols-3 gap-2">
                  <div class="space-y-1">
                    <label class="text-[11px] text-meta">Opus →</label>
                    <input v-model="providerForms.__new__.modelMappings.opus" class="field-input text-[12px]" placeholder="claude-opus-4" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[11px] text-meta">Sonnet →</label>
                    <input v-model="providerForms.__new__.modelMappings.sonnet" class="field-input text-[12px]" placeholder="claude-sonnet-4" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[11px] text-meta">Haiku →</label>
                    <input v-model="providerForms.__new__.modelMappings.haiku" class="field-input text-[12px]" placeholder="claude-haiku-4" />
                  </div>
                </div>
              </div>
              <p v-if="providerForms.__new__.error" class="text-[12px] text-error">{{ providerForms.__new__.error }}</p>
              <div class="flex justify-between pt-1">
                <button
                  type="button"
                  class="text-[12px] text-meta hover:text-body transition-colors"
                  @click="cancelNewProvider"
                >
                  Cancel
                </button>
                <UButton size="sm" :loading="providerLoading" @click="handleSaveProvider('__new__')">
                  Save Provider
                </UButton>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <p v-if="customProviders.length === 0 && !providerForms.__new__" class="text-[12px] text-meta py-2">
            No custom providers yet. Click "Add Provider" to get started.
          </p>
        </div>
      </div>
```

- [ ] **Step 3: Verify typecheck**

Run: `bun run typecheck 2>&1 | grep "settings.vue"`
Expected: No new errors introduced by these changes (the codebase has pre-existing errors unrelated to this work — only check for errors in lines touching `providerForms`, `customProviders`, `handleSaveProvider`, `handleRemoveProvider`).

- [ ] **Step 4: Smoke test in browser**

Start dev server: `bun run dev`

Test checklist:
1. Go to Settings. "Custom Providers" section shows with "Add Provider" button.
2. Click "Add Provider" → new accordion row opens with empty form.
3. Fill in name, URL, token → Save → accordion closes, new row appears in list.
4. Click existing provider row → accordion expands with pre-filled form (slug field is readonly).
5. Edit and Save → accordion closes.
6. Click "Delete" → button shows "Confirm?" → click again → provider removed.
7. Go to CLI Chat — provider selector dropdown shows all configured providers.

- [ ] **Step 5: Commit**

```bash
git add app/pages/settings.vue app/composables/useProviderConfig.ts
git commit -m "feat: Settings UI — accordion list for multiple custom providers"
```

---

### Task 6: Final integration commit

- [ ] **Step 1: Verify full feature end-to-end**

1. Add two custom providers via Settings (e.g., `openrouter` and `minimax`)
2. Check `~/.claude/providers.json` — should have both entries
3. Restart dev server — both providers should appear in chat provider selector
4. Switch between providers in chat — each should send to correct endpoint
5. Delete one provider — it disappears from Settings and chat selector

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: multi-custom-provider support complete"
```
