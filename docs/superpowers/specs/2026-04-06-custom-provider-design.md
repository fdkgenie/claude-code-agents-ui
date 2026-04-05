# Custom Provider Support — Design Spec

**Date:** 2026-04-06
**Status:** Approved

## Overview

Add support for a user-configurable custom Anthropic-compatible AI provider alongside the built-in Claude provider. Users configure the custom provider in Settings and switch between providers via a dropdown in the chat UI. The selected provider persists as the default.

---

## 1. Data Model

**File:** `~/.claude/providers.json`

```json
{
  "defaultProvider": "claude",
  "providers": [
    {
      "name": "claude",
      "displayName": "Claude (Default)",
      "builtIn": true
    },
    {
      "name": "custom",
      "displayName": "My Custom Provider",
      "baseUrl": "https://example.me",
      "authToken": "sk-***",
      "modelMappings": {
        "opus": "minimax-m2.7",
        "sonnet": "gpt-4o",
        "haiku": "claude-haiku-4-5"
      }
    }
  ]
}
```

**Rules:**
- `builtIn: true` entries are read-only — cannot be edited or deleted in UI
- `modelMappings` is partial — any tier without a mapping falls back to the default Claude alias (`claude-opus-4`, `claude-sonnet-4`, `claude-haiku-4`)
- MVP supports exactly **one** custom provider entry (name always `"custom"`)
- `authToken` is stored plaintext in `~/.claude/` (user-local, acceptable for this use case)
- Supported env var equivalents (for reference, not read at runtime by the app):
  - `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`
  - `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`
  - `ANTHROPIC_MODEL` (free-form default model override)

---

## 2. Backend

### New Files

**`server/utils/providers/providerConfig.ts`**

Reads and writes `~/.claude/providers.json`:

```typescript
interface ProviderConfig {
  defaultProvider: string
  providers: ProviderEntry[]
}

interface ProviderEntry {
  name: string
  displayName: string
  builtIn?: boolean
  baseUrl?: string
  authToken?: string
  modelMappings?: Partial<Record<'opus' | 'sonnet' | 'haiku', string>>
}

async function getProviderConfig(): Promise<ProviderConfig>
async function saveProviderConfig(config: ProviderConfig): Promise<void>
```

Returns default config (claude only, `defaultProvider: 'claude'`) if file does not exist.

---

**`server/utils/providers/customProvider.ts`**

`CustomAnthropicProvider` implements `ProviderAdapter`. Constructed with a `ProviderEntry`.

- **Model resolution:** `modelMappings[tier] ?? MODEL_ALIAS[tier]`
- **SDK usage:** Anthropic SDK instantiated with `baseURL: entry.baseUrl` and `apiKey: entry.authToken`
- **Implements:** `query`, `interrupt`, `normalizeMessage`, `fetchHistory`
- `fetchHistory`: custom provider has no native session storage like the Claude SDK — returns empty result (`{ messages: [], hasMore: false }`)
- `respondToPermission` and `loadAgentInstructions` are optional — implement if supported by the custom endpoint, otherwise no-op / return null

---

### API Routes (`server/api/v2/providers/`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v2/providers` | List providers + `defaultProvider`. Update to read from `providers.json` instead of hardcoded registry. |
| `GET` | `/api/v2/providers/config` | Full config. Auth token returned masked as `sk-***` (show first 3 chars + `***`). |
| `PUT` | `/api/v2/providers/config` | Save config → re-register custom provider in registry → update `defaultProvider`. |
| `DELETE` | `/api/v2/providers/custom` | Remove custom provider entry → reset `defaultProvider` to `"claude"`. |

---

### Registry Integration

**On server start** (`server/plugins/providers.ts` or Nitro `init` hook):
1. Read `providers.json`
2. If custom provider entry exists, construct `CustomAnthropicProvider` and register in `providerRegistry`
3. Call `providerRegistry.setDefault(config.defaultProvider)`

**On `PUT /api/v2/providers/config`:**
1. Save file
2. If custom entry present: deregister old, register new `CustomAnthropicProvider`
3. If custom entry removed: deregister
4. Call `providerRegistry.setDefault(config.defaultProvider)`

---

### Chat WebSocket

In `server/api/v2/chat/ws.ts`, the `start` message accepts an optional `providerName: string`.

Server resolves: `providerRegistry.get(providerName) ?? providerRegistry.getDefault()`

No breaking change — existing clients that don't send `providerName` continue to use the default.

---

## 3. Settings UI

**Location:** `app/pages/settings.vue` — new "Custom Provider" section appended below existing sections.

**Composable:** `app/composables/useProviderConfig.ts`
- `providerConfig` — reactive state (full config)
- `selectedProvider` — ref to `defaultProvider` name
- `save(entry)` — `PUT /api/v2/providers/config`
- `remove()` — `DELETE /api/v2/providers/custom`
- `loading` — request in-flight flag

**Form layout:**

```
┌─ Custom Provider ──────────────────────────────────┐
│                                                     │
│  Provider Name    [My Custom Provider          ]    │
│  Base URL         [https://example.me          ]    │
│  Auth Token       [sk-***                  👁  ]    │
│                                                     │
│  ── Model Mappings (optional) ──────────────────   │
│  Opus   →  [minimax-m2.7                      ]    │
│  Sonnet →  [gpt-4o                            ]    │
│  Haiku  →  [claude-haiku-4-5                  ]    │
│            (empty = use default Claude model)       │
│                                                     │
│  [Remove Provider]              [Save Provider]     │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- Auth Token field has show/hide toggle (👁). Loaded from API in masked form `sk-***`; if user does not retype, send sentinel value `"__unchanged__"` on save so backend skips overwriting the stored token
- Model Mapping placeholders show the default Claude alias (e.g., `claude-opus-4`) so users understand the fallback
- **Save:** validates Base URL (must be valid URL) and Auth Token (required if Base URL is set) before calling API
- **Remove Provider:** calls `DELETE`, clears form, resets to empty state
- If no custom provider exists yet: form is empty with placeholders; only **Save** button shown (creates on first save)

---

## 4. Chat UI

**Component:** `app/components/cli/chatv2/ChatV2ProviderSelector.vue`

Added to the left of `ChatV2ModelSelector` in `ChatV2Interface.vue` top bar:

```
[Claude ▾] [Opus · minimax-m2.7 ▾] [acceptEdits ▾]
```

**Visibility:** Hidden (or rendered as plain non-interactive label) when only the built-in Claude provider exists — no dropdown arrow, no interaction. Becomes a full dropdown once a custom provider is configured.

**Model selector label update:**

When custom provider is active, `ChatV2ModelSelector` options display the mapped model:
- `"Opus · minimax-m2.7"` (mapped)
- `"Haiku"` (no mapping → show tier name only, no `·` suffix)

The label transformation happens in `ChatV2Interface.vue` by computing a derived options array from `MODEL_OPTIONS_CHAT` + `selectedProviderEntry.modelMappings`.

**State flow:**
1. On mount: `GET /api/v2/providers` → set `selectedProvider = defaultProvider`
2. On provider switch: update local state + `PUT /api/v2/providers/config` with new `defaultProvider`
3. Each chat `start` WebSocket message includes `providerName: selectedProvider`

**State location:** `useProviderConfig.ts` (shared composable — same instance used by Settings page and Chat UI via `useState` under the hood).

---

## Out of Scope (MVP)

- Multiple custom providers (only one `"custom"` entry supported)
- Per-session provider override (provider selection is global default)
- Custom provider capability detection (permissions, images, interrupt)
- Import/export of provider config
