# Multi-Agent Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual flow builder that lets users chain agents into linear workflows, executed sequentially via the chat API with per-agent system prompts.

**Architecture:** New `/workflows` route with VueFlow canvas for building linear agent chains. Workflows stored as JSON files in `~/.claude/workflows/`. Execution is client-side — each step calls `/api/chat` with an `agentSlug` field that loads agent-specific instructions. CRUD follows the exact same pattern as agents/commands/skills.

**Tech Stack:** Vue 3, VueFlow (already installed), Nuxt UI v3, existing chat API + agent SDK

**Spec:** `docs/superpowers/specs/2026-03-18-multi-agent-workflows-design.md`

---

### Task 1: Add Workflow types

**Files:**
- Modify: `app/types/index.ts`

- [ ] **Step 1: Add workflow types to index.ts**

Add at the end of the file, before the closing:

```typescript
export interface WorkflowStep {
  id: string
  agentSlug: string
  label: string
}

export interface Workflow {
  slug: string
  name: string
  description: string
  steps: WorkflowStep[]
  createdAt: string
  lastRunAt?: string
  filePath: string
}

export interface WorkflowPayload {
  name: string
  description: string
  steps: WorkflowStep[]
}

export interface StepExecution {
  stepId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  input: string
  output: string
  error?: string
  startedAt?: number
  completedAt?: number
}
```

- [ ] **Step 2: Verify build**

Run: `npx nuxi build 2>&1 | tail -5`
Expected: Build succeeds

---

### Task 2: Create workflow API endpoints

**Files:**
- Create: `server/api/workflows/index.get.ts`
- Create: `server/api/workflows/index.post.ts`
- Create: `server/api/workflows/[slug].get.ts`
- Create: `server/api/workflows/[slug].put.ts`
- Create: `server/api/workflows/[slug].delete.ts`
- Modify: `server/api/setup.post.ts`

- [ ] **Step 1: Create GET /api/workflows (list all)**

```typescript
// server/api/workflows/index.get.ts
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'
import type { Workflow } from '~/types'

export default defineEventHandler(async () => {
  const dir = resolveClaudePath('workflows')
  if (!existsSync(dir)) return []

  const files = await readdir(dir)
  const jsonFiles = files.filter(f => f.endsWith('.json'))

  const workflows: Workflow[] = await Promise.all(
    jsonFiles.map(async (filename) => {
      const filePath = join(dir, filename)
      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw)
      const slug = filename.replace(/\.json$/, '')
      return { slug, filePath, ...data }
    })
  )

  return workflows.sort((a, b) => a.name.localeCompare(b.name))
})
```

- [ ] **Step 2: Create POST /api/workflows (create)**

```typescript
// server/api/workflows/index.post.ts
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'
import type { WorkflowPayload, Workflow } from '~/types'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workflow'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<WorkflowPayload>(event)
  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: 'name is required' })
  }

  const dir = resolveClaudePath('workflows')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })

  let slug = slugify(body.name)
  let filePath = join(dir, `${slug}.json`)
  let counter = 2
  while (existsSync(filePath)) {
    slug = `${slugify(body.name)}-${counter}`
    filePath = join(dir, `${slug}.json`)
    counter++
  }

  const workflow: Omit<Workflow, 'slug' | 'filePath'> = {
    name: body.name.trim(),
    description: body.description || '',
    steps: body.steps || [],
    createdAt: new Date().toISOString(),
  }

  await writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf-8')
  return { slug, filePath, ...workflow } as Workflow
})
```

- [ ] **Step 3: Create GET /api/workflows/[slug] (get one)**

```typescript
// server/api/workflows/[slug].get.ts
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'
import type { Workflow } from '~/types'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const filePath = resolveClaudePath('workflows', `${slug}.json`)

  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: 'Workflow not found' })
  }

  const raw = await readFile(filePath, 'utf-8')
  const data = JSON.parse(raw)
  return { slug, filePath, ...data } as Workflow
})
```

- [ ] **Step 4: Create PUT /api/workflows/[slug] (update)**

```typescript
// server/api/workflows/[slug].put.ts
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'
import type { Workflow } from '~/types'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const filePath = resolveClaudePath('workflows', `${slug}.json`)

  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: 'Workflow not found' })
  }

  const body = await readBody(event)
  const existing = JSON.parse(await readFile(filePath, 'utf-8'))
  const updated = { ...existing, ...body }
  await writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8')
  return { slug, filePath, ...updated } as Workflow
})
```

- [ ] **Step 5: Create DELETE /api/workflows/[slug]**

```typescript
// server/api/workflows/[slug].delete.ts
import { unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolveClaudePath } from '../../utils/claudeDir'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const filePath = resolveClaudePath('workflows', `${slug}.json`)

  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: 'Workflow not found' })
  }

  await unlink(filePath)
  return { deleted: true }
})
```

- [ ] **Step 6: Update setup.post.ts to create workflows directory**

In `server/api/setup.post.ts`, add `resolveClaudePath('workflows')` to the `dirs` array.

- [ ] **Step 7: Verify build**

Run: `npx nuxi build 2>&1 | tail -5`

---

### Task 3: Extend chat API for agent-specific prompts

**Files:**
- Modify: `server/api/chat.post.ts`

- [ ] **Step 1: Add agentSlug support to chat endpoint**

In `server/api/chat.post.ts`:

1. Update the `readBody` type to include `agentSlug?: string`
2. After the `const claudeDir = getClaudeDir()` line, add agent loading logic:

```typescript
  // Load agent-specific instructions if agentSlug provided
  let agentAppend = ''
  if (body.agentSlug) {
    const agentPath = resolveClaudePath('agents', `${body.agentSlug}.md`)
    if (existsSync(agentPath)) {
      const { parseFrontmatter } = await import('../utils/frontmatter')
      const raw = await import('node:fs/promises').then(fs => fs.readFile(agentPath, 'utf-8'))
      const { frontmatter, body: agentBody } = parseFrontmatter<{ name?: string }>(raw)
      const agentName = frontmatter.name || body.agentSlug
      agentAppend = `\n\nYou are now acting as the agent '${agentName}'. Follow these instructions:\n\n${agentBody}`
    }
  }
```

3. In the system prompt `append` string, concatenate `agentAppend` at the end.

Add `resolveClaudePath` to the existing import: change `import { getClaudeDir } from '../utils/claudeDir'` to `import { getClaudeDir, resolveClaudePath } from '../utils/claudeDir'`. Also add `import { existsSync } from 'node:fs'` and `import { readFile } from 'node:fs/promises'` at the top.

In the system prompt append string, change `"4 sections: Home, My Agents, Explore"` to `"5 sections: Home, My Agents, Workflows, Explore"` and add `- **Workflows**: Multi-agent pipelines that chain agents sequentially` to the "What the user sees" list.

Concatenate `${agentAppend}` at the very end of the append template literal (before the closing backtick on what is currently line 111).

- [ ] **Step 2: Verify the chat still works normally**

Run: `npx nuxi build 2>&1 | tail -5` — verify build passes.
Then `bun dev`, open chat panel, send a message. Verify it still works without `agentSlug`.

---

### Task 4: Create useWorkflows composable

**Files:**
- Create: `app/composables/useWorkflows.ts`

- [ ] **Step 1: Create the composable**

```typescript
import type { Workflow, WorkflowPayload } from '~/types'

export function useWorkflows() {
  const workflows = useState<Workflow[]>('workflows', () => [])
  const loading = useState('workflowsLoading', () => false)
  const error = useState<string | null>('workflowsError', () => null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      workflows.value = await $fetch<Workflow[]>('/api/workflows')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load workflows'
      error.value = msg
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(slug: string) {
    return await $fetch<Workflow>(`/api/workflows/${slug}`)
  }

  async function create(payload: WorkflowPayload) {
    const workflow = await $fetch<Workflow>('/api/workflows', { method: 'POST', body: payload })
    workflows.value.push(workflow)
    return workflow
  }

  async function update(slug: string, payload: Partial<WorkflowPayload & { lastRunAt?: string }>) {
    const workflow = await $fetch<Workflow>(`/api/workflows/${slug}`, { method: 'PUT', body: payload })
    const idx = workflows.value.findIndex(w => w.slug === slug)
    if (idx >= 0) workflows.value[idx] = workflow
    else workflows.value.push(workflow)
    return workflow
  }

  async function remove(slug: string) {
    await $fetch(`/api/workflows/${slug}`, { method: 'DELETE' })
    workflows.value = workflows.value.filter(w => w.slug !== slug)
  }

  return { workflows, loading, error, fetchAll, fetchOne, create, update, remove }
}
```

---

### Task 5: Create useWorkflowExecution composable

**Files:**
- Create: `app/composables/useWorkflowExecution.ts`

- [ ] **Step 1: Create the execution composable**

```typescript
import type { Workflow, StepExecution } from '~/types'

export function useWorkflowExecution() {
  const steps = ref<StepExecution[]>([])
  const isRunning = ref(false)
  const currentStepIndex = ref(-1)
  let abortController: AbortController | null = null

  async function run(workflow: Workflow, initialPrompt: string) {
    if (isRunning.value) return
    isRunning.value = true
    currentStepIndex.value = -1

    // Initialize step executions
    steps.value = workflow.steps.map(s => ({
      stepId: s.id,
      status: 'pending' as const,
      input: '',
      output: '',
    }))

    let previousOutput = initialPrompt

    for (let i = 0; i < workflow.steps.length; i++) {
      if (!isRunning.value) break

      currentStepIndex.value = i
      const step = workflow.steps[i]
      steps.value[i] = { ...steps.value[i], status: 'running', input: previousOutput, startedAt: Date.now() }

      abortController = new AbortController()

      try {
        const response = await $fetch<ReadableStream>('/api/chat', {
          method: 'POST',
          body: {
            messages: [{ role: 'user', content: previousOutput }],
            agentSlug: step.agentSlug,
          },
          signal: abortController.signal,
          responseType: 'stream',
        })

        const reader = (response as unknown as ReadableStream).getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let resultText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'text_delta') {
                resultText += data.text
                steps.value[i] = { ...steps.value[i], output: resultText }
              } else if (data.type === 'result') {
                resultText = data.text
                steps.value[i] = { ...steps.value[i], output: resultText }
              } else if (data.type === 'error') {
                throw new Error(data.message)
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue
              throw e
            }
          }
        }

        steps.value[i] = { ...steps.value[i], status: 'completed', output: resultText, completedAt: Date.now() }
        previousOutput = resultText
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          steps.value[i] = { ...steps.value[i], status: 'failed', error: 'Cancelled', completedAt: Date.now() }
        } else {
          steps.value[i] = { ...steps.value[i], status: 'failed', error: err instanceof Error ? err.message : 'Unknown error', completedAt: Date.now() }
        }
        // Mark remaining as skipped
        for (let j = i + 1; j < workflow.steps.length; j++) {
          steps.value[j] = { ...steps.value[j], status: 'skipped' }
        }
        break
      }
    }

    isRunning.value = false
    abortController = null
  }

  function stop() {
    abortController?.abort()
    isRunning.value = false
  }

  return { steps: readonly(steps), isRunning: readonly(isRunning), currentStepIndex: readonly(currentStepIndex), run, stop }
}
```

---

### Task 6: Create workflow templates

**Files:**
- Create: `app/utils/workflowTemplates.ts`

- [ ] **Step 1: Create workflow templates file**

```typescript
export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  icon: string
  steps: { agentTemplateId: string; label: string }[]
}

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'code-review-pipeline',
    name: 'Code Review Pipeline',
    description: 'Review code changes then update documentation.',
    icon: 'i-lucide-scan-eye',
    steps: [
      { agentTemplateId: 'code-reviewer', label: 'Review Code' },
      { agentTemplateId: 'documentation-writer', label: 'Update Docs' },
    ],
  },
  {
    id: 'content-creation',
    name: 'Content Creation',
    description: 'Research a topic then write about it.',
    icon: 'i-lucide-pen-line',
    steps: [
      { agentTemplateId: 'research-assistant', label: 'Research' },
      { agentTemplateId: 'writing-assistant', label: 'Write' },
    ],
  },
  {
    id: 'email-workflow',
    name: 'Email Workflow',
    description: 'Draft content then format as a professional email.',
    icon: 'i-lucide-mail',
    steps: [
      { agentTemplateId: 'writing-assistant', label: 'Draft Content' },
      { agentTemplateId: 'email-drafter', label: 'Format Email' },
    ],
  },
]
```

---

### Task 7: Update navigation and Home page

**Files:**
- Modify: `app/app.vue`
- Modify: `app/pages/index.vue`

- [ ] **Step 1: Add Workflows to sidebar nav**

In `app/app.vue`, update `navLinks`:

```typescript
const navLinks = [
  { label: 'Home', icon: 'i-lucide-home', to: '/' },
  { label: 'My Agents', icon: 'i-lucide-cpu', to: '/agents' },
  { label: 'Workflows', icon: 'i-lucide-git-branch', to: '/workflows' },
  { label: 'Explore', icon: 'i-lucide-compass', to: '/explore' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
]
```

Also add `useWorkflows` fetch to onMounted and update `badgeFor`:

```typescript
const { fetchAll: fetchWorkflows, workflows } = useWorkflows()
// In onMounted, add fetchWorkflows() to Promise.all
// In badgeFor, add: if (to === '/workflows') return workflows.value.length || null
```

- [ ] **Step 2: Add "Create a Workflow" quick action to Home page**

In `app/pages/index.vue`, add a 4th QuickActionCard in the grid (change grid to `md:grid-cols-2 lg:grid-cols-4`):

```vue
<QuickActionCard
  title="Create a Workflow"
  description="Chain agents together"
  icon="i-lucide-git-branch"
  to="/workflows"
/>
```

---

### Task 8: Create WorkflowCard component

**Files:**
- Create: `app/components/WorkflowCard.vue`

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
import type { Workflow } from '~/types'
import { getAgentColor } from '~/utils/colors'

const props = defineProps<{ workflow: Workflow }>()
const { agents } = useAgents()

const stepAgents = computed(() => {
  return props.workflow.steps.map(s => agents.value.find(a => a.slug === s.agentSlug))
})

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
</script>

<template>
  <NuxtLink
    :to="`/workflows/${workflow.slug}`"
    class="block rounded-xl p-4 transition-all duration-150 focus-ring group"
    style="background: var(--surface-raised); border: 1px solid var(--border-subtle);"
    @mouseenter="($event.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'"
    @mouseleave="($event.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'"
  >
    <div class="flex items-start gap-3">
      <div
        class="size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style="background: var(--accent-muted); border: 1px solid rgba(229, 169, 62, 0.15);"
      >
        <UIcon name="i-lucide-git-branch" class="size-4" style="color: var(--accent);" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-[13px] font-medium truncate" style="color: var(--text-primary);">{{ workflow.name }}</div>
        <div class="text-[11px] mt-0.5 line-clamp-2" style="color: var(--text-tertiary);">
          {{ workflow.description || 'No description' }}
        </div>
      </div>
    </div>
    <div class="flex items-center gap-2 mt-3 pt-3" style="border-top: 1px solid var(--border-subtle);">
      <div class="flex -space-x-1">
        <div
          v-for="(agent, idx) in stepAgents.slice(0, 4)"
          :key="idx"
          class="size-5 rounded-full flex items-center justify-center text-[8px] font-bold"
          :style="{ background: agent ? getAgentColor(agent.frontmatter.color) + '30' : 'var(--badge-subtle-bg)', color: agent ? getAgentColor(agent.frontmatter.color) : 'var(--text-disabled)', border: '2px solid var(--surface-raised)', zIndex: 10 - idx }"
        >
          {{ idx + 1 }}
        </div>
      </div>
      <span class="text-[10px]" style="color: var(--text-disabled);">{{ workflow.steps.length }} step{{ workflow.steps.length === 1 ? '' : 's' }}</span>
      <span v-if="workflow.lastRunAt" class="text-[10px] ml-auto" style="color: var(--text-disabled);">{{ timeAgo(workflow.lastRunAt) }}</span>
    </div>
  </NuxtLink>
</template>
```

---

### Task 9: Create Workflows list page

**Files:**
- Create: `app/pages/workflows/index.vue`

- [ ] **Step 1: Create the workflows list page**

Create `app/pages/workflows/index.vue` following the same patterns as `app/pages/agents/index.vue`:

Key script logic:
```typescript
import { workflowTemplates } from '~/utils/workflowTemplates'
import { agentTemplates } from '~/utils/templates'

const { workflows, loading, error, create, fetchAll } = useWorkflows()
const { agents, create: createAgent } = useAgents()
const router = useRouter()
const toast = useToast()
const searchQuery = ref('')
const showCreateModal = ref(false)
const creatingTemplate = ref<string | null>(null)
const newName = ref('')
const newDescription = ref('')

// Template creation: ensure agents exist, then create workflow
async function useWorkflowTemplate(templateId: string) {
  const template = workflowTemplates.find(t => t.id === templateId)
  if (!template) return
  creatingTemplate.value = templateId
  try {
    const steps = []
    for (const step of template.steps) {
      const agentTemplate = agentTemplates.find(t => t.id === step.agentTemplateId)
      if (!agentTemplate) continue
      // Check if agent exists
      let agent = agents.value.find(a => a.slug === agentTemplate.frontmatter.name)
      if (!agent) {
        agent = await createAgent({ frontmatter: { ...agentTemplate.frontmatter }, body: agentTemplate.body })
      }
      steps.push({ id: crypto.randomUUID(), agentSlug: agent.slug, label: step.label })
    }
    const workflow = await create({ name: template.name, description: template.description, steps })
    router.push(`/workflows/${workflow.slug}`)
  } catch (e: any) {
    toast.add({ title: 'Failed to create', description: e.data?.message || e.message, color: 'error' })
  } finally {
    creatingTemplate.value = null
  }
}
```

Template: PageHeader, search input, WorkflowCard grid (or loading skeletons), empty state with template cards, create modal with name/description fields.

---

### Task 10: Create WorkflowNode component (VueFlow custom node)

**Files:**
- Create: `app/components/WorkflowNode.vue`

- [ ] **Step 1: Create the custom VueFlow node**

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { getAgentColor } from '~/utils/colors'
import { getFriendlyModelName } from '~/utils/terminology'

const props = defineProps<{
  data: {
    label: string
    agentSlug: string
    agentColor?: string
    agentModel?: string
    stepNumber: number
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  }
}>()

const emit = defineEmits<{
  remove: []
  moveUp: []
  moveDown: []
}>()

const color = computed(() => getAgentColor(props.data.agentColor))
</script>

<template>
  <div
    class="workflow-node relative rounded-xl overflow-hidden"
    style="width: 160px; height: 80px; background: var(--surface-raised); border: 1px solid var(--border-subtle);"
    :class="{
      'workflow-node--running': data.status === 'running',
      'workflow-node--completed': data.status === 'completed',
      'workflow-node--failed': data.status === 'failed',
      'workflow-node--skipped': data.status === 'skipped',
    }"
  >
    <Handle type="target" :position="Position.Left" />
    <div class="absolute inset-x-0 top-0 h-[3px]" :style="{ background: color }" />
    <div class="p-2.5 h-full flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-[9px] font-mono" style="color: var(--text-disabled);">#{{ data.stepNumber }}</span>
        <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button class="p-0.5 rounded" style="color: var(--text-disabled);" @click="emit('moveUp')">
            <UIcon name="i-lucide-chevron-left" class="size-3" />
          </button>
          <button class="p-0.5 rounded" style="color: var(--text-disabled);" @click="emit('moveDown')">
            <UIcon name="i-lucide-chevron-right" class="size-3" />
          </button>
          <button class="p-0.5 rounded" style="color: var(--text-disabled);" @click="emit('remove')">
            <UIcon name="i-lucide-x" class="size-3" />
          </button>
        </div>
      </div>
      <div class="text-[11px] font-medium truncate" style="color: var(--text-primary);">{{ data.label }}</div>
      <span class="text-[9px]" style="color: var(--text-disabled);">{{ getFriendlyModelName(data.agentModel as AgentModel | undefined) }}</span>
    </div>
    <Handle type="source" :position="Position.Right" />

    <!-- Status overlays -->
    <div v-if="data.status === 'completed'" class="absolute top-1 right-1">
      <UIcon name="i-lucide-check-circle" class="size-4" style="color: var(--success, #22c55e);" />
    </div>
    <div v-if="data.status === 'failed'" class="absolute top-1 right-1">
      <UIcon name="i-lucide-x-circle" class="size-4" style="color: var(--error);" />
    </div>
  </div>
</template>

<style scoped>
.workflow-node--running {
  border-color: var(--accent) !important;
  box-shadow: 0 0 15px var(--accent-glow);
  animation: nodePulse 1.5s ease-in-out infinite;
}
.workflow-node--completed { border-color: var(--success, #22c55e) !important; }
.workflow-node--failed { border-color: var(--error) !important; }
.workflow-node--skipped { opacity: 0.4; }

@keyframes nodePulse {
  0%, 100% { box-shadow: 0 0 10px var(--accent-glow); }
  50% { box-shadow: 0 0 25px var(--accent-glow); }
}
</style>
```

---

### Task 11: Create WorkflowRunModal and WorkflowExecutionLog components

**Files:**
- Create: `app/components/WorkflowRunModal.vue`
- Create: `app/components/WorkflowExecutionLog.vue`

- [ ] **Step 1: Create WorkflowRunModal**

Simple modal with a textarea for the initial prompt, "Start" and "Cancel" buttons. Emits `start` with the prompt string.

- [ ] **Step 2: Create WorkflowExecutionLog**

Accordion-style panel showing each step's status, input (collapsed), and output (expanded for current step). Uses `renderMarkdown` for output rendering. Shows duration badge for completed steps.

---

### Task 12: Create Flow Builder page

**Files:**
- Create: `app/pages/workflows/[slug].vue`

- [ ] **Step 1: Create the flow builder page**

This is the largest single file. Key structure:

```vue
<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import type { Workflow, WorkflowStep } from '~/types'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const slug = route.params.slug as string
const { fetchOne, update, remove } = useWorkflows()
const { agents } = useAgents()
const { steps: execSteps, isRunning, currentStepIndex, run, stop } = useWorkflowExecution()

const workflow = ref<Workflow | null>(null)
const workflowSteps = ref<WorkflowStep[]>([])
const name = ref('')
const description = ref('')
const saving = ref(false)
const showRunModal = ref(false)
const paletteSearch = ref('')

// Load workflow
onMounted(async () => {
  try {
    const data = await fetchOne(slug)
    workflow.value = data
    workflowSteps.value = [...data.steps]
    name.value = data.name
    description.value = data.description
  } catch {
    toast.add({ title: 'Workflow not found', color: 'error' })
    router.push('/workflows')
  }
})

// Compute VueFlow nodes from steps
const nodes = computed(() =>
  workflowSteps.value.map((step, i) => {
    const agent = agents.value.find(a => a.slug === step.agentSlug)
    const exec = execSteps.value.find(e => e.stepId === step.id)
    return {
      id: step.id,
      type: 'workflow',
      position: { x: i * 220, y: 100 },
      data: {
        label: step.label,
        agentSlug: step.agentSlug,
        agentColor: agent?.frontmatter.color,
        agentModel: agent?.frontmatter.model,
        stepNumber: i + 1,
        status: exec?.status,
      },
    }
  })
)

// Compute edges (sequential: step[i] -> step[i+1])
const edges = computed(() =>
  workflowSteps.value.slice(0, -1).map((step, i) => ({
    id: `e-${step.id}-${workflowSteps.value[i + 1].id}`,
    source: step.id,
    target: workflowSteps.value[i + 1].id,
    animated: true,
    style: { strokeDasharray: '5 5', stroke: 'var(--accent)' },
    markerEnd: { type: 'arrowclosed', color: 'var(--accent)' },
  }))
)

// Drag-and-drop from palette
function onDrop(event: DragEvent) {
  const agentSlug = event.dataTransfer?.getData('agentSlug')
  if (!agentSlug) return
  const agent = agents.value.find(a => a.slug === agentSlug)
  if (!agent) return
  workflowSteps.value.push({
    id: crypto.randomUUID(),
    agentSlug,
    label: agent.frontmatter.name,
  })
}

function onDragOver(event: DragEvent) { event.preventDefault() }

// Node actions
function removeStep(stepId: string) {
  workflowSteps.value = workflowSteps.value.filter(s => s.id !== stepId)
}
function moveStep(stepId: string, direction: -1 | 1) {
  const idx = workflowSteps.value.findIndex(s => s.id === stepId)
  const newIdx = idx + direction
  if (newIdx < 0 || newIdx >= workflowSteps.value.length) return
  const copy = [...workflowSteps.value]
  ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
  workflowSteps.value = copy
}

// Save
async function save() { /* PUT /api/workflows/[slug] with name, description, steps */ }

// Run
async function startRun(prompt: string) {
  showRunModal.value = false
  if (!workflow.value) return
  const w = { ...workflow.value, steps: workflowSteps.value }
  await run(w, prompt)
  // Update lastRunAt
  await update(slug, { lastRunAt: new Date().toISOString() } as any)
}

const canRun = computed(() => workflowSteps.value.length > 0 && !isRunning.value)
const filteredAgents = computed(() => {
  if (!paletteSearch.value) return agents.value
  const q = paletteSearch.value.toLowerCase()
  return agents.value.filter(a => a.frontmatter.name.toLowerCase().includes(q))
})
</script>
```

Template layout:
- Top bar: PageHeader with name, Run (disabled when `!canRun`), Save, Delete buttons
- Body: flex row with left palette (200px, hidden on mobile with an "Add Agent" button instead) and VueFlow canvas
- VueFlow pane has `@drop="onDrop"` and `@dragover="onDragOver"`
- Register `WorkflowNode` as custom node type
- Below canvas: `<WorkflowExecutionLog>` shown when `execSteps.length > 0`
- After all steps complete, show a "Workflow complete" banner above the execution log

**Responsive:** On `md:` and below, hide left palette, show an "Add Agent" button in the top bar that opens a modal agent picker. Execution log panel is full width below canvas.

- [ ] **Step 2: Verify build**

Run: `npx nuxi build 2>&1 | tail -5`

---

### Task 13: Add Workflows tab to Explore page

**Files:**
- Modify: `app/pages/explore.vue`

- [ ] **Step 1: Add a third tab "Workflows" to the Explore page**

Add a tab alongside Templates and Extensions that shows workflow templates from `workflowTemplates.ts`. Each template card has a "Use template" button that triggers the same create flow as the workflows list page.

---

### Task 14: Final verification

- [ ] **Step 1: Full build check**

Run: `npx nuxi build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 2: Run full verification checklist from spec**

1. "Workflows" in sidebar between My Agents and Explore
2. `/workflows` empty state with templates
3. Template creates agents if missing, creates workflow, navigates to builder
4. Drag agents from palette onto canvas → nodes appear with edges
5. Reorder via arrow buttons → edges update
6. Remove node → edges reconnect
7. Save → persisted to file
8. Run → prompt modal → sequential execution with progress
9. Execution log shows input/output per step
10. Failed step → remaining skipped
11. Workflows tab on Explore page
12. "Create a Workflow" on Home page
