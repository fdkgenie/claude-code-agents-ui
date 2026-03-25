# Use Agent / Use Skill from the UI

**Date:** 2026-03-18
**Status:** In Review

## Problem

Agents and skills have detail/editor pages but no way to actually use them from the UI. The chat panel (Cmd+J) is always a generic Claude assistant. Users must manually type slash commands or have no way to chat with a specific agent's persona.

## Design

### Entry Points

- **Agent detail page** (`/agents/[slug]`): A "Chat with agent" button in the header area, alongside Save/Delete/Export. Button is disabled while the agent is still loading.
- **Skill detail page** (`/skills/[slug]`): A "Use skill" button in the same header area.

Both buttons only appear on detail pages, not on list views or the dashboard.

### Agent Chat Flow

1. User clicks "Chat with agent" on an agent detail page.
2. Chat panel opens (same Cmd+J sliding panel).
3. Session is initialized with the agent's context — instructions sent as system-level context to the backend.
4. A banner appears at the top of the chat panel showing: agent name, color dot, and an "x" button to clear the agent context.
5. Placeholder text adapts: "Ask **agent-name** something..."
6. Clearing the agent context (via banner "x") resets to generic Claude. Existing messages stay, but new messages go to plain Claude without the agent persona.

**Switching agents mid-conversation:** If the user clicks "Chat with agent" on a different agent while one is already active, the current conversation is cleared and a new session starts with the new agent. No confirmation prompt — this mirrors starting a fresh conversation.

### Skill Invocation Flow

1. User clicks "Use skill" on a skill detail page.
2. Chat panel opens.
3. Input is pre-filled with `/<skill-frontmatter-name> ` (using the skill's `frontmatter.name`, not the slug, since that's the actual command name). Trailing space, cursor at end.
4. User types arguments and sends.
5. No special banner — the skill invocation is visible in the message itself.

### Backend Changes

The `/api/chat` endpoint already supports skill invocation via the `invoke` field and already accepts `agentSlug`. When `agentSlug` is present, the server loads the agent's instructions and uses them as the system prompt, **replacing** the default manager system prompt. The agent persona should not compete with the generic "you manage Claude Code agents" framing.

### Chat Panel Open State

Currently `chatOpen` is a local ref in `app.vue`. To allow detail pages to open the chat panel, this state must be shared. Move it into `useChat` as a `useState`:

```ts
const isPanelOpen = useState<boolean>('chat-panel-open', () => false)
```

`app.vue` binds to this: the slideover's open state is controlled by `isPanelOpen` from `useChat`.

### State Management (`useChat` composable)

- New `isPanelOpen` state: shared via `useState`, replaces local ref in `app.vue`.
- New `activeAgent` ref: holds the agent object or `null`.
- New `pendingInput` ref: a string that `ChatPanel` watches. When set, it populates the input field and clears `pendingInput`.
- New `startAgentChat(agent)` method: sets `activeAgent`, clears conversation history & session, sets `isPanelOpen = true`.
- New `prefillSkill(skillName)` method: sets `pendingInput` to `/<skillName> `, sets `isPanelOpen = true`.
- Clearing the agent (via banner "x") resets `activeAgent` to `null` but preserves message history.

### UI Components

**ChatPanel.vue changes:**
- Agent banner at top of chat area (conditionally rendered when `activeAgent` is set).
- Banner shows: colored dot, agent name, "x" dismiss button.
- Input placeholder changes based on active agent: "Ask **agent-name** something..." vs default.
- Watches `pendingInput` — when it changes to a non-empty value, sets local input and clears `pendingInput`.
- Passes `agentSlug` to the `/api/chat` request body when `activeAgent` is set.

**Agent detail page changes:**
- Add "Chat with agent" button (with a message/chat icon) in the header action bar. Disabled while agent is loading.

**Skill detail page changes:**
- Add "Use skill" button (with a play/terminal icon) in the header action bar.

### Files to Modify

1. `app/composables/useChat.ts` — add `isPanelOpen`, `activeAgent`, `pendingInput`, `startAgentChat()`, `prefillSkill()`
2. `app/components/ChatPanel.vue` — agent banner, dynamic placeholder, `pendingInput` watcher, pass `agentSlug` to API
3. `app/app.vue` — replace local `chatOpen` ref with `isPanelOpen` from `useChat`
4. `app/pages/agents/[slug].vue` — add "Chat with agent" button
5. `app/pages/skills/[slug].vue` — add "Use skill" button
6. `server/api/chat.post.ts` — when `agentSlug` is set, replace default system prompt with agent-specific instructions
