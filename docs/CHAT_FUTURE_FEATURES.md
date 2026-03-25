# Chat Interface: Future Features Roadmap

This document outlines planned enhancements for the Claude Code Chat interface beyond the core MVP implementation.

---

## Phase 2 Features: Real-time Permissions & Advanced Tools (Est. 1-2 weeks)

### 2.1 Real-time Permission System
**Status**: Planned
**Priority**: High
**Dependencies**: WebSocket bidirectional communication (✅ completed in MVP)

#### Features
- **Mid-execution tool approval**: Pause agent execution to request user permission for sensitive tools
- **Permission request UI**: Inline banners showing tool name, input parameters, and approve/deny buttons
- **Remember decisions**: "Always allow this tool" checkbox to add to allowed tools list
- **Permission patterns**: Support wildcard patterns (e.g., `Bash(git:*)` allows all git commands)
- **Timeout handling**: Auto-deny after 55s to prevent API timeout

#### Implementation Overview
```typescript
// Backend: Hook into Claude SDK
sdkOptions.canUseTool = async (toolName, input, context) => {
  // Check if tool is in allowed list
  if (isAllowed(toolName, input)) return { behavior: 'allow' }

  // Request approval from user
  const requestId = generateId()
  ws.send({ kind: 'permission_request', requestId, toolName, input })

  // Wait for user decision (with timeout)
  const decision = await waitForDecision(requestId, { timeoutMs: 55000 })

  if (decision?.allow) {
    if (decision.remember) {
      // Add to allowed tools permanently
      addToAllowedTools(toolName, input)
    }
    return { behavior: 'allow' }
  }

  return { behavior: 'deny', message: 'User denied' }
}
```

#### UI Components
- `PermissionRequestBanner.vue`: Sticky banner at bottom of chat
- `PermissionHistoryPanel.vue`: View all permission requests in session
- Permission settings page in `/settings`

---

### 2.2 Advanced Tool Rendering

#### 2.2.1 Diff Viewer (Edit/Write/ApplyPatch tools)
**Features:**
- Side-by-side diff view (old vs new)
- Unified diff view (inline changes)
- Syntax highlighting based on file extension
- Line numbers
- Click to open file in editor
- Expand/collapse diff sections

**Libraries to use:**
- `diff` for generating diffs
- `react-diff-viewer-continued` or custom implementation
- `shiki` for syntax highlighting

**Component:**
```vue
<DiffViewer
  :file-path="message.toolInput.file_path"
  :old-content="message.toolInput.old_string"
  :new-content="message.toolInput.new_string"
  :language="detectLanguage(message.toolInput.file_path)"
  view-mode="split"
/>
```

#### 2.2.2 File List Renderer (Glob tool)
**Features:**
- Hierarchical tree view of matched files
- File count badges
- Click to preview file
- Filter/search within results
- Copy file paths

**Component:**
```vue
<FileListDisplay
  :files="message.toolResult.files"
  :pattern="message.toolInput.pattern"
  :total-count="message.toolResult.count"
/>
```

#### 2.2.3 Todo List Visualization (TodoRead/Write)
**Features:**
- Checkbox status indicators
- Progress bar (completed/total)
- Status badges (pending/in_progress/completed)
- Collapsible task groups
- Timeline view (when tasks completed)

**Component:**
```vue
<TodoListDisplay
  :todos="message.toolResult.todos"
  :show-timeline="true"
/>
```

#### 2.2.4 Subagent Execution Container (Task tool)
**Features:**
- Nested indentation for subagent messages
- Collapsible subagent sections
- Progress indicator while running
- Summary line (e.g., "Ran 5 tools in 12.3s")
- Click to expand/collapse all nested tools

**Component:**
```vue
<SubagentContainer
  :agent-name="message.toolInput.subagent_type"
  :nested-messages="getNestedMessages(message.toolId)"
  :is-complete="message.isComplete"
/>
```

---

## Phase 3 Features: Enhanced User Experience (Est. 1 week)

### 3.1 Multi-Provider Support
**Goal**: Support multiple AI providers in chat interface

#### Providers to Support
1. **Claude** (Anthropic) - ✅ Current
2. **Cursor** - Read from `~/.cursor/chats/store.db`
3. **Codex** (OpenAI) - Custom integration
4. **Gemini** (Google) - Future

#### Provider Adapter Pattern
```typescript
interface ProviderAdapter {
  name: string
  normalizeMessage(raw: any, sessionId: string): NormalizedMessage[]
  fetchHistory(sessionId: string, opts: FetchOptions): Promise<Message[]>
  sendQuery(prompt: string, opts: QueryOptions): AsyncIterator<Event>
}
```

#### UI Components
- Provider selector dropdown in chat composer
- Provider-specific icons/badges on messages
- Settings page for provider configuration (API keys, models)

---

### 3.2 Session Search & Filtering

#### Full-Text Search
- Search across all session content
- Highlight matches in messages
- Filter by date range, provider, agent
- Search within specific session or globally

#### Advanced Filters
- By tool usage (e.g., "all sessions that used Edit tool")
- By token usage (e.g., "sessions > 10k tokens")
- By duration (e.g., "sessions > 1 hour")
- By status (active, completed, error)

#### UI Components
```vue
<SessionSearch
  v-model:query="searchQuery"
  :filters="activeFilters"
  @select="navigateToSession"
/>
```

---

### 3.3 Export & Import

#### Export Formats
1. **Markdown**: Human-readable conversation export
2. **JSON**: Structured data for programmatic use
3. **HTML**: Standalone page with styling
4. **PDF**: Formatted document (via print)

#### Import Sources
- Import from other agents-ui installations
- Import from claudecodeui JSONL files
- Import from Cursor SQLite database
- Import from plain text transcripts

#### UI
- Export button in session header
- Batch export (select multiple sessions)
- Import wizard in settings

---

### 3.4 Session Sharing

#### Features
- Generate shareable link to session
- Password protection for shared sessions
- Expiration time for links
- View-only mode (no editing)
- Option to redact sensitive data

#### Implementation
- Upload session to cloud storage (S3, Cloudflare R2)
- Generate short URL (e.g., `agents-ui.com/s/abc123`)
- Standalone viewer page (no authentication required)

---

## Phase 4 Features: Advanced Collaboration (Est. 2-3 weeks)

### 4.1 Real-time Collaboration
**Goal**: Multiple users can participate in the same chat session

#### Features
- WebSocket-based presence (see who's online)
- Live cursor positions in composer
- User avatars on messages
- Typing indicators ("Alice is typing...")
- Conflict resolution (message ordering)

#### Architecture
- Shared WebSocket room per session
- CRDT (Conflict-free Replicated Data Type) for message ordering
- Presence tracking with heartbeat

---

### 4.2 Session Branching
**Goal**: Fork conversations at any point to explore alternatives

#### Features
- Right-click message → "Branch from here"
- Visual tree view of session branches
- Compare branches side-by-side
- Merge branches (combine message histories)
- Label branches (e.g., "Approach A", "Approach B")

#### UI Components
```vue
<SessionBranchTree
  :root-session-id="sessionId"
  :branches="getBranches(sessionId)"
  @select="navigateToProduction branch"
/>
```

---

### 4.3 Analytics Dashboard

#### Metrics to Track
- Total sessions, messages, tokens used
- Token usage by provider, model, agent
- Most-used tools (frequency, success rate)
- Average session duration
- Cost tracking (token costs by provider)
- Tool approval rate (granted vs denied)

#### Visualizations
- Time-series charts (token usage over time)
- Pie charts (tool distribution, provider usage)
- Heatmaps (activity by hour/day)
- Leaderboards (most active agents, top tools)

#### UI
- Dedicated `/analytics` page
- Per-session analytics panel
- Export analytics data as CSV/JSON

---

### 4.4 Custom Prompt Templates

#### Features
- Save frequently-used prompts as templates
- Variables in templates (e.g., `{filename}`, `{context}`)
- Template library with categories (coding, writing, analysis)
- Share templates with team
- Import templates from community

#### UI Components
```vue
<PromptTemplateSelector
  @select="fillComposer"
  :categories="['Coding', 'Writing', 'Analysis']"
/>
```

---

## Phase 5 Features: Integrations & Automation (Future)

### 5.1 Webhook Integrations
- Trigger webhooks on session events (start, complete, error)
- Send notifications to Slack, Discord, Email
- Custom webhook endpoints for external systems
- Event filtering (only trigger on specific conditions)

### 5.2 Scheduled Sessions
- Cron-style session scheduling
- Recurring prompts (e.g., daily summary)
- Background execution (no UI)
- Email digest of results

### 5.3 API Access
- REST API for session management
- GraphQL endpoint for complex queries
- WebSocket API for real-time streaming
- API key management
- Rate limiting

### 5.4 IDE Integrations
- VS Code extension (inline chat)
- JetBrains plugin
- Neovim plugin
- Emacs integration

---

## Technical Debt & Improvements

### Performance Optimizations
1. **Virtual Scrolling**: Render only visible messages (for 1000+ message sessions)
2. **Message Pagination**: Load messages on demand (already in MVP, can optimize)
3. **WebSocket Compression**: Use `permessage-deflate` extension
4. **JSONL Indexing**: Create index file for fast seeks
5. **Caching**: Cache rendered message components

### Code Quality
1. **Unit Tests**: Comprehensive test coverage for message normalization, storage, UI
2. **E2E Tests**: Playwright tests for critical flows
3. **Type Safety**: Strengthen TypeScript types, eliminate `any`
4. **Accessibility**: ARIA labels, keyboard navigation, screen reader support
5. **Documentation**: JSDoc comments, architecture diagrams

### Infrastructure
1. **Database Migration**: Move from JSONL to PostgreSQL/Supabase for scalability
2. **CDN**: Serve static assets from CDN
3. **Rate Limiting**: Prevent abuse of API
4. **Monitoring**: Error tracking (Sentry), analytics (PostHog)
5. **Backup**: Automated session backup to cloud storage

---

## Community Features

### Template Marketplace
- Browse and install community-created prompt templates
- Rate and review templates
- Submit your own templates
- Categories and tags for discovery

### Agent Marketplace
- Share agent configurations
- Pre-built agents for specific tasks (code review, writing, data analysis)
- One-click installation
- Version control for agents

### Session Gallery
- Showcase interesting conversations
- Learn from others' workflows
- Upvote/comment on sessions
- Privacy controls (opt-in sharing)

---

## Mobile Support

### Responsive Design
- Mobile-optimized chat interface
- Touch gestures (swipe to delete, long-press for options)
- Collapsible sections for small screens
- Voice input on mobile

### Progressive Web App (PWA)
- Offline support (cache sessions locally)
- Install as app on mobile devices
- Push notifications for session updates
- Background sync

---

## Voice & Accessibility

### Voice Features
- Speech-to-text for message input (Web Speech API)
- Text-to-speech for Claude responses
- Voice commands ("New session", "Send message")
- Hands-free mode

### Accessibility
- Full keyboard navigation
- Screen reader support (ARIA labels, semantic HTML)
- High contrast mode
- Adjustable font sizes
- Focus indicators

---

## Estimated Timeline for All Features

| Phase | Features | Duration | Status |
|-------|----------|----------|--------|
| MVP | Core chat, persistence, basic UI | 1 week | ✅ Planned |
| Phase 2 | Permissions, advanced tools | 1-2 weeks | 📋 Documented |
| Phase 3 | Multi-provider, search, export | 1 week | 📋 Documented |
| Phase 4 | Collaboration, branching, analytics | 2-3 weeks | 📋 Documented |
| Phase 5 | Integrations, automation | 2-4 weeks | 💭 Ideas |
| Polish | Performance, accessibility, testing | 1-2 weeks | 💭 Ideas |

**Total**: ~8-13 weeks for all features

---

## Prioritization Criteria

When deciding which feature to implement next, consider:

1. **User Impact**: How many users will benefit?
2. **Complexity**: How long will it take to build?
3. **Dependencies**: Does it unblock other features?
4. **Risk**: Could it break existing functionality?
5. **Value**: Does it provide unique value vs other tools?

---

## Contributing

Want to help build these features? Check out our contribution guide:

1. Pick a feature from this document
2. Open an issue for discussion
3. Create a feature branch
4. Submit a pull request
5. Get reviewed and merged

See `CONTRIBUTING.md` for detailed guidelines.

---

**Last Updated**: 2025-03-25
**Next Review**: After MVP completion
