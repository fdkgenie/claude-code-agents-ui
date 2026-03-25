<script setup lang="ts">
const { sessions, fetchSessions, terminateSession } = useCliExecution()

onMounted(() => {
  fetchSessions()
})

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

async function handleTerminate(id: string) {
  if (confirm('Are you sure you want to terminate this session?')) {
    await terminateSession(id)
  }
}
</script>

<template>
  <div class="p-4">
    <!-- Active Sessions -->
    <div v-if="sessions.active.length > 0" class="mb-6">
      <h3 class="text-[12px] font-semibold mb-3 px-1" style="color: var(--text-secondary);">
        Active Sessions
      </h3>
      <div class="space-y-2">
        <div
          v-for="session in sessions.active"
          :key="session.id"
          class="p-3 rounded-lg"
          style="background: var(--surface-raised);"
        >
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-center gap-2">
              <div class="size-2 rounded-full animate-pulse" style="background: #0dbc79;" />
              <span class="text-[12px] font-mono" style="color: var(--text-primary);">
                {{ session.id.slice(0, 8) }}
              </span>
            </div>
            <button
              class="p-1 rounded hover-bg"
              style="color: var(--text-tertiary);"
              title="Terminate session"
              @click="handleTerminate(session.id)"
            >
              <UIcon name="i-lucide-x" class="size-3.5" />
            </button>
          </div>

          <div v-if="session.agentSlug" class="text-[11px] mb-1" style="color: var(--text-secondary);">
            <UIcon name="i-lucide-cpu" class="size-3 inline-block mr-1" />
            {{ session.agentSlug }}
          </div>

          <div class="text-[10px] font-mono" style="color: var(--text-tertiary);">
            {{ session.workingDir }}
          </div>

          <div class="mt-2 pt-2 border-t flex items-center justify-between" style="border-color: var(--border-subtle);">
            <span class="text-[10px]" style="color: var(--text-tertiary);">
              {{ formatDate(session.createdAt) }}
            </span>
            <span v-if="session.cost" class="text-[10px] font-mono" style="color: var(--accent);">
              ${{ session.cost.toFixed(4) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Session History -->
    <div v-if="sessions.history.length > 0">
      <h3 class="text-[12px] font-semibold mb-3 px-1" style="color: var(--text-secondary);">
        Recent Sessions
      </h3>
      <div class="space-y-2">
        <div
          v-for="session in sessions.history.slice(0, 10)"
          :key="session.id"
          class="p-3 rounded-lg"
          style="background: var(--surface-raised);"
        >
          <div class="flex items-start justify-between gap-3 mb-2">
            <span class="text-[12px] font-mono" style="color: var(--text-primary);">
              {{ session.id.slice(0, 8) }}
            </span>
            <span class="text-[10px] px-1.5 py-0.5 rounded" style="background: var(--surface-base); color: var(--text-secondary);">
              {{ session.status }}
            </span>
          </div>

          <div v-if="session.agentSlug" class="text-[11px] mb-1" style="color: var(--text-secondary);">
            <UIcon name="i-lucide-cpu" class="size-3 inline-block mr-1" />
            {{ session.agentSlug }}
          </div>

          <div class="text-[10px] font-mono truncate" style="color: var(--text-tertiary);">
            {{ session.workingDir }}
          </div>

          <div class="mt-2 pt-2 border-t flex items-center justify-between" style="border-color: var(--border-subtle);">
            <span class="text-[10px]" style="color: var(--text-tertiary);">
              {{ formatDate(session.createdAt) }}
            </span>
            <span v-if="session.cost" class="text-[10px] font-mono" style="color: var(--accent);">
              ${{ session.cost.toFixed(4) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="sessions.active.length === 0 && sessions.history.length === 0" class="text-center py-12">
      <UIcon name="i-lucide-history" class="size-12 mx-auto mb-3" style="color: var(--text-disabled);" />
      <p class="text-[13px]" style="color: var(--text-secondary);">No sessions yet</p>
      <p class="text-[11px] mt-1" style="color: var(--text-tertiary);">Start a terminal session to see it here</p>
    </div>
  </div>
</template>
