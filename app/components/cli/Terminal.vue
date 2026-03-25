<script setup lang="ts">
const props = defineProps<{
  executionOptions: {
    agentSlug?: string
    workingDir?: string
  }
  canExecute: boolean
}>()

const { contextMonitor } = inject('contextMonitor', { contextMonitor: null }) as any
const terminalContainer = ref<HTMLElement | null>(null)
const { initTerminal, connect, disconnect, clear, isConnected, connectionError, sessionId } = useTerminal()

const showWelcome = ref(true)

onMounted(() => {
  if (terminalContainer.value) {
    initTerminal(terminalContainer.value, {
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorStyle: 'block',
      scrollback: 10000,
    })
  }
})

function startSession() {
  showWelcome.value = false

  // Connect to WebSocket and start Claude Code CLI session
  connect({
    agentSlug: props.executionOptions.agentSlug,
    workingDir: props.executionOptions.workingDir,
    onMessage: (event) => {
      // Forward events to context monitor
      if (contextMonitor) {
        contextMonitor.handleWebSocketEvent(event)
      }
    },
  })
}

function stopSession() {
  disconnect()
  showWelcome.value = true
}

function clearTerminal() {
  clear()
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 relative">
    <!-- Terminal Header -->
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

        <span v-if="sessionId" class="text-[10px] font-mono" style="color: var(--text-tertiary);">
          {{ sessionId.slice(0, 8) }}
        </span>
      </div>

      <div class="flex items-center gap-1">
        <button
          v-if="!isConnected"
          class="px-2 py-1 rounded text-[11px] font-medium hover-bg"
          style="background: var(--accent); color: white;"
          :disabled="!canExecute"
          @click="startSession"
        >
          <UIcon name="i-lucide-play" class="size-3 inline-block mr-1" />
          Start
        </button>
        <button
          v-else
          class="px-2 py-1 rounded text-[11px] font-medium hover-bg"
          style="background: rgba(205, 49, 49, 0.1); color: #cd3131;"
          @click="stopSession"
        >
          <UIcon name="i-lucide-square" class="size-3 inline-block mr-1" />
          Stop
        </button>

        <button
          class="p-1 rounded hover-bg"
          style="color: var(--text-secondary);"
          title="Clear terminal"
          @click="clearTerminal"
        >
          <UIcon name="i-lucide-trash-2" class="size-3.5" />
        </button>
      </div>
    </div>

    <!-- Welcome Message -->
    <div
      v-if="showWelcome && !isConnected"
      class="flex-1 flex items-center justify-center"
      style="background: var(--surface-base);"
    >
      <div class="text-center max-w-md px-6">
        <div class="size-16 mx-auto mb-4 rounded-full flex items-center justify-center" style="background: var(--surface-raised);">
          <UIcon name="i-lucide-terminal" class="size-8" style="color: var(--text-secondary);" />
        </div>
        <h2 class="text-[16px] font-semibold mb-2" style="color: var(--text-primary);">
          Claude Code Terminal
        </h2>
        <p class="text-[13px] mb-6" style="color: var(--text-secondary);">
          Interactive Claude Code CLI session in your project directory.
          {{ executionOptions.agentSlug ? `Using ${executionOptions.agentSlug} agent.` : 'Running in standalone mode.' }}
        </p>
        <button
          class="px-4 py-2 rounded-lg text-[13px] font-medium"
          style="background: var(--accent); color: white;"
          @click="startSession"
        >
          <UIcon name="i-lucide-play" class="size-4 inline-block mr-2" />
          Start Claude Code Session
        </button>
        <p class="text-[11px] mt-3" style="color: var(--text-tertiary);">
          {{ executionOptions.agentSlug ? 'Agent-aware mode enabled' : 'Standalone mode - select an agent for agent-aware mode' }}
        </p>
      </div>
    </div>

    <!-- Terminal Container -->
    <div
      v-show="!showWelcome || isConnected"
      ref="terminalContainer"
      class="flex-1 overflow-hidden p-2"
      style="background: #1e1e1e;"
    />

    <!-- Connection Error -->
    <div v-if="connectionError" class="absolute bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg" style="background: rgba(205, 49, 49, 0.9); color: white;">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-alert-circle" class="size-4" />
        <span class="text-[12px] font-medium">{{ connectionError }}</span>
      </div>
    </div>
  </div>
</template>
