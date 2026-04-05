# Multi Custom Provider Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the existing single-custom-provider feature to support multiple user-defined Anthropic-compatible providers, each identified by a unique user-defined slug.

**Approach:** Approach A — extend in-place, remove hardcoded `'custom'` name constraint, minimal API changes.

---

## 1. Data Model

No structural changes to `ProviderEntry` or `ProviderConfig`. The `providers.json` schema already supports arbitrary provider names. Existing entries (including any provider named `custom`) continue to work without migration.

```json
{
  "defaultProvider": "openrouter",
  "providers": [
    { "name": "claude", "displayName": "Claude (Default)", "builtIn": true },
    {
      "name": "openrouter",
      "displayName": "OpenRouter",
      "baseUrl": "https://openrouter.ai/api/v1",
      "authToken": "sk-or-***",
      "modelMappings": { "sonnet": "openai/gpt-4o" }
    },
    {
      "name": "minimax",
      "displayName": "MiniMax",
      "baseUrl": "https://api.minimax.io/v1",
      "authToken": "sk-***"
    }
  ]
}
```

`name` rules:
- User-provided slug, set once at creation (readonly after save)
- Lowercase alphanumeric + `-` only (e.g., `openrouter`, `my-provider`)
- Must be unique across all providers
- Cannot be `claude` (reserved for built-in)

---

## 2. Backend

### 2a. `server/api/v2/providers/config.put.ts`

Remove hardcoded `name: 'custom'`. Use `entry.name` from request body directly. Upsert by `entry.name`. Validate name format server-side (reject if not matching `/^[a-z0-9-]+$/` or if `builtIn: true`).

The `__unchanged__` sentinel for auth token now looks up by `entry.name` (not hardcoded `'custom'`).

### 2b. `server/api/v2/providers/custom.delete.ts` → `server/api/v2/providers/[name].delete.ts`

Convert to dynamic route. Reads `name` from route params. Guards: cannot delete `claude` (built-in). Deregisters from registry and removes from config.

### 2c. `server/plugins/providers.ts`

Register ALL non-builtIn providers with valid `baseUrl` + `authToken`, not just the one named `'custom'`:

```typescript
for (const entry of config.providers) {
  if (!entry.builtIn && entry.baseUrl && entry.authToken) {
    providerRegistry.register(new CustomAnthropicProvider(entry), customProviderInfo(entry))
  }
}
```

`ProviderRegistry`, `CustomAnthropicProvider`, and `customProviderInfo` require no changes — they already accept arbitrary names.

---

## 3. Composable (`app/composables/useProviderConfig.ts`)

Replace single-provider API with multi-provider API:

| Old | New |
|-----|-----|
| `customEntry` (single `ProviderEntry \| null`) | `customProviders` (array `ProviderEntry[]`) |
| `hasCustomProvider` | kept (true if `customProviders.length > 0`) |
| `saveCustomEntry(entry)` | `saveProvider(entry: ProviderEntry)` — sends `entry.name` as-is |
| `removeCustomProvider()` | `removeProvider(name: string)` — calls `DELETE /api/v2/providers/[name]` |

`providers`, `selectedProvider`, `switchProvider`, `load`, `loading` are unchanged.

---

## 4. Settings UI

The "Custom Provider" section becomes a multi-provider accordion list.

### Layout

```
┌─ Custom Providers ──────────────────────────────────┐
│  [+ Add Provider]                                    │
│                                                      │
│  ▶ OpenRouter                          [Delete]      │
│  ▼ MiniMax                             [Delete]      │
│    ┌─────────────────────────────────────────────┐  │
│    │ Slug*      [minimax              ]           │  │
│    │ Name       [MiniMax              ]           │  │
│    │ Base URL*  [https://...          ]           │  │
│    │ Auth Token*[sk-***               ] [👁]      │  │
│    │ Model mappings (optional)                    │  │
│    │  Opus →  [  ] Sonnet → [  ] Haiku → [  ]    │  │
│    │                              [Save]          │  │
│    └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Behavior

- **Add Provider**: Opens a new accordion entry with empty form. Slug field is editable (provider not yet saved).
- **Existing providers**: Slug field is `readonly` — slug cannot be changed after creation (it is the registry key).
- **Save**: Upserts via `saveProvider(entry)`. Collapses the accordion row on success.
- **Delete**: Button text changes to "Confirm?" on first click; second click executes `removeProvider(name)`. Resets if user clicks elsewhere.
- **Validation** (client-side, mirrored server-side):
  - Slug: required, `/^[a-z0-9-]+$/`, unique among existing providers
  - Base URL: required, valid URL
  - Auth Token: required (or `__unchanged__` for existing providers)

### State management

Settings page replaces `providerForm` (single reactive object) with a list-based pattern:
- `providerForms`: `Map<string, ReactiveForm>` keyed by slug (or `'__new__'` for unsaved entries)
- `openAccordions`: `Set<string>` tracking which accordions are expanded
- `deletingProviders`: `Set<string>` tracking which are in "Confirm?" state

---

## 5. Chat UI (no changes needed)

`ChatV2Interface.vue` reads providers from `useProviderConfig().providers` (all providers including built-in). The `ChatV2ProviderSelector` already renders all options and shows the selector only when `options.length > 1`. No changes required.

---

## Out of Scope

- Reordering providers
- Import/export provider configs
- Per-provider rate limiting or fallback chains
