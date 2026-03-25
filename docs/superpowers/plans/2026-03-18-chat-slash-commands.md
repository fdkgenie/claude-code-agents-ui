# Chat Slash Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to invoke skills and commands from the chat UI via slash syntax (`/skill`, `/agent:skill args`) with an autocomplete dropdown.

**Architecture:** Frontend parses `/` input into a structured `SkillInvocation` payload. A new autocomplete dropdown uses cached skills/commands data for instant suggestions. Backend resolves the skill reference from the filesystem using existing utils and injects content into the SDK prompt.

**Tech Stack:** Nuxt 3, Vue 3, TypeScript, @anthropic-ai/claude-agent-sdk, Node fs

**Spec:** `docs/superpowers/specs/2026-03-18-chat-slash-commands-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `app/types/index.ts` | Add `SkillInvocation` type |
| `server/utils/resolveSkill.ts` | **New** — filesystem skill/command resolution logic |
| `server/api/chat.post.ts` | Use `resolveSkill` to detect `invoke` and build prompt |
| `app/composables/useChat.ts` | Parse `/` prefix into `invoke` payload |
| `app/components/ChatSkillAutocomplete.vue` | **New** — autocomplete dropdown component |
| `app/components/ChatPanel.vue` | Wire autocomplete, modify keydown handling |

---

### Task 1: Add SkillInvocation type

**Files:**
- Modify: `app/types/index.ts`

- [ ] **Step 1: Add the type**

At the end of `app/types/index.ts`, add:

```ts
export interface SkillInvocation {
  skill: string
  args: string | null
}
```

- [ ] **Step 2: Commit**

```bash
git add app/types/index.ts
git commit -m "feat: add SkillInvocation type for chat slash commands"
```

---

### Task 2: Backend skill resolution utility

**Files:**
- Create: `server/utils/resolveSkill.ts`

- [ ] **Step 1: Create resolveSkill utility**

This utility reads the filesystem to find a skill or command matching the invocation. It reuses `resolveClaudePath` and `parseFrontmatter`.

```ts
// server/utils/resolveSkill.ts
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveClaudePath } from './claudeDir'
import { parseFrontmatter } from './frontmatter'
import type { SkillFrontmatter, CommandFrontmatter } from '~/types'

interface ResolvedSkill {
  name: string
  agent: string | null
  body: string
}

export async function resolveSkillInvocation(
  skillRef: string,
): Promise<ResolvedSkill | null> {
  // Parse "agent:name" or just "name"
  let agentFilter: string | null = null
  let skillName: string

  if (skillRef.includes(':')) {
    const parts = skillRef.split(':')
    agentFilter = parts[0]!
    skillName = parts.slice(1).join(':')
  } else {
    skillName = skillRef
  }

  // 1. Try standalone skills
  const result = await resolveFromSkillsDir(skillName, agentFilter)
  if (result) return result

  // 2. Try plugin skills
  const pluginResult = await resolveFromPluginSkills(skillName, agentFilter)
  if (pluginResult) return pluginResult

  // 3. Try commands
  const commandResult = await resolveFromCommands(skillName)
  if (commandResult) return commandResult

  return null
}

async function resolveFromSkillsDir(
  name: string,
  agentFilter: string | null,
): Promise<ResolvedSkill | null> {
  const skillPath = resolveClaudePath('skills', name, 'SKILL.md')
  if (!existsSync(skillPath)) return null

  const raw = await readFile(skillPath, 'utf-8')
  const { frontmatter, body } = parseFrontmatter<SkillFrontmatter>(raw)

  if (agentFilter && frontmatter.agent !== agentFilter) return null

  return {
    name: frontmatter.name || name,
    agent: frontmatter.agent || null,
    body,
  }
}

async function resolveFromPluginSkills(
  name: string,
  agentFilter: string | null,
): Promise<ResolvedSkill | null> {
  const installedPath = resolveClaudePath('plugins', 'installed_plugins.json')
  if (!existsSync(installedPath)) return null

  let installed: { plugins: Record<string, { installPath: string }[]> }
  try {
    const raw = await readFile(installedPath, 'utf-8')
    installed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!installed?.plugins) return null

  for (const entries of Object.values(installed.plugins)) {
    const entry = entries[0]
    if (!entry) continue

    const skillPath = join(entry.installPath, 'skills', name, 'SKILL.md')
    if (!existsSync(skillPath)) continue

    const raw = await readFile(skillPath, 'utf-8')
    const { frontmatter, body } = parseFrontmatter<SkillFrontmatter>(raw)

    if (agentFilter && frontmatter.agent !== agentFilter) continue

    return {
      name: frontmatter.name || name,
      agent: frontmatter.agent || null,
      body,
    }
  }

  return null
}

async function resolveFromCommands(name: string): Promise<ResolvedSkill | null> {
  const commandsDir = resolveClaudePath('commands')
  if (!existsSync(commandsDir)) return null

  // Direct match: commands/<name>.md
  const directPath = join(commandsDir, `${name}.md`)
  if (existsSync(directPath)) {
    const raw = await readFile(directPath, 'utf-8')
    const { frontmatter, body } = parseFrontmatter<CommandFrontmatter>(raw)
    return {
      name: frontmatter.name || name,
      agent: null,
      body,
    }
  }

  // Nested match: scan subdirectories for <dir>/<name>.md
  const entries = await readdir(commandsDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const nestedPath = join(commandsDir, entry.name, `${name}.md`)
    if (existsSync(nestedPath)) {
      const raw = await readFile(nestedPath, 'utf-8')
      const { frontmatter, body } = parseFrontmatter<CommandFrontmatter>(raw)
      return {
        name: frontmatter.name || name,
        agent: null,
        body,
      }
    }
  }

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add server/utils/resolveSkill.ts
git commit -m "feat: add resolveSkill utility for slash command resolution"
```

---

### Task 3: Backend chat handler — inject resolved skill

**Files:**
- Modify: `server/api/chat.post.ts`

- [ ] **Step 1: Update body type and add skill resolution**

At the top of `chat.post.ts` (line 2), add the import:

```ts
import { resolveSkillInvocation } from '../utils/resolveSkill'
```

Update the body type at line 10:

```ts
const body = await readBody<{
  messages: ChatMessage[]
  sessionId?: string
  invoke?: { skill: string; args: string | null }
}>(event)
```

Between line 19 (after `lastUserMessage` check) and line 21 (before `const claudeDir`), add skill resolution. This must be BEFORE the SSE header setup at line 24:

```ts
// Resolve skill invocation if present
let prompt = lastUserMessage.content
if (body.invoke) {
  const resolved = await resolveSkillInvocation(body.invoke.skill)
  if (!resolved) {
    // Not found — set up SSE just for the error response, then return early
    setResponseHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })
    event.node.res.write(`data: ${JSON.stringify({ type: 'error', message: `Skill not found: ${body.invoke.skill}` })}\n\n`)
    event.node.res.write(`data: ${JSON.stringify({ type: 'done', sessionId: body.sessionId || null })}\n\n`)
    event.node.res.end()
    return
  }

  const skillBlock = `<skill name="${resolved.name}"${resolved.agent ? ` agent="${resolved.agent}"` : ''}>\n${resolved.body}\n</skill>`
  prompt = body.invoke.args
    ? `${skillBlock}\n\nUser request: ${body.invoke.args}`
    : skillBlock
}
```

Then at line 39 in the `query()` call, change:
```ts
// FROM:
prompt: lastUserMessage.content,
// TO:
prompt: prompt,
```

The variable `prompt` is declared with `let` above, so it either holds the original `lastUserMessage.content` (no invoke) or the resolved skill content (with invoke).

- [ ] **Step 2: Commit**

```bash
git add server/api/chat.post.ts
git commit -m "feat: resolve skill invocations in chat backend"
```

---

### Task 4: Frontend — parse slash commands in useChat

**Files:**
- Modify: `app/composables/useChat.ts`

- [ ] **Step 1: Add slash command parsing to sendMessage**

Import the type at the top:

```ts
import type { SkillInvocation } from '~/types'
```

Inside `sendMessage`, after `addMessage('user', content)` and before the fetch call, add parsing logic:

```ts
// Parse slash command
let invoke: SkillInvocation | undefined
const trimmed = content.trim()
if (trimmed.startsWith('/')) {
  const withoutSlash = trimmed.slice(1)
  const spaceIdx = withoutSlash.indexOf(' ')
  if (spaceIdx === -1) {
    invoke = { skill: withoutSlash, args: null }
  } else {
    invoke = {
      skill: withoutSlash.slice(0, spaceIdx),
      args: withoutSlash.slice(spaceIdx + 1).trim() || null,
    }
  }
}
```

Then update the fetch body to include `invoke`:

```ts
body: {
  messages: messages.value
    .filter(m => m.content)
    .map(m => ({ role: m.role, content: m.content })),
  sessionId: sessionId.value,
  ...(invoke ? { invoke } : {}),
},
```

- [ ] **Step 2: Commit**

```bash
git add app/composables/useChat.ts
git commit -m "feat: parse slash commands in sendMessage"
```

---

### Task 5: Autocomplete dropdown component

**Files:**
- Create: `app/components/ChatSkillAutocomplete.vue`

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
import type { Skill, Command } from '~/types'

const props = defineProps<{
  query: string
  skills: Skill[]
  commands: Command[]
  visible: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  select: [value: string]
}>()

interface AutocompleteItem {
  id: string
  label: string
  description: string
  agent: string | null
  type: 'skill' | 'command'
  value: string // what gets inserted: "agent:skill" or "skill"
}

const selectedIndex = ref(0)

const items = computed<AutocompleteItem[]>(() => {
  const results: AutocompleteItem[] = []

  for (const skill of props.skills) {
    const agent = skill.frontmatter.agent || null
    results.push({
      id: `skill-${skill.slug}`,
      label: skill.frontmatter.name || skill.slug,
      description: skill.frontmatter.description || '',
      agent,
      type: 'skill',
      value: agent ? `${agent}:${skill.slug}` : skill.slug,
    })
  }

  for (const cmd of props.commands) {
    results.push({
      id: `cmd-${cmd.slug}`,
      label: cmd.frontmatter.name || cmd.slug,
      description: cmd.frontmatter.description || '',
      agent: null,
      type: 'command',
      value: cmd.slug,
    })
  }

  return results
})

const filtered = computed(() => {
  const q = props.query.toLowerCase()
  if (!q) return items.value.slice(0, 20)
  return items.value
    .filter(item =>
      item.label.toLowerCase().includes(q)
      || item.value.toLowerCase().includes(q)
      || (item.agent?.toLowerCase().includes(q) ?? false)
    )
    .slice(0, 20)
})

// Group by agent
const grouped = computed(() => {
  const groups: { label: string; items: AutocompleteItem[] }[] = []
  const agentMap = new Map<string, AutocompleteItem[]>()
  const general: AutocompleteItem[] = []

  for (const item of filtered.value) {
    if (item.agent) {
      if (!agentMap.has(item.agent)) agentMap.set(item.agent, [])
      agentMap.get(item.agent)!.push(item)
    } else {
      general.push(item)
    }
  }

  for (const [agent, agentItems] of agentMap) {
    groups.push({ label: agent, items: agentItems })
  }
  if (general.length) {
    groups.push({ label: 'General', items: general })
  }

  return groups
})

// Flat list for keyboard navigation
const flatFiltered = computed(() => filtered.value)

watch(() => props.query, () => { selectedIndex.value = 0 })

function moveUp() {
  if (selectedIndex.value > 0) selectedIndex.value--
}

function moveDown() {
  if (selectedIndex.value < flatFiltered.value.length - 1) selectedIndex.value++
}

function selectCurrent() {
  const item = flatFiltered.value[selectedIndex.value]
  if (item) emit('select', item.value)
}

function selectItem(value: string) {
  emit('select', value)
}

defineExpose({ moveUp, moveDown, selectCurrent, hasItems: computed(() => filtered.value.length > 0) })
</script>

<template>
  <div
    v-if="visible && (filtered.length > 0 || loading)"
    class="absolute bottom-full left-0 right-0 mb-2 rounded-xl overflow-hidden"
    style="
      background: var(--surface-raised);
      border: 1px solid var(--border-subtle);
      box-shadow: 0 -4px 16px var(--card-shadow);
      max-height: 200px;
      overflow-y: auto;
    "
  >
    <!-- Loading state -->
    <div
      v-if="loading && filtered.length === 0"
      class="px-3 py-3 text-[11px] font-mono"
      style="color: var(--text-disabled);"
    >
      Loading...
    </div>

    <template v-for="group in grouped" :key="group.label">
      <div
        class="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider sticky top-0"
        style="color: var(--text-disabled); background: var(--surface-raised); border-bottom: 1px solid var(--border-subtle);"
      >
        {{ group.label }}
      </div>
      <button
        v-for="item in group.items"
        :key="item.id"
        class="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-75"
        :style="{
          background: flatFiltered[selectedIndex]?.id === item.id ? 'var(--surface-hover)' : 'transparent',
        }"
        @click="selectItem(item.value)"
        @mouseenter="selectedIndex = flatFiltered.findIndex(f => f.id === item.id)"
      >
        <UIcon
          :name="item.type === 'skill' ? 'i-lucide-sparkles' : 'i-lucide-terminal'"
          class="size-3.5 shrink-0"
          style="color: var(--text-disabled);"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-[12px] font-medium truncate" style="color: var(--text-primary); font-family: var(--font-sans);">
              {{ item.label }}
            </span>
            <span
              v-if="item.agent"
              class="text-[9px] font-mono px-1.5 py-px rounded-full shrink-0"
              style="background: var(--badge-subtle-bg); color: var(--text-tertiary);"
            >
              {{ item.agent }}
            </span>
          </div>
          <span
            v-if="item.description"
            class="text-[11px] truncate block"
            style="color: var(--text-tertiary);"
          >
            {{ item.description }}
          </span>
        </div>
        <span class="text-[10px] font-mono shrink-0" style="color: var(--text-disabled);">
          /{{ item.value }}
        </span>
      </button>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/ChatSkillAutocomplete.vue
git commit -m "feat: add ChatSkillAutocomplete dropdown component"
```

---

### Task 6: Wire autocomplete into ChatPanel

**Files:**
- Modify: `app/components/ChatPanel.vue`

- [ ] **Step 1: Update existing composable destructuring and add autocomplete state**

Update the existing composable calls at lines 8-11 to also extract `skills`, `commands`, and their loading states. Don't add new separate calls — extend the existing ones:

```ts
const { fetchAll: fetchAgents } = useAgents()
const { fetchAll: fetchCommands, commands } = useCommands()
const { fetchAll: fetchSkills, skills, loading: skillsLoading } = useSkills()
const { fetchAll: fetchPlugins } = usePlugins()
```

Then add autocomplete state after the existing refs (after line 16):

```ts
// Autocomplete
const autocompleteRef = ref<{ moveUp: () => void; moveDown: () => void; selectCurrent: () => void; hasItems: { value: boolean } } | null>(null)

const autocompleteVisible = computed(() => {
  return input.value.startsWith('/') && !isStreaming.value
})

const autocompleteQuery = computed(() => {
  if (!input.value.startsWith('/')) return ''
  const withoutSlash = input.value.slice(1)
  const spaceIdx = withoutSlash.indexOf(' ')
  return spaceIdx === -1 ? withoutSlash : withoutSlash.slice(0, spaceIdx)
})

function onAutocompleteSelect(value: string) {
  input.value = `/${value} `
  nextTick(() => inputRef.value?.focus())
}
```

Note: we type `autocompleteRef` with an inline interface instead of `InstanceType<typeof ChatSkillAutocomplete>` because Nuxt auto-imports don't make component types available in `<script setup>`.

- [ ] **Step 2: Update handleEscape to respect autocomplete**

Replace the existing `handleEscape` function (line 39-43) to check autocomplete state first:

```ts
function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    // If autocomplete is showing, don't close the panel
    if (autocompleteVisible.value) return
    emit('update:open', false)
  }
}
```

- [ ] **Step 3: Update handleKeydown to delegate to autocomplete**

Replace the existing `handleKeydown` function (line 77-82):

```ts
function handleKeydown(e: KeyboardEvent) {
  if (autocompleteVisible.value && autocompleteRef.value && autocompleteRef.value.hasItems.value) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      autocompleteRef.value.moveUp()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      autocompleteRef.value.moveDown()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      autocompleteRef.value.selectCurrent()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      autocompleteRef.value.selectCurrent()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      input.value = ''
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
```

- [ ] **Step 4: Add the autocomplete component to the template**

Inside the `<div class="relative rounded-2xl ...">` wrapper (line 380), right before the `<textarea>` (line 387), add:

```html
<ChatSkillAutocomplete
  ref="autocompleteRef"
  :query="autocompleteQuery"
  :skills="skills"
  :commands="commands"
  :visible="autocompleteVisible"
  :loading="skillsLoading"
  @select="onAutocompleteSelect"
/>
```

This must be inside the `relative rounded-2xl` div, not the outer `shrink-0 px-5 pb-5 pt-2` div, so the absolute positioning anchors correctly.

- [ ] **Step 5: Commit**

```bash
git add app/components/ChatPanel.vue
git commit -m "feat: wire autocomplete dropdown into chat panel"
```

---

### Task 7: Manual end-to-end test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test autocomplete**

1. Open the chat panel
2. Type `/` — verify the dropdown appears with skills and commands
3. Type `/road` — verify filtering works
4. Use arrow keys + Enter — verify selection fills the input
5. Press Escape — verify dropdown closes without closing panel

- [ ] **Step 3: Test skill invocation**

1. Type `/pm:roadmap build a task manager` and press Enter (with autocomplete closed by pressing space after selection)
2. Verify the message is sent and Claude responds using the skill content
3. Type a non-existent skill like `/nonexistent` and press Enter
4. Verify the error "Skill not found: nonexistent" appears

- [ ] **Step 4: Test regular messages**

1. Type a normal message without `/` prefix — verify normal behavior
2. Type something like `/etc/config` (no matching skill) — verify it's sent as plain text

- [ ] **Step 5: Commit any fixes if needed**
