# Agent Manager: Beginner-Friendly Platform Redesign

**Date:** 2026-03-18
**Status:** Draft
**Goal:** Redesign the entire Agent Manager platform to be usable by complete beginners while retaining power-user capabilities through progressive disclosure.

---

## Context

Agent Manager is a Nuxt 3 web UI for managing Claude Code agents, commands, skills, and plugins. It currently exposes raw developer concepts (frontmatter, YAML, slugs, file paths) and has 8+ navigation sections. This makes it inaccessible to non-technical users.

This redesign makes every feature approachable to complete beginners while preserving advanced access through progressive disclosure (expandable sections, not mode toggles).

**Key principles:**
- Chat and visual UI are equal partners — users can accomplish tasks through either
- Simple by default, detailed on demand
- Friendly terminology everywhere
- Templates as the primary on-ramp

---

## 1. Information Architecture

### Current (8 sections)
Dashboard, Agents, Commands, Skills, Plugins, Templates, Graph, Settings

### Proposed (4 sections)

| Section | Contents | Merged from |
|---------|----------|-------------|
| **Home** | Welcome, quick actions, recent agents, suggested next steps | Dashboard, Suggestions |
| **My Agents** | Agent card grid. Each agent detail page shows its actions (commands) and skills inline as tabs | Agents, Commands, Skills |
| **Explore** | Template gallery + Extension (plugin) marketplace | Templates, Plugins |
| **Settings** | App config, claude directory, advanced tools (Connections graph, bulk ops) | Settings, Graph |

**Rationale:**
- Commands and Skills fold into agent context — beginners don't need them as standalone concepts
- Graph moves to Settings > Advanced (power-user tool)
- Templates promoted to "Explore" — primary discovery mechanism
- Chat (Cmd+J) remains a global slide-in, accessible everywhere

**Data relationship: Commands → Agents:**
Commands currently have no agent association. To populate the "Actions" tab, we use a **heuristic matching** approach: scan agent body/instructions for command references (e.g., `/command-name`), and show matching commands in that agent's Actions tab. Commands not referenced by any agent appear in a "Standalone Actions" section on the My Agents index page. No schema changes needed — this is a UI-level grouping.

**Data relationship: Skills → Agents:**
Skills already have an optional `agent` field in frontmatter. The "Skills" tab on the agent detail page filters skills by this field. "Add/remove" works by updating the skill's `agent` frontmatter field via the existing `PUT /api/skills/[slug]` endpoint. A skill picker dropdown lets users attach existing skills or create new ones.

**URL migration:**
Old routes (`/commands/*`, `/skills/*`, `/plugins/*`) will redirect:
- `/commands/[slug]` → `/agents?action=[slug]` (opens action in context)
- `/skills/[slug]` → `/agents?skill=[slug]` (opens skill in context)
- `/plugins/*` → `/explore?tab=extensions`
- `/graph` → `/settings?section=advanced`

---

## 2. Terminology Overhaul

| Current | New | Notes |
|---------|-----|-------|
| Frontmatter | *(hidden — fields shown individually)* | Never exposed as a concept |
| Body | Instructions | Agent/Skill editing |
| Slug | *(auto-generated, hidden)* | Internal only |
| Model (opus/sonnet/haiku) | "Most capable" / "Balanced" / "Fast & efficient" | Agent creation picker |
| Commands | Actions | Sidebar, agent detail tabs |
| Skills | Skills | Intuitive enough to keep |
| Plugins | Extensions | Explore page |
| Graph | Connections | Settings > Advanced |
| Claude Directory | *(hidden by default)* | Settings > Advanced |
| Allowed Tools | Permissions | Advanced agent settings |
| Memory Type | *(auto-configured, hidden)* | Advanced settings |
| `filePath` | *(never shown)* | Internal only |

---

## 3. Home Page

### First-time user
- **Welcome banner:** "Welcome to Agent Manager! Create AI assistants that work for you."
- **3 action buttons:** "Create an Agent", "Browse Templates", "Chat with Claude"
- **Guided tip:** "Start by creating your first agent from a template!"

### Returning user
- **Quick actions row:** "Create an Agent", "Browse Templates", "Chat with Claude" — large clickable cards
- **Recent agents:** Card grid (last 4-6) with name, description, color indicator
- **Suggested next steps:** Powered by the existing `/api/suggestions` endpoint, but with friendly phrasing. Maps existing suggestion types (missing descriptions, orphan skills, etc.) to beginner-friendly tips.
- Stats move to Settings or a subtle footer — not primary content

---

## 4. Agent Creation Wizard

3-step guided flow replacing the current raw form.

### Step 1 — "What should this agent do?"
- Single text area: *"Describe what you want this agent to help you with"*
- Placeholder: *"An agent that helps me write professional emails"*
- Below: template card row — "Or start from a template" (4-6 popular templates)

**Data flow:** The description text is stored as the agent's `description` frontmatter field. It is also used to auto-suggest a name (simple heuristic: extract key noun phrase, e.g., "email writing assistant"). If a template is selected instead, its pre-filled values populate Step 2. No AI generation at this stage — keep it fast and predictable.

### Step 2 — "Customize your agent"
- **Name** — auto-suggested from description, editable
- **Icon & Color** — visual picker (color swatches, emoji/icon selector)
- **Model** — simple choice cards:
  - "Fast & efficient" (Haiku)
  - "Balanced" (Sonnet) — *recommended badge*
  - "Most capable" (Opus)
- **Instructions** — textarea labeled "Instructions" with placeholder: *"Tell your agent how to behave, what tone to use, what to focus on..."*

### Step 3 — "Review & Create"
- Summary card of all settings
- "Create Agent" button
- Optional collapsed "Add skills" section

### Advanced (collapsed by default on Step 2)
- Raw frontmatter editor
- File path info
- Memory settings
- Permissions (allowed tools)

### Edit mode
The wizard is **creation-only**. Editing existing agents uses the Agent Detail Page (section 5) with inline editing on each tab. The detail page's fields mirror the wizard's Step 2 fields. This avoids the awkward "What should this agent do?" prompt for an agent that already exists.

### Error handling
- Back/forward navigation between steps preserves entered data
- Network errors on Step 3 show an inline error with a "Try again" button
- Validation: Name is required (checked on Step 2), other fields optional
- No draft persistence for the wizard — it's quick enough to redo

---

## 5. Agent Detail Page

### Header
- Agent name, icon, color badge
- "Edit" and "Delete" buttons
- "Chat with this agent" button (opens chat panel pre-configured)

### Tabs
- **Overview:** Description, model (friendly name), creation date, quick stats
- **Instructions:** Rich textarea (the "body") with formatting hints
- **Actions:** Commands associated with this agent (relabeled "Actions")
- **Skills:** Skills attached to this agent with add/remove

### Advanced section (collapsed)
- Raw frontmatter editor
- File path
- Memory configuration
- Permissions (allowed tools)

### Inline editing
All fields on the detail page are directly editable (click to edit pattern). The existing `useDraftRecovery` and `useUnsavedChanges` composables are reused to prevent data loss. Save via existing `PUT /api/agents/[slug]` endpoint.

---

## 6. Chat Panel Upgrades

Built on existing `ChatPanel.vue` slide-in (Cmd+J).

### Welcome state (empty chat)
- 4-6 suggested prompt cards:
  - "Create a new agent"
  - "What can I do here?"
  - "Help me set up my first agent"
  - "Show me my agents"

### Friendly status indicators
- "Thinking..." instead of raw thinking blocks (details available via "Show details" toggle)
- Tool progress shows friendly descriptions: "Reading your files..." / "Saving changes..." instead of tool names (Read, Write, Glob)

### Action cards
- When Claude creates/modifies an agent, show a visual card in chat with a link to it

### Onboarding mode
- First-time users get contextual tips in chat ("Try asking me to create an agent!")

### Terminology consistency
The chat panel adopts all new terminology: "Actions" not "Commands", "Extensions" not "Plugins". Suggested prompts use friendly language only. The system prompt sent to Claude (in `chat.post.ts`) is updated to use the new terms so Claude's responses are consistent.

---

## 7. Explore Page

Combined Templates + Extensions page.

### Tab bar: Templates | Extensions

### Templates tab
- Card grid with category filters (Productivity, Writing, Code, Creative, etc.)
- Each card: name, description, preview, "Use this template" button
- Search bar at top

### Extensions tab
- Installed extensions with enable/disable toggles
- Search/filter among installed extensions
- **Note:** "Browse more" / marketplace discovery is **out of scope** for this redesign. The Extensions tab shows only locally installed plugins. A marketplace feature can be added later.

---

## 8. Onboarding Flow

New first-time user experience. Replaces the existing `WelcomeOnboarding` component in `index.vue` and merges with `SetupWizard.vue` into a single `OnboardingFlow.vue`.

1. **Welcome screen:** "Agent Manager helps you create AI assistants that work for you" — brief, visual intro
2. **Setup check:** Verify Claude directory exists (reuse logic from existing `SetupWizard.vue`, which is then deprecated)
3. **Guided first agent:** Walk through creating first agent from a template (reuses agent creation wizard)
4. **Chat intro:** Show chat panel, demonstrate asking a question
5. **Done:** Land on Home with everything set up

### State tracking
- Store `onboardingCompleted: boolean` in settings via existing settings API
- Show onboarding only when `false` or missing
- "Skip" option always available

### Replaces
- `WelcomeOnboarding` component (currently in `index.vue`)
- `SetupWizard.vue` (setup logic merged into OnboardingFlow step 2)

---

## 9. Settings Page

### Simplified default view
- Theme toggle (light/dark)
- Claude directory path (with "Change" button)
- Extensions management (enable/disable)

### Advanced section (collapsed)
- Connections graph (formerly "Graph" page)
- Hooks configuration
- Bulk operations
- Raw settings editor

---

## Files to Modify

### Navigation & Layout
- `app/app.vue` — Sidebar restructure (8 → 4 sections), terminology changes

### Pages (modify existing)
- `app/pages/index.vue` — Home page redesign
- `app/pages/agents/index.vue` — Card grid, friendly terminology
- `app/pages/agents/[slug].vue` — Tabbed detail page, progressive disclosure
- `app/pages/settings.vue` — Simplified + advanced section
- `app/pages/graph.vue` — Remove as standalone page; embed graph component into Settings > Advanced "Connections" section

### Pages (merge/remove)
- `app/pages/commands/` — Fold into agent detail "Actions" tab
- `app/pages/skills/` — Fold into agent detail "Skills" tab
- `app/pages/templates.vue` — Becomes "Explore" page templates tab
- `app/pages/plugins/` — Becomes "Explore" page extensions tab

### Pages (new)
- `app/pages/explore.vue` — Combined Templates + Extensions

### Components (modify)
- `app/components/ChatPanel.vue` — Welcome state, friendly status, action cards
- `app/components/SetupWizard.vue` — Integrate into broader onboarding
- `app/components/AgentForm.vue` — Replace with wizard steps

### Components (new)
- `app/components/AgentWizard.vue` — 3-step creation wizard
- `app/components/OnboardingFlow.vue` — First-time user experience
- `app/components/AgentCard.vue` — Card component for agent grid views
- `app/components/QuickActionCard.vue` — Large action cards for Home page
- `app/components/TemplateCard.vue` — Template card for Explore page

### Composables
- `app/composables/useChat.ts` — Add onboarding tips, friendly status messages
- `app/composables/useAgents.ts` — May need updates for wizard flow

### Types
- `app/types/index.ts` — Add onboarding state, wizard step types

### Server
- `server/api/chat.post.ts` — Update system prompt to use new terminology
- Minor updates to existing endpoints as needed for new UI patterns

---

## Verification

1. **Navigation:** Open app → verify 4 sections in sidebar (Home, My Agents, Explore, Settings)
2. **Onboarding:** Clear settings → reopen → verify onboarding flow triggers
3. **Agent creation:** Click "Create an Agent" → verify 3-step wizard works end-to-end
4. **Agent detail:** Open an agent → verify tabs (Overview, Instructions, Actions, Skills)
5. **Terminology:** Scan all pages → verify no developer jargon visible in default view
6. **Progressive disclosure:** On agent detail → verify "Advanced" section expands to show raw frontmatter
7. **Chat:** Open chat (Cmd+J) → verify welcome prompts, friendly status messages
8. **Explore:** Navigate to Explore → verify Templates and Extensions tabs
9. **Settings:** Open Settings → verify simplified view with collapsible Advanced section
10. **Responsive:** Test on mobile viewport → verify layout adapts
