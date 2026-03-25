# Guidance & Education Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three layers of in-context guidance (HelpTip tooltips, ExampleBlock expandable examples, FeatureCallout first-time callouts) that teach beginners what agents, skills, and actions are.

**Architecture:** Three independent Vue components (`HelpTip`, `ExampleBlock`, `FeatureCallout`) that are placed into existing pages. `FeatureCallout` persists dismiss state via the existing settings API. No new API endpoints.

**Tech Stack:** Vue 3, Nuxt UI v3 (UPopover), existing `useSettings()` composable

**Spec:** `docs/superpowers/specs/2026-03-18-guidance-education-design.md`

---

### Task 1: Add `guidanceSeen` to Settings type

**Files:**
- Modify: `app/types/index.ts`

- [ ] **Step 1: Add guidanceSeen to Settings interface**

In `app/types/index.ts`, add `guidanceSeen` field to the `Settings` interface:

```typescript
export interface Settings {
  hooks?: Record<string, unknown[]>
  enabledPlugins?: Record<string, boolean>
  statusLine?: { type: string; command: string }
  alwaysThinkingEnabled?: boolean
  onboardingCompleted?: boolean
  guidanceSeen?: {
    agentDetail?: boolean
    explore?: boolean
    chat?: boolean
  }
  [key: string]: unknown
}
```

- [ ] **Step 2: Verify build**

Run: `npx nuxi build 2>&1 | tail -5`
Expected: Build succeeds

---

### Task 2: Create HelpTip component

**Files:**
- Create: `app/components/HelpTip.vue`

- [ ] **Step 1: Create the HelpTip component**

```vue
<script setup lang="ts">
defineProps<{
  title: string
  body: string
  hasExample?: boolean
}>()

const showExample = ref(false)
</script>

<template>
  <UPopover :ui="{ width: 'max-w-[280px]' }">
    <button
      class="inline-flex items-center justify-center size-[18px] rounded-full shrink-0 cursor-pointer"
      style="background: var(--badge-subtle-bg); border: 1px solid var(--border-subtle); color: var(--text-disabled);"
      :aria-label="`Learn more about ${title}`"
    >
      <span class="text-[10px] font-bold leading-none">?</span>
    </button>
    <template #panel>
      <div class="p-3 space-y-1.5">
        <div class="text-[12px] font-semibold" style="color: var(--text-primary);">{{ title }}</div>
        <p class="text-[11px] leading-relaxed" style="color: var(--text-secondary);">{{ body }}</p>
        <button
          v-if="hasExample"
          class="text-[11px] font-medium mt-1"
          style="color: var(--accent);"
          @click="showExample = !showExample"
        >
          {{ showExample ? 'Hide example' : 'See example' }}
        </button>
      </div>
    </template>
  </UPopover>
  <div v-if="hasExample && showExample" class="mt-2">
    <slot />
  </div>
</template>
```

- [ ] **Step 2: Verify component renders**

Add a temporary `<HelpTip title="Test" body="Test body" />` in `app/pages/index.vue`, run `bun dev`, verify the `?` icon appears and popover works on click.

- [ ] **Step 3: Remove temporary test, commit**

---

### Task 3: Create ExampleBlock component

**Files:**
- Create: `app/components/ExampleBlock.vue`

- [ ] **Step 1: Create the ExampleBlock component**

```vue
<script setup lang="ts">
defineProps<{
  title: string
}>()

const open = ref(false)
</script>

<template>
  <div
    class="rounded-lg overflow-hidden"
    style="border-left: 3px solid var(--accent); background: var(--surface-raised);"
  >
    <button
      class="w-full flex items-center gap-2 px-4 py-2.5 text-left"
      @click="open = !open"
    >
      <UIcon name="i-lucide-lightbulb" class="size-3.5 shrink-0" style="color: var(--accent);" />
      <span class="text-[12px] font-medium flex-1" style="color: var(--text-secondary);">{{ title }}</span>
      <UIcon
        :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="size-3.5"
        style="color: var(--text-disabled);"
      />
    </button>
    <div v-if="open" class="px-4 pb-3">
      <slot />
    </div>
  </div>
</template>
```

---

### Task 4: Create FeatureCallout component

**Files:**
- Create: `app/components/FeatureCallout.vue`

- [ ] **Step 1: Create the FeatureCallout component**

```vue
<script setup lang="ts">
const props = defineProps<{
  featureKey: string
  message: string
  action: string
}>()

const { settings, save } = useSettings()

const dismissed = computed(() => {
  return !!(settings.value?.guidanceSeen as any)?.[props.featureKey]
})

async function dismiss() {
  if (!settings.value) return
  const guidanceSeen = { ...(settings.value.guidanceSeen || {}), [props.featureKey]: true }
  // Optimistic update
  settings.value = { ...settings.value, guidanceSeen }
  // Persist in background
  try {
    await save({ ...settings.value, guidanceSeen })
  } catch {
    // Non-critical — state is already updated locally
  }
}
</script>

<template>
  <div
    v-if="!dismissed"
    class="rounded-xl px-4 py-3 flex items-start gap-3 mb-4"
    style="background: rgba(229, 169, 62, 0.06); border: 1px solid rgba(229, 169, 62, 0.12);"
  >
    <UIcon name="i-lucide-info" class="size-4 shrink-0 mt-0.5" style="color: var(--accent);" />
    <div class="flex-1 min-w-0">
      <p class="text-[12px] leading-relaxed" style="color: var(--text-secondary);">{{ message }}</p>
      <p class="text-[11px] mt-1 font-medium" style="color: var(--accent);">{{ action }}</p>
    </div>
    <button
      class="p-1 rounded shrink-0"
      style="color: var(--text-disabled);"
      aria-label="Dismiss"
      @click="dismiss"
    >
      <UIcon name="i-lucide-x" class="size-3.5" />
    </button>
  </div>
</template>
```

---

### Task 5: Place HelpTips across the app

**Files:**
- Modify: `app/pages/index.vue`
- Modify: `app/components/AgentWizard.vue`
- Modify: `app/pages/agents/[slug].vue`
- Modify: `app/pages/explore.vue`
- Modify: `app/pages/settings.vue`

- [ ] **Step 1: Home page — add HelpTip next to the Quick Actions heading**

In `app/pages/index.vue`, add a small heading above the quick actions grid with a HelpTip:

```vue
<!-- Add above the grid of QuickActionCards -->
<div class="flex items-center gap-1.5 mb-2">
  <span class="text-[12px] font-medium" style="color: var(--text-tertiary);">Quick actions</span>
  <HelpTip
    title="What's an agent?"
    body="An agent is an AI assistant with custom instructions. It knows how to do a specific job for you."
  />
</div>
```

- [ ] **Step 2: Agent wizard — add HelpTips on Step 1 and Step 2**

In `app/components/AgentWizard.vue`:

Step 1 description field label:
```vue
<label class="field-label text-[13px]">
  What should this agent help you with?
  <HelpTip title="Good descriptions" body="A good description helps you remember what this agent does, and helps Claude know when to use it." />
</label>
```

Step 2 model picker label:
```vue
<label class="field-label">
  Model
  <HelpTip title="Which model?" body="'Fast & efficient' is great for simple tasks. 'Balanced' works for most things. 'Most capable' handles complex reasoning." />
</label>
```

- [ ] **Step 3: Agent detail — add HelpTips on Actions and Skills tab buttons**

In `app/pages/agents/[slug].vue`, update the tab buttons to include HelpTips. Add after the tab label text for `actions` and `skills` tabs:

For the actions tab button, after `{{ tab.label }}`:
```vue
<HelpTip
  v-if="tab.key === 'actions'"
  title="What are actions?"
  body="Actions are reusable workflows (like slash commands) that this agent can perform."
/>
<HelpTip
  v-if="tab.key === 'skills'"
  title="What are skills?"
  body="Skills give your agent specialized capabilities — like knowing how to review code or write tests."
/>
```

- [ ] **Step 4: Explore page — add HelpTips on tab labels**

In `app/pages/explore.vue`, add HelpTips next to the description text below each tab:

After the Templates tab description `<p>`:
```vue
<HelpTip title="What are templates?" body="Templates are pre-built agents you can create with one click and customize later." />
```

After the Extensions tab description `<p>`:
```vue
<HelpTip title="What are extensions?" body="Extensions are add-on packages that give your agents new abilities." />
```

- [ ] **Step 5: Settings page — add HelpTip next to Extensions heading**

In `app/pages/settings.vue`, add:
```vue
<h3 ...>
  Extensions
  <HelpTip title="Managing extensions" body="Enable or disable extensions here. Install new ones via the Claude Code CLI." />
</h3>
```

- [ ] **Step 6: Verify all HelpTips render correctly**

Run `bun dev`, visit each page, click each `?` icon, verify popover content.

---

### Task 6: Place ExampleBlocks on empty states

**Files:**
- Modify: `app/pages/agents/[slug].vue`
- Modify: `app/pages/agents/index.vue`
- Modify: `app/components/AgentWizard.vue`

- [ ] **Step 1: Agent list empty state — add Agent Example**

In `app/pages/agents/index.vue`, in the empty state section (the `v-else` block that says "No agents yet"), add above the template grid:

```vue
<ExampleBlock title="What does a good agent look like?" class="max-w-md mx-auto mb-6">
  <div class="space-y-2 text-[11px]" style="color: var(--text-secondary);">
    <div class="rounded-lg p-3" style="background: var(--surface-base); border: 1px solid var(--border-subtle);">
      <p><strong style="color: var(--text-primary);">code-reviewer</strong> <span class="text-[10px]" style="color: var(--text-disabled);">← This name is short and descriptive</span></p>
      <p class="mt-1">"Reviews pull requests for bugs, style, and security." <span class="text-[10px]" style="color: var(--text-disabled);">← Explains what it does in one sentence</span></p>
      <p class="mt-1 text-[10px]" style="color: var(--text-tertiary);">"Check for bugs, flag security issues, suggest improvements..." <span style="color: var(--text-disabled);">← Instructions are specific</span></p>
    </div>
  </div>
</ExampleBlock>
```

- [ ] **Step 2: Agent wizard Step 2 — add Agent Example**

In `app/components/AgentWizard.vue`, in the Step 2 section (v-else-if="step === 2"), add after the description paragraph:

```vue
<ExampleBlock title="See what a good agent looks like">
  <div class="space-y-1.5 text-[11px]" style="color: var(--text-secondary);">
    <p><strong>Name:</strong> email-drafter</p>
    <p><strong>Instructions:</strong> "You are an email drafting assistant. Help the user write clear, professional emails. Before drafting, ask about the recipient, goal, and tone..."</p>
    <p class="text-[10px]" style="color: var(--text-tertiary);">Good instructions are specific about behavior, tone, and rules.</p>
  </div>
</ExampleBlock>
```

- [ ] **Step 3: Agent detail — Actions tab empty state**

In `app/pages/agents/[slug].vue`, in the Actions tab empty state `<div>`, add below the "No actions linked" text:

```vue
<ExampleBlock title="What does an action look like?" class="mt-4 text-left max-w-md mx-auto">
  <div class="space-y-2 text-[11px]" style="color: var(--text-secondary);">
    <p><strong style="color: var(--text-primary);">/review-code</strong> — A slash command that tells Claude to review code changes following specific guidelines.</p>
    <p class="text-[10px]" style="color: var(--text-tertiary);">Actions appear here when they reference this agent in their instructions.</p>
  </div>
</ExampleBlock>
```

- [ ] **Step 2: Agent detail — Skills tab empty state**

Same pattern for the Skills tab empty state:

```vue
<ExampleBlock title="What does a skill look like?" class="mt-4 text-left max-w-md mx-auto">
  <div class="space-y-2 text-[11px]" style="color: var(--text-secondary);">
    <p><strong style="color: var(--text-primary);">test-driven-development</strong> — A skill that teaches an agent to write tests before implementation.</p>
    <p class="text-[10px]" style="color: var(--text-tertiary);">Skills give your agent specialized knowledge. Add one using the picker above.</p>
  </div>
</ExampleBlock>
```

---

### Task 7: Place FeatureCallouts on pages

**Files:**
- Modify: `app/pages/agents/[slug].vue`
- Modify: `app/pages/explore.vue`
- Modify: `app/components/ChatPanel.vue`

- [ ] **Step 1: Agent detail page callout**

In `app/pages/agents/[slug].vue`, add at the top of the `v-if="agent"` block (before the draft recovery banner):

```vue
<FeatureCallout
  feature-key="agentDetail"
  message="This is where you configure your agent — its name, instructions, and what it can do."
  action="Start by writing clear instructions in the Instructions tab."
/>
```

- [ ] **Step 2: Explore page callout**

In `app/pages/explore.vue`, add at the top of the content area (after the page header div):

```vue
<FeatureCallout
  feature-key="explore"
  message="Find ready-made templates here. Pick one to create an agent instantly."
  action="Try using a template to create your first agent."
/>
```

- [ ] **Step 3: Chat panel callout**

In `app/components/ChatPanel.vue`, add inside the empty state `<div>` (before the orb), wrapped in a settings check:

```vue
<FeatureCallout
  feature-key="chat"
  message="You can ask Claude anything — create agents, get help, or manage your workspace."
  action="Try asking 'Help me create an agent for writing emails'."
/>
```

- [ ] **Step 4: Verify all callouts**

Run `bun dev`, ensure settings has no `guidanceSeen` set. Visit agent detail, explore, and chat. Verify callouts appear. Dismiss each one, verify they don't reappear.

---

### Task 8: Final verification

- [ ] **Step 1: Full build check**

Run: `npx nuxi build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 2: Run full verification checklist from spec**

1. Open app as new user → no callouts on Home
2. Navigate to Explore → callout appears, dismiss, navigate away and back → doesn't reappear
3. Click `?` icons → popovers show correct content, close on click outside
4. Agent detail Actions tab (empty) → example block visible and expandable
5. `guidanceSeen` keys persist in settings.json
6. Callouts don't appear for returning users
