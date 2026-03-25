# Chat Slash Commands — Design Spec

## Problem

Users cannot invoke skills or commands from the chat UI. Typing `/roadmap` (a skill belonging to the "pm" agent) results in a "skill not found" error because the message is sent as plain text to the Claude Agent SDK, which has no slash command resolution.

## Goal

Enable users to invoke skills and commands directly from the chat input using slash syntax, with autocomplete for discoverability.

## Syntax

- `/skill-name` — matches any skill or command by slug
- `/agent:skill-name` — targets a skill belonging to a specific agent
- `/skill-name additional context` — skill invocation with user arguments

**Escaping**: Only inputs where the first token (text before the first space) matches a known skill/command slug are treated as slash commands. `/etc/config` would not match anything and is sent as a plain message. The autocomplete only appears when there is a match.

## Architecture: Hybrid (Frontend autocomplete + Backend resolution)

Frontend handles autocomplete UI using already-cached skills/agents/commands data. Frontend sends a structured payload with the parsed skill reference. Backend resolves the skill content from the filesystem and injects it into the prompt.

## Types (types/index.ts)

```ts
interface SkillInvocation {
  skill: string       // e.g. "roadmap" or "pm:roadmap"
  args: string | null  // everything after the skill name
}
```

## 1. Frontend: Slash Command Parsing (useChat.ts)

`sendMessage(content: string)` detects the `/` prefix internally — no signature change.

- If input starts with `/`, extract the first token as the potential skill reference and the rest as args
- Parse into `SkillInvocation`: `/pm:roadmap build X` → `{ skill: "pm:roadmap", args: "build X" }`
- Add `invoke` field to the POST body:
  ```ts
  {
    messages: [...],
    sessionId: string | null,
    invoke?: SkillInvocation
  }
  ```
- The user message displayed in chat shows the raw input text

## 2. Frontend: Autocomplete Dropdown (ChatSkillAutocomplete.vue)

- **Trigger**: input starts with `/` and not currently streaming
- **Data source**: `useSkills().skills` + `useCommands().commands`. Skills carry `frontmatter.agent` if set; commands have no agent association.
- **Filtering**: simple case-insensitive `includes` on slug and name (no external library). Debounced at 100ms to avoid jank.
- **Display per item**: icon (skill icon vs terminal icon for commands), name, agent badge (if `frontmatter.agent` exists), truncated description
- **Grouping**: items with an agent are grouped under agent headers. Items without an agent (standalone skills + all commands) appear under an "General" header.
- **Keyboard**: Arrow up/down, Enter to select (fills input with `/<agent>:<skill> ` or `/<skill> `), Escape to dismiss autocomplete (does NOT close panel — Escape only closes panel when autocomplete is not showing), Tab to complete without sending.
- **Mouse**: click to select
- **Max height**: ~200px, scrollable
- **Position**: above textarea, anchored to input area
- **Loading state**: if skills/commands haven't loaded yet, show a brief "Loading..." indicator. Fetch is triggered on panel open if not already cached.

### handleKeydown changes (ChatPanel.vue)

The existing `handleKeydown` must check if autocomplete is open. If open:
- Enter → select highlighted item (do NOT send message)
- Arrow up/down → navigate autocomplete
- Escape → close autocomplete

If autocomplete is closed, existing behavior (Enter sends, Escape closes panel).

Achieved via a ref `autocompleteOpen` exposed by the autocomplete component.

## 3. Backend: Skill Resolution (chat.post.ts)

Update the body type to include `invoke?: { skill: string, args: string | null }`.

When request body contains `invoke`:

1. Parse `invoke.skill` — split on `:` for optional `agent:name` format
2. Resolution — reuse existing server utils (`resolveClaudePath`, `parseFrontmatter`):
   a. Skills directory (`skills/<name>/SKILL.md`) — filter by agent frontmatter if agent prefix given
   b. Plugin skills — same agent filter, same logic as `agents/[slug]/skills.get.ts`
   c. Commands directory (`commands/`) — match by slug
3. If found, build prompt:
   ```
   <skill name="roadmap" agent="pm">
   {skill body content}
   </skill>

   User request: {invoke.args}
   ```
   If no args, just the skill block as the prompt.
4. If not found, send SSE error: `"Skill not found: {name}"`

When no `invoke` field, existing behavior unchanged.

## Files Changed

| File | Change |
|---|---|
| `app/types/index.ts` | Add `SkillInvocation` interface |
| `server/api/chat.post.ts` | Update body type, resolve skill/command from filesystem using existing utils, inject into prompt |
| `app/composables/useChat.ts` | Parse `/` prefix into structured `invoke` payload inside `sendMessage` |
| `app/components/ChatPanel.vue` | Wire up autocomplete, modify `handleKeydown` to delegate when autocomplete is open |
| `app/components/ChatSkillAutocomplete.vue` | **New** — autocomplete dropdown component |

## Edge Cases

- No match found: SSE error event displayed in chat
- Multiple matches (no agent prefix): prefer standalone skills, then plugin skills, then commands; first match wins
- Empty input after `/`: show full list (capped at 20 items)
- Streaming in progress: autocomplete disabled
- Skills/commands not yet loaded: show "Loading..." in dropdown, trigger fetch
- Escape key: closes autocomplete first, only closes panel when autocomplete is already closed
- Input like `/etc/config`: no matching skill → sent as plain message, no invoke field
