export type AgentModel = 'opus' | 'sonnet' | 'haiku'
export type AgentMemory = 'user' | 'project' | 'none'

export interface AgentFrontmatter {
  name: string
  description: string
  model?: AgentModel
  color?: string
  memory?: AgentMemory
}

export interface Agent {
  slug: string
  filename: string
  frontmatter: AgentFrontmatter
  body: string
  hasMemory: boolean
  filePath: string
}

export interface CommandFrontmatter {
  name: string
  description: string
  'argument-hint'?: string
  'allowed-tools'?: string[]
}

export interface Command {
  slug: string
  filename: string
  directory: string
  frontmatter: CommandFrontmatter
  body: string
  filePath: string
}

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

export type RelationshipType = 'spawns' | 'agent-frontmatter' | 'spawned-by'

export interface Relationship {
  sourceType: 'agent' | 'command' | 'skill' | 'plugin'
  sourceSlug: string
  targetType: 'agent' | 'command' | 'skill' | 'plugin'
  targetSlug: string
  type: RelationshipType
  evidence: string
}

export interface AgentPayload {
  frontmatter: AgentFrontmatter
  body: string
}

export interface CommandPayload {
  frontmatter: CommandFrontmatter
  body: string
  directory?: string
}

export interface Plugin {
  id: string
  name: string
  marketplace: string
  description: string
  version: string
  enabled: boolean
  installedAt: string
  lastUpdated: string
  installPath: string
  skills: string[]
  author?: { name: string; email?: string }
}

export interface SkillFrontmatter {
  name: string
  description: string
  context?: string
  agent?: string
  [key: string]: unknown
}

export interface Skill {
  slug: string
  frontmatter: SkillFrontmatter
  body: string
  filePath: string
  source?: 'local' | 'github' | 'plugin'
  githubRepo?: string
}

export interface AgentSkill {
  slug: string
  frontmatter: SkillFrontmatter
  body: string
  filePath: string
  source: 'standalone' | 'plugin'
  pluginId?: string
  pluginName?: string
}

export interface SkillPayload {
  frontmatter: SkillFrontmatter
  body: string
}

// ── GitHub Imports ──────────────────────────────────

export interface ScannedSkill {
  slug: string
  name: string
  description: string
  category: string | null
  tags: string[]
  filePath: string
  hasSupporting: boolean
  conflict: boolean
}

export interface ScanResult {
  owner: string
  repo: string
  branch: string
  targetPath: string
  skills: ScannedSkill[]
  detectionMethod: 'frontmatter' | 'skills-index'
}

export interface GithubImport {
  owner: string
  repo: string
  url: string
  targetPath: string
  localPath: string
  importedAt: string
  lastChecked: string
  currentSha: string
  remoteSha: string
  selectedSkills: string[]
}

export interface GithubImportsRegistry {
  imports: GithubImport[]
}

// ── Marketplace ─────────────────────────────────────

export interface AvailablePlugin {
  name: string
  description: string
  author?: { name: string; email?: string }
  skillCount: number
  commandCount: number
  installed: boolean
  marketplace: string
}

export interface MarketplaceSource {
  name: string
  sourceType: string
  sourceUrl: string
  lastUpdated: string
}

export interface MarketplaceData {
  marketplaces: Record<string, { plugins: AvailablePlugin[] }>
}

export interface PluginDetail extends Plugin {
  skillDetails: Skill[]
}

export interface SkillInvocation {
  skill: string
  args: string | null
}

export type WizardStep = 1 | 2 | 3

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

// ── Chat ──────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  timestamp: number
}

export type StreamActivity =
  | { type: 'thinking' }
  | { type: 'tool'; name: string; elapsed: number }
  | { type: 'writing' }
  | null

// ── History ───────────────────────────────────────

export interface ToolCallRecord {
  toolName: string
  elapsed: number
  timestamp: number
}

export interface ConversationSession {
  id: string
  agentSlug: string
  messages: ChatMessage[]
  toolCalls: ToolCallRecord[]
  tokenUsage: { input: number; output: number }
  duration: number
  createdAt: string
}

export interface ConversationSummary {
  id: string
  agentSlug: string
  messageCount: number
  firstUserMessage: string
  createdAt: string
}

// ── CLI Terminal ──────────────────────────────────

export interface CliSession {
  id: string
  agentSlug?: string
  workingDir: string
  shell: string
  status: 'active' | 'idle' | 'terminated'
  createdAt: string
  lastActivity: string
  tokenUsage?: TokenUsage
  cost?: number
}

export interface TokenUsage {
  input: number
  output: number
  cached: number
}

export interface CostBreakdown {
  total: number
  input: number
  output: number
  cached: number
}

export interface FileChange {
  path: string
  type: 'created' | 'modified' | 'deleted'
  timestamp: string
  size?: number
  diff?: string
}

export interface ToolCall {
  toolName: string
  timestamp: string
  elapsed?: number
  args?: any
  result?: any
  status: 'running' | 'success' | 'error'
}

export interface ContextMetrics {
  tokens: TokenUsage
  cost: CostBreakdown
  contextWindow: {
    used: number
    total: number
    percentage: number
  }
  files: {
    created: FileChange[]
    modified: FileChange[]
    deleted: FileChange[]
  }
  tools: ToolCall[]
}

export interface CliSettings {
  defaultShell: string
  fontSize: number
  fontFamily: string
  cursorStyle: 'block' | 'underline' | 'bar'
  scrollback: number
  autoSave: boolean
}

// WebSocket message types
export type CliWebSocketMessage =
  | { type: 'execute'; sessionId?: string; agentSlug?: string; workingDir?: string; cols?: number; rows?: number }
  | { type: 'input'; sessionId: string; data: string }
  | { type: 'resize'; sessionId: string; cols: number; rows: number }
  | { type: 'kill'; sessionId: string }

export type CliWebSocketEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'output'; data: string }
  | { type: 'context_update'; metrics: ContextMetrics }
  | { type: 'token_update'; tokens: Partial<TokenUsage> }
  | { type: 'file_change'; change: FileChange }
  | { type: 'tool_call'; tool: ToolCall }
  | { type: 'error'; error: string }
  | { type: 'exit'; exitCode: number }

// ── Claude Code Chat ──────────────────────────────────

export type NormalizedMessageKind =
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'thinking'
  | 'stream_delta'
  | 'stream_end'
  | 'complete'
  | 'error'
  | 'status'
  | 'session_created'

export interface NormalizedMessage {
  kind: NormalizedMessageKind
  id: string
  sessionId: string
  timestamp: string
  role?: 'user' | 'assistant'
  content?: string
  toolName?: string
  toolInput?: any
  toolResult?: any
  isError?: boolean
  exitCode?: number
  stopReason?: string
  metadata?: Record<string, any>
}

export interface ChatSession {
  id: string
  agentSlug?: string
  workingDir?: string
  messages: NormalizedMessage[]
  createdAt: string
  lastActivity: string
  status: 'active' | 'completed' | 'error'
  tokenUsage?: TokenUsage
  messageCount: number
}

export interface ChatSessionSummary {
  id: string
  agentSlug?: string
  messageCount: number
  firstUserMessage: string
  lastActivity: string
  createdAt: string
  status: 'active' | 'completed' | 'error'
}

// WebSocket message types for Chat
export type ChatWebSocketMessage =
  | { type: 'start'; message: string; sessionId?: string; agentSlug?: string; workingDir?: string }
  | { type: 'abort'; sessionId: string }

export type ChatWebSocketEvent =
  | NormalizedMessage
  | { type: 'connected'; sessionId: string }
  | { type: 'disconnected' }
