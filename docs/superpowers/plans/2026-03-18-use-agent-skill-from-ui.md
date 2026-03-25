# Use Agent / Use Skill from UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Chat with agent" and "Use skill" buttons to detail pages that open the chat panel with agent context or skill prefill.

**Architecture:** Extend `useChat` composable with shared panel state, active agent tracking, and input prefill. ChatPanel renders an agent banner when active. Backend replaces default system prompt with agent-specific instructions when `agentSlug` is set.

**Tech Stack:** Nuxt 3, Vue 3 composables, Nuxt UI v3, SSE streaming

---

### Task 1: Extend `useChat` composable with shared panel state and agent/skill support

**Files:**
- Modify: `app/composables/useChat.ts`

- [ ] **Step 1: Add `isPanelOpen` shared state**

Replace the local `chatOpen` ref pattern. Add at the top of `useChat()`:

```ts
const isPanelOpen = useState<boolean>('chat-panel-open', () => false)
```

- [ ] **Step 2: Add `activeAgent` state**

```ts
const activeAgent = useState<{ slug: string; name: string; color?: string } | null>('chat-active-agent', () => null)
```

- [ ] **Step 3: Add `pendingInput` state**

```ts
const pendingInput = useState<string>('chat-pending-input', () => '')
```

- [ ] **Step 4: Add `startAgentChat` method**

```ts
function startAgentChat(agent: { slug: string; name: string; color?: string }) {
  activeAgent.value = agent
  clearChat()
  isPanelOpen.value = true
}
```

- [ ] **Step 5: Add `prefillSkill` method**

```ts
function prefillSkill(skillName: string) {
  pendingInput.value = `/${skillName} `
  isPanelOpen.value = true
}
```

- [ ] **Step 6: Add `clearAgent` method**

```ts
function clearAgent() {
  activeAgent.value = null
}
```

- [ ] **Step 7: Export new state and methods**

Add to the return object:

```ts
isPanelOpen,
activeAgent: readonly(activeAgent),
pendingInput,
startAgentChat,
prefillSkill,
clearAgent,
```

- [ ] **Step 8: Pass `agentSlug` in `sendMessage`**

In the `$fetch('/api/chat', ...)` call body, add:

```ts
...(activeAgent.value ? { agentSlug: activeAgent.value.slug } : {}),
```

---

### Task 2: Update `app.vue` to use shared panel state

**Files:**
- Modify: `app/app.vue`

- [ ] **Step 1: Replace local `chatOpen` with `useChat().isPanelOpen`**

In `<script setup>`, remove `const chatOpen = ref(false)`. Add:

```ts
const { isPanelOpen: chatOpen } = useChat()
```

- [ ] **Step 2: Update Cmd+J handler**

The handler already toggles `chatOpen.value` — since `chatOpen` is now a `useState` ref instead of a local `ref`, the toggle still works. No code change needed, just verify.

- [ ] **Step 3: Verify ChatPanel binding**

`<ChatPanel v-model:open="chatOpen" />` — still works since `chatOpen` is now `isPanelOpen` from the composable.

---

### Task 3: Add agent banner and input prefill to ChatPanel

**Files:**
- Modify: `app/components/ChatPanel.vue`

- [ ] **Step 1: Import active agent and pending input from `useChat`**

Update the destructured imports:

```ts
const { messages, isStreaming, error, activity, usedTools, sendMessage, stopStreaming, clearChat, activeAgent, pendingInput, clearAgent } = useChat()
```

- [ ] **Step 2: Watch `pendingInput` to set local input**

```ts
watch(pendingInput, (val) => {
  if (val) {
    input.value = val
    pendingInput.value = ''
    nextTick(() => inputRef.value?.focus())
  }
})
```

- [ ] **Step 3: Add agent banner after the header separator**

Insert after the `<!-- Separator with glow -->` div (after the `</div>` closing the header section, right before `<!-- Messages -->`):

```vue
<!-- Active agent banner -->
<div
  v-if="activeAgent"
  class="shrink-0 px-5 py-2 flex items-center gap-2.5"
  style="background: var(--surface-raised); border-bottom: 1px solid var(--border-subtle);"
>
  <div
    class="size-2 rounded-full shrink-0"
    :style="{ background: activeAgent.color || 'var(--accent)' }"
  />
  <span class="text-[12px] font-medium flex-1 truncate" style="color: var(--text-primary); font-family: var(--font-sans);">
    Chatting with <strong>{{ activeAgent.name }}</strong>
  </span>
  <button
    class="p-1 rounded-md hover-bg transition-all"
    style="color: var(--text-disabled);"
    title="Switch to generic Claude"
    @click="clearAgent"
  >
    <UIcon name="i-lucide-x" class="size-3" />
  </button>
</div>
```

- [ ] **Step 4: Update placeholder text**

Change the textarea placeholder from static to dynamic:

```vue
:placeholder="activeAgent ? `Ask ${activeAgent.name} something...` : 'Tell Claude what to do...'"
```

- [ ] **Step 5: Update header subtitle when agent is active**

Change the "Agent Manager" subtitle span:

```vue
<span class="text-[10px] font-mono" style="color: var(--text-disabled);">
  {{ activeAgent ? activeAgent.name : 'Agent Manager' }}
</span>
```

- [ ] **Step 6: Update clearChat to also clear agent**

In the "New conversation" button click handler, update:

```vue
@click="() => { clearChat(); clearAgent(); }"
```

---

### Task 4: Add "Chat with agent" button to agent detail page

**Files:**
- Modify: `app/pages/agents/[slug].vue`

- [ ] **Step 1: Import `startAgentChat` from `useChat`**

Add to the script:

```ts
const { startAgentChat } = useChat()
```

- [ ] **Step 2: Add the button in the `#right` template slot**

Insert before the export download link (so it appears first in the action bar):

```vue
<UButton
  label="Chat"
  icon="i-lucide-message-circle"
  size="sm"
  variant="soft"
  :disabled="!agent"
  @click="startAgentChat({ slug, name: agent!.frontmatter.name, color: getAgentColor(agent!.frontmatter.color) })"
/>
```

---

### Task 5: Add "Use skill" button to skill detail page

**Files:**
- Modify: `app/pages/skills/[slug].vue`

- [ ] **Step 1: Import `prefillSkill` from `useChat`**

Add to the script:

```ts
const { prefillSkill } = useChat()
```

- [ ] **Step 2: Add the button in the `#right` template slot**

Insert before the export download link:

```vue
<UButton
  label="Use"
  icon="i-lucide-play"
  size="sm"
  variant="soft"
  :disabled="!skill"
  @click="prefillSkill(skill!.frontmatter.name)"
/>
```

---

### Task 6: Update backend to replace system prompt for agent context

**Files:**
- Modify: `server/api/chat.post.ts`

- [ ] **Step 1: Use agent instructions as primary system prompt when `agentSlug` is set**

Replace the current `agentAppend` approach. When `agentSlug` is provided and the agent file exists, use a dedicated agent system prompt instead of appending to the manager prompt:

```ts
// Build the system prompt — agent-specific or default manager
let systemAppend: string

if (body.agentSlug) {
  const agentPath = resolveClaudePath('agents', `${body.agentSlug}.md`)
  if (existsSync(agentPath)) {
    const { parseFrontmatter } = await import('../utils/frontmatter')
    const raw = await readFile(agentPath, 'utf-8')
    const { frontmatter, body: agentBody } = parseFrontmatter<{ name?: string }>(raw)
    const agentName = frontmatter.name || body.agentSlug
    systemAppend = `You are "${agentName}", a specialized agent. Follow these instructions precisely:\n\n${agentBody}\n\nThe current working directory is: ${claudeDir}`
  } else {
    systemAppend = defaultManagerPrompt(claudeDir)
  }
} else {
  systemAppend = defaultManagerPrompt(claudeDir)
}
```

Extract the current long manager prompt string into a `defaultManagerPrompt(claudeDir)` helper at the top of the file to keep things clean. Then use `systemAppend` in the `query()` call where `append` currently is.

---

### Task 7: Manual verification

- [ ] **Step 1: Navigate to an agent detail page, click "Chat", verify panel opens with banner**
- [ ] **Step 2: Send a message, verify Claude responds with agent persona (not manager framing)**
- [ ] **Step 3: Click "x" on banner, verify it clears and reverts to generic Claude**
- [ ] **Step 4: Navigate to a skill detail page, click "Use", verify panel opens with `/skill-name ` prefilled**
- [ ] **Step 5: Verify Cmd+J still toggles the panel**
- [ ] **Step 6: Verify sidebar Claude button still toggles the panel**
