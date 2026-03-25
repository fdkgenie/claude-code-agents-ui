<script setup lang="ts">
import type { ChatSessionSummary } from '~/types'

const props = defineProps<{
  compact?: boolean // Compact mode for sidebar
  sessionType?: 'chat' | 'sdk' // Control which sessions to show (for parent component)
}>()

const emit = defineEmits<{
  selectSession: [sessionId: string | null]
}>()

// Session type: controlled by parent if provided, otherwise internal state
const internalSessionType = ref<'chat' | 'sdk'>('chat')
const activeSessionType = computed(() => props.sessionType || internalSessionType.value)

// Chat sessions state
const chatSessions = ref<ChatSessionSummary[]>([])
const loadingChatSessions = ref(false)

// SDK sessions state
const projects = ref<any[]>([])
const expandedProjects = ref<Set<string>>(new Set()) // Track which projects are expanded
const projectSessions = ref<Map<string, any[]>>(new Map()) // Store sessions by project
const projectSessionsVisible = ref<Map<string, number>>(new Map()) // Track visible session count per project
const loadingProjects = ref(false)
const loadingProjectSessions = ref<Set<string>>(new Set()) // Track which projects are loading sessions

// Currently focused session (for highlighting)
const focusedSessionId = ref<string | null>(null)
const route = useRoute()

// Initialize focused session from URL params (or query for backward compatibility)
watchEffect(() => {
  const sessionId = (route.params.sessionId as string) || (route.query.session as string) || null
  focusedSessionId.value = sessionId
})

// Load on mount
onMounted(async () => {
  await loadChatSessions()
  await loadProjects()
})

async function loadChatSessions() {
  loadingChatSessions.value = true
  try {
    chatSessions.value = await $fetch<ChatSessionSummary[]>('/api/chat-ws/sessions')
  } catch (error) {
    console.error('Error loading chat sessions:', error)
    chatSessions.value = []
  } finally {
    loadingChatSessions.value = false
  }
}

async function loadProjects() {
  loadingProjects.value = true
  try {
    projects.value = await $fetch('/api/claude/projects')
  } catch (error) {
    console.error('Error loading projects:', error)
  } finally {
    loadingProjects.value = false
  }
}

// Toggle project expanded/collapsed state
async function toggleProject(projectName: string) {
  if (expandedProjects.value.has(projectName)) {
    // Collapse the project
    expandedProjects.value.delete(projectName)
  } else {
    // Expand the project and load sessions if not already loaded
    expandedProjects.value.add(projectName)

    if (!projectSessions.value.has(projectName)) {
      await loadProjectSessions(projectName)
    }
  }
}

// Load sessions for a specific project
async function loadProjectSessions(projectName: string) {
  loadingProjectSessions.value.add(projectName)
  try {
    const sessions = await $fetch(`/api/claude/sessions/${projectName}`)
    projectSessions.value.set(projectName, sessions)
    projectSessionsVisible.value.set(projectName, 5) // Show 5 initially
  } catch (error) {
    console.error('Error loading SDK sessions:', error)
    projectSessions.value.set(projectName, [])
  } finally {
    loadingProjectSessions.value.delete(projectName)
  }
}

// Show more sessions for a project
function showMoreSessions(projectName: string) {
  const currentVisible = projectSessionsVisible.value.get(projectName) || 5
  projectSessionsVisible.value.set(projectName, currentVisible + 5)
}

// Get visible sessions for a project
function getVisibleSessions(projectName: string) {
  const sessions = projectSessions.value.get(projectName) || []
  const visibleCount = projectSessionsVisible.value.get(projectName) || 5
  return sessions.slice(0, visibleCount)
}

// Check if a project has more sessions to show
function hasMoreSessions(projectName: string) {
  const sessions = projectSessions.value.get(projectName) || []
  const visibleCount = projectSessionsVisible.value.get(projectName) || 5
  return sessions.length > visibleCount
}

function startNewSession() {
  focusedSessionId.value = null
  emit('selectSession', null)
}

function resumeSession(sessionId: string) {
  focusedSessionId.value = sessionId
  emit('selectSession', sessionId)
}
</script>

<template>
  <div :class="compact ? '' : 'flex-1 overflow-y-auto p-6'" :style="compact ? '' : 'background: var(--surface-base);'">
    <div :class="compact ? '' : 'max-w-3xl mx-auto'">
      <!-- Header (only in non-compact mode) -->
      <div v-if="!compact" class="mb-6">
        <h2 class="text-[20px] font-semibold mb-2" style="color: var(--text-primary); font-family: var(--font-display);">
          Session Explorer
        </h2>
        <p class="text-[13px]" style="color: var(--text-secondary);">
          Select an existing session to resume or start a new conversation
        </p>
      </div>

      <!-- Session Type Tabs (only in non-compact mode when not controlled by parent) -->
      <div v-if="!compact && !props.sessionType" class="flex items-center gap-2 mb-4 p-1 rounded-lg" style="background: var(--surface-raised);">
        <button
          class="flex-1 px-3 py-2 rounded-md text-[13px] font-medium transition-all"
          :style="{
            background: internalSessionType === 'chat' ? 'var(--accent)' : 'transparent',
            color: internalSessionType === 'chat' ? 'white' : 'var(--text-secondary)',
          }"
          @click="internalSessionType = 'chat'"
        >
          <UIcon name="i-lucide-message-circle" class="size-3.5 inline-block mr-1" />
          Chat Sessions
          <span v-if="chatSessions.length > 0" class="ml-1 opacity-70">({{ chatSessions.length }})</span>
        </button>
        <button
          class="flex-1 px-3 py-2 rounded-md text-[13px] font-medium transition-all"
          :style="{
            background: internalSessionType === 'sdk' ? 'var(--accent)' : 'transparent',
            color: internalSessionType === 'sdk' ? 'white' : 'var(--text-secondary)',
          }"
          @click="internalSessionType = 'sdk'"
        >
          <UIcon name="i-lucide-folder" class="size-3.5 inline-block mr-1" />
          SDK Projects
          <span v-if="projects.length > 0" class="ml-1 opacity-70">({{ projects.length }})</span>
        </button>
      </div>

      <!-- New Session Button (only in non-compact mode, compact has it in parent) -->
      <div v-if="!compact" class="mb-4">
        <button
          class="w-full px-4 py-3 rounded-lg text-[13px] font-medium hover-bg transition-all flex items-center justify-center gap-2"
          style="background: var(--accent); color: white;"
          @click="startNewSession"
        >
          <UIcon name="i-lucide-plus" class="size-4" />
          Start New Session
        </button>
      </div>

      <!-- Chat Sessions Tab -->
      <div v-if="activeSessionType === 'chat'" :class="compact ? 'p-2' : ''">
        <!-- Loading State -->
        <div v-if="loadingChatSessions" :class="compact ? 'flex items-center justify-center py-8' : 'flex items-center justify-center py-16'">
          <UIcon name="i-lucide-loader-2" :class="compact ? 'size-4' : 'size-6'" class="animate-spin" style="color: var(--text-disabled);" />
        </div>

        <!-- Empty State -->
        <div v-else-if="chatSessions.length === 0" :class="compact ? 'text-center py-8 px-2' : 'text-center py-16 rounded-lg'" :style="compact ? '' : 'background: var(--surface-raised);'">
          <UIcon name="i-lucide-message-circle-off" :class="compact ? 'size-8 mb-2' : 'size-12 mb-4'" style="color: var(--text-disabled); opacity: 0.5;" />
          <p :class="compact ? 'text-[12px]' : 'text-[14px] mb-2'" style="color: var(--text-primary);">
            No chat sessions yet
          </p>
          <p v-if="!compact" class="text-[13px]" style="color: var(--text-secondary);">
            Start your first conversation with Claude
          </p>
        </div>

        <!-- Chat Sessions List -->
        <div v-else :class="compact ? '' : 'space-y-2'">
          <div v-if="!compact" class="text-[12px] font-medium mb-3" style="color: var(--text-secondary);">
            Recent Sessions ({{ chatSessions.length }})
          </div>
          <div :class="compact ? 'space-y-1.5' : 'grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto'">
            <button
              v-for="session in chatSessions"
              :key="session.id"
              :class="compact ? 'w-full p-2 rounded-lg text-left hover-bg transition-all' : 'p-3 rounded-lg border text-left hover-bg transition-all'"
              :style="{
                background: focusedSessionId === session.id ? 'var(--accent-muted)' : 'var(--surface-raised)',
                borderColor: focusedSessionId === session.id ? 'var(--accent)' : 'var(--border-subtle)',
                borderWidth: compact ? '0' : '1px',
              }"
              @click="resumeSession(session.id)"
            >
              <div :class="compact ? 'mb-1' : 'flex items-start justify-between gap-3 mb-2'">
                <span :class="compact ? 'text-[12px] line-clamp-1 block' : 'text-[13px] line-clamp-2 flex-1'" style="color: var(--text-primary);">
                  {{ session.firstUserMessage || '(No message)' }}
                </span>
                <span v-if="!compact" class="text-[10px] shrink-0" style="color: var(--text-tertiary);">
                  {{ new Date(session.lastActivity).toLocaleDateString() }}
                </span>
              </div>
              <div :class="compact ? 'flex items-center gap-2 text-[10px]' : 'flex items-center gap-3 text-[11px]'" style="color: var(--text-secondary);">
                <div class="flex items-center gap-1">
                  <UIcon :class="compact ? 'size-2.5' : 'size-3'" name="i-lucide-message-circle" />
                  <span>{{ session.messageCount }}</span>
                </div>
                <div v-if="!compact" class="flex items-center gap-1">
                  <UIcon name="i-lucide-clock" class="size-3" />
                  <span>{{ new Date(session.lastActivity).toLocaleTimeString() }}</span>
                </div>
                <div v-if="session.agentSlug && !compact" class="flex items-center gap-1">
                  <UIcon name="i-lucide-cpu" class="size-3" />
                  <span>{{ session.agentSlug }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <div
                    :class="compact ? 'size-1' : 'size-1.5'"
                    class="rounded-full"
                    :style="{
                      background: session.status === 'completed' ? '#0dbc79' : session.status === 'error' ? '#cd3131' : 'var(--accent)'
                    }"
                  />
                  <span v-if="!compact" class="capitalize">{{ session.status }}</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- SDK Sessions Tab -->
      <div v-else-if="activeSessionType === 'sdk'" :class="compact ? 'p-2' : ''">
        <!-- Loading Projects -->
        <div v-if="loadingProjects" :class="compact ? 'flex items-center justify-center py-8' : 'flex items-center justify-center py-16'">
          <UIcon name="i-lucide-loader-2" :class="compact ? 'size-4' : 'size-6'" class="animate-spin" style="color: var(--text-disabled);" />
        </div>

        <!-- No Projects -->
        <div v-else-if="projects.length === 0" :class="compact ? 'text-center py-8 px-2' : 'text-center py-16'">
          <UIcon name="i-lucide-folder-x" :class="compact ? 'size-8 mb-2' : 'size-12 mb-4'" style="color: var(--text-disabled); opacity: 0.5;" />
          <p :class="compact ? 'text-[12px]' : 'text-[14px]'" style="color: var(--text-secondary);">
            No Claude Code projects found
          </p>
        </div>

        <!-- Projects List (Collapsible) -->
        <div v-else :class="compact ? 'space-y-1.5' : 'space-y-2'">
          <div v-if="!compact" class="text-[12px] font-medium mb-3" style="color: var(--text-secondary);">
            Projects ({{ projects.length }})
          </div>

          <div v-for="project in projects" :key="project.name" :class="compact ? '' : 'border rounded-lg'" :style="compact ? '' : 'border-color: var(--border-subtle);'">
            <!-- Project Header (Clickable to expand/collapse) -->
            <button
              :class="compact ? 'w-full p-2 rounded-lg text-left hover-bg transition-all' : 'w-full p-3 text-left hover-bg transition-all rounded-lg'"
              :style="compact ? 'background: var(--surface-raised);' : 'background: var(--surface-raised);'"
              :title="compact ? project.path : undefined"
              @click="toggleProject(project.name)"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <UIcon
                    :name="expandedProjects.has(project.name) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                    :class="compact ? 'size-3' : 'size-4'"
                    class="shrink-0 transition-transform"
                    style="color: var(--text-secondary);"
                  />
                  <UIcon name="i-lucide-folder" :class="compact ? 'size-3' : 'size-4'" class="shrink-0" style="color: var(--accent);" />
                  <div class="min-w-0 flex-1">
                    <div :class="compact ? 'text-[12px] truncate' : 'text-[13px] font-medium truncate'" style="color: var(--text-primary);">
                      {{ project.displayName }}
                    </div>
                    <div v-if="compact" class="text-[9px] truncate" style="color: var(--text-tertiary);">
                      {{ project.path }}
                    </div>
                  </div>
                </div>
                <span :class="compact ? 'text-[10px]' : 'text-[11px]'" class="shrink-0" style="color: var(--text-tertiary);">
                  {{ project.sessionsCount }}
                </span>
              </div>
              <p v-if="!compact" class="text-[10px] mt-1 ml-8 truncate" style="color: var(--text-secondary);">{{ project.path }}</p>
            </button>

            <!-- Sessions List (Shown when expanded) -->
            <div v-if="expandedProjects.has(project.name)" :class="compact ? 'mt-1 ml-2 space-y-1' : 'p-2 pt-0 space-y-1.5'">
              <!-- Loading Sessions -->
              <div v-if="loadingProjectSessions.has(project.name)" class="flex items-center justify-center py-6">
                <UIcon name="i-lucide-loader-2" :class="compact ? 'size-3' : 'size-4'" class="animate-spin" style="color: var(--text-disabled);" />
              </div>

              <!-- No Sessions -->
              <div v-else-if="(projectSessions.get(project.name) || []).length === 0" :class="compact ? 'text-center py-4 px-2' : 'text-center py-6 rounded-lg'" :style="compact ? '' : 'background: var(--surface-base);'">
                <UIcon name="i-lucide-message-circle-off" :class="compact ? 'size-5 mb-1' : 'size-6 mb-2'" style="color: var(--text-disabled); opacity: 0.5;" />
                <p :class="compact ? 'text-[10px]' : 'text-[11px]'" style="color: var(--text-secondary);">
                  No sessions found
                </p>
              </div>

              <!-- Sessions -->
              <template v-else>
                <button
                  v-for="session in getVisibleSessions(project.name)"
                  :key="session.id"
                  :class="compact ? 'w-full p-2 rounded-lg text-left hover-bg transition-all' : 'w-full p-2.5 rounded-lg text-left hover-bg transition-all border'"
                  :style="{
                    background: focusedSessionId === session.id ? 'var(--accent-muted)' : 'var(--surface-base)',
                    borderColor: focusedSessionId === session.id ? 'var(--accent)' : 'var(--border-subtle)',
                    borderWidth: compact ? '0' : '1px',
                  }"
                  @click="resumeSession(session.id)"
                >
                  <div :class="compact ? 'mb-1' : 'flex items-start justify-between gap-2 mb-1.5'">
                    <span :class="compact ? 'text-[11px] line-clamp-1 block' : 'text-[12px] line-clamp-2 flex-1'" style="color: var(--text-primary);">
                      {{ session.summary || '(No summary)' }}
                    </span>
                    <span v-if="!compact" class="text-[9px] shrink-0" style="color: var(--text-tertiary);">
                      {{ new Date(session.lastActivity).toLocaleDateString() }}
                    </span>
                  </div>
                  <div :class="compact ? 'flex items-center gap-2 text-[9px]' : 'flex items-center gap-2 text-[10px]'" style="color: var(--text-secondary);">
                    <div class="flex items-center gap-1">
                      <UIcon :class="compact ? 'size-2' : 'size-2.5'" name="i-lucide-message-circle" />
                      <span>{{ session.messageCount }}</span>
                    </div>
                    <div v-if="!compact" class="flex items-center gap-1">
                      <UIcon class="size-2.5" name="i-lucide-clock" />
                      <span>{{ new Date(session.lastActivity).toLocaleTimeString() }}</span>
                    </div>
                  </div>
                </button>

                <!-- Show More Button -->
                <button
                  v-if="hasMoreSessions(project.name)"
                  :class="compact ? 'w-full py-1.5 px-2 rounded-lg text-[10px] font-medium hover-bg transition-all' : 'w-full py-2 px-3 rounded-lg text-[11px] font-medium hover-bg transition-all border'"
                  :style="compact ? 'background: var(--surface-base); color: var(--accent);' : 'background: var(--surface-base); color: var(--accent); border-color: var(--border-subtle);'"
                  @click.stop="showMoreSessions(project.name)"
                >
                  <UIcon :class="compact ? 'size-2.5 inline-block mr-1' : 'size-3 inline-block mr-1'" name="i-lucide-chevron-down" />
                  Show more ({{ (projectSessions.get(project.name) || []).length - (projectSessionsVisible.get(project.name) || 5) }} remaining)
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
