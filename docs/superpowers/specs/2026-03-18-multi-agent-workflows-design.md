# Track 2: Multi-Agent Workflows (Visual Flow Builder)

**Date:** 2026-03-18
**Status:** Draft
**Goal:** Add a visual flow builder that lets users chain agents together into linear workflows, executed sequentially via the existing chat API.

---

## Context

Users can create individual agents, but there's no way to compose them into multi-step pipelines. This feature adds a visual flow builder using VueFlow (already in the codebase for the relationship graph) where users drag agents onto a canvas to create sequential workflows.

**Scope:** Linear chains only (no branching). Text passing between steps (output of step N is input to step N+1). Client-side execution via existing chat API.

---

## 1. Data Model

### Workflow Type

```typescript
interface WorkflowStep {
  id: string
  agentSlug: string
  label: string
}

interface Workflow {
  slug: string
  name: string
  description: string
  steps: WorkflowStep[]
  createdAt: string
  lastRunAt?: string
  filePath: string
}

interface WorkflowPayload {
  name: string
  description: string
  steps: WorkflowStep[]
}
```

### Storage

Workflows stored as JSON files in `~/.claude/workflows/`:
```
~/.claude/workflows/code-review-pipeline.json
~/.claude/workflows/content-creation.json
```

Each file contains the full workflow definition. Slug derived from filename (same pattern as agents). On create, the server slugifies the `name` field to produce the filename (lowercase, hyphens for spaces, strip special chars). Collisions are handled by appending a numeric suffix (e.g., `my-workflow-2.json`).

---

## 2. API Endpoints

All follow the existing CRUD pattern used by agents/commands/skills.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/workflows` | List all workflows |
| `GET` | `/api/workflows/[slug]` | Get one workflow |
| `POST` | `/api/workflows` | Create workflow |
| `PUT` | `/api/workflows/[slug]` | Update workflow |
| `DELETE` | `/api/workflows/[slug]` | Delete workflow |

**No dedicated execution endpoint.** Execution is client-side: the composable calls `/api/chat` sequentially per step.

**Chat API extension required:** The existing `POST /api/chat` must be extended to accept an optional `agentSlug` field. When provided, the server reads the agent's markdown file, and appends its instructions to the system prompt so Claude acts as that specific agent. This is the foundational change that enables per-agent execution.

New request body field:
```typescript
{
  // ...existing fields
  agentSlug?: string  // Load this agent's instructions as additional system context
}
```

Server implementation: When `agentSlug` is set, read `${claudeDir}/agents/${agentSlug}.md`, parse frontmatter + body, and append to the system prompt: `"\n\nYou are now acting as the agent '${name}'. Follow these instructions:\n\n${body}"`

**Important:** `useWorkflowExecution` must NOT use the shared `useChat()` composable (which is a global singleton storing the user's chat history). Instead, it calls `$fetch('/api/chat', ...)` directly to avoid polluting the chat panel state.

---

## 3. Navigation

Update sidebar from 4 to 5 items:

| # | Label | Icon | Route |
|---|-------|------|-------|
| 1 | Home | `i-lucide-home` | `/` |
| 2 | My Agents | `i-lucide-cpu` | `/agents` |
| 3 | Workflows | `i-lucide-git-branch` | `/workflows` |
| 4 | Explore | `i-lucide-compass` | `/explore` |
| 5 | Settings | `i-lucide-settings` | `/settings` |

**Note:** The `/graph` page remains accessible via Settings > Advanced "Connections" link (unchanged from current state). It is not in the sidebar.

---

## 4. Workflows List Page (`/workflows`)

### Layout
- `PageHeader` with title "Workflows" and "New Workflow" button
- Card grid (same pattern as agents list)
- Each card shows: name, description, step count (e.g., "3 agents"), last run time, step agent icons/colors

### Empty State
- Icon + "Chain your agents together"
- "Create workflows that pass work from one agent to the next."
- "New Workflow" button
- Below: 2-3 workflow template cards (pre-built pipelines)

### Workflow Templates
Pre-built templates that create a workflow pre-populated with steps:

| Template | Steps | Description |
|----------|-------|-------------|
| Code Review Pipeline | code-reviewer → documentation-writer | Review code then update docs |
| Content Creation | research-assistant → writing-assistant | Research a topic then write about it |
| Email Workflow | writing-assistant → email-drafter | Draft content then format as email |

Templates reference agent slugs. If the agent doesn't exist, it's created from the agent template library first.

---

## 5. Flow Builder Page (`/workflows/[slug]`)

### Layout: Three Panels

**Top Bar:**
- Back button (to `/workflows`)
- Workflow name (click to reveal `<input>`, same pattern as agent name editing)
- Description (click to reveal `<input>`)
- "Run" button (primary, with play icon)
- "Save" button
- "Delete" button

**Left Palette (200px, scrollable):**
- Header: "Your Agents"
- List of all agents from `useAgents()`
- Each item: agent color dot, name, drag handle
- Uses HTML5 drag-and-drop: each agent item has `draggable="true"` and sets `dataTransfer` with the agent slug
- Search/filter input at top

**Main Canvas (flex-1):**
- VueFlow canvas with manual horizontal positioning (not auto-layout — no dagre/elkjs needed)
- Nodes positioned at `x = stepIndex * 220, y = 100` (simple left-to-right spacing)
- On adding a node via drop: listen for `@drop` on the VueFlow pane, read the agent slug from `dataTransfer`, append to steps array, recalculate positions
- Edges auto-generated from the steps array (step[i] → step[i+1])
- Click a node to select it (shows agent details in a side popover)
- X button on each node to remove it from steps array
- **Reordering:** Nodes are NOT reordered by dragging on canvas. Instead, a small up/down button pair on each node moves it in the step sequence. This avoids the complexity of mapping canvas position to array order.

### Node Appearance
- 160px × 80px rounded card
- Agent color accent bar at top (3px)
- Agent name (bold, 13px)
- Model badge (friendly name)
- Step number (small, top-left corner: "#1", "#2", etc.)
- Remove button (X, top-right, shown on hover)

### Edge Appearance
- Animated dashed line (subtle flow animation suggesting data direction)
- Arrow at target end

### VueFlow Configuration
- Import VueFlow, Controls, MiniMap (same packages as `graph.vue` — only imports are reused, node/edge logic is entirely new)
- Manual node positioning: `x = stepIndex * 220, y = 100` (no auto-layout library needed for linear chains)
- Minimap enabled for workflows with 5+ steps
- Controls panel for zoom
- `WorkflowNode.vue` is a custom VueFlow node template (completely new, not shared with graph)

### Responsive behavior
- On mobile/small screens: hide the left palette, show an "Add Agent" button that opens a modal picker instead
- Execution log panel stacks below canvas on mobile (full width)

---

## 6. Execution View

### Trigger
Click "Run" → modal opens with:
- Text area: "What should this workflow process?"
- Placeholder: e.g., "Review the authentication module in src/auth/"
- "Start" button

### Execution Progress

The canvas stays visible with real-time updates:

**Node states:**
- `pending` — Default gray appearance
- `running` — Pulsing glow animation (reuse chat streaming style), accent border
- `completed` — Green check overlay, subtle green border
- `failed` — Red X overlay, red border
- `skipped` — If a previous step failed, remaining steps show as skipped (gray, dimmed)

**Execution Log Panel (below canvas, 300px, resizable):**
- Accordion-style: one section per step
- Auto-expands the currently running step
- Each section shows:
  - Step name and status badge
  - "Input" (collapsed): what was sent to this agent
  - "Output" (expanded): the agent's response, rendered as markdown
  - Duration badge

### Execution Logic (Client-Side)

```
1. User provides initial prompt
2. For each step in order:
   a. Call POST /api/chat with:
      - messages: [{ role: 'user', content: previousOutput || initialPrompt }]
      - System context includes: "You are the agent [name]. [agent instructions]"
   b. Stream response, display in execution log
   c. On completion, capture final text as input for next step
   d. On error, mark step as failed, mark remaining as skipped, stop
3. On completion of all steps, show "Workflow complete" banner
```

**Note:** Each step starts a fresh chat session (no session resumption between steps). The agent's instructions come from its file, and the input is the previous step's text output.

---

## 7. Composables

### `useWorkflows()`

```typescript
function useWorkflows() {
  // State
  const workflows: Ref<Workflow[]>
  const loading: Ref<boolean>
  const error: Ref<string | null>

  // CRUD
  function fetchAll(): Promise<void>
  function fetchOne(slug: string): Promise<Workflow>
  function create(payload: WorkflowPayload): Promise<Workflow>
  function update(slug: string, payload: WorkflowPayload): Promise<Workflow>
  function remove(slug: string): Promise<void>

  return { workflows, loading, error, fetchAll, fetchOne, create, update, remove }
}
```

### `useWorkflowExecution()`

```typescript
interface StepExecution {
  stepId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  input: string
  output: string
  error?: string
  startedAt?: number
  completedAt?: number
}

function useWorkflowExecution() {
  const steps: Ref<StepExecution[]>
  const isRunning: Ref<boolean>
  const currentStepIndex: Ref<number>

  async function run(workflow: Workflow, initialPrompt: string): Promise<void>
  function stop(): void  // Aborts current step's fetch, marks it as 'failed', marks remaining as 'skipped'

  return { steps, isRunning, currentStepIndex, run, stop }
}
```

Execution calls `/api/chat` directly via `$fetch` (not `useChat()`) per step. Each step starts a fresh session. The `agentSlug` field tells the server which agent's instructions to use.

**Validation:** A workflow must have at least 1 step to be saved or run. The "Run" button is disabled for empty workflows.

**WorkflowStep.id:** Generated as `crypto.randomUUID()` on the client when a step is added. Used to correlate with `StepExecution.stepId`.

**`lastRunAt` persistence:** After execution completes (success or failure), the client calls `PUT /api/workflows/[slug]` with `lastRunAt` set to the current ISO timestamp.

---

## 8. Workflow Templates

Pre-built templates stored in `app/utils/workflowTemplates.ts`:

```typescript
interface WorkflowTemplate {
  id: string
  name: string
  description: string
  icon: string
  steps: { agentTemplateId: string; label: string }[]
  // agentTemplateId maps to AgentTemplate.id from app/utils/templates.ts
  // Resolution: look up agent by slug matching the template's frontmatter.name
  // If not found, create the agent from the template first
}
```

When a user picks a template:
1. Check if required agents exist (by template ID → agent slug)
2. Create missing agents from agent templates
3. Create the workflow with the agent slugs
4. Navigate to the flow builder

Also add a "Workflows" tab to the Explore page alongside Templates and Extensions.

---

## Files to Create

| File | Purpose |
|------|---------|
| **Server** | |
| `server/api/workflows/index.get.ts` | List workflows |
| `server/api/workflows/index.post.ts` | Create workflow |
| `server/api/workflows/[slug].get.ts` | Get workflow |
| `server/api/workflows/[slug].put.ts` | Update workflow |
| `server/api/workflows/[slug].delete.ts` | Delete workflow |
| **Frontend** | |
| `app/pages/workflows/index.vue` | Workflows list page |
| `app/pages/workflows/[slug].vue` | Flow builder page |
| `app/composables/useWorkflows.ts` | Workflow CRUD composable |
| `app/composables/useWorkflowExecution.ts` | Execution logic |
| `app/components/WorkflowCard.vue` | Card for workflows list |
| `app/components/WorkflowNode.vue` | Custom VueFlow node |
| `app/components/WorkflowExecutionLog.vue` | Step-by-step execution output |
| `app/components/WorkflowRunModal.vue` | Initial prompt input modal |
| `app/utils/workflowTemplates.ts` | Pre-built workflow templates |

## Files to Modify

| File | Changes |
|------|---------|
| `app/app.vue` | Add Workflows to nav (5th item), fetch workflows on mount |
| `app/types/index.ts` | Add Workflow, WorkflowStep, WorkflowPayload types |
| `app/pages/explore.vue` | Add Workflows tab |
| `app/pages/index.vue` | Add "Create a Workflow" quick action card |
| `server/utils/claudeDir.ts` | Ensure `workflows/` directory creation in setup |
| `server/api/setup.post.ts` | Create `workflows/` directory |

---

## Verification

1. **Navigation:** Verify "Workflows" appears in sidebar between My Agents and Explore
2. **Empty state:** Open `/workflows` with no workflows → verify empty state with templates
3. **Create from template:** Click a workflow template → verify agents created if missing, workflow created, navigates to builder
4. **Flow builder:** Drag agents from palette → verify nodes appear on canvas, edges connect sequentially
5. **Reorder:** Drag a node to reorder → verify edges update
6. **Remove node:** Click X on a node → verify it's removed and edges reconnect
7. **Save:** Edit name/description, save → verify persisted to file
8. **Run:** Click Run → enter prompt → verify steps execute sequentially with progress indicators
9. **Execution log:** Verify each step shows input/output, currently running step auto-expands
10. **Error handling:** If a step fails, verify remaining steps show as skipped
11. **Explore tab:** Verify Workflows tab appears on Explore page with templates
12. **Home page:** Verify "Create a Workflow" quick action appears
