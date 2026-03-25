# Track 1: Progressive In-Context Guidance System

**Date:** 2026-03-18
**Status:** Draft
**Goal:** Add a comprehensive guidance system that teaches complete beginners what agents, skills, actions, and workflows are through tooltips, inline examples, and first-time feature callouts.

---

## Context

The platform was redesigned for beginners (simplified navigation, friendly terminology, wizards), but it lacks in-context education. Users who don't know what an "agent" or "skill" is have no way to learn within the product. This track adds three layers of guidance that meet users where they are.

---

## 1. HelpTip Component

A reusable `<HelpTip>` component that renders a small `?` icon inline. On click, shows a popover with:
- **Title** (1-3 words)
- **Body** (1-2 sentences explaining the concept)
- **Optional "See example" link** that expands an inline example block below the parent element

### Props
- `title: string` — Popover heading
- `body: string` — Explanation text
- `hasExample?: boolean` — If true, shows a "See example" link. The default slot provides the example content.

### Implementation
- Use Nuxt UI's `UPopover` component for the popover
- The `?` icon renders as a `<button>` with `aria-label="Learn more about [title]"` and `tabindex="0"` for keyboard accessibility
- Small (14px), subtle, clickable circle
- Popover max-width: 280px, clamped to viewport on mobile (no overflow)
- Close on click outside or Escape
- Interaction: click-only (not hover) for consistency on touch devices

**Note:** "Actions" in all guidance text refers to the underlying `Command` type in the codebase. The UI uses "Actions" as the user-facing term per the terminology overhaul.

### Placement Map

| Location | Title | Body |
|----------|-------|------|
| Home > Quick actions | What's an agent? | An agent is an AI assistant with custom instructions. It knows how to do a specific job for you. |
| Agent wizard Step 1 | Good descriptions | A good description helps you remember what this agent does, and helps Claude know when to use it. |
| Agent wizard Step 2 > Model | Which model? | "Fast & efficient" is great for simple tasks. "Balanced" works for most things. "Most capable" handles complex reasoning. |
| Agent detail > Actions tab | What are actions? | Actions are reusable workflows (like slash commands) that this agent can perform. |
| Agent detail > Skills tab | What are skills? | Skills give your agent specialized capabilities — like knowing how to review code or write tests. |
| Explore > Templates | What are templates? | Templates are pre-built agents you can create with one click and customize later. |
| Explore > Extensions | What are extensions? | Extensions are add-on packages that give your agents new abilities. |
| Settings > Extensions | Managing extensions | Enable or disable extensions here. Install new ones via the Claude Code CLI. |

---

## 2. Inline Example Blocks

Expandable example blocks shown in strategic locations. Each contains a real, annotated configuration.

### Agent Example
Shown on:
- Agent list empty state
- Agent wizard Step 2 (collapsed "See what a good agent looks like")

Content: A complete agent card showing name, description, model, instructions with callout annotations:
- "This name is short and descriptive"
- "The description explains what the agent does in one sentence"
- "Instructions are specific about tone, rules, and output format"

### Action Example
Shown on: Agent detail > Actions tab empty state

Content: A sample command with annotation explaining how commands reference agents.

### Skill Example
Shown on: Agent detail > Skills tab empty state

Content: A sample skill with annotation explaining how skills attach to agents.

### Implementation
- New `<ExampleBlock>` component
- Props: `title: string`, slot for content
- Toggle open/closed state
- Styled with a subtle left border accent and slightly different background

---

## 3. First-Time Feature Callouts

On first visit to key areas, show a lightweight callout card at the top of the content area.

### State Tracking

Add to Settings type:
```typescript
guidanceSeen?: {
  agentDetail?: boolean
  explore?: boolean
  chat?: boolean
}
```

**Note:** `workflows` key omitted — will be added when the Workflows feature ships (Track 2).

Stored in `settings.json` via existing settings API. On dismiss, the `FeatureCallout` component does an optimistic local state update immediately, then calls `useSettings().save()` with a merged settings object in the background. This avoids blocking the UI on the API call.

### Callout Locations

| Area | Message | Suggested Action |
|------|---------|-----------------|
| Agent detail (first visit) | "This is where you configure your agent — its name, instructions, and what it can do." | "Start by writing clear instructions in the Instructions tab." |
| Explore (first visit) | "Find ready-made templates here. Pick one to create an agent instantly." | "Try using a template to create your first agent." |
| Chat (first open) | "You can ask Claude anything — create agents, get help, or manage your workspace." | "Try asking 'Help me create an agent for writing emails'." |

### Implementation
- New `<FeatureCallout>` component
- Props: `featureKey: string`, `title: string`, `message: string`, `action: string`
- On dismiss: updates `guidanceSeen[featureKey] = true` via settings API
- Renders as a card with accent border, dismiss X button
- Only shown when `guidanceSeen[featureKey]` is falsy

---

## Files to Create

| File | Purpose |
|------|---------|
| `app/components/HelpTip.vue` | Tooltip/popover component |
| `app/components/ExampleBlock.vue` | Expandable example component |
| `app/components/FeatureCallout.vue` | First-time callout component |

## Files to Modify

| File | Changes |
|------|---------|
| `app/types/index.ts` | Add `guidanceSeen` to Settings interface |
| `app/pages/index.vue` | Add HelpTip next to quick actions |
| `app/pages/agents/[slug].vue` | Add HelpTips on tabs, FeatureCallout on first visit, ExampleBlocks on empty states |
| `app/pages/explore.vue` | Add HelpTips, FeatureCallout |
| `app/components/AgentWizard.vue` | Add HelpTips on fields |
| `app/components/ChatPanel.vue` | Add FeatureCallout on first open |

---

## Verification

1. Open app as new user → verify no callouts appear on Home (no first-time gate there)
2. Navigate to Explore → verify callout appears, dismiss it, navigate away and back → verify it doesn't reappear
3. Click `?` icons → verify popovers show correct content, close on click outside
4. On agent detail Actions tab (empty) → verify example block is visible and expandable
5. Verify all `guidanceSeen` keys persist in settings.json
6. Verify callouts don't appear for returning users (with `guidanceSeen` already set)
