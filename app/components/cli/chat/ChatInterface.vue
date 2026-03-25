<script setup lang="ts">
const props = defineProps<{
  executionOptions: {
    agentSlug?: string
    workingDir?: string
  }
}>()

const route = useRoute()
const router = useRouter()

const { messages, currentSessionId, createSession, loadSession, sessions, fetchSessions } = useChatSessions()
const { isConnected, isStreaming, streamingText, sendChat, error } = useWebSocketChat()

const inputText = ref('')
const messagesContainerRef = ref<HTMLElement | null>(null)
const sidebarCollapsed = ref(false)
const sidebarTab = ref<'chat' | 'sdk'>('chat')

// Handle session selection from sidebar
async function handleSessionSelect(sessionId: string | null) {
  if (sessionId) {
    // Navigate to existing session
    await router.push(`/cli/${sessionId}`)
  } else {
    // Create new session
    const newSession = await createSession({
      agentSlug: props.executionOptions.agentSlug,
      workingDir: props.executionOptions.workingDir,
    })

    if (newSession) {
      // Navigate to new session
      await router.push(`/cli/${newSession.id}`)
    }
  }
}

// Get session ID from route (params or query for backward compatibility)
const sessionIdFromRoute = computed(() => {
  return route.params.sessionId as string || route.query.session as string || null
})

// Load session from URL on mount or when URL changes
watch(sessionIdFromRoute, async (sessionId) => {
  console.log('[Chat] sessionIdFromRoute changed:', sessionId)

  if (sessionId && typeof sessionId === 'string') {
    currentSessionId.value = sessionId
    console.log('[Chat] Loading session from URL:', sessionId)
    console.log('[Chat] Messages before load:', messages.value.length)

    try {
      const result = await loadSession(sessionId)
      console.log('[Chat] Session loaded successfully:', result)
      console.log('[Chat] Messages after load:', messages.value.length)
      console.log('[Chat] Messages:', messages.value)
    } catch (e) {
      console.error('[Chat] Failed to load session:', e)
    }
  } else {
    // No session in URL - clear current session and show empty state
    currentSessionId.value = null
    console.log('[Chat] No session in URL, showing session selector')
  }
}, { immediate: true })

// Fetch sessions list on mount
onMounted(async () => {
  await fetchSessions()
})

// Auto-scroll to bottom when new messages arrive
watch([messages, streamingText], () => {
  nextTick(() => {
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
    }
  })
})

function handleSendMessage() {
  if (!inputText.value.trim() || isStreaming.value || !currentSessionId.value) return

  const success = sendChat(inputText.value, {
    sessionId: currentSessionId.value,
    agentSlug: props.executionOptions.agentSlug,
    workingDir: props.executionOptions.workingDir,
  })

  if (success) {
    inputText.value = ''
  }
}
</script>

<template>
  <div class="flex-1 flex min-h-0">
    <!-- Left Sidebar - Session List -->
    <div
      class="shrink-0 flex flex-col border-r transition-all duration-300"
      :style="{
        width: sidebarCollapsed ? '56px' : '320px',
        borderColor: 'var(--border-subtle)',
        background: 'var(--surface)',
      }"
    >
      <!-- Sidebar Header -->
      <div class="shrink-0 px-3 py-3 border-b flex items-center justify-between gap-2" style="border-color: var(--border-subtle);">
        <div v-if="!sidebarCollapsed" class="flex-1 min-w-0">
          <h3 class="text-[14px] font-semibold truncate" style="color: var(--text-primary);">
            {{ sidebarTab === 'chat' ? 'Chat Sessions' : 'SDK Projects' }}
          </h3>
        </div>

        <button
          class="p-1.5 rounded-lg hover-bg transition-all shrink-0"
          style="background: var(--surface-raised);"
          @click="sidebarCollapsed = !sidebarCollapsed"
          :title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <UIcon
            :name="sidebarCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
            class="size-4"
            style="color: var(--text-secondary);"
          />
        </button>
      </div>

      <!-- Sidebar Content (when expanded) -->
      <template v-if="!sidebarCollapsed">
        <!-- Tabs -->
        <div class="shrink-0 flex gap-1 p-2 border-b" style="border-color: var(--border-subtle);">
          <button
            class="flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all"
            :style="{
              background: sidebarTab === 'chat' ? 'var(--accent)' : 'transparent',
              color: sidebarTab === 'chat' ? 'white' : 'var(--text-secondary)',
            }"
            @click="sidebarTab = 'chat'"
          >
            <UIcon name="i-lucide-message-circle" class="size-3 inline-block mr-1" />
            Chats
          </button>
          <button
            class="flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all"
            :style="{
              background: sidebarTab === 'sdk' ? 'var(--accent)' : 'transparent',
              color: sidebarTab === 'sdk' ? 'white' : 'var(--text-secondary)',
            }"
            @click="sidebarTab = 'sdk'"
          >
            <UIcon name="i-lucide-folder" class="size-3 inline-block mr-1" />
            SDK
          </button>
        </div>

        <!-- New Chat Button (only for chat tab) -->
        <div v-if="sidebarTab === 'chat'" class="shrink-0 p-2 border-b" style="border-color: var(--border-subtle);">
          <button
            class="w-full px-3 py-2 rounded-lg text-[12px] font-medium hover-bg transition-all flex items-center justify-center gap-2"
            style="background: var(--accent); color: white;"
            @click="handleSessionSelect(null)"
          >
            <UIcon name="i-lucide-plus" class="size-3.5" />
            New Chat
          </button>
        </div>

        <!-- Sessions List -->
        <div class="flex-1 overflow-y-auto">
          <SessionSelector
            :compact="true"
            :session-type="sidebarTab"
            @select-session="handleSessionSelect"
          />
        </div>
      </template>

      <!-- Collapsed Sidebar Icons -->
      <template v-else>
        <div class="flex-1 flex flex-col items-center gap-2 pt-3">
          <button
            class="p-2 rounded-lg hover-bg transition-all"
            :style="{
              background: sidebarTab === 'chat' ? 'var(--accent)' : 'transparent',
            }"
            :title="'Chat Sessions'"
            @click="sidebarTab = 'chat'; sidebarCollapsed = false"
          >
            <UIcon
              name="i-lucide-message-circle"
              class="size-4"
              :style="{ color: sidebarTab === 'chat' ? 'white' : 'var(--text-secondary)' }"
            />
          </button>
          <button
            class="p-2 rounded-lg hover-bg transition-all"
            :style="{
              background: sidebarTab === 'sdk' ? 'var(--accent)' : 'transparent',
            }"
            :title="'SDK Projects'"
            @click="sidebarTab = 'sdk'; sidebarCollapsed = false"
          >
            <UIcon
              name="i-lucide-folder"
              class="size-4"
              :style="{ color: sidebarTab === 'sdk' ? 'white' : 'var(--text-secondary)' }"
            />
          </button>
          <div class="h-px w-8 my-2" style="background: var(--border-subtle);" />
          <button
            class="p-2 rounded-lg transition-all"
            style="background: var(--accent);"
            :title="'New Chat'"
            @click="sidebarCollapsed = false; sidebarTab = 'chat'; handleSessionSelect(null)"
          >
            <UIcon name="i-lucide-plus" class="size-4" style="color: white;" />
          </button>
        </div>
      </template>
    </div>

    <!-- Right Panel - Chat Interface -->
    <div class="flex-1 flex flex-col min-h-0">
      <!-- Header -->
      <div class="shrink-0 flex items-center justify-between px-4 py-2 border-b" style="border-color: var(--border-subtle);">
        <div class="flex items-center gap-2">
          <div v-if="isConnected" class="flex items-center gap-2 px-2 py-1 rounded text-[11px] font-medium" style="background: rgba(13, 188, 121, 0.1); color: #0dbc79;">
            <div class="size-1.5 rounded-full animate-pulse" style="background: #0dbc79;" />
            Connected
          </div>
          <div v-else class="flex items-center gap-2 px-2 py-1 rounded text-[11px] font-medium" style="background: var(--surface-raised); color: var(--text-disabled);">
            <div class="size-1.5 rounded-full" style="background: var(--text-disabled);" />
            Disconnected
          </div>

          <div v-if="isStreaming" class="flex items-center gap-2 px-2 py-1 rounded text-[11px] font-medium" style="background: rgba(229, 169, 62, 0.1); color: var(--accent);">
            <UIcon name="i-lucide-loader-2" class="size-3 animate-spin" />
            Generating...
          </div>
        </div>

        <span v-if="currentSessionId" class="text-[10px] font-mono" style="color: var(--text-tertiary);">
          {{ currentSessionId.slice(0, 8) }}
        </span>
      </div>

      <!-- Messages -->
      <div
        ref="messagesContainerRef"
        class="flex-1 overflow-y-auto p-4 space-y-4"
        style="background: var(--surface-base);"
      >
        <!-- Empty state -->
        <div v-if="messages.length === 0 && !isStreaming" class="flex items-center justify-center h-full">
          <div class="text-center max-w-md">
            <div class="size-16 mx-auto mb-4 rounded-full flex items-center justify-center" style="background: var(--surface-raised);">
              <UIcon name="i-lucide-message-circle" class="size-8" style="color: var(--text-secondary);" />
            </div>
            <h2 class="text-[16px] font-semibold mb-2" style="color: var(--text-primary);">
              {{ currentSessionId ? 'Start a Conversation' : 'No Session Selected' }}
            </h2>
            <p class="text-[13px]" style="color: var(--text-secondary);">
              {{ currentSessionId ? 'Ask Claude anything. Type your message below to begin.' : 'Click "New Chat" or select a session from the sidebar to start.' }}
            </p>
          </div>
        </div>

        <!-- Message list -->
        <ChatMessages :messages="messages" :streaming-text="streamingText" :is-streaming="isStreaming" />
      </div>

      <!-- Input -->
      <div class="shrink-0 border-t" style="border-color: var(--border-subtle);">
        <CliChatInput
          v-model="inputText"
          :disabled="!currentSessionId || !isConnected || isStreaming"
          :is-streaming="isStreaming"
          @send="handleSendMessage"
        />
      </div>

      <!-- Error banner -->
      <div v-if="error" class="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg" style="background: rgba(205, 49, 49, 0.9); color: white;">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-alert-circle" class="size-4" />
          <span class="text-[12px] font-medium">{{ error }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
