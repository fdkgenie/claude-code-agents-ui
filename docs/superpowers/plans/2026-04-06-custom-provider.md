# Custom Provider Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-configurable custom Anthropic-compatible AI provider alongside the built-in Claude provider, with a provider selector in the chat UI and a config form in Settings.

**Architecture:** A `CustomAnthropicProvider` adapter is registered in the existing `ProviderRegistry` singleton on server startup (via a Nitro plugin that reads `~/.claude/providers.json`). The chat WebSocket handler already reads `msg.provider` to select the adapter — no WS changes needed. API routes handle CRUD for `providers.json` and re-register the adapter on save. The frontend shares state via `useProviderConfig()` (used in both Settings and the chat top bar).

**Tech Stack:** Nuxt 3, `@anthropic-ai/sdk` (raw Anthropic SDK for custom baseURL support), Vue 3 Composition API, crossws (WebSocket), existing `ProviderRegistry` pattern.

**Spec:** `docs/superpowers/specs/2026-04-06-custom-provider-design.md`

---

## File Map

**New files:**
- `server/utils/providers/providerConfig.ts` — read/write `~/.claude/providers.json`
- `server/utils/providers/customProvider.ts` — `CustomAnthropicProvider` adapter
- `server/plugins/providers.ts` — Nitro plugin: register custom provider on startup
- `server/api/v2/providers/config.get.ts` — GET provider config (token masked)
- `server/api/v2/providers/config.put.ts` — PUT save custom entry + update default
- `server/api/v2/providers/custom.delete.ts` — DELETE custom provider
- `app/composables/useProviderConfig.ts` — frontend state + API calls
- `app/components/cli/chatv2/ChatV2ProviderSelector.vue` — provider dropdown

**Modified files:**
- `server/utils/providers/registry.ts` — add `deregister(name)` method
- `server/api/v2/providers/index.get.ts` — read `defaultProvider` from `providers.json`
- `app/types/index.ts` — add `ProviderEntry`, `ProviderConfig` types
- `app/components/cli/chatv2/ChatV2Interface.vue` — add selector, send `provider` in WS start, compute mapped model labels
- `app/pages/settings.vue` — add Custom Provider form section

---

## Task 1: Create feature branch

- [ ] **Step 1: Create and checkout branch**

```bash
cd /Users/pham/Personal/claude-code-agents-ui
git checkout -b feat-custom-provider
```

Expected: `Switched to a new branch 'feat-custom-provider'`

---

## Task 2: Install `@anthropic-ai/sdk`

The raw Anthropic SDK is needed for custom `baseURL` + `apiKey` support (the agent SDK doesn't expose these). It may already be a transitive dep — install ensures it's explicit.

- [ ] **Step 1: Install**

```bash
bun add @anthropic-ai/sdk
```

Expected: package added or "already installed" in lockfile.

- [ ] **Step 2: Verify typecheck still passes**

```bash
bun run typecheck 2>&1 | tail -5
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: add @anthropic-ai/sdk for custom provider support"
```

---

## Task 3: Add TypeScript types

Add `ProviderEntry` and `ProviderConfig` to the frontend type registry.

**Files:**
- Modify: `app/types/index.ts`

- [ ] **Step 1: Add types** — append to the `// ── Provider Types ──` section at the bottom of `app/types/index.ts`:

```typescript
// ── Custom Provider Config ─────────────────────────────

export interface ProviderEntry {
  name: string
  displayName: string
  builtIn?: boolean
  baseUrl?: string
  authToken?: string
  modelMappings?: Partial<Record<'opus' | 'sonnet' | 'haiku', string>>
}

export interface ProviderConfig {
  defaultProvider: string
  providers: ProviderEntry[]
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/types/index.ts
git commit -m "feat: add ProviderEntry and ProviderConfig types"
```

---

## Task 4: Implement `providerConfig.ts`

Thin utility for reading and writing `~/.claude/providers.json`.

**Files:**
- Create: `server/utils/providers/providerConfig.ts`

- [ ] **Step 1: Create the file**

```typescript
// server/utils/providers/providerConfig.ts
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../claudeDir'

export interface ProviderEntry {
  name: string
  displayName: string
  builtIn?: boolean
  baseUrl?: string
  authToken?: string
  modelMappings?: Partial<Record<'opus' | 'sonnet' | 'haiku', string>>
}

export interface ProviderConfig {
  defaultProvider: string
  providers: ProviderEntry[]
}

const DEFAULT_CONFIG: ProviderConfig = {
  defaultProvider: 'claude',
  providers: [{ name: 'claude', displayName: 'Claude (Default)', builtIn: true }],
}

export async function getProviderConfig(): Promise<ProviderConfig> {
  const filePath = resolveClaudePath('providers.json')
  if (!existsSync(filePath)) return structuredClone(DEFAULT_CONFIG)
  const raw = await readFile(filePath, 'utf-8')
  return JSON.parse(raw) as ProviderConfig
}

export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  const filePath = resolveClaudePath('providers.json')
  await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/utils/providers/providerConfig.ts
git commit -m "feat: add providerConfig util for reading/writing providers.json"
```

---

## Task 5: Implement `CustomAnthropicProvider`

Uses `@anthropic-ai/sdk` with custom `baseURL` and `apiKey`. Resolves model tier → mapped ID.

**Files:**
- Create: `server/utils/providers/customProvider.ts`

- [ ] **Step 1: Create the file**

```typescript
// server/utils/providers/customProvider.ts
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'node:crypto'
import type { Peer } from 'crossws'
import type { ProviderAdapter, ProviderInfo, ProviderQueryOptions } from './types'
import type { NormalizedMessage, ProviderFetchOptions, ProviderFetchResult } from '~/types'
import { MODEL_ALIAS } from '../models'
import type { ProviderEntry } from './providerConfig'

export class CustomAnthropicProvider implements ProviderAdapter {
  name = 'custom'
  private entry: ProviderEntry
  private activeControllers = new Map<string, AbortController>()

  constructor(entry: ProviderEntry) {
    this.entry = entry
  }

  private resolveModel(tier: string): string {
    const mappings = this.entry.modelMappings ?? {}
    return mappings[tier as keyof typeof mappings] ?? MODEL_ALIAS[tier] ?? tier
  }

  async query(prompt: string, options: ProviderQueryOptions, ws: Peer): Promise<void> {
    const sessionId = options.sessionId ?? randomUUID()
    const controller = new AbortController()
    this.activeControllers.set(sessionId, controller)

    const client = new Anthropic({
      baseURL: this.entry.baseUrl,
      apiKey: this.entry.authToken,
    })

    const model = this.resolveModel(options.model ?? 'sonnet')

    const send = (msg: NormalizedMessage) => ws.send(JSON.stringify(msg))

    try {
      const stream = await client.messages.create(
        {
          model,
          max_tokens: 8096,
          ...(options.agentInstructions ? { system: options.agentInstructions } : {}),
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        },
        { signal: controller.signal }
      )

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          send({
            kind: 'stream_delta',
            id: randomUUID(),
            sessionId,
            timestamp: new Date().toISOString(),
            content: event.delta.text,
            provider: 'custom',
          })
        }
      }

      send({ kind: 'stream_end', id: randomUUID(), sessionId, timestamp: new Date().toISOString(), content: '', provider: 'custom' })
      send({ kind: 'complete', id: randomUUID(), sessionId, timestamp: new Date().toISOString(), content: '', provider: 'custom' })
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        send({ kind: 'error', id: randomUUID(), sessionId, timestamp: new Date().toISOString(), content: err.message ?? 'Unknown error', provider: 'custom' })
      }
    } finally {
      this.activeControllers.delete(sessionId)
    }
  }

  async interrupt(sessionId: string): Promise<boolean> {
    const controller = this.activeControllers.get(sessionId)
    if (!controller) return false
    controller.abort()
    this.activeControllers.delete(sessionId)
    return true
  }

  normalizeMessage(_raw: any, _sessionId: string): NormalizedMessage[] {
    return []
  }

  async fetchHistory(_sessionId: string, _options: ProviderFetchOptions): Promise<ProviderFetchResult> {
    return { messages: [], total: 0, hasMore: false }
  }
}

export function customProviderInfo(entry: ProviderEntry): ProviderInfo {
  return {
    name: 'custom',
    displayName: entry.displayName || 'Custom Provider',
    description: `Custom Anthropic-compatible provider at ${entry.baseUrl ?? ''}`,
    models: ['opus', 'sonnet', 'haiku'],
    supportsPermissions: false,
    supportsImages: false,
    supportsInterrupt: true,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/utils/providers/customProvider.ts
git commit -m "feat: implement CustomAnthropicProvider adapter"
```

---

## Task 6: Add `deregister()` to ProviderRegistry + create Nitro plugin

`deregister` is needed so delete operations clean up the registry at runtime.

**Files:**
- Modify: `server/utils/providers/registry.ts`
- Create: `server/plugins/providers.ts`

- [ ] **Step 1: Add `deregister` method to `ProviderRegistry`** — insert after the `has()` method in `registry.ts`:

```typescript
  /**
   * Deregister a provider by name. Built-in providers cannot be deregistered.
   */
  deregister(name: string): void {
    if (name === 'claude') return // built-in, never remove
    this.providers.delete(name)
    this.providerInfo.delete(name)
    console.log(`[ProviderRegistry] Deregistered provider: ${name}`)
  }
```

- [ ] **Step 2: Create Nitro plugin** at `server/plugins/providers.ts`:

```typescript
// server/plugins/providers.ts
import { providerRegistry } from '../utils/providers/registry'
import { getProviderConfig } from '../utils/providers/providerConfig'
import { CustomAnthropicProvider, customProviderInfo } from '../utils/providers/customProvider'

export default defineNitroPlugin(async () => {
  try {
    const config = await getProviderConfig()
    const customEntry = config.providers.find(p => p.name === 'custom' && !p.builtIn)

    if (customEntry?.baseUrl && customEntry?.authToken) {
      providerRegistry.register(new CustomAnthropicProvider(customEntry), customProviderInfo(customEntry))
      console.log('[providers] Registered custom provider:', customEntry.displayName)
    }

    if (providerRegistry.has(config.defaultProvider)) {
      providerRegistry.setDefault(config.defaultProvider)
    }
  } catch (err) {
    console.error('[providers] Failed to load providers.json:', err)
  }
})
```

- [ ] **Step 3: Typecheck**

```bash
bun run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/utils/providers/registry.ts server/plugins/providers.ts
git commit -m "feat: add ProviderRegistry.deregister() and Nitro plugin for provider startup"
```

---

## Task 7: Add provider config API routes

**Files:**
- Modify: `server/api/v2/providers/index.get.ts`
- Create: `server/api/v2/providers/config.get.ts`
- Create: `server/api/v2/providers/config.put.ts`
- Create: `server/api/v2/providers/custom.delete.ts`

- [ ] **Step 1: Update `index.get.ts`** to read `defaultProvider` from file (replace current content):

```typescript
// server/api/v2/providers/index.get.ts
import { providerRegistry } from '../../../utils/providers/registry'
import { getProviderConfig } from '../../../utils/providers/providerConfig'

export default defineEventHandler(async () => {
  const config = await getProviderConfig()
  const providers = providerRegistry.getAllInfo()

  return {
    providers,
    default: config.defaultProvider,
  }
})
```

- [ ] **Step 2: Create `config.get.ts`** — returns full config with masked auth token:

```typescript
// server/api/v2/providers/config.get.ts
import { getProviderConfig } from '../../../utils/providers/providerConfig'

function maskToken(token: string): string {
  if (token.length <= 6) return '***'
  return token.slice(0, 3) + '***'
}

export default defineEventHandler(async () => {
  const config = await getProviderConfig()
  return {
    ...config,
    providers: config.providers.map(p => ({
      ...p,
      authToken: p.authToken ? maskToken(p.authToken) : undefined,
    })),
  }
})
```

- [ ] **Step 3: Create `config.put.ts`** — save custom entry + update defaultProvider, then re-register:

```typescript
// server/api/v2/providers/config.put.ts
import { providerRegistry } from '../../../utils/providers/registry'
import { getProviderConfig, saveProviderConfig } from '../../../utils/providers/providerConfig'
import { CustomAnthropicProvider, customProviderInfo } from '../../../utils/providers/customProvider'
import type { ProviderEntry } from '../../../utils/providers/providerConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ entry?: ProviderEntry; defaultProvider?: string }>(event)

  const config = await getProviderConfig()

  if (body.entry) {
    // Sentinel: '__unchanged__' means keep existing auth token
    if (body.entry.authToken === '__unchanged__') {
      const existing = config.providers.find(p => p.name === 'custom')
      body.entry.authToken = existing?.authToken
    }

    const idx = config.providers.findIndex(p => p.name === 'custom')
    const entry: ProviderEntry = { ...body.entry, name: 'custom' }
    if (idx >= 0) {
      config.providers[idx] = entry
    } else {
      config.providers.push(entry)
    }

    // Re-register in registry
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

- [ ] **Step 4: Create `custom.delete.ts`** — remove custom entry, reset default to 'claude':

```typescript
// server/api/v2/providers/custom.delete.ts
import { providerRegistry } from '../../../utils/providers/registry'
import { getProviderConfig, saveProviderConfig } from '../../../utils/providers/providerConfig'

export default defineEventHandler(async () => {
  const config = await getProviderConfig()

  config.providers = config.providers.filter(p => p.name !== 'custom')
  config.defaultProvider = 'claude'

  await saveProviderConfig(config)

  providerRegistry.deregister('custom')
  providerRegistry.setDefault('claude')

  return { ok: true }
})
```

- [ ] **Step 5: Typecheck**

```bash
bun run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

```bash
bun run dev
# In another terminal:
curl http://localhost:3000/api/v2/providers | jq .
```

Expected: `{ providers: [{ name: 'claude', ... }], default: 'claude' }`

- [ ] **Step 7: Commit**

```bash
git add server/api/v2/providers/index.get.ts \
        server/api/v2/providers/config.get.ts \
        server/api/v2/providers/config.put.ts \
        server/api/v2/providers/custom.delete.ts
git commit -m "feat: add provider config API routes (GET/PUT config, DELETE custom)"
```

---

## Task 8: Create `useProviderConfig` composable

Shared state between Settings and Chat UI. Uses `useState` so both pages read the same reactive instance.

**Files:**
- Create: `app/composables/useProviderConfig.ts`

- [ ] **Step 1: Create the file**

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
    } finally {
      loading.value = false
    }
  }

  /** Save/update the custom provider entry (entry.name will be forced to 'custom') */
  async function saveCustomEntry(entry: Omit<ProviderEntry, 'name' | 'builtIn'>) {
    loading.value = true
    try {
      await $fetch('/api/v2/providers/config', {
        method: 'PUT',
        body: { entry: { ...entry, name: 'custom' } },
      })
      await load()
    } finally {
      loading.value = false
    }
  }

  /** Delete the custom provider and reset default to 'claude' */
  async function removeCustomProvider() {
    loading.value = true
    try {
      await $fetch('/api/v2/providers/custom', { method: 'DELETE' })
      await load()
    } finally {
      loading.value = false
    }
  }

  /**
   * Switch the active provider and persist it as default.
   * Does NOT touch the custom entry details.
   */
  async function switchProvider(providerName: string) {
    selectedProvider.value = providerName
    await $fetch('/api/v2/providers/config', {
      method: 'PUT',
      body: { defaultProvider: providerName },
    })
  }

  const customEntry = computed(
    () => config.value?.providers.find(p => p.name === 'custom' && !p.builtIn) ?? null
  )

  const hasCustomProvider = computed(() => !!customEntry.value)

  const providers = computed(() => config.value?.providers ?? [])

  return {
    config,
    selectedProvider,
    loading,
    load,
    saveCustomEntry,
    removeCustomProvider,
    switchProvider,
    customEntry,
    hasCustomProvider,
    providers,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useProviderConfig.ts
git commit -m "feat: add useProviderConfig composable"
```

---

## Task 9: Create `ChatV2ProviderSelector` component

A dropdown for switching providers. Hidden when only one (built-in) provider exists.

**Files:**
- Create: `app/components/cli/chatv2/ChatV2ProviderSelector.vue`

- [ ] **Step 1: Create the file**

```vue
<!-- app/components/cli/chatv2/ChatV2ProviderSelector.vue -->
<template>
  <!-- Hidden when there's nothing to switch to -->
  <div v-if="options.length > 1" class="relative">
    <USelectMenu
      :model-value="modelValue"
      :options="options"
      value-attribute="name"
      option-attribute="displayName"
      size="xs"
      class="w-36"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <template #leading>
        <UIcon name="i-lucide-cpu" class="size-3 text-muted" />
      </template>
    </USelectMenu>
  </div>
  <!-- Single provider: show plain label, no dropdown -->
  <div v-else class="flex items-center gap-1 text-xs text-muted px-2">
    <UIcon name="i-lucide-cpu" class="size-3" />
    <span>{{ options[0]?.displayName ?? 'Claude' }}</span>
  </div>
</template>

<script setup lang="ts">
import type { ProviderEntry } from '~/types'

const props = defineProps<{
  modelValue: string
  options: Pick<ProviderEntry, 'name' | 'displayName'>[]
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/cli/chatv2/ChatV2ProviderSelector.vue
git commit -m "feat: add ChatV2ProviderSelector component"
```

---

## Task 10: Update `ChatV2Interface.vue`

Three changes: (1) add provider selector to top bar, (2) pass `provider` in WS `start` message, (3) compute mapped model labels when custom provider is active.

**Files:**
- Modify: `app/components/cli/chatv2/ChatV2Interface.vue`

- [ ] **Step 1: Import and set up `useProviderConfig`** — in the `<script setup>` section, add:

```typescript
const { load: loadProviders, providers, selectedProvider, switchProvider, customEntry } = useProviderConfig()

onMounted(() => {
  loadProviders()
})
```

- [ ] **Step 2: Compute mapped model options** — add a computed that rewrites model labels when custom provider is active:

```typescript
const mappedModelOptions = computed(() => {
  const mappings = customEntry.value?.modelMappings
  if (selectedProvider.value !== 'custom' || !mappings) return MODEL_OPTIONS_CHAT

  return MODEL_OPTIONS_CHAT.map(opt => {
    const mapped = mappings[opt.value as 'opus' | 'sonnet' | 'haiku']
    return mapped
      ? { ...opt, label: `${opt.label} · ${mapped}`, description: mapped }
      : opt
  })
})
```

- [ ] **Step 3: Add provider selector to template** — in the top bar, immediately before `<ChatV2ModelSelector`, add:

```html
<ChatV2ProviderSelector
  :model-value="selectedProvider"
  :options="providers"
  @update:model-value="switchProvider"
/>
```

Note: use `:model-value` (not `v-model`) because `switchProvider` already updates `selectedProvider` internally — using both would double-fire.

- [ ] **Step 4: Switch model options** — change:

```html
<ChatV2ModelSelector v-model="selectedModel" :options="MODEL_OPTIONS_CHAT" />
```
to:
```html
<ChatV2ModelSelector v-model="selectedModel" :options="mappedModelOptions" />
```

- [ ] **Step 5: Send `provider` in WS start message** — find the `sendChat` or equivalent function where the WebSocket message with `type: 'start'` is built, and add `provider: selectedProvider.value`:

```typescript
// in the object passed to ws.send / the start message:
{
  type: 'start',
  message: userInput,
  sessionId: currentSessionId.value,
  provider: selectedProvider.value,   // ← add this line
  model: selectedModel.value,
  // ... other existing fields
}
```

- [ ] **Step 6: Typecheck**

```bash
bun run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 7: Manual test in browser**
  1. `bun run dev` → open `http://localhost:3000/cli`
  2. Verify provider selector shows "Claude" (no dropdown since no custom provider yet)
  3. Model selector shows normal labels (Opus, Sonnet, Haiku)

- [ ] **Step 8: Commit**

```bash
git add app/components/cli/chatv2/ChatV2Interface.vue
git commit -m "feat: add provider selector and mapped model labels to chat UI"
```

---

## Task 11: Add Custom Provider section to Settings

**Files:**
- Modify: `app/pages/settings.vue`

- [ ] **Step 1: Import composable** — in the `<script setup>` of `settings.vue`, add:

```typescript
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

// Local form state (does not mutate composable directly)
const providerForm = reactive({
  displayName: '',
  baseUrl: '',
  authToken: '',
  modelMappings: { opus: '', sonnet: '', haiku: '' },
})
const showAuthToken = ref(false)
const providerSaveError = ref('')

// Populate form when customEntry loads
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
  } catch {
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

- [ ] **Step 2: Add template section** — append this block inside the settings page template, after the last existing section (Automations/Hooks):

```html
<!-- Custom Provider -->
<div class="space-y-4">
  <h2 class="text-sm font-semibold text-highlighted">Custom Provider</h2>
  <p class="text-xs text-muted">
    Configure an Anthropic-compatible API endpoint to use instead of Claude.
  </p>

  <div class="space-y-3">
    <UFormField label="Provider Name">
      <UInput v-model="providerForm.displayName" placeholder="My Custom Provider" size="sm" />
    </UFormField>

    <UFormField label="Base URL" required>
      <UInput v-model="providerForm.baseUrl" placeholder="https://example.me" size="sm" />
    </UFormField>

    <UFormField label="Auth Token" required>
      <UInput
        v-model="providerForm.authToken"
        :type="showAuthToken ? 'text' : 'password'"
        placeholder="sk-***"
        size="sm"
      >
        <template #trailing>
          <UButton
            variant="ghost"
            size="xs"
            :icon="showAuthToken ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            @click="showAuthToken = !showAuthToken"
          />
        </template>
      </UInput>
    </UFormField>

    <div class="space-y-2">
      <p class="text-xs font-medium text-muted">Model Mappings <span class="font-normal">(optional — empty = use default Claude model)</span></p>
      <div class="grid grid-cols-3 gap-2">
        <UFormField label="Opus →">
          <UInput v-model="providerForm.modelMappings.opus" placeholder="claude-opus-4" size="sm" />
        </UFormField>
        <UFormField label="Sonnet →">
          <UInput v-model="providerForm.modelMappings.sonnet" placeholder="claude-sonnet-4" size="sm" />
        </UFormField>
        <UFormField label="Haiku →">
          <UInput v-model="providerForm.modelMappings.haiku" placeholder="claude-haiku-4" size="sm" />
        </UFormField>
      </div>
    </div>

    <p v-if="providerSaveError" class="text-xs text-red-500">{{ providerSaveError }}</p>

    <div class="flex justify-between">
      <UButton
        v-if="hasCustomProvider"
        variant="ghost"
        color="error"
        size="sm"
        :loading="providerLoading"
        @click="handleRemoveProvider"
      >
        Remove Provider
      </UButton>
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

- [ ] **Step 3: Typecheck**

```bash
bun run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 4: Manual end-to-end test**
  1. Open `http://localhost:3000/settings`
  2. Fill in Base URL, Auth Token, and at least one model mapping → click **Save Provider**
  3. Verify `~/.claude/providers.json` was created with the correct content:
     ```bash
     cat ~/.claude/providers.json | jq .
     ```
  4. Open `http://localhost:3000/cli` → verify provider dropdown now shows two options
  5. Switch to Custom Provider → verify model labels show mapped names (e.g., "Opus · minimax-m2.7")
  6. Return to Settings → click **Remove Provider** → verify file resets to default

- [ ] **Step 5: Commit**

```bash
git add app/pages/settings.vue
git commit -m "feat: add Custom Provider config section to Settings page"
```

---

## Final: Push branch

- [ ] **Push to remote**

```bash
git push -u origin feat-custom-provider
```
